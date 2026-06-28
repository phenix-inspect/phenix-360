/**
 * PHÉNIX 360 — Port d'accès au journal (contrat, termes produit)
 * ---------------------------------------------------------------------------
 * Interface neutre vis-à-vis de l'infrastructure (ADR-004 §2.5 r3) : les écrans
 * ne parlent jamais à Supabase en direct, ils parlent à ce port. Changer d'hôte
 * = changer l'adaptateur, pas les appelants.
 */
import type { CaptureId, ProjectId } from '../ids.js';
import type { EventActor } from '../actor.js';
import type {
  Event,
  EventContentByType,
  EventState,
  EventType,
  EventVisibility,
} from '../event.js';
import type { Project } from '../project.js';

/** Données d'un nouvel événement (l'id et la date sont générés côté base). */
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

/**
 * Le port. La visibilité reste appliquée par la RLS à la source : `listEvents`
 * renvoie ce que l'appelant a le droit de voir (le client n'obtient que son
 * journal visible).
 */
export interface JournalRepository {
  getProject(id: ProjectId): Promise<Project | null>;
  listProjects(): Promise<Project[]>;
  listEvents(projectId: ProjectId): Promise<Event[]>;
  /** Écriture interne (capture, validation). Le client passe par la passerelle. */
  appendEvent(input: NewEvent): Promise<Event>;
}
