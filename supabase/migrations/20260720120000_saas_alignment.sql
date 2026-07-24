-- PHÉNIX 360 — Alignement du schéma sur le produit (migration SaaS M2)
-- ============================================================================
-- Le schéma initial (Sprint 0) est antérieur à plusieurs évolutions produit.
-- Cette migration l'aligne sur `packages/core` pour que l'adaptateur Supabase
-- (SupabaseBackend) fonctionne à l'identique de la démo, SANS rien changer au
-- produit ni à l'UI. Additive et sûre sur une base fraîche (aucune donnée).
--
-- Alignements :
--   • project : code chantier `AA-VV-NNN` (unique) + adresse ;
--   • project_status : valeurs de core (l'enum Sprint 0 était obsolète) ;
--   • member_role : ajout de `sous_traitant` (l'artisan, Mode Artisan) ;
--   • event_type : ajout des types apparus depuis (decision, reserve, levee,
--     action, communication) — le contenu reste jsonb typé côté core.

-- ----------------------------------------------------------------------------
-- project : identifiant chantier + adresse
-- ----------------------------------------------------------------------------
alter table project add column if not exists code text;
alter table project add column if not exists address text;
-- Unicité du code (plusieurs NULL tolérés : le code est posé par l'app à la création).
create unique index if not exists project_code_key on project (code);

-- ----------------------------------------------------------------------------
-- project_status : aligner sur core (pas_commence / en_cours / pre_reception /
-- levee_reserves / cloture). Recréation propre (table vide à ce stade).
-- ----------------------------------------------------------------------------
alter table project alter column status drop default;
alter table project alter column status type text using status::text;
drop type project_status;
create type project_status as enum (
  'pas_commence',
  'en_cours',
  'pre_reception',
  'levee_reserves',
  'cloture'
);
-- Reconvertit les éventuelles valeurs héritées vers le vocabulaire de core.
alter table project
  alter column status type project_status
  using (
    case status
      when 'en_preparation' then 'pas_commence'
      when 'receptionne' then 'cloture'
      when 'en_cours' then 'en_cours'
      else 'pas_commence'
    end::project_status
  );
alter table project alter column status set default 'pas_commence';

-- ----------------------------------------------------------------------------
-- member_role : l'artisan intervenant
-- ----------------------------------------------------------------------------
alter type member_role add value if not exists 'sous_traitant';

-- ----------------------------------------------------------------------------
-- event_type : types apparus depuis le Sprint 0 (contenu jsonb typé côté core)
-- ----------------------------------------------------------------------------
alter type event_type add value if not exists 'decision';
alter type event_type add value if not exists 'reserve';
alter type event_type add value if not exists 'levee';
alter type event_type add value if not exists 'action';
alter type event_type add value if not exists 'communication';
