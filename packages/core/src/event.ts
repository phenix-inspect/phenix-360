/**
 * PHÉNIX 360 — L'ÉVÉNEMENT : la colonne vertébrale produit
 * ===========================================================================
 * Un projet = un journal chronologique d'événements (ADR-001/002). Ce modèle
 * n'est PAS une timeline d'affichage : c'est la source unique qui alimente
 * l'interface PHÉNIX, l'espace client, l'assistant IA et le bandeau décision.
 *
 * Forme : **enveloppe commune + contenu typé** (ADR-002 §2). `Event` est une
 * union discriminée sur `type` ; narrower `type` donne un `content` typé.
 *
 * Invariants verrouillés par les ADR :
 *  • l'IA n'est jamais auteur (ADR-001 §3) — voir EventActor.
 *  • la validation est un ÉTAT, pas un type : `brouillon → publie` (ADR-002 §4).
 *  • une demande = un besoin = une résolution, pas un fil (ADR-001 §6).
 *  • l'avancement est une étape portée par le compte_rendu, jamais un %.
 *  • les vues (galerie, coffre, file…) sont des lectures filtrées, pas des
 *    stockages séparés (voir views.ts).
 */
import type { CaptureId, EventId, IsoDateTime, ProjectId, UserId } from './ids.js';
import type { EventActor } from './actor.js';
import type { EventAttachment } from './attachment.js';
import type { ProjectStep } from './project.js';

/* -------------------------------------------------------------------------- *
 * Énumérations d'enveloppe
 * -------------------------------------------------------------------------- */
export const EVENT_TYPES = ['compte_rendu', 'photo', 'document', 'demande', 'decision'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  compte_rendu: 'Compte rendu',
  photo: 'Photo',
  document: 'Document',
  demande: 'Demande',
  decision: 'Décision',
};

export const EVENT_VISIBILITIES = ['client', 'interne'] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

/**
 * Cycle de vie. Deux familles selon le type :
 *  • publication (compte_rendu / photo / document) : `brouillon → publie`
 *  • demande : `ouverte → traitee → close`
 */
export const EVENT_STATES = ['brouillon', 'publie', 'ouverte', 'traitee', 'close'] as const;
export type EventState = (typeof EVENT_STATES)[number];

/* -------------------------------------------------------------------------- *
 * Contenus typés (la part spécifique à chaque type — ADR-002 §3)
 * -------------------------------------------------------------------------- */

/** Vocabulaire de classement manuel V1 (ADR-002 §3) — non figé côté produit. */
export type PhotoCategory = string;
export type DocumentCategory = string;
export type Room = string;

export interface CompteRenduContent {
  /** Texte du compte rendu (rédigé par l'IA, validé par l'humain). */
  texte: string;
  /** Étape suggérée par l'IA. */
  etapeProposee?: ProjectStep;
  /** Étape confirmée à la validation — jamais un pourcentage (ADR-004 §4). */
  etapeConfirmee?: ProjectStep;
}

export interface PhotoContent {
  attachment: EventAttachment;
  legende?: string;
  categorie?: PhotoCategory;
  piece?: Room;
}

export interface DocumentContent {
  attachment: EventAttachment;
  libelle: string;
  categorie?: DocumentCategory;
}

/** Qui doit agir sur une demande — pilote le bandeau décision client. */
export type DemandeAudience = 'client' | 'equipe';

/** Réponse PORTÉE par la demande (pas un événement séparé, pas un fil). */
export interface DemandeResolution {
  texte: string;
  resolvedBy: UserId;
  resolvedAt: IsoDateTime;
}

/**
 * Provenance d'une demande créée depuis une photo annotée du Fil (pont manuel
 * annotation → action chantier). Ids en chaînes : la colonne vertébrale reste
 * indépendante du module Fil. Lien RETOUR vers la photo / l'annotation.
 */
export interface DemandeSource {
  kind: 'fil';
  momentId: string;
  photoId?: string;
  annotationId?: string;
}

export interface DemandeContent {
  /** Besoin du client, formulé via l'assistant (ADR-001 §6). */
  question: string;
  /** Destinataire de l'action attendue (`client` ⇒ décision client). */
  destinataire: DemandeAudience;
  resolution?: DemandeResolution;
  /** Origine (le cas échéant) : photo annotée du Fil. */
  source?: DemandeSource;
}

/* -------------------------------------------------------------------------- *
 * DÉCISION — cycle de vie d'un choix client, tracé au journal (source unique)
 * -------------------------------------------------------------------------- *
 * Chaque action importante d'une décision client écrit UN événement structuré
 * (jamais du texte libre dupliqué). L'auteur et la date sont portés par
 * l'enveloppe ; le contenu porte l'origine, le choix concerné, le statut
 * avant/après et la proposition retenue. Toutes les vues LISENT ces champs.
 */
export type DecisionEventKind =
  | 'envoyee' // décision envoyée au client
  | 'renvoyee' // proposition renvoyée au client après modification
  | 'validee' // choix validé par le client
  | 'deleguee' // choix confié à PHÉNIX
  | 'modification' // modification demandée par le client
  | 'reco_confirmee'; // recommandation PHÉNIX confirmée par le conducteur

/** À l'origine de l'action (distinct de l'auteur technique de l'enveloppe). */
export type DecisionOrigin = 'client' | 'conducteur' | 'phenix';

export interface DecisionEventContent {
  kind: DecisionEventKind;
  origin: DecisionOrigin;
  /** Choix concerné (id + catégorie). */
  selectionId: string;
  categorie: string;
  /** Statut du choix avant / après l'action. */
  statutAvant: string;
  statutApres: string;
  /** Proposition retenue, le cas échéant. */
  optionId?: string;
  optionLabel?: string;
  /** Message libre (ex. demande de modification du client). */
  message?: string;
}

/** Carte type → contenu (utile aux génériques / à la couche d'accès). */
export interface EventContentByType {
  compte_rendu: CompteRenduContent;
  photo: PhotoContent;
  document: DocumentContent;
  demande: DemandeContent;
  decision: DecisionEventContent;
}

/* -------------------------------------------------------------------------- *
 * Enveloppe + union discriminée
 * -------------------------------------------------------------------------- */
export interface EventEnvelope {
  id: EventId;
  projectId: ProjectId;
  type: EventType;
  /** Auteur humain (l'IA n'est jamais auteur). */
  actor: EventActor;
  visibility: EventVisibility;
  state: EventState;
  /** Saisie d'origine : regroupe 1 compte_rendu + N photos (ADR-002 §7). */
  captureId: CaptureId | null;
  createdAt: IsoDateTime;
  /** Validation = état : qui a publié / quand (ADR-002 §4). */
  publishedBy: UserId | null;
  publishedAt: IsoDateTime | null;
}

export interface CompteRenduEvent extends EventEnvelope {
  type: 'compte_rendu';
  content: CompteRenduContent;
}
export interface PhotoEvent extends EventEnvelope {
  type: 'photo';
  content: PhotoContent;
}
export interface DocumentEvent extends EventEnvelope {
  type: 'document';
  content: DocumentContent;
}
export interface DemandeEvent extends EventEnvelope {
  type: 'demande';
  content: DemandeContent;
}
export interface DecisionEvent extends EventEnvelope {
  type: 'decision';
  content: DecisionEventContent;
}

/** L'événement du journal — colonne vertébrale du produit. */
export type Event = CompteRenduEvent | PhotoEvent | DocumentEvent | DemandeEvent | DecisionEvent;

/* -------------------------------------------------------------------------- *
 * Gardes de type
 * -------------------------------------------------------------------------- */
export const isCompteRendu = (e: Event): e is CompteRenduEvent => e.type === 'compte_rendu';
export const isPhoto = (e: Event): e is PhotoEvent => e.type === 'photo';
export const isDocument = (e: Event): e is DocumentEvent => e.type === 'document';
export const isDemande = (e: Event): e is DemandeEvent => e.type === 'demande';
export const isDecision = (e: Event): e is DecisionEvent => e.type === 'decision';

export const isDraft = (e: Event): boolean => e.state === 'brouillon';
export const isPublished = (e: Event): boolean => e.state === 'publie';
export const isDemandeOpen = (e: Event): e is DemandeEvent => isDemande(e) && e.state === 'ouverte';

/* -------------------------------------------------------------------------- *
 * Règle de VISIBILITÉ CLIENT — source unique, miroir de la RLS (ADR-004 §4)
 * -------------------------------------------------------------------------- *
 * Cette fonction définit le produit ; la policy RLS Postgres devra la refléter
 * (le produit dicte le schéma, pas l'inverse).
 */
export function isVisibleToClient(e: Event): boolean {
  if (e.visibility !== 'client') return false;
  if (e.type === 'demande') {
    // Demande adressée au client : visible dès `ouverte` (il doit pouvoir agir),
    // puis une fois `traitee` / `close`.
    if (e.content.destinataire === 'client') {
      return e.state === 'ouverte' || e.state === 'traitee' || e.state === 'close';
    }
    // Demande interne (vers l'équipe) : visible client seulement une fois résolue.
    return e.state === 'traitee' || e.state === 'close';
  }
  // compte_rendu / photo / document : visibles une fois publiés.
  return e.state === 'publie';
}

/** Une décision attend explicitement le client (pilote le bandeau d'accueil). */
export function isAwaitingClientDecision(e: Event): e is DemandeEvent {
  return (
    e.type === 'demande' &&
    e.state === 'ouverte' &&
    e.visibility === 'client' &&
    e.content.destinataire === 'client'
  );
}
