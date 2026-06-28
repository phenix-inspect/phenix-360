/**
 * PHÉNIX 360 — Vues dérivées du journal
 * ---------------------------------------------------------------------------
 * Les « modules » (galerie, coffre, file de demandes, avancement, bandeau…) ne
 * sont PAS des silos : ce sont des **lectures filtrées** du journal (ADR-001 §2,
 * ADR-004 §4). Sélecteurs purs, sans dépendance — réutilisables côté interface
 * PHÉNIX, espace client, et passerelle/assistant.
 */
import type { DocumentEvent, Event, PhotoEvent, DemandeEvent } from './event.js';
import {
  isCompteRendu,
  isDemande,
  isDocument,
  isPhoto,
  isPublished,
  isVisibleToClient,
  isAwaitingClientDecision,
} from './event.js';
import type { ProjectStep } from './project.js';
import type { ClientDecisionBanner, Decision } from './decision.js';
import { toDecision } from './decision.js';

/** Tri chronologique stable (par `createdAt` ISO). */
export function sortByDate<T extends { createdAt: string }>(
  items: T[],
  dir: 'asc' | 'desc' = 'desc',
): T[] {
  const sign = dir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => sign * a.createdAt.localeCompare(b.createdAt));
}

/** Restreint le journal à ce que le client a le droit de voir (miroir RLS). */
export function forClient(events: Event[]): Event[] {
  return events.filter(isVisibleToClient);
}

/**
 * Avancement courant du chantier = étape du dernier `compte_rendu` publié et
 * confirmé (ADR-002 §5). Aucun stockage séparé : pure lecture du journal.
 */
export function currentStep(events: Event[]): ProjectStep | null {
  const confirmed = sortByDate(events.filter(isCompteRendu).filter(isPublished), 'desc').find(
    (e) => e.content.etapeConfirmee != null,
  );
  return confirmed?.content.etapeConfirmee ?? null;
}

/** Galerie d'avancement — les photos (récentes d'abord). */
export function gallery(events: Event[]): PhotoEvent[] {
  return sortByDate(events.filter(isPhoto), 'desc');
}

/** Coffre / liste des documents. */
export function vault(events: Event[]): DocumentEvent[] {
  return sortByDate(events.filter(isDocument), 'desc');
}

/** File des demandes à traiter côté Phénix (ouvertes) — une liste de tâches. */
export function teamQueue(events: Event[]): DemandeEvent[] {
  return sortByDate(
    events.filter(isDemande).filter((e) => e.state === 'ouverte'),
    'asc',
  );
}

/** Le récit client : tout le journal visible au client, récent d'abord. */
export function clientFeed(events: Event[]): Event[] {
  return sortByDate(forClient(events), 'desc');
}

/** Décisions en attente du client (anciennes d'abord : on traite la plus vieille). */
export function pendingClientDecisions(events: Event[]): Decision[] {
  return sortByDate(events.filter(isAwaitingClientDecision), 'asc').map(toDecision);
}

/** État du bandeau d'accueil client — une seule priorité. */
export function clientDecisionBanner(events: Event[]): ClientDecisionBanner {
  const pending = pendingClientDecisions(events);
  const next = pending[0];
  if (next === undefined) return { kind: 'rien_a_faire' };
  return { kind: 'decision_attendue', total: pending.length, prochaine: next };
}
