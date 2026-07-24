-- PHÉNIX 360 — Fil temps réel : réactions client dans une table dédiée
-- ============================================================================
-- Jusqu'ici les réactions du client (❤️/💬 des coulisses) étaient écrites dans le
-- coffre `app_kv` du conducteur : le conducteur ne les voyait qu'à son prochain
-- chargement (pas de temps réel sur `app_kv`), et une synchro CloudKv concurrente
-- pouvait les écraser (course « dernier écrit gagne »).
--
-- On les déplace dans une table dédiée `fil_reaction`, inscrite à Supabase
-- Realtime : le conducteur (membre INTERNE, via RLS) reçoit la réaction du client
-- EN DIRECT, sans rechargement, et la course disparaît (source unique, append/delete
-- atomiques). Les MOMENTS du Fil restent dans `app_kv` (le client les reçoit par
-- son polling 12 s) : seules les réactions, qui doivent remonter live, migrent ici.
--
-- Le client anonyme est modélisé par `author_id = null`, `author_role = 'client'`.

create table if not exists fil_reaction (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references project(id) on delete cascade,
  moment_id   text not null,
  kind        text not null check (kind in ('coup', 'message')),
  author_id   uuid references auth.users on delete set null,
  author_role member_role not null,
  texte       text,
  photo_id    text,
  created_at  timestamptz not null default now()
);
create index if not exists fil_reaction_project_idx on fil_reaction (project_id);

alter table fil_reaction enable row level security;

-- Lecture : membres INTERNES du projet (le conducteur voit les réactions du client).
drop policy if exists fil_reaction_select_internal on fil_reaction;
create policy fil_reaction_select_internal on fil_reaction
  for select using (app_is_internal(project_id));

-- Écriture directe : membres internes seulement (le client passe par les RPC definer).
drop policy if exists fil_reaction_write_internal on fil_reaction;
create policy fil_reaction_write_internal on fil_reaction
  for all using (app_is_internal(project_id)) with check (app_is_internal(project_id));

-- Temps réel : diffuser les INSERT/DELETE (RLS appliquée à l'abonné).
alter table fil_reaction replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fil_reaction'
     )
  then
    alter publication supabase_realtime add table fil_reaction;
  end if;
end
$$;

-- ❤️ Coup de cœur du client (bascule) — écrit dans fil_reaction, plus dans app_kv.
create or replace function client_coup(p_project uuid, p_code text, p_moment text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text; v_id uuid;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;
  if client_moment_owner(p_project, p_moment) is null then
    raise exception 'moment introuvable ou non partage' using errcode = '42501';
  end if;

  select id into v_id from fil_reaction
   where project_id = p_project and moment_id = p_moment
     and kind = 'coup' and author_role = 'client'
   limit 1;
  if v_id is not null then
    delete from fil_reaction where id = v_id;           -- un-like
  else
    insert into fil_reaction(project_id, moment_id, kind, author_id, author_role)
    values (p_project, p_moment, 'coup', null, 'client');
  end if;

  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_coup(uuid, text, text) to anon, authenticated;

-- 💬 Message du client sous un moment (ou une photo) — écrit dans fil_reaction.
create or replace function client_moment_message(
  p_project uuid, p_code text, p_moment text, p_texte text, p_photo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text; v_txt text;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;
  v_txt := btrim(coalesce(p_texte, ''));
  if v_txt = '' then
    raise exception 'message vide' using errcode = '22023';
  end if;
  if client_moment_owner(p_project, p_moment) is null then
    raise exception 'moment introuvable ou non partage' using errcode = '42501';
  end if;

  insert into fil_reaction(project_id, moment_id, kind, author_id, author_role, texte, photo_id)
  values (p_project, p_moment, 'message', null, 'client', v_txt, p_photo);

  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_moment_message(uuid, text, text, text, text) to anon, authenticated;

-- client_space : le Fil partagé fusionne désormais les réactions client de
-- `fil_reaction` (les coups/messages `client-espace` d'app_kv sont ignorés — source
-- unique côté table). Le reste (moments, zones, coups/messages du conducteur) inchangé.
create or replace function client_space(p_project uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash      text;
  v_result    jsonb;
  v_moments   jsonb;
  v_ids       jsonb;
  v_coups     jsonb;
  v_messages  jsonb;
  v_zones     jsonb;
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
            (type = 'decision'
               and (content ->> 'kind')
                     in ('envoyee','renvoyee','validee','deleguee','modification'))
            or (type = 'demande' and visibility = 'client'
                and (case
                       when (content ->> 'destinataire') = 'client'
                         then state in ('ouverte','traitee','close')
                       when (content ->> 'destinataire') = 'phenix'
                         then state in ('ouverte','traitee','close')
                       else state in ('traitee','close') end))
            or (type <> 'decision' and type <> 'demande'
                and visibility = 'client' and state = 'publie')
          )
      ) e), '[]'::jsonb)
  ) into v_result;

  -- Moments PARTAGÉS (app_kv du conducteur).
  select coalesce(jsonb_agg(elem order by elem ->> 'createdAt'), '[]'::jsonb)
    into v_moments
  from jsonb_array_elements(client_fil_array(p_project, 'phenix-demo:fil-moments:v1')) elem
  where (elem ->> 'state') = 'publie' and (elem -> 'visibleTo') ? 'client';

  select coalesce(jsonb_agg(elem ->> 'id'), '[]'::jsonb)
    into v_ids
  from jsonb_array_elements(v_moments) elem;

  -- Coups : app_kv (conducteur, hors 'client-espace') + fil_reaction (client).
  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_coups
  from jsonb_array_elements(client_fil_array(p_project, 'phenix-demo:fil-coups:v1')) elem
  where v_ids ? (elem ->> 'momentId') and coalesce(elem ->> 'userId', '') <> 'client-espace';
  v_coups := v_coups || coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', fr.id::text, 'momentId', fr.moment_id, 'userId', 'client-espace',
      'userRole', fr.author_role::text,
      'createdAt', to_char(fr.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    from fil_reaction fr
    where fr.project_id = p_project and fr.kind = 'coup' and v_ids ? fr.moment_id
  ), '[]'::jsonb);

  -- Messages : app_kv (conducteur, hors 'client-espace') + fil_reaction (client).
  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_messages
  from jsonb_array_elements(client_fil_array(p_project, 'phenix-demo:fil-messages:v1')) elem
  where v_ids ? (elem ->> 'momentId') and coalesce(elem ->> 'authorId', '') <> 'client-espace';
  v_messages := v_messages || coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', fr.id::text, 'momentId', fr.moment_id, 'photoId', fr.photo_id,
      'parentId', null, 'authorId', 'client-espace', 'authorRole', fr.author_role::text,
      'texte', fr.texte,
      'createdAt', to_char(fr.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    from fil_reaction fr
    where fr.project_id = p_project and fr.kind = 'message' and v_ids ? fr.moment_id
  ), '[]'::jsonb);

  v_zones := client_fil_array(p_project, 'phenix-demo:fil-zones:v1');

  v_result := v_result || jsonb_build_object(
    'fil', jsonb_build_object(
      'moments', v_moments, 'coups', v_coups, 'messages', v_messages,
      'zones', coalesce(v_zones, '[]'::jsonb)
    )
  );
  return v_result;
end;
$$;
grant execute on function client_space(uuid, text) to anon, authenticated;
