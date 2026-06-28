-- PHÉNIX 360 — Row Level Security (cœur de la sécurité, ADR-004 §4)
-- ============================================================================
-- La RLS applique la visibilité à la SOURCE (jamais le seul front). La policy
-- de lecture client est le MIROIR exact de core.isVisibleToClient() : le
-- produit définit la règle (TS), la base la fait respecter (SQL).
--
-- Écritures sensibles : le client n'écrit jamais le journal en direct — tout
-- passe par la passerelle (rôle de service, qui bypass la RLS et REVALIDE).

-- ----------------------------------------------------------------------------
-- Helpers d'appartenance (security definer pour éviter la récursion RLS)
-- ----------------------------------------------------------------------------
create or replace function app_is_member(p_project uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from project_member m
    where m.project_id = p_project and m.user_id = auth.uid()
  );
$$;

create or replace function app_has_role(p_project uuid, p_role member_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from project_member m
    where m.project_id = p_project and m.user_id = auth.uid() and m.role = p_role
  );
$$;

-- Membre « interne » Phénix = compagnon ou équipe (accès complet à ses projets).
create or replace function app_is_internal(p_project uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from project_member m
    where m.project_id = p_project
      and m.user_id = auth.uid()
      and m.role in ('compagnon', 'equipe')
  );
$$;

-- ----------------------------------------------------------------------------
-- project
-- ----------------------------------------------------------------------------
alter table project enable row level security;

create policy project_select_member on project
  for select using (app_is_member(id) or client_id = auth.uid());

create policy project_update_internal on project
  for update using (app_is_internal(id)) with check (app_is_internal(id));
-- insert/delete : rôle de service uniquement (création gérée par la passerelle).

-- ----------------------------------------------------------------------------
-- project_member
-- ----------------------------------------------------------------------------
alter table project_member enable row level security;

create policy project_member_select_member on project_member
  for select using (app_is_member(project_id));
-- écritures : rôle de service uniquement (gestion des accès par la passerelle).

-- ----------------------------------------------------------------------------
-- event — la colonne vertébrale
-- ----------------------------------------------------------------------------
alter table event enable row level security;

-- Lecture INTERNE (compagnon/équipe) : accès complet à leurs projets.
create policy event_select_internal on event
  for select using (app_is_internal(project_id));

-- Lecture CLIENT : MIROIR de core.isVisibleToClient().
create policy event_select_client on event
  for select using (
    visibility = 'client'
    and app_has_role(project_id, 'client')
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
  );

-- Écriture INTERNE : capture terrain + validation/publication + résolution.
create policy event_insert_internal on event
  for insert with check (app_is_internal(project_id) and author_id = auth.uid());

create policy event_update_internal on event
  for update using (app_is_internal(project_id)) with check (app_is_internal(project_id));
-- delete : aucun (journal non destructif ; rôle de service si réellement nécessaire).
-- Le client n'a AUCUNE policy d'écriture : ses actions passent par la passerelle.
