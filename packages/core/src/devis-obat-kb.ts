/**
 * PHÉNIX 360 — OBAT KNOWLEDGE BASE (grammaire testée & versionnée du format OBAT)
 * =============================================================================
 * Ce module est la connaissance MACHINE-VÉRIFIÉE du format OBAT : la prose vit
 * dans `apps/demo/e2e/corpus/OBAT-KNOWLEDGE-BASE.md`, mais chaque VARIANTE
 * STRUCTURELLE qu'on prétend comprendre est déclarée ici avec un PRÉDICAT. Le
 * test `obat-knowledge-base.test.mjs` exige qu'au moins un devis du corpus
 * DÉMONTRE chaque variante : on ne documente pas une règle qu'on ne sait pas
 * exhiber. Toute nouvelle variante découverte s'ajoute ici (documentée + testée
 * + versionnée + adossée au corpus), et le moteur ne doit jamais régresser.
 *
 * On raisonne comme l'équipe OBAT : chaque variante dit CE QU'OBAT présente et
 * POURQUOI (logique métier), ce qui est CONSTANT et ce qui peut VARIER.
 */
import type { Devis, DevisPoste } from './devis.js';
import type { DevisAnalyseGeo } from './devis-geometry.js';

/**
 * Version de la base de connaissance OBAT. À incrémenter à CHAQUE règle ajoutée
 * (journal en tête de OBAT-KNOWLEDGE-BASE.md).
 */
export const OBAT_KB_VERSION = 1;

/** Nature d'une règle : invariante du gabarit OBAT, ou variable selon le devis. */
export type NatureRegle = 'constant' | 'variable';

/** Une variante structurelle OBAT — connaissance testable contre le corpus. */
export interface VarianteObat {
  id: string;
  /** Ce qu'OBAT présente (grammaire). */
  description: string;
  /** Pourquoi OBAT fait ainsi (logique métier). */
  logiqueMetier: string;
  nature: NatureRegle;
  /** Vrai si l'analyse d'un devis DÉMONTRE cette variante. */
  demontreePar: (analyse: DevisAnalyseGeo) => boolean;
}

/** Postes FERMES (hors options) d'une analyse. */
const fermes = (a: DevisAnalyseGeo): DevisPoste[] =>
  a.devis ? a.devis.lots.flatMap((l) => l.postes).filter((p) => !p.option) : [];

const tauxDistincts = (devis?: Devis): number =>
  devis ? new Set(devis.lots.flatMap((l) => l.postes).map((p) => p.tva)).size : 0;

/**
 * Les variantes STRUCTURELLES du format OBAT que le moteur comprend. Chacune doit
 * être exhibée par au moins un devis réel du corpus (cf. test). C'est la grammaire
 * vivante : on l'enrichit à chaque nouvelle découverte, jamais on ne la triche.
 */
export const OBAT_VARIANTES: VarianteObat[] = [
  {
    id: 'structure-par-lots',
    description:
      'Lots numérotés (en-têtes « N … <sous-total> » / « LOT NN – »), prestations « N.M ».',
    logiqueMetier:
      'OBAT organise le chiffrage par corps d’état pour lire un devis long et rattacher chaque prestation à son lot.',
    nature: 'constant',
    demontreePar: (a) => (a.devis?.lots.length ?? 0) >= 3 && fermes(a).length >= 3,
  },
  {
    id: 'plat-sans-lots',
    description: 'Aucun lot : prestations numérotées 1, 2, 3… → lot implicite « Prestations ».',
    logiqueMetier:
      'Pour une intervention courte et mono-métier, OBAT n’impose pas de lots — la numérotation reste linéaire.',
    nature: 'variable',
    demontreePar: (a) => a.devis?.lots.length === 1 && fermes(a).length >= 3,
  },
  {
    id: 'multi-tva',
    description: 'Plusieurs taux de TVA (5,5 / 10 / 20 %) coexistent, ventilés en fin de devis.',
    logiqueMetier:
      'La TVA dépend de la nature des travaux (rénovation énergétique 5,5 %, rénovation 10 %, neuf/agencement 20 %).',
    nature: 'variable',
    demontreePar: (a) => tauxDistincts(a.devis) >= 2,
  },
  {
    id: 'exclusion',
    description: 'Ligne « ATTENTION : … N’EST PAS INCLUSE … » (montant 0) → écartée du contrat.',
    logiqueMetier:
      'OBAT matérialise ce qui est HORS périmètre pour éviter tout litige — ce n’est pas une prestation vendue.',
    nature: 'variable',
    demontreePar: (a) => a.exclusions.length >= 1,
  },
  {
    id: 'liste-de-prix-options',
    description:
      '« Transparence des prix / prestations supplémentaires » : add-ons à quantité 0 → OPTIONS.',
    logiqueMetier:
      'OBAT annexe un tarif d’options pour cadrer les demandes en cours de chantier sans réengager un devis.',
    nature: 'variable',
    demontreePar: (a) => a.options.length >= 1,
  },
  {
    id: 'remise-moins-value',
    description: 'Ligne numérotée à MONTANT NÉGATIF (« Remise commerciale … -1 200,00 € »).',
    logiqueMetier:
      'Une remise/moins-value est une ligne du tableau (donc numérotée) qui DIMINUE le total — pas une note.',
    nature: 'variable',
    demontreePar: (a) => fermes(a).some((p) => p.montantHT < 0),
  },
  {
    id: 'ligne-zero-euro-offerte',
    description:
      'Prestation à 0,00 € (« … (OFFERT) », étude offerte) : conservée, signalée à vérifier.',
    logiqueMetier:
      'OBAT trace le geste commercial (prestation offerte) : elle existe au contrat même à 0 € — le conducteur confirme.',
    nature: 'variable',
    demontreePar: (a) => fermes(a).some((p) => p.montantHT === 0),
  },
  {
    id: 'reconciliation-totaux',
    description:
      'Bloc « Total net HT / TVA / Total TTC / NET À PAYER » → réconciliation Σ lignes = total.',
    logiqueMetier:
      'Le total déclaré par OBAT est la vérité financière : PHÉNIX le rapproche de la somme des lignes lues.',
    nature: 'constant',
    demontreePar: (a) => a.reconciliation.totalHTDeclare != null && a.reconciliation.coherent,
  },
];
