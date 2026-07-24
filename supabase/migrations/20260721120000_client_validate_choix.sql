-- PHÉNIX 360 — Écriture client : valider un CHOIX (M7.2.2)
-- ============================================================================
-- Deuxième geste d'écriture côté client, toujours SANS compte : le client valide
-- un choix (carrelage, peinture…) que le conducteur lui a envoyé, ou le confie à
-- PHÉNIX. Le code est vérifié CÔTÉ SERVEUR (comme en lecture / en réponse).
--
-- La présentation du choix (options A–E, photos, contexte) voyage désormais sur
-- l'événement d'ENVOI `decision`/`envoyee` (miroir léger de `ClientSelection`,
-- construit par core.buildDecisionContent). L'espace client autonome — qui ne lit
-- que le journal — peut donc afficher le choix. On étend d'abord `client_space`
-- pour renvoyer les événements `decision`, puis on ajoute la RPC de validation.
--
-- La validation n'écrit JAMAIS le journal en direct : elle passe par cette
-- fonction SECURITY DEFINER, qui ne pose qu'une TRACE de résolution
-- (`decision`/`validee` ou `deleguee`, `author_id` NULL, visible client) — que le
-- conducteur relit déjà du journal (core.choixClientValides). Aucune réécriture
-- (un choix déjà résolu est refusé).

-- ----------------------------------------------------------------------------
-- client_space (redéfini) : renvoie AUSSI les événements `decision` (choix)
-- ----------------------------------------------------------------------------
-- Les événements `decision` client-safe (envoi + résolutions) sont renvoyés quel
-- que soit leur `visibility` (l'envoi est « interne » côté conducteur, mais sa
-- part présentée est faite pour le client). Le reste de la vue est inchangé.
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
                type <> 'decision'
                and visibility = 'client'
                and (
                  case
                    when type = 'demande' then (
                      case
                        when (content ->> 'destinataire') = 'client'
                          then state in ('ouverte', 'traitee', 'close')
                        else state in ('traitee', 'close')
                      end
                    )
                    else state = 'publie'
                  end
                )
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
-- client_validate_choix : le client valide une option (ou confie à PHÉNIX)
-- ----------------------------------------------------------------------------
-- p_option : id de l'option retenue, ou le sentinel '__phenix_delegate__'
--            (core.PHENIX_DELEGATE_ID) pour confier le choix à PHÉNIX.
-- p_message : commentaire libre facultatif.
create or replace function client_validate_choix(
  p_project uuid, p_code text, p_event uuid, p_option text, p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash      text;
  v_content   jsonb;
  v_selection text;
  v_categorie text;
  v_avant     text;
  v_delegate  boolean;
  v_kind      text;
  v_label     text;
  v_done      boolean;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;

  -- Le porteur : un choix ENVOYÉ au client (envoyee/renvoyee) de CE projet.
  select content into v_content
  from event
  where id = p_event
    and project_id = p_project
    and type = 'decision'
    and (content ->> 'kind') in ('envoyee', 'renvoyee');
  if v_content is null then
    raise exception 'choix introuvable' using errcode = '42501';
  end if;

  v_selection := v_content ->> 'selectionId';
  v_categorie := v_content ->> 'categorie';
  -- Le statut porté à l'envoi (« propose ») devient le statut AVANT résolution.
  v_avant := coalesce(v_content ->> 'statutApres', 'propose');

  -- Append-only mais pas de RÉÉCRITURE : un choix déjà résolu est refusé.
  select exists (
    select 1 from event
    where project_id = p_project
      and type = 'decision'
      and (content ->> 'selectionId') = v_selection
      and (content ->> 'kind') in ('validee', 'deleguee')
  ) into v_done;
  if v_done then
    raise exception 'choix deja resolu' using errcode = '42501';
  end if;

  v_delegate := (p_option = '__phenix_delegate__');
  v_kind := case when v_delegate then 'deleguee' else 'validee' end;
  if v_delegate then
    v_label := 'PHÉNIX décide';
  else
    -- Libellé de l'option retenue, lu depuis la présentation portée par l'envoi.
    select opt ->> 'title' into v_label
    from jsonb_array_elements(coalesce(v_content -> 'choix' -> 'options', '[]'::jsonb)) opt
    where opt ->> 'id' = p_option
    limit 1;
    if v_label is null then
      raise exception 'option inconnue' using errcode = '22023';
    end if;
  end if;

  -- Trace de résolution : visible client, auteur NULL (le client n'a pas de compte).
  insert into event(project_id, type, author_id, author_role, visibility, state, content)
  values (
    p_project, 'decision', null, 'client', 'client', 'publie',
    jsonb_strip_nulls(jsonb_build_object(
      'kind', v_kind,
      'origin', 'client',
      'selectionId', v_selection,
      'categorie', v_categorie,
      'statutAvant', v_avant,
      'statutApres', 'valide',
      'optionId', case when v_delegate then null else p_option end,
      'optionLabel', v_label,
      'message', nullif(btrim(coalesce(p_message, '')), '')
    ))
  );

  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_validate_choix(uuid, text, uuid, text, text) to anon, authenticated;
