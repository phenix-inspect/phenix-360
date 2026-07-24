-- PHÉNIX 360 — Notifications e-mail au conducteur (activité du client)
-- ============================================================================
-- Le site est statique (GitHub Pages) : l'envoi d'e-mail se fait CÔTÉ SERVEUR,
-- depuis Postgres via l'extension `pg_net` (appel HTTP asynchrone à l'API Resend).
-- Quand le client agit (valide un choix, répond, écrit, envoie un document,
-- commente les coulisses), on prévient le conducteur par e-mail — utile quand
-- l'app est fermée (en direct, il le voit déjà via Realtime).
--
-- Compat TESTS : sur un Postgres nu (sans pg_net), `notify_conductor` est un
-- NO-OP silencieux — le suite RLS reste verte, aucune RPC ne casse. En production,
-- il faut : (1) activer l'extension pg_net, (2) poser la clé Resend dans app_secret.

-- Coffre à secrets serveur : AUCUNE policy → inaccessible via l'API PostgREST ;
-- seules les fonctions SECURITY DEFINER (ci-dessous) le lisent.
create table if not exists app_secret (
  k text primary key,
  v text not null
);
alter table app_secret enable row level security;

-- Envoie un e-mail au conducteur du projet (best-effort, jamais bloquant).
create or replace function notify_conductor(p_project uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key   text;
  v_from  text;
  v_email text;
  v_pname text;
  v_pcode text;
  v_body  text;
  v_html  text;
begin
  -- pg_net absent (Postgres nu / tests) → no-op silencieux.
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;
  select v into v_key from app_secret where k = 'resend_key';
  if coalesce(v_key, '') = '' then return; end if;
  select coalesce((select v from app_secret where k = 'resend_from'),
                  'PHÉNIX 360 <onboarding@resend.dev>') into v_from;

  -- Destinataire : le conducteur (membre interne) du chantier.
  select u.email into v_email
    from auth.users u
    join project_member m on m.user_id = u.id
   where m.project_id = p_project and m.role in ('compagnon', 'equipe')
   order by m.created_at
   limit 1;
  if coalesce(v_email, '') = '' then return; end if;

  select name, code into v_pname, v_pcode from project where id = p_project;

  -- Échappe le texte client (jamais d'HTML injecté dans l'e-mail).
  v_body := replace(replace(replace(coalesce(p_body, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  v_html := '<div style="font-family:system-ui,sans-serif;color:#221c12">'
         || '<p style="font-size:16px">' || v_body || '</p>'
         || '<p style="color:#8a8069;font-size:13px">Chantier : ' || coalesce(v_pname, '')
         || case when v_pcode is not null then ' · ' || v_pcode else '' end || '</p>'
         || '<p><a href="https://monphenix360.fr/" '
         || 'style="color:#a9803a">Ouvrir PHÉNIX 360</a></p>'
         || '<p style="color:#b8ac90;font-size:12px">— PHÉNIX 360</p></div>';

  -- Resend via pg_net (asynchrone). EXECUTE dynamique : `net.http_post` n'est résolu
  -- qu'à l'exécution → la fonction se CRÉE même sans pg_net (compat tests).
  begin
    execute 'select net.http_post(url := $1, headers := $2::jsonb, body := $3::jsonb)'
      using
        'https://api.resend.com/emails',
        jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
        jsonb_build_object('from', v_from, 'to', v_email,
                           'subject', 'PHÉNIX 360 — activité sur votre chantier', 'html', v_html);
  exception when others then
    return; -- une notif ratée ne casse jamais l'action du client
  end;
end;
$$;

-- --- Les RPC client appellent notify_conductor au moment exact de l'action ----

create or replace function client_respond_demande(
  p_project uuid, p_code text, p_event uuid, p_texte text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text; v_ok boolean;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;
  if length(coalesce(btrim(p_texte), '')) = 0 then
    raise exception 'reponse vide' using errcode = '22023';
  end if;
  select exists (
    select 1 from event
    where id = p_event and project_id = p_project and type = 'demande'
      and visibility = 'client' and (content ->> 'destinataire') = 'client' and state = 'ouverte'
  ) into v_ok;
  if not v_ok then
    raise exception 'demande introuvable ou deja traitee' using errcode = '42501';
  end if;
  update event
     set content = content || jsonb_build_object('resolution', jsonb_build_object(
           'texte', btrim(p_texte),
           'resolvedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'resolvedBy', (select client_id from project where id = p_project))),
         state = 'traitee'
   where id = p_event;
  perform notify_conductor(p_project, 'Votre client a répondu à une demande.');
  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_respond_demande(uuid, text, uuid, text) to anon, authenticated;

create or replace function client_validate_choix(
  p_project uuid, p_code text, p_event uuid, p_option text, p_message text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text; v_content jsonb; v_selection text; v_categorie text; v_avant text;
  v_delegate boolean; v_kind text; v_label text; v_done boolean;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;
  select content into v_content from event
   where id = p_event and project_id = p_project and type = 'decision'
     and (content ->> 'kind') in ('envoyee','renvoyee');
  if v_content is null then
    raise exception 'choix introuvable' using errcode = '42501';
  end if;
  v_selection := v_content ->> 'selectionId';
  v_categorie := v_content ->> 'categorie';
  v_avant := coalesce(v_content ->> 'statutApres', 'propose');
  select exists (
    select 1 from event where project_id = p_project and type = 'decision'
      and (content ->> 'selectionId') = v_selection
      and (content ->> 'kind') in ('validee','deleguee')
  ) into v_done;
  if v_done then raise exception 'choix deja resolu' using errcode = '42501'; end if;
  v_delegate := (p_option = '__phenix_delegate__');
  v_kind := case when v_delegate then 'deleguee' else 'validee' end;
  if v_delegate then
    v_label := 'PHÉNIX décide';
  else
    select opt ->> 'title' into v_label
    from jsonb_array_elements(coalesce(v_content -> 'choix' -> 'options', '[]'::jsonb)) opt
    where opt ->> 'id' = p_option limit 1;
    if v_label is null then raise exception 'option inconnue' using errcode = '22023'; end if;
  end if;
  insert into event(project_id, type, author_id, author_role, visibility, state, content)
  values (p_project, 'decision', null, 'client', 'client', 'publie',
    jsonb_strip_nulls(jsonb_build_object(
      'kind', v_kind, 'origin', 'client', 'selectionId', v_selection,
      'categorie', v_categorie, 'statutAvant', v_avant, 'statutApres', 'valide',
      'optionId', case when v_delegate then null else p_option end,
      'optionLabel', v_label, 'message', nullif(btrim(coalesce(p_message,'')), ''))));
  perform notify_conductor(p_project, case when v_delegate
    then 'Votre client a confié un choix à PHÉNIX (' || coalesce(v_categorie, 'choix') || ').'
    else 'Votre client a validé un choix : ' || coalesce(v_label, '') || '.' end);
  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_validate_choix(uuid, text, uuid, text, text) to anon, authenticated;

create or replace function client_message(p_project uuid, p_code text, p_texte text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  select code_hash into v_hash from project_client_access where project_id = p_project;
  if v_hash is null or v_hash <> crypt(p_code, v_hash) then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;
  if length(coalesce(btrim(p_texte), '')) = 0 then
    raise exception 'message vide' using errcode = '22023';
  end if;
  insert into event(project_id, type, author_id, author_role, visibility, state, content)
  values (p_project, 'demande', null, 'client', 'client', 'ouverte',
          jsonb_build_object('question', btrim(p_texte), 'destinataire', 'phenix'));
  perform notify_conductor(p_project, 'Nouveau message de votre client : « ' || btrim(p_texte) || ' »');
  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_message(uuid, text, text) to anon, authenticated;

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

  perform notify_conductor(p_project, 'Votre client a commenté dans les coulisses : « ' || v_txt || ' »');
  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_moment_message(uuid, text, text, text, text) to anon, authenticated;

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
  insert into event(project_id, type, author_id, author_role, visibility, state, content)
  values (
    p_project, 'document', null, 'client', 'client', 'publie',
    jsonb_build_object('attachment', p_doc, 'libelle', v_libelle)
  )
  returning id into v_doc_id;
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
  perform notify_conductor(p_project, 'Votre client a envoyé un document : ' || v_libelle || '.');
  return client_space(p_project, p_code);
end;
$$;
grant execute on function client_respond_document(uuid, text, uuid, text, jsonb, text)
  to anon, authenticated;
