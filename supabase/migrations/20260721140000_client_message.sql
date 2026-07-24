-- PHÉNIX 360 — Écriture client : ÉCRIRE UN MESSAGE au conducteur (M7.2.3)
-- ============================================================================
-- Troisième geste d'écriture côté client, toujours SANS compte : le client
-- envoie un message libre (une question, une remarque) à son conducteur depuis
-- son espace. On réutilise le modèle existant : le message est une `demande`
-- adressée au conducteur (`destinataire='phenix'`) — exactement ce que le
-- conducteur voit déjà dans son onglet « Demandes client », auquel il répond avec
-- ses outils habituels (`resolveDemande`). Le temps réel (M6) la lui livre en direct.
--
-- Le code est vérifié CÔTÉ SERVEUR (comme les autres écritures client). L'auteur
-- reste NULL (le client n'a pas de compte) ; `author_role='client'` — ce qui
-- alimente la notification conducteur « Nouvelle demande client à traiter ».

-- ----------------------------------------------------------------------------
-- client_space (redéfini) : renvoie AUSSI les messages du client (ses demandes
-- adressées au conducteur), pour qu'il voie son message ET la réponse.
-- ----------------------------------------------------------------------------
-- Une demande `destinataire='phenix'` est le message du client : on la lui montre
-- dès `ouverte` (c'est le sien), puis résolue. Le reste de la vue est inchangé
-- (choix + demandes qui lui sont adressées + récit publié).
create or replace function client_space(p_project uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash   text;
  v_result jsonb;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'project',
    (
      select to_jsonb(p)
      from (
        select id, code, name, address, status, current_step, created_at
        from project where id = p_project
      ) p
    ),
    'events',
    coalesce(
      (
        select jsonb_agg(to_jsonb(e) order by e.created_at)
        from (
          select id, project_id, type, author_id, author_role, visibility, state,
                 capture_id, created_at, published_by, published_at, content
          from event
          where project_id = p_project
            and (
              -- Choix : envoi (présentation) + résolutions, part client-safe.
              (
                type = 'decision'
                and (content ->> 'kind')
                      in ('envoyee', 'renvoyee', 'validee', 'deleguee', 'modification')
              )
              or (
                type = 'demande'
                and visibility = 'client'
                and (
                  case
                    when (content ->> 'destinataire') = 'client'
                      then state in ('ouverte', 'traitee', 'close')
                    -- 'phenix' = message DU client au conducteur : visible dès l'envoi.
                    when (content ->> 'destinataire') = 'phenix'
                      then state in ('ouverte', 'traitee', 'close')
                    else state in ('traitee', 'close')
                  end
                )
              )
              or (
                type <> 'decision'
                and type <> 'demande'
                and visibility = 'client'
                and state = 'publie'
              )
            )
        ) e
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;
grant execute on function client_space(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- client_message : le client envoie un message libre au conducteur
-- ----------------------------------------------------------------------------
create or replace function client_message(p_project uuid, p_code text, p_texte text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;

  if length(coalesce(btrim(p_texte), '')) = 0 then
    raise exception 'message vide' using errcode = '22023';
  end if;

  insert into event(project_id, type, author_id, author_role, visibility, state, content)
  values (
    p_project, 'demande', null, 'client', 'client', 'ouverte',
    jsonb_build_object('question', btrim(p_texte), 'destinataire', 'phenix')
  );

  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_message(uuid, text, text) to anon, authenticated;
