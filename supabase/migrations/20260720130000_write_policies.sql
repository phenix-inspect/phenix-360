-- PHÉNIX 360 — Règles d'écriture pilote (écritures directes sous RLS)
-- ============================================================================
-- Décision pilote (ADR-006 §7 / Road B) : plutôt que de router toute écriture
-- par une passerelle de service, on autorise les MEMBRES INTERNES connectés à
-- écrire directement dans la base — la RLS reste le garde-fou à la source.
--
-- Amorçage (bootstrap) : un utilisateur connecté crée un projet (il en devient
-- le `created_by`), puis s'ajoute lui-même comme `compagnon` de CE projet — il
-- devient alors « interne » et peut écrire le journal. Il ne peut PAS s'inviter
-- dans le projet d'un autre. Additif et sûr sur base fraîche.

-- Traçabilité du créateur (par défaut : l'utilisateur courant).
alter table project add column if not exists created_by uuid default auth.uid() references auth.users on delete set null;

-- project : le créateur voit / insère / supprime ses projets (en plus des
-- policies membre/client existantes).
drop policy if exists project_select_creator on project;
create policy project_select_creator on project
  for select to authenticated using (created_by = auth.uid());

drop policy if exists project_insert_creator on project;
create policy project_insert_creator on project
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists project_delete_owner on project;
create policy project_delete_owner on project
  for delete to authenticated using (created_by = auth.uid() or app_is_internal(id));

-- project_member : (a) je m'ajoute MOI-MÊME à un projet que J'AI créé
-- (bootstrap) ; (b) un membre interne ajoute n'importe qui à son projet.
drop policy if exists project_member_insert_self on project_member;
create policy project_member_insert_self on project_member
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from project p where p.id = project_id and p.created_by = auth.uid())
  );

drop policy if exists project_member_insert_internal on project_member;
create policy project_member_insert_internal on project_member
  for insert to authenticated with check (app_is_internal(project_id));

-- event : l'insertion interne existe déjà (app_is_internal + author_id = auth.uid()).
-- Rien à ajouter ici — le créateur devenu compagnon écrit le journal.
