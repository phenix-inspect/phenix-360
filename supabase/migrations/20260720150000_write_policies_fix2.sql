-- PHÉNIX 360 — Simplification de la policy bootstrap membre
-- ============================================================================
-- Diagnostic terrain : `(user_id = auth.uid()) AND app_owns_project(project_id)`
-- refuse l'insertion alors que LES DEUX conditions sont prouvées vraies
-- (app_owns_project = true, user_id = auth.uid()). On retire la condition
-- redondante et on ne garde que `app_owns_project(project_id)` : c'est déjà sûr
-- (on ne peut ajouter un membre qu'à un projet DONT ON EST LE CRÉATEUR).

drop policy if exists project_member_insert_self on project_member;
create policy project_member_insert_self on project_member
  for insert to authenticated
  with check (app_owns_project(project_id));
