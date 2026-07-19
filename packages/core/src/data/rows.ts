/**
 * PHÉNIX 360 — Formes de lignes SQL (snake_case)
 * ---------------------------------------------------------------------------
 * Reflètent les tables Supabase (cf. supabase/migrations). Isolées ici pour que
 * le reste de core ignore le détail du stockage. Converties en types canoniques
 * par les mappers.
 */
import type { Role } from '../actor.js';
import type { EventState, EventType, EventVisibility } from '../event.js';
import type { ProjectStatus, ProjectStep } from '../project.js';

export interface ProjectRow {
  id: string;
  /** Code chantier `AA-VV-NNN` — identifiant définitif (colonne stockée). */
  code: string;
  name: string;
  client_id: string | null;
  status: ProjectStatus;
  current_step: ProjectStep | null;
  created_at: string;
}

export interface MemberRow {
  id: string;
  project_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface EventRow {
  id: string;
  project_id: string;
  type: EventType;
  author_id: string | null;
  author_role: Role;
  visibility: EventVisibility;
  state: EventState;
  capture_id: string | null;
  created_at: string;
  published_by: string | null;
  published_at: string | null;
  /** jsonb — déjà en camelCase (clés alignées sur core). */
  content: unknown;
}
