/**
 * PHÉNIX 360 — LA RÉCEPTION : dernière étape contractuelle du chantier
 * ===========================================================================
 * La Réception ne repart JAMAIS du devis. Elle repart EXCLUSIVEMENT de la
 * Pré-réception validée. Elle ne contrôle plus les prestations : elle contrôle
 * uniquement que TOUTES les réserves émises en Pré-réception ont été LEVÉES.
 *
 * Le cycle contractuel :
 *   Devis validé → Préparation → Pré-réception → Réserves → Levée des réserves
 *   → Réception → Clôture du chantier.
 *
 * Aucune prestation n'est recréée. Chaque réserve conserve toute sa traçabilité :
 *   photo avant → photo après → date → conducteur → commentaire (initial + levée).
 *
 * Modèle PUR (types + sélecteurs). L'écran et le store le CONSOMMENT sans
 * dupliquer la moindre règle métier.
 */
import type {
  PrereceptionData,
  PrereceptionPhoto,
  ReserveResponsableKind,
} from './prereception.js';

/** Nombre de photos « après » exigées pour lever une réserve (1 à 3). */
export const MIN_LEVEE_PHOTOS = 1;
export const MAX_LEVEE_PHOTOS = 3;

/**
 * La LEVÉE d'une réserve : le contrôle final côté Réception. Commentaire de levée
 * ET au moins une photo « après » sont OBLIGATOIRES — sinon la réserve reste
 * ouverte et la Réception ne peut pas être validée.
 */
export interface ReserveLevee {
  /** Commentaire de levée — OBLIGATOIRE. */
  commentaire: string;
  /** 1 à 3 photos « après » — OBLIGATOIRES (conducteur, client, document final). */
  photos: PrereceptionPhoto[];
  /** Date de la levée (horodatage automatique). */
  dateLevee?: string;
  /** Conducteur ayant levé la réserve. */
  conducteur?: string;
}

/**
 * Une réserve vue par la Réception : issue de la Pré-réception (dénormalisée pour
 * un archivage autonome — aucune information n'est perdue) + sa levée éventuelle.
 * L'identifiant stable est `posteId` (la prestation d'origine du contrat).
 */
export interface ReceptionReserve {
  /** Numéro d'ordre (1..N), stable dans la Réception. */
  numero: number;
  /** Poste d'origine (prestation du devis / avenant) — identifiant stable. */
  posteId: string;
  /** Lot (corps d'état) de la prestation concernée. */
  lotLabel: string;
  /** Intitulé de la prestation concernée. */
  prestationLabel: string;
  /** Commentaire initial de la réserve (saisi en Pré-réception). */
  commentaireInitial: string;
  /** Responsable de la reprise (interne). */
  responsable: ReserveResponsableKind;
  /** Date de création de la réserve (validation de la Pré-réception). */
  dateCreation: string;
  /** Photos « avant » de la Pré-réception. */
  photosAvant: PrereceptionPhoto[];
  /** Levée (présente dès que le conducteur commence à lever ; complète = voir `leveeComplete`). */
  levee?: ReserveLevee;
}

/**
 * La saisie complète d'une Réception (portée par l'événement compte rendu). Toutes
 * les données du document sont dénormalisées ici : la Réception validée est un
 * archive AUTONOME, indépendante de la Pré-réception d'origine.
 */
export interface ReceptionData {
  /** Événement de Pré-réception validée dont dérive la Réception. */
  prereceptionEventId: string;
  /** Référence de la Pré-réception (PR-AAAAMMJJ-Vx). */
  prereceptionRef: string;
  /** Numéro du devis signé (référence documentaire). */
  devisRef?: string;
  /** Numéros des avenants intégrés (référence documentaire). */
  avenants: number[];
  /** Version de la Réception (1, 2, 3…) — fixée à la validation. */
  version?: number;
  /** Nombre total de prestations vérifiées en Pré-réception (pour le résumé). */
  prestationsTotal: number;
  /** Toutes les réserves de la Pré-réception + leur levée. */
  reserves: ReceptionReserve[];
  /** Commentaire général optionnel du conducteur. */
  commentaireGeneral?: string;
}

/**
 * Extrait les réserves d'une Pré-réception validée (prestations « Réceptionné avec
 * réserve »). Aucune prestation n'est recréée : seules les réserves sont reprises,
 * dénormalisées et numérotées dans l'ordre du contrat.
 */
export function reservesDePrereception(
  data: PrereceptionData,
  dateCreationISO: string,
): ReceptionReserve[] {
  const out: ReceptionReserve[] = [];
  for (const p of data.prestations) {
    if (p.statut !== 'reserve' || !p.reserve) continue;
    out.push({
      numero: out.length + 1,
      posteId: p.posteId,
      lotLabel: p.lotLabel,
      prestationLabel: p.label,
      commentaireInitial: p.reserve.commentaire,
      responsable: p.reserve.responsable,
      dateCreation: dateCreationISO,
      photosAvant: p.reserve.photos,
    });
  }
  return out;
}

/** Une levée est-elle COMPLÈTE ? Commentaire non vide + 1 à 3 photos « après ». */
export function leveeComplete(levee?: ReserveLevee): boolean {
  if (!levee) return false;
  if (levee.commentaire.trim().length === 0) return false;
  const n = levee.photos.length;
  return n >= MIN_LEVEE_PHOTOS && n <= MAX_LEVEE_PHOTOS;
}

/** La réserve est-elle levée (levée complète) ? Sinon elle reste OUVERTE. */
export function reserveEstLevee(r: ReceptionReserve): boolean {
  return leveeComplete(r.levee);
}

/** Nombre de réserves encore OUVERTES (levée absente ou incomplète). */
export function reservesRestantes(reserves: ReceptionReserve[]): number {
  return reserves.filter((r) => !leveeComplete(r.levee)).length;
}

/** Nombre de réserves LEVÉES. */
export function reservesLevees(reserves: ReceptionReserve[]): number {
  return reserves.filter((r) => leveeComplete(r.levee)).length;
}

/**
 * La Réception peut-elle être validée ? Uniquement quand TOUTES les réserves sont
 * levées (une seule réserve ouverte bloque). Une Réception sans réserve est
 * validable d'emblée.
 */
export function receptionComplete(reserves: ReceptionReserve[]): boolean {
  return reserves.every((r) => leveeComplete(r.levee));
}

/** Synthèse (résumé) d'une Réception — dérivée, jamais saisie. */
export interface ReceptionSynthese {
  prestationsTotal: number;
  reservesCreees: number;
  reservesLevees: number;
  reservesRestantes: number;
}

export function receptionSynthese(data: ReceptionData): ReceptionSynthese {
  return {
    prestationsTotal: data.prestationsTotal,
    reservesCreees: data.reserves.length,
    reservesLevees: reservesLevees(data.reserves),
    reservesRestantes: reservesRestantes(data.reserves),
  };
}

/** Titre du document de réception, versionné (« Réception » / « … V2 »). */
export function receptionDocTitle(version = 1): string {
  return version > 1 ? `Réception V${version}` : 'Réception';
}

/**
 * Référence STABLE et lisible de la réception : « REC-AAAAMMJJ-V1 ». Dérivée de la
 * date de validation et de la version — jamais saisie. `dateISO` absent ⇒ sans date.
 */
export function receptionReference(dateISO?: string, version = 1): string {
  const d = dateISO ? dateISO.slice(0, 10).replace(/-/g, '') : '';
  return d ? `REC-${d}-V${version}` : `REC-V${version}`;
}

/** Conclusion du document selon qu'il y avait ou non des réserves. */
export const RECEPTION_CONCLUSION_LEVEES =
  'Les réserves émises lors de la Pré-réception ont été levées.';
export const RECEPTION_CONCLUSION_AUCUNE =
  'Aucune réserve n’avait été émise lors de la Pré-réception.';
export const RECEPTION_CONCLUSION_FINALE = 'Les travaux sont réceptionnés.';
