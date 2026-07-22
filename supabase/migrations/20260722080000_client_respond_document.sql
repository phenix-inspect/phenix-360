-- PHÉNIX 360 — Écriture client : RÉPONDRE avec un DOCUMENT (M7.2 · durable)
-- ============================================================================
-- Quand le conducteur demande un document au client (« Demander au client →
-- Document »), le client répond en JOIGNANT un fichier. Jusqu'ici, côté lien
-- client, le fichier n'était pas durable. Cette RPC code-gardée le rend durable :
-- elle crée un événement `document` (visible client) ET résout la demande en le
-- pointant (`docEventId`), le tout côté serveur.
--
-- Le fichier arrive en `p_doc` (jsonb : l'EventAttachment, avec `dataUrl` base64 —
-- le client anonyme ne peut pas écrire dans Storage, réservé aux membres internes).
-- `author_id` NULL, `author_role='client'`.

create or replace function client_respond_document(
  p_project uuid, p_code text, p_event uuid, p_texte text, p_doc jsonb, p_libelle text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash    text;
  v_ok      boolean;
  v_doc_id  uuid;
  v_libelle text;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;

  -- La demande doit être une demande de document adressée au client, encore ouverte.
  select exists (
    select 1 from event
    where id = p_event and project_id = p_project and type = 'demande'
      and visibility = 'client' and (content ->> 'destinataire') = 'client'
      and state = 'ouverte'
  ) into v_ok;
  if not v_ok then
    raise exception 'demande introuvable ou deja traitee' using errcode = '42501';
  end if;

  if p_doc is null or jsonb_typeof(p_doc) <> 'object' then
    raise exception 'document manquant' using errcode = '22023';
  end if;

  v_libelle := coalesce(nullif(btrim(coalesce(p_libelle, '')), ''), p_doc ->> 'fileName', 'Document');

  -- 1) L'événement DOCUMENT (visible client, publié), auteur = client (NULL id).
  insert into event(project_id, type, author_id, author_role, visibility, state, content)
  values (
    p_project, 'document', null, 'client', 'client', 'publie',
    jsonb_build_object('attachment', p_doc, 'libelle', v_libelle)
  )
  returning id into v_doc_id;

  -- 2) La demande passe à « traitee » en pointant le document créé.
  update event
     set content = content || jsonb_build_object(
           'resolution',
           jsonb_build_object(
             'texte', coalesce(btrim(p_texte), ''),
             'docEventId', v_doc_id,
             'resolvedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'resolvedBy', (select client_id from project where id = p_project)
           )
         ),
         state = 'traitee'
   where id = p_event;

  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_respond_document(uuid, text, uuid, text, jsonb, text)
  to anon, authenticated;
