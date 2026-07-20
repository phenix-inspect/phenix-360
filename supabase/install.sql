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
-- Storage — bucket privé des pièces jointes (photos / documents)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments read members" on storage.objects;
create policy "attachments read members" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and app_is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "attachments write internal" on storage.objects;
create policy "attachments write internal" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and app_is_internal(((storage.foldername(name))[1])::uuid));

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
