-- PHÉNIX 360 — Test RLS minimal (assertions, échoue la CI au moindre écart)
-- ============================================================================
-- Vérifie sur la base réelle ce que core garantit en types :
--   1. trigger d'avancement : project.current_step = 'gros_oeuvre'
--   2. vue CLIENT : 3 événements visibles (CR publié, photo, demande ouverte) ;
--      le brouillon interne reste masqué.
--   3. vue INTERNE (compagnon) : les 4 événements.
-- S'exécute sous un rôle non-privilégié pour que la RLS s'applique réellement.

-- Rôle de test (cluster-level) — idempotent.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_test') then
    create role app_test nologin;
  end if;
end
$$;

grant usage on schema auth to app_test;
grant select on project, project_member, event to app_test;
grant execute on function auth.uid() to app_test;
grant execute on function app_is_member(uuid) to app_test;
grant execute on function app_has_role(uuid, member_role) to app_test;
grant execute on function app_is_internal(uuid) to app_test;

do $$
declare
  v_step     text;
  v_client   int;
  v_internal int;
begin
  -- 1. Avancement dérivé (trigger = miroir de core.currentStep)
  select current_step::text into v_step
  from project where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if v_step is distinct from 'gros_oeuvre' then
    raise exception 'FAIL current_step : attendu gros_oeuvre, obtenu %', coalesce(v_step, 'NULL');
  end if;

  -- 2. Vue client (RLS = miroir de core.isVisibleToClient)
  perform set_config('app.user_id', '22222222-2222-2222-2222-222222222222', true);
  perform set_config('role', 'app_test', true);
  select count(*) into v_client from event;
  perform set_config('role', 'none', true);
  if v_client <> 3 then
    raise exception 'FAIL vue client : attendu 3 événements, obtenu %', v_client;
  end if;

  -- 3. Vue interne (compagnon) : accès complet
  perform set_config('app.user_id', '11111111-1111-1111-1111-111111111111', true);
  perform set_config('role', 'app_test', true);
  select count(*) into v_internal from event;
  perform set_config('role', 'none', true);
  if v_internal <> 4 then
    raise exception 'FAIL vue interne : attendu 4 événements, obtenu %', v_internal;
  end if;

  raise notice 'OK RLS — client=%, interne=%, avancement=%', v_client, v_internal, v_step;
end
$$;

-- 4. Espace client par LIEN + CODE (M7.1) : code vérifié + miroir de la vue client
do $$
declare v_nb int; v_name text; v_bad boolean := false;
begin
  perform set_config('app.user_id', '11111111-1111-1111-1111-111111111111', true);
  perform set_client_access('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234');

  begin
    perform client_space('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'wrong');
  exception when sqlstate '42501' then v_bad := true;
  end;
  if not v_bad then raise exception 'FAIL espace client : mauvais code accepté'; end if;

  select jsonb_array_length(
           client_space('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234') -> 'events'),
         client_space('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234') -> 'project' ->> 'name'
    into v_nb, v_name;
  if v_nb <> 3 then
    raise exception 'FAIL espace client : attendu 3 événements visibles, obtenu %', v_nb;
  end if;
  raise notice 'OK espace client — % événements, projet %', v_nb, v_name;
end
$$;
