/**
 * PHÉNIX 360 — Ports d'accès aux données (contrats, termes produit)
 * ---------------------------------------------------------------------------
 * Interfaces neutres vis-à-vis de l'infrastructure (ADR-004 §2.5 r3). Le produit
 * et l'UI ne parlent qu'à ces ports ; passer en Supabase = remplacer
 * l'implémentation, sans toucher au produit, à l'UI, ni à la logique métier.
 */
import type { CaptureId, EventId, ProjectId, UserId } from '../ids.js';
import type { EventActor, Role } from '../actor.js';
import type {
  DemandeResolution,
  Event,
  EventContentByType,
  EventState,
  EventType,
  EventVisibility,
} from '../event.js';
import type { Project, ProjectMember, ProjectStatus, ProjectStep } from '../project.js';

/* -------------------------------------------------------------------------- *
 * Projets & membres
 * -------------------------------------------------------------------------- */
export interface NewProject {
  name: string;
  clientId?: UserId | null;
  status?: ProjectStatus;
  /** Adresse du chantier (saisie à la création d'un chantier réel). */
  address?: string;
  /** Étape de départ (sinon dérivée des comptes rendus, `null` au début). */
  currentStep?: ProjectStep | null;
}

export interface ProjectPatch {
  name?: string;
  status?: ProjectStatus;
  address?: string;
  currentStep?: ProjectStep | null;
}

export interface NewMember {
  projectId: ProjectId;
  userId: UserId;
  role: Role;
}

export interface ProjectRepository {
  createProject(input: NewProject): Promise<Project>;
  getProject(id: ProjectId): Promise<Project | null>;
  listProjects(): Promise<Project[]>;
  updateProject(id: ProjectId, patch: ProjectPatch): Promise<Project>;
  /** Supprime un projet et TOUTES ses données colonne vertébrale (membres, événements). */
  deleteProject(id: ProjectId): Promise<void>;
  listMembers(projectId: ProjectId): Promise<ProjectMember[]>;
  addMember(input: NewMember): Promise<ProjectMember>;
}

/* -------------------------------------------------------------------------- *
 * Événements
 * -------------------------------------------------------------------------- */

/** Données d'un nouvel événement (id et date générés par l'implémentation). */
export type NewEvent = {
  [K in EventType]: {
    projectId: ProjectId;
    type: K;
    actor: EventActor;
    visibility: EventVisibility;
    state: EventState;
    captureId?: CaptureId | null;
    content: EventContentByType[K];
  };
}[EventType];

export interface EventRepository {
  listEvents(projectId: ProjectId): Promise<Event[]>;
  /** Crée un événement (brouillon ou publié selon `state`). */
  appendEvent(input: NewEvent): Promise<Event>;
  /** Validation = ÉTAT : passe un événement à `publie` (ADR-002 §4). */
  publishEvent(id: EventId, publishedBy: UserId): Promise<Event>;
  /** Change la VISIBILITÉ d'un événement (interne ↔ client) — partage a posteriori. */
  setEventVisibility(id: EventId, visibility: EventVisibility): Promise<Event>;
  /** Résout une demande (réponse portée par la demande ; clôt le besoin). */
  resolveDemande(id: EventId, resolution: DemandeResolution): Promise<Event>;
}

/** Aperçu agrégé pratique (un backend implémente les deux ports). */
export interface Backend extends ProjectRepository, EventRepository {}

/**
 * Port historique (lecture + append) — conservé pour l'adaptateur Supabase
 * existant. `Backend` le couvre et l'étend.
 */
export interface JournalRepository {
  getProject(id: ProjectId): Promise<Project | null>;
  listProjects(): Promise<Project[]>;
  listEvents(projectId: ProjectId): Promise<Event[]>;
  appendEvent(input: NewEvent): Promise<Event>;
}
