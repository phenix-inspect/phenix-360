-- PHÉNIX 360 — Écriture client : répondre à une demande (M7.2.1)
-- ============================================================================
-- Le client (anonyme) répond à une demande que le conducteur lui a adressée. Le
-- code est vérifié CÔTÉ SERVEUR (comme en lecture) ; la fonction ne touche QUE
-- des demandes `visibility='client'`, `destinataire='client'`, encore `ouverte`
-- du bon projet — impossible d'écrire ailleurs. `author_id` reste NULL (le client
-- n'a pas de compte) ; `author_role='client'`. Renvoie l'espace client à jour.

create or replace function client_respond_demande(
  p_project uuid, p_code text, p_event uuid, p_texte text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_ok   boolean;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;

  if length(coalesce(btrim(p_texte), '')) = 0 then
    raise exception 'reponse vide' using errcode = '22023';
  end if;

  -- La demande doit exister, appartenir au projet, être adressée au client et
  -- encore ouverte (sinon on refuse — pas de réécriture d'une réponse).
  select exists (
    select 1 from event
    where id = p_event
      and project_id = p_project
      and type = 'demande'
      and visibility = 'client'
      and (content ->> 'destinataire') = 'client'
      and state = 'ouverte'
  ) into v_ok;
  if not v_ok then
    raise exception 'demande introuvable ou deja traitee' using errcode = '42501';
  end if;

  update event
     set content = content || jsonb_build_object(
           'resolution',
           jsonb_build_object(
             'texte', btrim(p_texte),
             'resolvedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'resolvedBy', (select client_id from project where id = p_project)
           )
         ),
         state = 'traitee'
   where id = p_event;

  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_respond_demande(uuid, text, uuid, text) to anon, authenticated;
