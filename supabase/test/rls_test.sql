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
do $$ begin
  if to_regclass('public.fil_reaction') is not null then
    execute 'grant select on fil_reaction to app_test';
  end if;
end $$;
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

-- 8. Écriture client : RÉPONDRE avec un DOCUMENT (durable)
do $$
declare
  v_dem   uuid;
  v_space jsonb;
  v_docok boolean;
  v_bad   boolean := false;
begin
  -- Le conducteur demande un document au client.
  insert into event(project_id, type, author_id, author_role, visibility, state, content)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demande',
          '11111111-1111-1111-1111-111111111111', 'compagnon', 'client', 'ouverte',
          '{"question":"Votre attestation d''assurance ?","destinataire":"client","attendu":"document"}')
  returning id into v_dem;

  -- mauvais code refusé
  begin
    perform client_respond_document('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nope', v_dem,
      'voici', '{"fileName":"assurance.pdf","mimeType":"application/pdf"}'::jsonb, null);
  exception when sqlstate '42501' then v_bad := true;
  end;
  if not v_bad then raise exception 'FAIL document : mauvais code accepté'; end if;

  -- bon code : document créé + demande traitée, tous deux visibles dans l'espace
  v_space := client_respond_document('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234', v_dem,
    'La voici', '{"fileName":"assurance.pdf","mimeType":"application/pdf","dataUrl":"data:application/pdf;base64,AA=="}'::jsonb,
    'Attestation assurance');
  select exists (
    select 1 from jsonb_array_elements(v_space -> 'events') ev
    where ev ->> 'type' = 'document'
      and ev -> 'content' ->> 'libelle' = 'Attestation assurance'
      and ev ->> 'author_role' = 'client'
  ) into v_docok;
  if not v_docok then raise exception 'FAIL document : document client absent de l''espace'; end if;
  -- la demande est passée à traitee avec un docEventId
  if not exists (
    select 1 from event where id = v_dem and state = 'traitee'
      and (content -> 'resolution' ->> 'docEventId') is not null
  ) then
    raise exception 'FAIL document : demande non résolue / docEventId manquant';
  end if;

  raise notice 'OK document client — attestation enregistrée + demande traitée';
end
$$;

-- 9. Espace client : « Dans les coulisses » — moments PARTAGÉS uniquement.
-- Le Fil vit dans le coffre satellite du conducteur (app_kv). client_space doit
-- exposer au client SEULEMENT les moments publiés + audience 'client', avec leurs
-- coups/messages ; l'interne (audience sans 'client') reste masqué.
do $$
declare
  v_space   jsonb;
  v_moments jsonb;
  v_coups   jsonb;
  v_msgs    jsonb;
begin
  -- Coffre Fil du conducteur (user 1111, compagnon interne du projet).
  insert into app_kv(user_id, k, v) values
    ('11111111-1111-1111-1111-111111111111', 'phenix-demo:fil-moments:v1', $json$
     {"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa":[
       {"id":"m-shared","projectId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","state":"publie",
        "visibleTo":["phenix","artisans","client"],"createdAt":"2026-06-25T10:00:00.000Z",
        "authorId":"11111111-1111-1111-1111-111111111111","authorRole":"compagnon",
        "title":"Cuisine installée","photos":[{"id":"p1","bucket":"attachments",
        "storagePath":"x/y.jpg","mimeType":"image/jpeg","ordre":0,
        "createdAt":"2026-06-25T10:00:00.000Z"}]},
       {"id":"m-internal","projectId":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","state":"publie",
        "visibleTo":["phenix","artisans"],"createdAt":"2026-06-26T10:00:00.000Z",
        "authorId":"11111111-1111-1111-1111-111111111111","authorRole":"compagnon",
        "title":"Note interne","photos":[]}
     ]}$json$),
    ('11111111-1111-1111-1111-111111111111', 'phenix-demo:fil-coups:v1', $json$
     {"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa":[
       {"id":"c1","momentId":"m-shared","userId":"22222222-2222-2222-2222-222222222222",
        "userRole":"client","createdAt":"2026-06-25T11:00:00.000Z"},
       {"id":"c2","momentId":"m-internal","userId":"11111111-1111-1111-1111-111111111111",
        "userRole":"compagnon","createdAt":"2026-06-26T11:00:00.000Z"}
     ]}$json$),
    ('11111111-1111-1111-1111-111111111111', 'phenix-demo:fil-messages:v1', $json$
     {"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa":[
       {"id":"msg1","momentId":"m-shared","photoId":null,"parentId":null,
        "authorId":"11111111-1111-1111-1111-111111111111","authorRole":"compagnon",
        "texte":"Belle avancée !","createdAt":"2026-06-25T12:00:00.000Z"}
     ]}$json$)
  on conflict (user_id, k) do update set v = excluded.v;

  v_space   := client_space('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234');
  v_moments := v_space -> 'fil' -> 'moments';
  v_coups   := v_space -> 'fil' -> 'coups';
  v_msgs    := v_space -> 'fil' -> 'messages';

  if jsonb_array_length(v_moments) <> 1 then
    raise exception 'FAIL coulisses : attendu 1 moment partagé, obtenu %',
      jsonb_array_length(v_moments);
  end if;
  if (v_moments -> 0 ->> 'id') <> 'm-shared' then
    raise exception 'FAIL coulisses : mauvais moment exposé (%)', v_moments -> 0 ->> 'id';
  end if;
  if jsonb_array_length(v_coups) <> 1 or (v_coups -> 0 ->> 'momentId') <> 'm-shared' then
    raise exception 'FAIL coulisses : coup de cœur interne non filtré';
  end if;
  if jsonb_array_length(v_msgs) <> 1 or (v_msgs -> 0 ->> 'momentId') <> 'm-shared' then
    raise exception 'FAIL coulisses : message inattendu';
  end if;

  raise notice 'OK coulisses — 1 moment partagé (interne masqué), coup + message filtrés';
end
$$;

-- 10. Espace client : le client RÉAGIT dans les coulisses (❤️ bascule + 💬).
-- (S'appuie sur les coffres Fil semés au test 9 : moment partagé 'm-shared'
--  appartenant au conducteur 1111, moment interne 'm-internal' non partagé.)
do $$
declare
  v_space jsonb;
  v_nb    int;
  v_bad   boolean := false;
begin
  -- mauvais code refusé
  begin
    perform client_coup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nope', 'm-shared');
  exception when sqlstate '42501' then v_bad := true;
  end;
  if not v_bad then raise exception 'FAIL coup : mauvais code accepté'; end if;

  -- moment NON partagé refusé (interne)
  v_bad := false;
  begin
    perform client_coup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234', 'm-internal');
  exception when sqlstate '42501' then v_bad := true;
  end;
  if not v_bad then raise exception 'FAIL coup : moment interne accepté'; end if;

  -- like : une LIGNE fil_reaction est créée ET le coup apparaît dans client_space
  v_space := client_coup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234', 'm-shared');
  select count(*) into v_nb from fil_reaction
   where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     and moment_id = 'm-shared' and kind = 'coup';
  if v_nb <> 1 then raise exception 'FAIL coup : ligne fil_reaction absente (%)', v_nb; end if;
  select count(*) into v_nb
  from jsonb_array_elements(v_space -> 'fil' -> 'coups') as x(elem)
  where x.elem ->> 'userId' = 'client-espace' and x.elem ->> 'momentId' = 'm-shared';
  if v_nb <> 1 then raise exception 'FAIL coup : like absent de client_space (%)', v_nb; end if;

  -- un-like : bascule → la ligne fil_reaction est SUPPRIMÉE, le coup disparaît
  v_space := client_coup('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234', 'm-shared');
  select count(*) into v_nb from fil_reaction
   where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     and moment_id = 'm-shared' and kind = 'coup';
  if v_nb <> 0 then raise exception 'FAIL coup : un-like ne supprime pas la ligne (%)', v_nb; end if;
  select count(*) into v_nb
  from jsonb_array_elements(v_space -> 'fil' -> 'coups') as x(elem)
  where x.elem ->> 'userId' = 'client-espace' and x.elem ->> 'momentId' = 'm-shared';
  if v_nb <> 0 then raise exception 'FAIL coup : un-like non pris en compte (%)', v_nb; end if;

  -- message vide refusé
  v_bad := false;
  begin
    perform client_moment_message('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234',
      'm-shared', '   ', null);
  exception when sqlstate '22023' then v_bad := true;
  end;
  if not v_bad then raise exception 'FAIL message coulisses : vide accepté'; end if;

  -- message : apparaît sous le moment partagé, auteur client-espace
  v_space := client_moment_message('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test1234',
    'm-shared', 'Superbe, hâte de voir la suite !', null);
  select count(*) into v_nb
  from jsonb_array_elements(v_space -> 'fil' -> 'messages') as x(elem)
  where x.elem ->> 'authorId' = 'client-espace'
    and x.elem ->> 'momentId' = 'm-shared'
    and x.elem ->> 'texte' = 'Superbe, hâte de voir la suite !';
  if v_nb <> 1 then raise exception 'FAIL message coulisses : non enregistré (%)', v_nb; end if;

  raise notice 'OK coulisses réactions — fil_reaction (like/un-like + message) fondu dans client_space';
end
$$;

-- 11. RLS fil_reaction : le CONDUCTEUR (membre interne) voit la réaction client
-- (base du temps réel : Realtime applique cette même RLS à l'abonné).
do $$
declare v_ct int;
begin
  perform set_config('app.user_id', '11111111-1111-1111-1111-111111111111', true);
  perform set_config('role', 'app_test', true);
  select count(*) into v_ct from fil_reaction
   where project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  perform set_config('role', 'none', true);
  -- Le test 10 laisse 1 message (le coup a été retiré) → le conducteur doit le voir.
  if v_ct < 1 then
    raise exception 'FAIL RLS fil_reaction : le conducteur ne voit pas la réaction (%)', v_ct;
  end if;
  raise notice 'OK RLS fil_reaction — le conducteur voit % réaction(s) client', v_ct;
end
$$;
