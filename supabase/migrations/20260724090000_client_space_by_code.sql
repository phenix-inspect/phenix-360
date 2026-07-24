-- PHÉNIX 360 — Lien client COURT par CODE CHANTIER (M7.3)
-- ============================================================================
-- Le lien client passe de …/#/c/<UUID> à …/#/c/<AA-VV-NNN> (le code chantier
-- lisible : 26-LY-003). Plus court, plus pro, mémorisable. Le navigateur envoie
-- désormais le CODE CHANTIER ; cette fonction le résout en UUID côté serveur puis
-- délègue à `client_space` (inchangée). Le lien UUID historique continue de
-- fonctionner (rétro-compatibilité : la page appelle `client_space` si l'URL
-- porte un UUID, `client_space_by_code` si elle porte un code chantier).
--
-- Sécurité : le code chantier est PUBLIC (il est dans le lien) — la protection
-- reste le code d'accès. En cas d'homonymie de code chantier entre plusieurs
-- conducteurs (compteur annuel propre à chacun), on retient le chantier dont le
-- code d'accès CORRESPOND : jamais de fuite d'un chantier vers un autre.

create or replace function client_space_by_code(p_code text, p_access text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_project uuid;
begin
  select p.id into v_project
  from project p
  join project_client_access a on a.project_id = p.id
  where upper(p.code) = upper(trim(p_code))
    and a.code_hash = crypt(p_access, a.code_hash)
  limit 1;

  if v_project is null then
    raise exception 'forbidden: bad code' using errcode = '42501';
  end if;

  return client_space(v_project, p_access);
end;
$$;
grant execute on function client_space_by_code(text, text) to anon, authenticated;
