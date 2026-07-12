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

/* -------------------------------------------------------------------------- *
 * Statut d'une prestation — QUATRE choix exclusifs
 * -------------------------------------------------------------------------- */
export const PRESTATION_STATUTS = ['fait', 'reserve', 'non_fait', 'moins_value'] as const;
export type PrestationStatut = (typeof PRESTATION_STATUTS)[number];

/** Libellé COMPLET (conducteur / artisan). */
export const PRESTATION_STATUT_LABEL: Record<PrestationStatut, string> = {
  fait: 'Fait sans réserve',
  reserve: 'Fait avec réserve',
  non_fait: 'Non fait, à faire',
  moins_value: 'Plus à faire (moins-value)',
};

/**
 * Libellé CLIENT (rassurant, sans notion interne de moins-value / de « à faire »
 * chiffré). Le client voit un statut clair, jamais l'organisation du chantier.
 */
export const PRESTATION_STATUT_LABEL_CLIENT: Record<PrestationStatut, string> = {
  fait: 'Fait sans réserve',
  reserve: 'Fait avec réserve',
  non_fait: 'Non fait',
  moins_value: 'Plus à faire',
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
  /** Statut vérifié par le conducteur. */
  statut: PrestationStatut;
  /** Réserve rattachée (présente SI statut === 'reserve'). */
  reserve?: PrestationReserve;
  /** Commentaire OBLIGATOIRE si statut === 'non_fait' (ex. « Livraison semaine prochaine »). */
  commentaireNonFait?: string;
  /** Motif OBLIGATOIRE si statut === 'moins_value' (demande client, erreur devis…). */
  motifMoinsValue?: string;
}

/** La saisie complète d'une pré-réception (portée par l'événement compte rendu). */
export interface PrereceptionData {
  /** Intervenants présents (champ libre, optionnel). */
  presents: string[];
  /** Toutes les prestations vérifiées (reconstruites du contrat). */
  prestations: PrestationVerif[];
  /** Commentaire général de pré-réception — apparaît dans TOUS les documents. */
  commentaireGeneral: string;
}

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
      out.push({
        posteId: cp.poste.id,
        lotLabel: lot.label,
        label: cp.poste.label,
        origin: cp.origin,
        statut: 'fait',
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
 * Prestations à DÉDUIRE de la facture finale (les moins-values). Cette lecture
 * sera exploitée plus tard lors de la génération de la facture finale — on la
 * dérive ici, à la source, sans jamais la ressaisir.
 */
export function prestationsADeduire(prestations: PrestationVerif[]): PrestationVerif[] {
  return prestations.filter((p) => p.statut === 'moins_value');
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
