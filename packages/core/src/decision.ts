/**
 * PHÉNIX 360 — Décision client & action
 * ---------------------------------------------------------------------------
 * `Decision` est une **projection** d'une `demande` adressée au client — pas un
 * enregistrement séparé (le journal reste l'unique source, ADR-001 §2). Elle
 * alimente le bandeau d'accueil « Vous n'avez rien à faire / Une décision vous
 * attend » (S1, une seule priorité — ADR-004 §5 Sprint 3).
 *
 * `ClientAction` est la **commande** par laquelle le client résout une demande
 * (relayée par la passerelle ; le client n'écrit jamais le journal en direct).
 */
import type { EventId, IsoDateTime, ProjectId } from './ids.js';
import type { DemandeEvent, DemandeResolution } from './event.js';

export type DecisionStatus = 'attendue' | 'traitee' | 'close';

export interface Decision {
  eventId: EventId;
  projectId: ProjectId;
  question: string;
  status: DecisionStatus;
  createdAt: IsoDateTime;
  resolution?: DemandeResolution;
}

/** Projette une `demande` en `Decision` lisible côté client. */
export function toDecision(e: DemandeEvent): Decision {
  const status: DecisionStatus =
    e.state === 'ouverte' ? 'attendue' : e.state === 'traitee' ? 'traitee' : 'close';
  return {
    eventId: e.id,
    projectId: e.projectId,
    question: e.content.question,
    status,
    createdAt: e.createdAt,
    resolution: e.content.resolution,
  };
}

/**
 * État du bandeau d'accueil client — une seule priorité à la fois.
 *  • `rien_a_faire`      → « Vous n'avez rien à faire »
 *  • `decision_attendue` → « Une décision vous attend »
 */
export type ClientDecisionBanner =
  { kind: 'rien_a_faire' } | { kind: 'decision_attendue'; total: number; prochaine: Decision };

/** Action du client résolvant une demande (commande, relayée par la passerelle). */
export interface ResolveDemandeAction {
  type: 'resolution_demande';
  eventId: EventId;
  texte: string;
}

/** Union des actions client (extensible). */
export type ClientAction = ResolveDemandeAction;
