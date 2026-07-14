/**
 * PHÉNIX 360 — Vues dérivées du journal
 * ---------------------------------------------------------------------------
 * Les « modules » (galerie, coffre, file de demandes, avancement, bandeau…) ne
 * sont PAS des silos : ce sont des **lectures filtrées** du journal (ADR-001 §2,
 * ADR-004 §4). Sélecteurs purs, sans dépendance — réutilisables côté interface
 * PHÉNIX, espace client, et passerelle/assistant.
 */
import type { DecisionEvent, DocumentEvent, Event, PhotoEvent, DemandeEvent } from './event.js';
import {
  isCompteRendu,
  isDecision,
  isDemande,
  isDocument,
  isLevee,
  isPhoto,
  isPublished,
  isReserve,
  isVisibleToClient,
  isAwaitingClientDecision,
} from './event.js';
import type { LeveeEvent, ReserveEvent } from './event.js';
import type { Project, ProjectStatus, ProjectStep } from './project.js';
import { PROJECT_STATUS_ORDER } from './project.js';
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

/**
 * Une PRÉ-RÉCEPTION a-t-elle été VALIDÉE (compte rendu publié la portant) ? Seuls
 * les documents publiés comptent : un brouillon n'est jamais une étape franchie.
 */
export function hasValidatedPrereception(events: Event[]): boolean {
  return events.some((e) => isCompteRendu(e) && isPublished(e) && !!e.content.prereception);
}

/** Une RÉCEPTION a-t-elle été validée (compte rendu publié la portant) ? */
export function hasValidatedReception(events: Event[]): boolean {
  return events.some((e) => isCompteRendu(e) && isPublished(e) && !!e.content.reception);
}

/**
 * STATUT RÉEL du chantier — SOURCE DE VÉRITÉ UNIQUE (Condition bêta #5).
 * ---------------------------------------------------------------------------
 * Le statut stocké (`project.status`) est saisi à la main ; les faits (le Journal)
 * priment toujours. Cette fonction réconcilie les deux et INTERDIT les états
 * impossibles :
 *  • une RÉCEPTION validée ⇒ « Clôturé » (elle n'existe que toutes réserves levées,
 *    donc jamais « Clôturé avec réserves ouvertes ») ;
 *  • « Clôturé » sans réception validée est impossible → on redescend au fait justifié ;
 *  • une PRÉ-RÉCEPTION validée fait passer AU MOINS en « Pré-réception » (un statut
 *    manuel plus bas, ou un brouillon, ne peut pas la contredire).
 * Toute lecture de statut pour AFFICHAGE ou LOGIQUE doit passer par ici.
 */
export function deriveProjectStatus(project: Project, events: Event[]): ProjectStatus {
  if (hasValidatedReception(events)) return 'cloture';
  const floor: ProjectStatus = hasValidatedPrereception(events) ? 'pre_reception' : 'pas_commence';
  let s = project.status;
  // « Clôturé » sans réception validée : impossible → on retombe sur le fait justifié.
  if (s === 'cloture') s = hasValidatedPrereception(events) ? 'levee_reserves' : 'en_cours';
  // On ne descend jamais SOUS le plancher imposé par les faits.
  if (PROJECT_STATUS_ORDER[s] < PROJECT_STATUS_ORDER[floor]) s = floor;
  return s;
}

/**
 * Le statut est-il VERROUILLÉ par les faits (non modifiable à la main) ? Une
 * réception validée fige le chantier à « Clôturé ».
 */
export function isProjectStatusLocked(events: Event[]): boolean {
  return hasValidatedReception(events);
}

/** Galerie d'avancement — les photos (récentes d'abord). */
export function gallery(events: Event[]): PhotoEvent[] {
  return sortByDate(events.filter(isPhoto), 'desc');
}

/** Coffre / liste des documents. */
export function vault(events: Event[]): DocumentEvent[] {
  return sortByDate(events.filter(isDocument), 'desc');
}

/**
 * Questions du CLIENT en attente d'une réponse de PHÉNIX (les plus anciennes
 * d'abord). PHÉNIX n'a pas de demandes internes : le conducteur répond, il ne
 * se crée pas de tâches. Lecture filtrée du journal — aucune duplication.
 */
export function questionsEnAttente(events: Event[]): DemandeEvent[] {
  return sortByDate(
    events
      .filter(isDemande)
      .filter((e) => e.content.destinataire === 'phenix' && e.state === 'ouverte'),
    'asc',
  );
}

/**
 * Toutes les demandes ADRESSÉES à PHÉNIX (question du client), les plus récentes
 * d'abord — répondues ou non. Base du modèle « 1 demande = 1 réponse » : la
 * mémoire du Suivi et la section « Vos demandes » côté client la lisent.
 */
export function demandesPourPhenix(events: Event[]): DemandeEvent[] {
  return sortByDate(
    events.filter(isDemande).filter((e) => e.content.destinataire === 'phenix'),
    'desc',
  );
}

/** Une demande a-t-elle reçu sa réponse (conducteur) ? */
export function demandeRepondue(e: DemandeEvent): boolean {
  return e.content.resolution != null;
}

/**
 * Signalements des ARTISANS en attente de validation du conducteur (« j'ai
 * terminé, à valider »). Canal distinct des questions client — lecture filtrée
 * du journal (Mode Artisan). Toujours interne : jamais exposé au client.
 */
export function signalementsArtisan(events: Event[]): DemandeEvent[] {
  return sortByDate(
    events
      .filter(isDemande)
      .filter((e) => e.content.destinataire === 'conducteur' && e.state === 'ouverte'),
    'asc',
  );
}

/** Le récit client : tout le journal visible au client, récent d'abord. */
export function clientFeed(events: Event[]): Event[] {
  return sortByDate(forClient(events), 'desc');
}

/**
 * Un événement est un JALON de l'historique (moment majeur de la vie du
 * chantier) : compte rendu publié, document publié (devis, avenant, contractuel),
 * ou demande/décision. Les photos de l'album (« Dans les coulisses ») n'entrent
 * pas dans l'historique du Journal. Vue dérivée — aucune duplication.
 */
export function isMilestone(e: Event): boolean {
  if (isCompteRendu(e)) return isPublished(e);
  if (isDocument(e)) return isPublished(e);
  if (isDemande(e)) return true;
  if (isDecision(e)) return true;
  if (isReserve(e)) return true;
  if (isLevee(e)) return true;
  return false;
}

/** Réserves du chantier (récentes d'abord). Lecture filtrée du journal. */
export function reserveEvents(events: Event[]): ReserveEvent[] {
  return sortByDate(events.filter(isReserve), 'desc');
}

/** Prochain numéro de réserve (incrémental par projet). */
export function nextReserveNumero(events: Event[]): number {
  const nums = events.filter(isReserve).map((e) => e.content.numero);
  return (nums.length > 0 ? Math.max(...nums) : 0) + 1;
}

/**
 * Levée d'une réserve, le cas échéant. Append-only : la levée est un événement
 * AJOUTÉ pointant vers la réserve (jamais une mutation). On retient la plus
 * ancienne (la première levée fait foi).
 */
export function leveeDeReserve(reserve: ReserveEvent, events: Event[]): LeveeEvent | undefined {
  return sortByDate(
    events.filter(isLevee).filter((e) => e.content.reserveId === reserve.id),
    'asc',
  )[0];
}

/** Statut DÉRIVÉ d'une réserve : `levee` si une levée existe, sinon `ouverte`. */
export function reserveStatut(reserve: ReserveEvent, events: Event[]): 'ouverte' | 'levee' {
  return leveeDeReserve(reserve, events) ? 'levee' : 'ouverte';
}

/** Réserves encore ouvertes (aucune levée enregistrée). Récentes d'abord. */
export function reservesOuvertes(events: Event[]): ReserveEvent[] {
  return reserveEvents(events).filter((r) => reserveStatut(r, events) === 'ouverte');
}

/**
 * Historique du projet : les jalons du journal en ordre chronologique
 * (du devis signé jusqu'à aujourd'hui). Lecture filtrée du journal.
 */
export function projectHistory(events: Event[]): Event[] {
  return sortByDate(events.filter(isMilestone), 'asc');
}

/** Décisions en attente du client (anciennes d'abord : on traite la plus vieille). */
export function pendingClientDecisions(events: Event[]): Decision[] {
  return sortByDate(events.filter(isAwaitingClientDecision), 'asc').map(toDecision);
}

/**
 * Choix VALIDÉS par le client (une ambiance/option retenue, ou choix confié à
 * PHÉNIX). Symétrique de `pendingClientDecisions` : là où celui-ci dit « le
 * client doit agir », celui-ci dit « le CONDUCTEUR doit agir » (commander,
 * prévenir l'artisan, mettre à jour le planning). Récents d'abord. Lecture
 * filtrée du journal — l'« accusé de prise en compte » vit côté application.
 */
export function choixClientValides(events: Event[]): DecisionEvent[] {
  return sortByDate(
    events
      .filter(isDecision)
      .filter((e) => e.content.kind === 'validee' || e.content.kind === 'deleguee'),
    'desc',
  );
}

/** État du bandeau d'accueil client — une seule priorité. */
export function clientDecisionBanner(events: Event[]): ClientDecisionBanner {
  const pending = pendingClientDecisions(events);
  const next = pending[0];
  if (next === undefined) return { kind: 'rien_a_faire' };
  return { kind: 'decision_attendue', total: pending.length, prochaine: next };
}
