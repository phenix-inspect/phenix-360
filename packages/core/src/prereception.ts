/**
 * PHÉNIX 360 — LA PRÉ-RÉCEPTION : vérifier l'exécution du contrat signé
 * ===========================================================================
 * La pré-réception n'est PLUS une liste de réserves. C'est la VÉRIFICATION que
 * chaque prestation VENDUE a bien été EXÉCUTÉE. Le conducteur ne ressaisit jamais
 * le chantier : PHÉNIX reconstruit automatiquement la liste des prestations à
 * partir du DEVIS SIGNÉ + de TOUS les avenants validés (vue consolidée, postes
 * actifs). Le conducteur contrôle le contrat, prestation par prestation :
 *
 *   🟢 Fait sans réserve      ⚫ Plus à faire (moins-value)
 *   🟠 Fait avec réserve      🟡 Non fait, à faire
 *
 * Une réserve n'existe JAMAIS seule : elle est toujours rattachée à une
 * prestation. À partir d'une SEULE saisie, PHÉNIX génère deux documents (client /
 * artisan), filtrés par destinataire — aucune double saisie (VISION Art. 8).
 *
 * Modèle PUR (types + sélecteurs). L'écran et le store le CONSOMMENT sans
 * dupliquer la moindre règle métier.
 */
import { consolidateDevis, type Avenant, type Devis, type PosteOrigin } from './devis.js';
import { deriverDetailsPoste, type DetailTechnique } from './details-techniques.js';

/* -------------------------------------------------------------------------- *
 * Statut d'une prestation — QUATRE choix exclusifs
 * -------------------------------------------------------------------------- */
export const PRESTATION_STATUTS = ['fait', 'reserve', 'non_fait', 'moins_value'] as const;
export type PrestationStatut = (typeof PRESTATION_STATUTS)[number];

/**
 * Libellé COMPLET, PROFESSIONNEL (conducteur / artisan). Vocabulaire de réception
 * de chantier — source unique consommée par l'écran, la synthèse et les documents.
 */
export const PRESTATION_STATUT_LABEL: Record<PrestationStatut, string> = {
  fait: 'Réceptionné sans réserve',
  reserve: 'Réceptionné avec réserve',
  non_fait: 'Non réceptionné — à réaliser',
  moins_value: 'Retiré du périmètre — moins-value à prévoir',
};

/**
 * Libellé CLIENT (clair, factuel, sans notion interne de moins-value). Le client
 * voit un statut professionnel, jamais l'organisation ni la facturation interne.
 */
export const PRESTATION_STATUT_LABEL_CLIENT: Record<PrestationStatut, string> = {
  fait: 'Réceptionné sans réserve',
  reserve: 'Réceptionné avec réserve',
  non_fait: 'Non réceptionné',
  moins_value: 'Retiré du périmètre',
};

/** Libellé COURT pour les boutons de sélection (tient sur mobile). */
export const PRESTATION_STATUT_SHORT: Record<PrestationStatut, string> = {
  fait: 'Sans réserve',
  reserve: 'Avec réserve',
  non_fait: 'À réaliser',
  moins_value: 'Retiré',
};

/** Tonalité visuelle d'un statut (la réserve seule est mise en évidence en rouge). */
export type StatutTon = 'ok' | 'reserve' | 'todo' | 'retire';
/** Pastille de statut (repère visuel discret, cohérent écran ↔ document). */
export const PRESTATION_STATUT_DOT: Record<PrestationStatut, string> = {
  fait: '🟢',
  reserve: '🔴',
  non_fait: '🟡',
  moins_value: '⚫',
};

/* -------------------------------------------------------------------------- *
 * Réserve rattachée à une prestation (cas « Fait avec réserve »)
 * -------------------------------------------------------------------------- */
export const RESERVE_RESPONSABLES = ['phenix', 'artisan', 'fournisseur'] as const;
export type ReserveResponsableKind = (typeof RESERVE_RESPONSABLES)[number];

export const RESERVE_RESPONSABLE_LABEL: Record<ReserveResponsableKind, string> = {
  phenix: 'PHÉNIX',
  artisan: 'Artisan',
  fournisseur: 'Fournisseur',
};

/** Nombre de photos autorisées sur une réserve de pré-réception (1 à 3). */
export const MAX_PRERECEPTION_PHOTOS = 3;

/**
 * Photo d'une réserve. Mêmes conventions que le reste du produit : `imageUrl`
 * (data URL en démo) double `bucket`/`storagePath` (S3 en prod) — on bascule le
 * stockage sans toucher au modèle.
 */
export interface PrereceptionPhoto {
  imageUrl: string;
  bucket: string;
  storagePath: string;
  mimeType: string;
  width?: number;
  height?: number;
}

/** Une réserve : toujours rattachée à une prestation (cas « Fait avec réserve »). */
export interface PrestationReserve {
  /** 1 à 3 photos. */
  photos: PrereceptionPhoto[];
  /** Commentaire OBLIGATOIRE décrivant la réserve. */
  commentaire: string;
  /** Responsable de la reprise (INTERNE — jamais visible côté client). */
  responsable: ReserveResponsableKind;
  /** Date prévisionnelle de reprise (INTERNE, optionnelle). */
  dateReprise?: string;
}

/* -------------------------------------------------------------------------- *
 * Une prestation VÉRIFIÉE (reconstruite du devis + avenants)
 * -------------------------------------------------------------------------- */
export interface PrestationVerif {
  /** Poste d'origine (id du devis / de l'avenant) — jamais ressaisi. */
  posteId: string;
  /** Lot (corps d'état) auquel appartient la prestation. */
  lotLabel: string;
  /** Intitulé de la prestation vendue (repris tel quel du contrat). */
  label: string;
  /** Origine : devis initial ou avenant n°X. */
  origin: PosteOrigin;
  /** Page du PDF d'origine (traçabilité jusqu'au document signé). */
  sourcePage?: number;
  /** Statut vérifié par le conducteur. */
  statut: PrestationStatut;
  /** Réserve rattachée (présente SI statut === 'reserve'). */
  reserve?: PrestationReserve;
  /** Commentaire OBLIGATOIRE si statut === 'non_fait' (ex. « Livraison semaine prochaine »). */
  commentaireNonFait?: string;
  /** Motif OBLIGATOIRE si statut === 'moins_value' (demande client, erreur devis…). */
  motifMoinsValue?: string;
  /**
   * DÉTAILS TECHNIQUES dérivés du contrat (quantités, dimensions, références…),
   * en AIDE AU CONTRÔLE uniquement. Ne crée JAMAIS de nouvelle prestation : ce
   * sont des repères pour vérifier l'exécution de LA prestation (« receveur
   * 800×800 posé ? », « 18 prises ? »). Absent si le poste n'a pas de sous-liste.
   */
  detailsTechniques?: DetailTechnique[];
}

/** La saisie complète d'une pré-réception (portée par l'événement compte rendu). */
export interface PrereceptionData {
  /** Intervenants présents (champ libre, optionnel). */
  presents: string[];
  /** Toutes les prestations vérifiées (reconstruites du contrat). */
  prestations: PrestationVerif[];
  /** Commentaire général de pré-réception — apparaît dans TOUS les documents. */
  commentaireGeneral: string;
  /**
   * Numéro de version (1, 2, 3…). Un document VALIDÉ est verrouillé et
   * non modifiable : une correction crée une NOUVELLE version (jamais de
   * modification silencieuse d'un document déjà transmis). Fixé à la validation.
   */
  version?: number;
}

/** Titre du document de pré-réception, versionné (« Pré-réception » / « … V2 »). */
export function prereceptionDocTitle(version = 1): string {
  return version > 1 ? `Pré-réception V${version}` : 'Pré-réception';
}

/**
 * Référence STABLE et lisible de la pré-réception (en-tête & documents) :
 * « PR-AAAAMMJJ-V1 ». Dérivée de la date de validation et de la version — jamais
 * saisie à la main. `dateISO` absent ⇒ référence sans date (préparation).
 */
export function prereceptionReference(dateISO?: string, version = 1): string {
  const d = dateISO ? dateISO.slice(0, 10).replace(/-/g, '') : '';
  return d ? `PR-${d}-V${version}` : `PR-V${version}`;
}

/** Libellés PROFESSIONNELS de la synthèse (cohérents écran ↔ document). */
export const PRERECEPTION_SYNTHESE_LABEL: Record<
  keyof Omit<PrereceptionSynthese, 'total'>,
  string
> = {
  conformes: 'Réceptionnées sans réserve',
  avecReserve: 'Réceptionnées avec réserve',
  restantes: 'Non réceptionnées',
  supprimees: 'Retirées du périmètre',
};

/* -------------------------------------------------------------------------- *
 * Motifs proposés pour une moins-value (« Plus à faire »)
 * -------------------------------------------------------------------------- */
export const MOINS_VALUE_MOTIFS = [
  'Demande client',
  'Impossibilité technique',
  'Erreur devis',
  'Abandon',
  'Autre',
] as const;

/* -------------------------------------------------------------------------- *
 * Reconstruction automatique des prestations (devis + avenants)
 * -------------------------------------------------------------------------- */
/**
 * Reconstruit la liste des prestations à vérifier à partir du devis signé et de
 * TOUS les avenants validés (vue consolidée). On ne garde que les postes ACTIFS
 * (un poste remplacé par un avenant n'est plus au contrat) : le conducteur
 * retrouve EXACTEMENT ce qui a été vendu, sans aucune ressaisie. Chaque
 * prestation démarre au statut « Fait sans réserve » (le cas nominal) ; le
 * conducteur ne touche que les exceptions.
 */
export function buildPrestationsAVerifier(
  devis?: Devis,
  avenants: Avenant[] = [],
): PrestationVerif[] {
  const consolidated = consolidateDevis(devis, avenants);
  const out: PrestationVerif[] = [];
  for (const lot of consolidated.lots) {
    for (const cp of lot.postes) {
      // Un poste remplacé par un avenant n'est plus au contrat : on l'exclut.
      if (cp.replacedByNumero != null) continue;
      // Aide au contrôle : détails techniques DÉRIVÉS (jamais une prestation de plus).
      const details = deriverDetailsPoste(cp.poste, lot.label);
      out.push({
        posteId: cp.poste.id,
        lotLabel: lot.label,
        label: cp.poste.label,
        origin: cp.origin,
        ...(cp.poste.sourcePage != null ? { sourcePage: cp.poste.sourcePage } : {}),
        statut: 'fait',
        ...(details.length > 0 ? { detailsTechniques: details } : {}),
      });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 * Synthèse automatique
 * -------------------------------------------------------------------------- */
export interface PrereceptionSynthese {
  /** Prestations conformes (Fait sans réserve). */
  conformes: number;
  /** Prestations avec réserve (Fait avec réserve). */
  avecReserve: number;
  /** Prestations restant à réaliser (Non fait, à faire). */
  restantes: number;
  /** Prestations supprimées (Plus à faire — moins-value). */
  supprimees: number;
  /** Total des prestations vérifiées. */
  total: number;
}

/** Calcule la synthèse (comptes par statut) — dérivée, jamais saisie. */
export function prereceptionSynthese(prestations: PrestationVerif[]): PrereceptionSynthese {
  const s: PrereceptionSynthese = {
    conformes: 0,
    avecReserve: 0,
    restantes: 0,
    supprimees: 0,
    total: prestations.length,
  };
  for (const p of prestations) {
    if (p.statut === 'fait') s.conformes += 1;
    else if (p.statut === 'reserve') s.avecReserve += 1;
    else if (p.statut === 'non_fait') s.restantes += 1;
    else if (p.statut === 'moins_value') s.supprimees += 1;
  }
  return s;
}

/**
 * Une prestation est-elle COMPLÈTE (prête à être générée) ? Une réserve exige un
 * commentaire ; un « Non fait » exige un commentaire ; une moins-value exige un
 * motif. PHÉNIX ne laisse jamais passer une vérification incomplète.
 */
export function prestationComplete(p: PrestationVerif): boolean {
  if (p.statut === 'reserve') return !!p.reserve && p.reserve.commentaire.trim().length > 0;
  if (p.statut === 'non_fait') return (p.commentaireNonFait ?? '').trim().length > 0;
  if (p.statut === 'moins_value') return (p.motifMoinsValue ?? '').trim().length > 0;
  return true;
}

/** La pré-réception entière est-elle prête à être générée ? */
export function prereceptionComplete(prestations: PrestationVerif[]): boolean {
  return prestations.length > 0 && prestations.every(prestationComplete);
}
