-- PHÉNIX 360 — Espace client : exposer « Dans les coulisses » (lecture seule)
-- ============================================================================
-- Le Fil (« Dans les coulisses ») vit dans le coffre satellite du conducteur
-- (`app_kv`, blob JSON opaque par conducteur, RLS privée). Le client par
-- lien + code n'y a donc AUCUN accès et son onglet reste vide. Cette migration
-- étend `client_space` pour renvoyer, EN PLUS des événements, les moments du Fil
-- qui sont PARTAGÉS au client (publié + audience 'client'), avec leurs coups de
-- cœur / messages / zones — le tout lu côté serveur dans le(s) coffre(s) du/des
-- conducteur(s) internes du projet. Lecture seule : le client CONSULTE l'album
-- (les réactions durables du client sont un incrément ultérieur — écrire dans le
-- blob `app_kv` du conducteur entrerait en collision avec sa synchro CloudKv).
--
-- Robuste : un blob illisible ne fait jamais échouer l'espace client.

-- Agrège, à travers TOUS les membres internes du projet, le tableau du Fil
-- rangé sous la clé `p_key` pour `p_project`. SECURITY DEFINER : lit `app_kv`
-- au-delà de la RLS (propriétaire = postgres). N'est JAMAIS exposée à `anon` :
-- uniquement appelée depuis `client_space` (déjà gardée par le code).
create or replace function client_fil_array(p_project uuid, p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_out jsonb := '[]'::jsonb;
  r     record;
  j     jsonb;
begin
  for r in
    select distinct m.user_id
    from project_member m
    where m.project_id = p_project and m.role in ('compagnon', 'equipe')
  loop
    begin
      select (kv.v)::jsonb -> (p_project::text) into j
      from app_kv kv
      where kv.user_id = r.user_id and kv.k = p_key;
    exception when others then
      j := null; -- blob corrompu : on ignore ce coffre, jamais d'échec global.
    end;
    if j is not null and jsonb_typeof(j) = 'array' then
      v_out := v_out || j;
    end if;
  end loop;
  return v_out;
end;
$$;

create or replace function client_space(p_project uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash     text;
  v_result   jsonb;
  v_moments  jsonb;
  v_ids      jsonb;
  v_coups    jsonb;
  v_messages jsonb;
  v_zones    jsonb;
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

  -- FIL « Dans les coulisses » — uniquement les moments PARTAGÉS au client.
  select coalesce(jsonb_agg(elem order by elem ->> 'createdAt'), '[]'::jsonb)
    into v_moments
  from jsonb_array_elements(client_fil_array(p_project, 'phenix-demo:fil-moments:v1')) elem
  where (elem ->> 'state') = 'publie' and (elem -> 'visibleTo') ? 'client';

  select coalesce(jsonb_agg(elem ->> 'id'), '[]'::jsonb)
    into v_ids
  from jsonb_array_elements(v_moments) elem;

  -- Coups de cœur / messages : seulement ceux qui portent sur un moment partagé.
  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_coups
  from jsonb_array_elements(client_fil_array(p_project, 'phenix-demo:fil-coups:v1')) elem
  where v_ids ? (elem ->> 'momentId');

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_messages
  from jsonb_array_elements(client_fil_array(p_project, 'phenix-demo:fil-messages:v1')) elem
  where v_ids ? (elem ->> 'momentId');

  v_zones := client_fil_array(p_project, 'phenix-demo:fil-zones:v1');

  v_result := v_result || jsonb_build_object(
    'fil', jsonb_build_object(
      'moments',  v_moments,
      'coups',    v_coups,
      'messages', v_messages,
      'zones',    coalesce(v_zones, '[]'::jsonb)
    )
  );

  return v_result;
end;
$$;
grant execute on function client_space(uuid, text) to anon, authenticated;
