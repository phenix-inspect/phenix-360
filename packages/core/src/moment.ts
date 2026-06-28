/**
 * PHÉNIX 360 — Moments (modèle PRÉPARÉ, pas encore activé)
 * ---------------------------------------------------------------------------
 * Un « Moment » est une photo du chantier promue en instant partageable. On ne
 * construit pas encore le système (réactions ❤️, commentaires 💬, partage) ;
 * on pose le modèle pour ne pas bloquer cette évolution.
 *
 * Choix d'architecture (ADR-004 §7.3) : les Moments sont des **annotations**
 * autour d'un événement `photo`, hors du journal métier — ils ne polluent pas la
 * colonne vertébrale. Ici, seulement les types + le prédicat « momentable ».
 */
import type { EventId, IsoDateTime, UserId } from './ids.js';
import type { Event, PhotoEvent } from './event.js';
import { isPhoto } from './event.js';
import type { ActorRole } from './actor.js';

/** Réaction ❤️ (à activer plus tard). */
export interface MomentReaction {
  userId: UserId;
  emoji: string;
  createdAt: IsoDateTime;
}

/** Commentaire 💬 (à activer plus tard). */
export interface MomentComment {
  id: string;
  authorId: UserId;
  authorRole: ActorRole;
  texte: string;
  createdAt: IsoDateTime;
}

/** Annotation « Moment » ancrée sur un événement photo. */
export interface Moment {
  /** L'événement photo source (le Moment ne duplique pas la photo). */
  eventId: EventId;
  reactions: MomentReaction[];
  comments: MomentComment[];
}

/** Un événement photo peut devenir un Moment. */
export const isMomentable = (e: Event): e is PhotoEvent => isPhoto(e);

/** Crée l'enveloppe (vide) d'un Moment pour une photo donnée. */
export function emptyMoment(photo: PhotoEvent): Moment {
  return { eventId: photo.id, reactions: [], comments: [] };
}
