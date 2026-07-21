-- PHÉNIX 360 — Installation complète du schéma (à coller dans Supabase → SQL Editor)
-- ============================================================================
-- Script UNIQUE et autonome pour une base Supabase NEUVE : crée toute la
-- structure du « classeur » (chantiers, membres, journal), la sécurité (RLS,
-- miroir de core.isVisibleToClient) et le stockage des photos/documents.
--
-- Équivalent consolidé des migrations `supabase/migrations/*` + alignement M2,
-- mais avec les énumérations créées COMPLÈTES d'emblée (aucun ALTER TYPE) : donc
-- exécutable d'un seul bloc dans l'éditeur SQL de Supabase, sans erreur de
-- transaction. Idempotent autant que possible (IF NOT EXISTS / on conflict).
-- Sur Supabase, les schémas `auth` et `storage` existent déjà nativement.

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Énumérations (miroir des unions de @phenix360/core) — valeurs FINALES
-- ----------------------------------------------------------------------------
do $$ begin
  create type member_role as enum ('compagnon', 'equipe', 'sous_traitant', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type as enum (
    'compte_rendu', 'photo', 'document', 'demande',
    'decision', 'reserve', 'levee', 'action', 'communication'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_visibility as enum ('client', 'interne');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_state as enum ('brouillon', 'publie', 'ouverte', 'traitee', 'close');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_step as enum ('gros_oeuvre', 'second_oeuvre', 'finitions', 'reception');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum (
    'pas_commence', 'en_cours', 'pre_reception', 'levee_reserves', 'cloture'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- project (≡ chantier) — un projet = un journal
-- ----------------------------------------------------------------------------
create table if not exists project (
  id            uuid primary key default gen_random_uuid(),
  code          text,                                          -- code chantier AA-VV-NNN (posé par l'app)
  name          text not null,
  client_id     uuid references auth.users on delete set null,
  address       text,
  status        project_status not null default 'pas_commence',
  current_step  project_step,                                  -- cache dérivé du dernier CR publié
  created_at    timestamptz not null default now()
);
create unique index if not exists project_code_key on project (code);

-- ----------------------------------------------------------------------------
-- project_member — qui a accès, et avec quel rôle (pilote la RLS)
-- ----------------------------------------------------------------------------
create table if not exists project_member (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references project(id) on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  role        member_role not null,
  created_at  timestamptz not null default now(),
  unique (project_id, user_id)
);
create index if not exists project_member_user_idx on project_member (user_id);

-- ----------------------------------------------------------------------------
-- event — la colonne vertébrale (enveloppe commune + contenu typé jsonb)
-- ----------------------------------------------------------------------------
create table if not exists event (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references project(id) on delete cascade,
  type          event_type not null,
  author_id     uuid references auth.users on delete set null,
  author_role   member_role not null,
  visibility    event_visibility not null default 'interne',
  state         event_state not null,
  capture_id    uuid,
  created_at    timestamptz not null default now(),
  published_by  uuid references auth.users on delete set null,
  published_at  timestamptz,
  content       jsonb not null,
  constraint event_state_for_type check (
    case
      when type = 'demande' then state in ('ouverte', 'traitee', 'close')
      else state in ('brouillon', 'publie')
    end
  ),
  constraint event_published_pair check ((published_at is null) = (published_by is null))
);

create index if not exists event_project_created_idx on event (project_id, created_at desc);
create index if not exists event_project_type_idx    on event (project_id, type);
create index if not exists event_capture_idx         on event (capture_id);

-- ----------------------------------------------------------------------------
-- Cache d'avancement : project.current_step = étape du dernier CR publié
-- ----------------------------------------------------------------------------
create or replace function set_project_current_step()
returns trigger language plpgsql as $$
declare target uuid := coalesce(new.project_id, old.project_id);
begin
  update project p set current_step = (
    select (e.content ->> 'etapeConfirmee')::project_step
    from event e
    where e.project_id = target
      and e.type = 'compte_rendu' and e.state = 'publie'
      and e.content ? 'etapeConfirmee' and (e.content ->> 'etapeConfirmee') is not null
    order by e.created_at desc limit 1
  ) where p.id = target;
  return null;
end $$;

drop trigger if exists trg_event_current_step on event;
create trigger trg_event_current_step
after insert or update or delete on event
for each row execute function set_project_current_step();

-- ----------------------------------------------------------------------------
-- Helpers d'appartenance (security definer pour éviter la récursion RLS)
-- ----------------------------------------------------------------------------
create or replace function app_is_member(p_project uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from project_member m where m.project_id = p_project and m.user_id = auth.uid());
$$;

create or replace function app_has_role(p_project uuid, p_role member_role)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from project_member m
    where m.project_id = p_project and m.user_id = auth.uid() and m.role = p_role);
$$;

create or replace function app_is_internal(p_project uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from project_member m
    where m.project_id = p_project and m.user_id = auth.uid() and m.role in ('compagnon', 'equipe'));
$$;

-- ----------------------------------------------------------------------------
-- RLS — la visibilité appliquée à la SOURCE (miroir de core)
-- ----------------------------------------------------------------------------
alter table project enable row level security;
drop policy if exists project_select_member on project;
create policy project_select_member on project
  for select using (app_is_member(id) or client_id = auth.uid());
drop policy if exists project_update_internal on project;
create policy project_update_internal on project
  for update using (app_is_internal(id)) with check (app_is_internal(id));

alter table project_member enable row level security;
drop policy if exists project_member_select_member on project_member;
create policy project_member_select_member on project_member
  for select using (app_is_member(project_id));

alter table event enable row level security;
drop policy if exists event_select_internal on event;
create policy event_select_internal on event
  for select using (app_is_internal(project_id));
drop policy if exists event_select_client on event;
create policy event_select_client on event
  for select using (
    visibility = 'client'
    and app_has_role(project_id, 'client')
    and (
      case
        when type = 'demande' then (
          case
            when (content ->> 'destinataire') = 'client' then state in ('ouverte', 'traitee', 'close')
            else state in ('traitee', 'close')
          end
        )
        else state = 'publie'
      end
    )
  );
drop policy if exists event_insert_internal on event;
create policy event_insert_internal on event
  for insert with check (app_is_internal(project_id) and author_id = auth.uid());
drop policy if exists event_update_internal on event;
create policy event_update_internal on event
  for update using (app_is_internal(project_id)) with check (app_is_internal(project_id));

-- ----------------------------------------------------------------------------
-- Storage — bucket PUBLIC des pièces jointes (photos / documents), M5
-- ----------------------------------------------------------------------------
-- Bucket PUBLIC (lecture par URL) : sert l'app interne ET la page cliente
-- anonyme (lien+code) sans fonction serveur. Les chemins sont des UUID
-- aléatoires (URL-capacité) : seules les personnes à qui l'URL est transmise
-- (via une réponse déjà gardée par la RLS / le code) peuvent l'ouvrir.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update set public = true;

-- L'ÉCRITURE reste réservée aux membres INTERNES du chantier (dossier = projet).
drop policy if exists "attachments write internal" on storage.objects;
create policy "attachments write internal" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and app_is_internal(((storage.foldername(name))[1])::uuid));
-- La lecture publique est portée par le bucket (public=true) : pas de policy select.
drop policy if exists "attachments read members" on storage.objects;

-- ----------------------------------------------------------------------------
-- app_kv — coffre clé→valeur privé par utilisateur (satellites, M4)
-- Miroir durable des « satellites » du conducteur (préparation, contacts, Le Fil,
-- réglages, accusés de lecture) pour qu'ils le suivent d'un appareil à l'autre.
-- ----------------------------------------------------------------------------
create table if not exists app_kv (
  user_id    uuid not null references auth.users on delete cascade,
  k          text not null,
  v          text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);

alter table app_kv enable row level security;

drop policy if exists app_kv_select_own on app_kv;
create policy app_kv_select_own on app_kv
  for select to authenticated using (user_id = auth.uid());

drop policy if exists app_kv_insert_own on app_kv;
create policy app_kv_insert_own on app_kv
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists app_kv_update_own on app_kv;
create policy app_kv_update_own on app_kv
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists app_kv_delete_own on app_kv;
create policy app_kv_delete_own on app_kv
  for delete to authenticated using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Espace client par LIEN + CODE (M7.1, lecture seule)
-- Le client (sans compte) ouvre …/#/c/<projectId> et saisit un code vérifié
-- côté serveur. Ne renvoie que ce qui est visible au client (miroir RLS).
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

create table if not exists project_client_access (
  project_id uuid primary key references project(id) on delete cascade,
  code_hash  text not null,
  updated_at timestamptz not null default now()
);
alter table project_client_access enable row level security;
-- RLS active sans policy : accessible uniquement via les fonctions definer.

create or replace function set_client_access(p_project uuid, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not app_is_internal(p_project) then
    raise exception 'forbidden: not internal member' using errcode = '42501';
  end if;
  if length(coalesce(p_code, '')) < 4 then
    raise exception 'code too short' using errcode = '22023';
  end if;
  insert into project_client_access (project_id, code_hash)
  values (p_project, crypt(p_code, gen_salt('bf')))
  on conflict (project_id) do update set code_hash = excluded.code_hash, updated_at = now();
end;
$$;
grant execute on function set_client_access(uuid, text) to authenticated;

create or replace function client_space(p_project uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text; v_result jsonb;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'project', (select to_jsonb(p) from (
      select id, code, name, address, status, current_step, created_at
      from project where id = p_project) p),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at) from (
        select id, project_id, type, author_id, author_role, visibility, state,
               capture_id, created_at, published_by, published_at, content
        from event
        where project_id = p_project
          and (
            -- Choix (M7.2.2) : envoi (présentation) + résolutions, part client-safe.
            (type = 'decision'
               and (content ->> 'kind')
                     in ('envoyee','renvoyee','validee','deleguee','modification'))
            or (type = 'demande' and visibility = 'client'
                and (case
                       when (content ->> 'destinataire') = 'client'
                         then state in ('ouverte','traitee','close')
                       when (content ->> 'destinataire') = 'phenix' -- message DU client
                         then state in ('ouverte','traitee','close')
                       else state in ('traitee','close') end))
            or (type <> 'decision' and type <> 'demande'
                and visibility = 'client' and state = 'publie')
          )
      ) e), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
grant execute on function client_space(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Écriture client : répondre à une demande (M7.2.1) — code vérifié côté serveur
-- ----------------------------------------------------------------------------
create or replace function client_respond_demande(
  p_project uuid, p_code text, p_event uuid, p_texte text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text; v_ok boolean;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;
  if length(coalesce(btrim(p_texte), '')) = 0 then
    raise exception 'reponse vide' using errcode = '22023';
  end if;
  select exists (
    select 1 from event
    where id = p_event and project_id = p_project and type = 'demande'
      and visibility = 'client' and (content ->> 'destinataire') = 'client' and state = 'ouverte'
  ) into v_ok;
  if not v_ok then
    raise exception 'demande introuvable ou deja traitee' using errcode = '42501';
  end if;
  update event
     set content = content || jsonb_build_object('resolution', jsonb_build_object(
           'texte', btrim(p_texte),
           'resolvedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'resolvedBy', (select client_id from project where id = p_project))),
         state = 'traitee'
   where id = p_event;
  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_respond_demande(uuid, text, uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Écriture client : valider un CHOIX (M7.2.2) — code vérifié côté serveur
-- ----------------------------------------------------------------------------
-- p_option : id de l'option retenue, ou '__phenix_delegate__' (confier à PHÉNIX).
create or replace function client_validate_choix(
  p_project uuid, p_code text, p_event uuid, p_option text, p_message text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text; v_content jsonb; v_selection text; v_categorie text; v_avant text;
  v_delegate boolean; v_kind text; v_label text; v_done boolean;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;
  -- Le porteur : un choix ENVOYÉ au client (envoyee/renvoyee) de CE projet.
  select content into v_content from event
   where id = p_event and project_id = p_project and type = 'decision'
     and (content ->> 'kind') in ('envoyee','renvoyee');
  if v_content is null then
    raise exception 'choix introuvable' using errcode = '42501';
  end if;
  v_selection := v_content ->> 'selectionId';
  v_categorie := v_content ->> 'categorie';
  v_avant := coalesce(v_content ->> 'statutApres', 'propose');
  -- Pas de réécriture : un choix déjà résolu est refusé.
  select exists (
    select 1 from event where project_id = p_project and type = 'decision'
      and (content ->> 'selectionId') = v_selection
      and (content ->> 'kind') in ('validee','deleguee')
  ) into v_done;
  if v_done then raise exception 'choix deja resolu' using errcode = '42501'; end if;
  v_delegate := (p_option = '__phenix_delegate__');
  v_kind := case when v_delegate then 'deleguee' else 'validee' end;
  if v_delegate then
    v_label := 'PHÉNIX décide';
  else
    select opt ->> 'title' into v_label
    from jsonb_array_elements(coalesce(v_content -> 'choix' -> 'options', '[]'::jsonb)) opt
    where opt ->> 'id' = p_option limit 1;
    if v_label is null then raise exception 'option inconnue' using errcode = '22023'; end if;
  end if;
  insert into event(project_id, type, author_id, author_role, visibility, state, content)
  values (p_project, 'decision', null, 'client', 'client', 'publie',
    jsonb_strip_nulls(jsonb_build_object(
      'kind', v_kind, 'origin', 'client', 'selectionId', v_selection,
      'categorie', v_categorie, 'statutAvant', v_avant, 'statutApres', 'valide',
      'optionId', case when v_delegate then null else p_option end,
      'optionLabel', v_label, 'message', nullif(btrim(coalesce(p_message,'')), ''))));
  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_validate_choix(uuid, text, uuid, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Écriture client : ÉCRIRE UN MESSAGE au conducteur (M7.2.3)
-- ----------------------------------------------------------------------------
create or replace function client_message(p_project uuid, p_code text, p_texte text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;
  if length(coalesce(btrim(p_texte), '')) = 0 then
    raise exception 'message vide' using errcode = '22023';
  end if;
  insert into event(project_id, type, author_id, author_role, visibility, state, content)
  values (p_project, 'demande', null, 'client', 'client', 'ouverte',
          jsonb_build_object('question', btrim(p_texte), 'destinataire', 'phenix'));
  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_message(uuid, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Temps réel (M6) : diffuser les changements de `event` (RLS appliquée à l'abonné)
-- ----------------------------------------------------------------------------
alter table event replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event')
  then
    alter publication supabase_realtime add table event;
  end if;
end
$$;
