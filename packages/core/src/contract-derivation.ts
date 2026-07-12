/**
 * PHÉNIX 360 — LE DEVIS VALIDÉ, CERVEAU DU CHANTIER (contrat d'extension)
 * ===========================================================================
 * Une fois un lot VALIDÉ, il devient la source de vérité à partir de laquelle
 * PHÉNIX pourra dériver automatiquement tout le chantier. Ce module définit
 * UNIQUEMENT le CONTRAT D'EXTENSION de ce futur moteur : les types de sortie et
 * l'interface du dériveur. Il ne contient AUCUNE logique métier et n'expose
 * AUCUN sélecteur opérationnel (pas de faux moteur renvoyant des listes vides) :
 * le premier vrai sélecteur naîtra avec la première dérivation réellement utile.
 *
 * Point d'entrée prévu : le futur moteur LIRA les lots exploitables via
 * `validatedDevis(dossier)` (cf. contract.ts) — un lot non validé n'alimente
 * jamais une dérivation. Chaque artefact dérivé RÉFÉRENCE son origine (lot/poste)
 * pour rester traçable jusqu'au devis, et n'est jamais figé : il se recalcule
 * quand un lot est validé, corrigé ou remplacé par un avenant.
 */
import type { Devis } from './devis.js';

/** Origine d'un artefact dérivé : le lot / poste du contrat dont il provient. */
export interface DerivationSource {
  lotId: string;
  posteId?: string;
}

/** Une commande PROBABLE déduite d'un poste (fourniture/matériel). */
export interface DerivedOrder extends DerivationSource {
  label: string;
}

/** Un MÉTIER (corps d'état) concerné par le contrat. */
export interface DerivedMetier {
  label: string;
  lotIds: string[];
}

/** Une RÉSERVATION probable (matériel, moyen, intervenant à réserver en amont). */
export interface DerivedReservation extends DerivationSource {
  label: string;
}

/** Un POINT DE VIGILANCE métier issu d'une prestation. */
export interface DerivedVigilance extends DerivationSource {
  message: string;
}

/** Un CONTRÔLE DE RÉCEPTION attendu pour une prestation vendue. */
export interface DerivedControleReception extends DerivationSource {
  label: string;
}

/** Une PHOTO ATTENDUE (avant/pendant/après) pour tracer une prestation. */
export interface DerivedPhotoAttendue extends DerivationSource {
  label: string;
}

/** Une DÉCISION CLIENT probable à obtenir (choix de matériaux, finitions…). */
export interface DerivedDecisionClient extends DerivationSource {
  categorie: string;
  label: string;
}

/**
 * Le PLAN dérivé d'un contrat validé — la sortie du futur moteur. Chaque liste
 * sera remplie par une dérivation dédiée (créée séparément, avec ses tests).
 */
export interface ContractPlan {
  commandesProbables: DerivedOrder[];
  metiers: DerivedMetier[];
  reservationsProbables: DerivedReservation[];
  vigilances: DerivedVigilance[];
  controlesReception: DerivedControleReception[];
  photosAttendues: DerivedPhotoAttendue[];
  decisionsClientProbables: DerivedDecisionClient[];
}

/**
 * L'INTERFACE du futur moteur de dérivation. On l'implémentera derrière ce
 * contrat (comme le port `DossierAnalyzer`), sans toucher aux écrans. Le
 * `devis` passé en entrée est TOUJOURS le devis restreint aux lots validés
 * (`validatedDevis(dossier)`).
 */
export type ContractDeriver = (input: { devis: Devis }) => ContractPlan;
