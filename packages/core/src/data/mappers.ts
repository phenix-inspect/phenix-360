/**
 * PHÉNIX 360 — Mappers ligne SQL ↔ modèle canonique
 * ---------------------------------------------------------------------------
 * Frontière unique entre la forme de stockage (snake_case) et le modèle produit
 * (camelCase, identifiants branded). Le contenu jsonb est stocké tel quel
 * (clés camelCase) : seul un cast typé selon `type` est nécessaire.
 */
import { captureId, eventId, projectId, userId } from '../ids.js';
import type { EventActor } from '../actor.js';
import type {
  ActionEventContent,
  CommunicationContent,
  CompteRenduContent,
  DecisionEventContent,
  DemandeContent,
  DocumentContent,
  Event,
  EventEnvelope,
  LeveeEventContent,
  PhotoContent,
  ReserveEventContent,
} from '../event.js';
import type { Project } from '../project.js';
import type { EventRow, ProjectRow } from './rows.js';
import type { NewEvent } from './repository.js';

export function mapProjectRow(r: ProjectRow): Project {
  return {
    id: projectId(r.id),
    name: r.name,
    clientId: r.client_id !== null ? userId(r.client_id) : null,
    status: r.status,
    currentStep: r.current_step,
    createdAt: r.created_at,
  };
}

export function mapEventRow(r: EventRow): Event {
  const actor: EventActor = {
    userId: userId(r.author_id ?? ''),
    role: r.author_role,
  };
  const envelope: Omit<EventEnvelope, 'type'> = {
    id: eventId(r.id),
    projectId: projectId(r.project_id),
    actor,
    visibility: r.visibility,
    state: r.state,
    captureId: r.capture_id !== null ? captureId(r.capture_id) : null,
    createdAt: r.created_at,
    publishedBy: r.published_by !== null ? userId(r.published_by) : null,
    publishedAt: r.published_at,
  };

  switch (r.type) {
    case 'compte_rendu':
      return { ...envelope, type: 'compte_rendu', content: r.content as CompteRenduContent };
    case 'photo':
      return { ...envelope, type: 'photo', content: r.content as PhotoContent };
    case 'document':
      return { ...envelope, type: 'document', content: r.content as DocumentContent };
    case 'demande':
      return { ...envelope, type: 'demande', content: r.content as DemandeContent };
    case 'decision':
      return { ...envelope, type: 'decision', content: r.content as DecisionEventContent };
    case 'reserve':
      return { ...envelope, type: 'reserve', content: r.content as ReserveEventContent };
    case 'levee':
      return { ...envelope, type: 'levee', content: r.content as LeveeEventContent };
    case 'action':
      return { ...envelope, type: 'action', content: r.content as ActionEventContent };
    case 'communication':
      return { ...envelope, type: 'communication', content: r.content as CommunicationContent };
  }
}

/** Construit la ligne d'insertion (id/date générés par la base). */
export function toEventInsert(input: NewEvent): Omit<EventRow, 'id' | 'created_at'> {
  return {
    project_id: input.projectId,
    type: input.type,
    author_id: input.actor.userId,
    author_role: input.actor.role,
    visibility: input.visibility,
    state: input.state,
    capture_id: input.captureId ?? null,
    published_by: null,
    published_at: null,
    content: input.content,
  };
}
