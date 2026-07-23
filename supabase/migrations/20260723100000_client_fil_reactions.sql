-- PHÉNIX 360 — Espace client : le client RÉAGIT dans « Dans les coulisses »
-- ============================================================================
-- Jumeau complet de l'app validée : sur le lien client, l'album se REGARDE, se
-- LIKE (❤️) et se COMMENTE (💬), comme côté conducteur. Les interactions du Fil
-- vivent dans le coffre satellite du conducteur (`app_kv`, agrégat DISTINCT du
-- Journal — les deux ne fusionnent jamais). On écrit donc la réaction du client
-- DIRECTEMENT dans le coffre du conducteur PROPRIÉTAIRE du moment, via une RPC
-- code-gardée (SECURITY DEFINER). Bénéfices : le client voit sa réaction tout de
-- suite (client_space relit le même coffre), elle survit au polling, et elle
-- REMONTE au conducteur (même stockage) à sa prochaine hydratation.
--
-- Le client anonyme est modélisé par l'utilisateur synthétique 'client-espace'
-- (comme dans ClientSpaceBackend), pour que ❤️ (un par personne) et messages lui
-- soient correctement attribués côté lecture.

-- Trouve le conducteur (membre interne) PROPRIÉTAIRE d'un moment PARTAGÉ (son
-- coffre fil-moments contient ce moment, publié + audience client). Interne only.
create or replace function client_moment_owner(p_project uuid, p_moment text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare r record; j jsonb;
begin
  for r in
    select distinct m.user_id from project_member m
    where m.project_id = p_project and m.role in ('compagnon', 'equipe')
  loop
    begin
      select (kv.v)::jsonb -> (p_project::text) into j
      from app_kv kv
      where kv.user_id = r.user_id and kv.k = 'phenix-demo:fil-moments:v1';
    exception when others then j := null;
    end;
    if j is not null and jsonb_typeof(j) = 'array' and exists (
      select 1 from jsonb_array_elements(j) as x(elem)
      where x.elem ->> 'id' = p_moment
        and x.elem ->> 'state' = 'publie'
        and (x.elem -> 'visibleTo') ? 'client'
    ) then
      return r.user_id;
    end if;
  end loop;
  return null;
end;
$$;

-- ❤️ Coup de cœur du client (bascule) sur un moment partagé.
create or replace function client_coup(p_project uuid, p_code text, p_moment text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash  text;
  v_owner uuid;
  v_blob  jsonb;
  v_arr   jsonb;
  v_has   boolean;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;
  v_owner := client_moment_owner(p_project, p_moment);
  if v_owner is null then
    raise exception 'moment introuvable ou non partage' using errcode = '42501';
  end if;

  begin
    select (kv.v)::jsonb into v_blob from app_kv kv
    where kv.user_id = v_owner and kv.k = 'phenix-demo:fil-coups:v1';
  exception when others then v_blob := null;
  end;
  if v_blob is null or jsonb_typeof(v_blob) <> 'object' then v_blob := '{}'::jsonb; end if;
  v_arr := coalesce(v_blob -> (p_project::text), '[]'::jsonb);

  perform 1 from jsonb_array_elements(v_arr) as x(elem)
    where x.elem ->> 'momentId' = p_moment and x.elem ->> 'userId' = 'client-espace';
  v_has := found;

  if v_has then
    -- Un-like : on retire le coup du client.
    select coalesce(jsonb_agg(x.elem), '[]'::jsonb) into v_arr
    from jsonb_array_elements(v_arr) as x(elem)
    where not (x.elem ->> 'momentId' = p_moment and x.elem ->> 'userId' = 'client-espace');
  else
    v_arr := v_arr || jsonb_build_array(jsonb_build_object(
      'id',        gen_random_uuid()::text,
      'momentId',  p_moment,
      'userId',    'client-espace',
      'userRole',  'client',
      'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ));
  end if;

  insert into app_kv(user_id, k, v, updated_at)
  values (v_owner, 'phenix-demo:fil-coups:v1',
          (v_blob || jsonb_build_object(p_project::text, v_arr))::text, now())
  on conflict (user_id, k) do update set v = excluded.v, updated_at = now();

  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_coup(uuid, text, text) to anon, authenticated;

-- 💬 Message du client sous un moment (niveau 1) ou une photo (niveau 2).
create or replace function client_moment_message(
  p_project uuid, p_code text, p_moment text, p_texte text, p_photo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash  text;
  v_owner uuid;
  v_blob  jsonb;
  v_arr   jsonb;
  v_txt   text;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;
  v_txt := btrim(coalesce(p_texte, ''));
  if v_txt = '' then
    raise exception 'message vide' using errcode = '22023';
  end if;
  v_owner := client_moment_owner(p_project, p_moment);
  if v_owner is null then
    raise exception 'moment introuvable ou non partage' using errcode = '42501';
  end if;

  begin
    select (kv.v)::jsonb into v_blob from app_kv kv
    where kv.user_id = v_owner and kv.k = 'phenix-demo:fil-messages:v1';
  exception when others then v_blob := null;
  end;
  if v_blob is null or jsonb_typeof(v_blob) <> 'object' then v_blob := '{}'::jsonb; end if;
  v_arr := coalesce(v_blob -> (p_project::text), '[]'::jsonb);

  v_arr := v_arr || jsonb_build_array(jsonb_build_object(
    'id',        gen_random_uuid()::text,
    'momentId',  p_moment,
    'photoId',   p_photo,           -- null => JSON null (message de niveau 1)
    'parentId',  null,
    'authorId',  'client-espace',
    'authorRole','client',
    'texte',     v_txt,
    'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ));

  insert into app_kv(user_id, k, v, updated_at)
  values (v_owner, 'phenix-demo:fil-messages:v1',
          (v_blob || jsonb_build_object(p_project::text, v_arr))::text, now())
  on conflict (user_id, k) do update set v = excluded.v, updated_at = now();

  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_moment_message(uuid, text, text, text, text) to anon, authenticated;
