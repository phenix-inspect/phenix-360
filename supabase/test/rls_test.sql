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

-- 5. Écriture client : répondre à une demande (M7.2.1)
do $$
declare v_eid uuid; v_state text; v_txt text; v_bad boolean := false;
begin
  insert into event(project_id, type, author_id, author_role, visibility, state, content)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demande',
          '11111111-1111-1111-1111-111111111111', 'compagnon', 'client', 'ouverte',
          '{"question":"Couleur ?","destinataire":"client"}')
  returning id into v_eid;
  -- mauvais code refusé (le code 'test1234' a été posé au test 4)
  begin
    perform client_respond_demande('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nope', v_eid, 'bleu');
  exception when sqlstate '42501' then v_bad := true;
  end;
  if not v_bad then raise exception 'FAIL respond : mauvais code accepté'; end if;
  -- bon code : réponse enregistrée + demande traitée
  perform client_respond_demande('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234', v_eid, 'Bleu nuit');
  select state, content -> 'resolution' ->> 'texte' into v_state, v_txt from event where id = v_eid;
  if v_state <> 'traitee' or v_txt <> 'Bleu nuit' then
    raise exception 'FAIL respond : état/réponse inattendus (% / %)', v_state, v_txt;
  end if;
  raise notice 'OK réponse client — %', v_txt;
end
$$;

-- 6. Écriture client : valider un CHOIX (M7.2.2)
do $$
declare
  v_carrier uuid;
  v_label   text;
  v_kind    text;
  v_apres   text;
  v_bad     boolean := false;
begin
  -- Le conducteur ENVOIE un choix (présentation portée par l'événement d'envoi).
  insert into event(project_id, type, author_id, author_role, visibility, state, content)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'decision',
          '11111111-1111-1111-1111-111111111111', 'compagnon', 'interne', 'publie',
          '{"kind":"envoyee","origin":"conducteur","selectionId":"sel-carrelage",'
          '"categorie":"Carrelage","statutAvant":"a_choisir","statutApres":"propose",'
          '"choix":{"titre":"Carrelage salle de bain","options":['
          '{"id":"opt-a","ref":"A","title":"Grès clair"},'
          '{"id":"opt-b","ref":"B","title":"Ardoise anthracite"}]}}')
  returning id into v_carrier;

  -- mauvais code refusé (le code 'test1234' a été posé au test 4)
  begin
    perform client_validate_choix(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nope', v_carrier, 'opt-b', null);
  exception when sqlstate '42501' then v_bad := true;
  end;
  if not v_bad then raise exception 'FAIL choix : mauvais code accepté'; end if;

  -- bon code : validation enregistrée (trace decision/validee, libellé résolu)
  perform client_validate_choix(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234', v_carrier, 'opt-b', 'Merci');
  select content ->> 'kind', content ->> 'optionLabel', content ->> 'statutApres'
    into v_kind, v_label, v_apres
  from event
  where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and type = 'decision' and (content ->> 'kind') = 'validee'
    and (content ->> 'selectionId') = 'sel-carrelage'
  order by created_at desc limit 1;
  if v_kind <> 'validee' or v_label <> 'Ardoise anthracite' or v_apres <> 'valide' then
    raise exception 'FAIL choix : résolution inattendue (% / % / %)', v_kind, v_label, v_apres;
  end if;

  -- pas de réécriture : re-valider le même choix est refusé
  v_bad := false;
  begin
    perform client_validate_choix(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234', v_carrier, 'opt-a', null);
  exception when sqlstate '42501' then v_bad := true;
  end;
  if not v_bad then raise exception 'FAIL choix : double validation acceptée'; end if;

  raise notice 'OK choix client — %', v_label;
end
$$;

-- 7. Écriture client : ÉCRIRE UN MESSAGE au conducteur (M7.2.3)
do $$
declare
  v_space jsonb;
  v_found boolean;
  v_bad   boolean := false;
begin
  -- mauvais code refusé
  begin
    perform client_message('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nope', 'Bonjour');
  exception when sqlstate '42501' then v_bad := true;
  end;
  if not v_bad then raise exception 'FAIL message : mauvais code accepté'; end if;

  -- message vide refusé
  v_bad := false;
  begin
    perform client_message('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234', '   ');
  exception when sqlstate '22023' then v_bad := true;
  end;
  if not v_bad then raise exception 'FAIL message : message vide accepté'; end if;

  -- bon code : le message est créé (demande destinataire=phenix, auteur client)
  -- et RENVOYÉ dans l'espace client (le client voit son propre message).
  v_space := client_message(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234',
    'Bonjour, une question sur les délais ?');
  select exists (
    select 1 from jsonb_array_elements(v_space -> 'events') ev
    where ev ->> 'type' = 'demande'
      and ev -> 'content' ->> 'destinataire' = 'phenix'
      and ev -> 'content' ->> 'question' = 'Bonjour, une question sur les délais ?'
      and ev ->> 'author_role' = 'client'
      and ev ->> 'state' = 'ouverte'
  ) into v_found;
  if not v_found then raise exception 'FAIL message : message client absent de l''espace'; end if;

  raise notice 'OK message client — visible dans l''espace';
end
$$;
