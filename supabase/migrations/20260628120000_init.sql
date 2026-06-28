-- PHÉNIX 360 — Schéma initial : le journal d'événements au centre
-- ============================================================================
-- Traduction directe du modèle canonique @phenix360/core (ADR-001/002/004).
-- Le PRODUIT dicte le schéma : ces tables reflètent core, pas l'inverse.
--
-- Amendement ADR-004 §4 : noms de tables alignés sur core (anglais : project,
-- project_member, event) ; les VALEURS d'enum restent en français (vocabulaire
-- métier : compte_rendu, gros_oeuvre…). Décision produit 2026-06-28.
--
-- Portabilité (ADR-004 §2.5) : tout est code et versionné ; rien de cloud-only.

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Énumérations (miroir des unions de core)
-- ----------------------------------------------------------------------------
create type member_role      as enum ('compagnon', 'equipe', 'client'); -- 'sous_traitant' plus tard
create type event_type       as enum ('compte_rendu', 'photo', 'document', 'demande');
create type event_visibility as enum ('client', 'interne');
create type event_state      as enum ('brouillon', 'publie', 'ouverte', 'traitee', 'close');
create type project_step     as enum ('gros_oeuvre', 'second_oeuvre', 'finitions', 'reception');
create type project_status   as enum ('en_preparation', 'en_cours', 'receptionne');

-- ----------------------------------------------------------------------------
-- project (≡ chantier) — un projet = un journal (ADR-001 §2)
-- ----------------------------------------------------------------------------
create table project (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  client_id     uuid references auth.users on delete set null, -- V1 : un client = un chantier
  status        project_status not null default 'en_preparation',
  current_step  project_step,                                  -- cache dérivé du dernier CR publié
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- project_member — qui a accès, et avec quel rôle (pilote la RLS)
-- ----------------------------------------------------------------------------
create table project_member (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references project(id) on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  role        member_role not null,
  created_at  timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_member_user_idx on project_member (user_id);

-- ----------------------------------------------------------------------------
-- event — LA colonne vertébrale (enveloppe commune + contenu typé)
-- ----------------------------------------------------------------------------
create table event (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references project(id) on delete cascade,
  type          event_type not null,
  author_id     uuid references auth.users on delete set null, -- l'IA n'est JAMAIS auteur (ADR-001 §3)
  author_role   member_role not null,
  visibility    event_visibility not null default 'interne',
  state         event_state not null,
  capture_id    uuid,                                          -- saisie : 1 CR + N photos (ADR-002 §7)
  created_at    timestamptz not null default now(),
  published_by  uuid references auth.users on delete set null, -- validation = ÉTAT (ADR-002 §4)
  published_at  timestamptz,
  content       jsonb not null,                                -- contenu typé (clés camelCase, cf. core)

  -- Intégrité minimale alignée sur core (validation fine côté app + passerelle) :
  -- l'état appartient au bon cycle de vie selon le type.
  constraint event_state_for_type check (
    case
      when type = 'demande' then state in ('ouverte', 'traitee', 'close')
      else state in ('brouillon', 'publie')
    end
  ),
  -- le contenu typé porte au moins ses clés requises (clés camelCase = core).
  constraint event_content_shape check (
    case type
      when 'compte_rendu' then content ? 'texte'
      when 'photo'        then content ? 'attachment'
      when 'document'     then (content ? 'attachment' and content ? 'libelle')
      when 'demande'      then (content ? 'question' and content ? 'destinataire')
    end
  ),
  -- publication cohérente : les deux champs ensemble, ou aucun.
  constraint event_published_pair check ((published_at is null) = (published_by is null))
);

-- Vues = lectures filtrées (ADR-004 §4) : index pour le fil, les types, la saisie.
create index event_project_created_idx on event (project_id, created_at desc);
create index event_project_type_idx    on event (project_id, type);
create index event_capture_idx         on event (capture_id);

-- ----------------------------------------------------------------------------
-- Cache d'avancement : project.current_step = étape du dernier CR publié.
-- Miroir SQL de core.currentStep() — aucune saisie manuelle, pure dérivation.
-- ----------------------------------------------------------------------------
create or replace function set_project_current_step()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.project_id, old.project_id);
begin
  update project p
  set current_step = (
    select (e.content ->> 'etapeConfirmee')::project_step
    from event e
    where e.project_id = target
      and e.type = 'compte_rendu'
      and e.state = 'publie'
      and e.content ? 'etapeConfirmee'
      and (e.content ->> 'etapeConfirmee') is not null
    order by e.created_at desc
    limit 1
  )
  where p.id = target;
  return null;
end;
$$;

create trigger trg_event_current_step
after insert or update or delete on event
for each row execute function set_project_current_step();
