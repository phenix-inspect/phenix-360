-- PHÉNIX 360 — Correctif bootstrap membre (fonction security definer)
-- ============================================================================
-- La policy `project_member_insert_self` s'appuyait sur une sous-requête inline
-- sur `project` évaluée SOUS la RLS de `project` — fragile en pratique. On la
-- remplace par un helper SECURITY DEFINER `app_owns_project()` (même patron que
-- `app_is_member` / `app_is_internal`) qui vérifie la propriété SANS récursion RLS.

create or replace function app_owns_project(p_project uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from project where id = p_project and created_by = auth.uid()
  );
$$;

grant execute on function app_owns_project(uuid) to authenticated;

-- Le créateur s'ajoute lui-même comme membre de SON projet (bootstrap interne).
drop policy if exists project_member_insert_self on project_member;
create policy project_member_insert_self on project_member
  for insert to authenticated
  with check (user_id = auth.uid() and app_owns_project(project_id));
