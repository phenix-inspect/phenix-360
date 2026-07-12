/**
 * PHÉNIX 360 — MOTEUR NATIF DE LECTURE DES DEVIS (géométrie → contrat structuré)
 * =============================================================================
 * Le lecteur de première génération travaillait sur un simple flux de texte
 * (lignes séparées par la position verticale) : les colonnes étaient perdues,
 * les descriptions multi-lignes tronquées, les tableaux de totaux/TVA et les
 * exclusions confondus avec des prestations. Ce moteur natif travaille sur la
 * GÉOMÉTRIE réelle du PDF (chaque mot connaît sa page, son x, son y, sa largeur)
 * et déroule un pipeline explicite :
 *
 *   1. Reconstruction des lignes   (regroupement par y, tri par x)
 *   2. Détection des colonnes       (ancrées sur l'en-tête du tableau)
 *   3. Retrait en-têtes / pieds     (pieds de page répétés, bandeaux)
 *   4. Classification des blocs      (~25 types ; « indéterminé » ≠ prestation)
 *   5. Construction des prestations  (libellé exact + libellé court, source,
 *                                     confiance, statut brouillon)
 *   6. Contrôles de cohérence        (montants, comptage, prix orphelin, options)
 *
 * Règle d'or inchangée : ne JAMAIS inventer. Un bloc non classé en prestation
 * (exclusion, note, total, ventilation TVA, pied de page) n'entre pas au contrat.
 * Une exclusion (« … N'EST PAS INCLUSE ») n'est pas une prestation. Une option
 * n'est jamais intégrée sans validation. Module PUR (déterministe, sans I/O) :
 * l'extraction binaire PDF→géométrie vit côté application.
 */
import type { Devis, DevisLot, DevisPoste, VerificationNiveau } from './devis.js';
import {
  MOTEUR_VERSION,
  evaluerVerification,
  extractDeclaredTotals,
  parseMontantFr,
  parseTauxFr,
  reconcileTotals,
  type TotalsReconciliation,
} from './contract.js';

/* -------------------------------------------------------------------------- *
 * Entrée : géométrie d'un PDF (produite côté app par pdf.js)
 * -------------------------------------------------------------------------- */

/** Un mot positionné sur une page (repère PDF : y croît vers le HAUT). */
export interface MotToken {
  x: number;
  y: number;
  /** Largeur du mot (pour estimer sa colonne / son bord droit). */
  w: number;
  str: string;
}

/** La géométrie d'une page : dimensions + mots positionnés. */
export interface PageGeom {
  page: number;
  width: number;
  height: number;
  tokens: MotToken[];
}

/* -------------------------------------------------------------------------- *
 * ~25 types de blocs. « indetermine » est le repli — JAMAIS une prestation.
 * -------------------------------------------------------------------------- */
export type BlocType =
  | 'entete_document'
  | 'coordonnees_entreprise'
  | 'coordonnees_client'
  | 'entete_tableau'
  | 'lot'
  | 'prestation'
  | 'prestation_valeurs'
  | 'description_complement'
  | 'materiau'
  | 'exclusion'
  | 'option'
  | 'sous_total_lot'
  | 'total_general'
  | 'ventilation_tva'
  | 'acompte'
  | 'echeancier'
  | 'conditions_paiement'
  | 'mentions_legales'
  | 'gestion_dechets'
  | 'signature'
  | 'notes'
  | 'garantie'
  | 'delai'
  | 'remise'
  | 'pied_de_page'
  | 'indetermine';

/** L'ensemble des types qui NE produisent jamais de prestation contractuelle. */
export const BLOCS_NON_CONTRACTUELS: ReadonlySet<BlocType> = new Set<BlocType>([
  'entete_document',
  'coordonnees_entreprise',
  'coordonnees_client',
  'entete_tableau',
  'exclusion',
  'sous_total_lot',
  'total_general',
  'ventilation_tva',
  'acompte',
  'echeancier',
  'conditions_paiement',
  'mentions_legales',
  'gestion_dechets',
  'signature',
  'notes',
  'garantie',
  'delai',
  'remise',
  'pied_de_page',
  'indetermine',
]);

/** Les cellules d'une ligne reconstruite, réparties par colonne. */
export interface CellulesLigne {
  num: string;
  designation: string;
  qte: string;
  unite: string;
  prix: string;
  tva: string;
  total: string;
}

/** Une ligne reconstruite depuis la géométrie, puis classée. */
export interface LigneClasse {
  page: number;
  /** Ordonnée moyenne (repère PDF). */
  y: number;
  cells: CellulesLigne;
  /** Texte brut concaténé (traçabilité). */
  brut: string;
  type: BlocType;
}

/* -------------------------------------------------------------------------- *
 * Contrôles de cohérence
 * -------------------------------------------------------------------------- */
export type GraviteControle = 'ok' | 'info' | 'attention' | 'bloquant';

export interface ControleCoherence {
  id: string;
  libelle: string;
  gravite: GraviteControle;
  message: string;
}

/** Une exclusion détectée (retirée du contrat, mais tracée). */
export interface ExclusionDetectee {
  page: number;
  texte: string;
}

/**
 * Sous-ensemble PERSISTÉ de l'analyse (sans la piste d'audit `lignes`, volumineuse) :
 * ce que les écrans de vérification/consolidation exploitent durablement.
 */
export interface DevisAnalyseMeta {
  controles: ControleCoherence[];
  exclusions: ExclusionDetectee[];
  options: { posteId: string; label: string }[];
  metriques: DevisAnalyseGeo['metriques'];
  versionMoteur: string;
}

/** Résultat complet de l'analyse géométrique. */
export interface DevisAnalyseGeo {
  /** Contrat structuré (lots → postes), lots en brouillon. Absent si illisible. */
  devis?: Devis;
  reconciliation: TotalsReconciliation;
  /** Toutes les lignes classées (piste d'audit). */
  lignes: LigneClasse[];
  controles: ControleCoherence[];
  exclusions: ExclusionDetectee[];
  /** Postes détectés comme options (jamais intégrés sans validation). */
  options: { posteId: string; label: string }[];
  metriques: {
    lotsDetectes: number;
    postesConstruits: number;
    lignesNumerotees: number;
    exclusions: number;
    options: number;
  };
  versionMoteur: string;
  /** true quand la géométrie n'expose pas de tableau colonné exploitable : il
   *  faut retomber sur le lecteur texte (`extractDevisContract`). */
  fallbackTexte: boolean;
}

/* -------------------------------------------------------------------------- *
 * Petits utilitaires
 * -------------------------------------------------------------------------- */
const round2 = (n: number): number => Math.round(n * 100) / 100;
const norm = (s: string): string => s.replace(/\s{2,}/g, ' ').trim();

/** Regroupe les mots d'une page en lignes (tolérance verticale). */
function grouperLignes(tokens: MotToken[]): { y: number; toks: MotToken[] }[] {
  const sorted = [...tokens].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; toks: MotToken[] }[] = [];
  for (const t of sorted) {
    const row = rows.find((r) => Math.abs(r.y - t.y) <= 3);
    if (row) row.toks.push(t);
    else rows.push({ y: t.y, toks: [t] });
  }
  for (const r of rows) r.toks.sort((a, b) => a.x - b.x);
  return rows;
}

/* -------------------------------------------------------------------------- *
 * Détection des colonnes (ancrée sur l'en-tête « N° DÉSIGNATION QTÉ … »)
 * -------------------------------------------------------------------------- */
interface Colonnes {
  /** Bord droit de la colonne « N° » (au-delà : désignation). */
  numMax: number;
  /** Bord droit de la désignation (au-delà : zone des valeurs). */
  desMax: number;
  /** Ancres (x gauche) des colonnes de valeurs, pour l'assignation au plus proche. */
  ancres: { col: keyof CellulesLigne; x: number }[];
}

const RE_DESIGNATION = /d[eé]signation/i;
const RE_TOTAL_HT = /total\s*ht/i;

/** Trouve l'en-tête du tableau et en déduit les frontières de colonnes. */
function detecterColonnes(pages: PageGeom[]): Colonnes | undefined {
  for (const pg of pages) {
    for (const row of grouperLignes(pg.tokens)) {
      const brut = norm(row.toks.map((t) => t.str).join(' '));
      if (!RE_DESIGNATION.test(brut) || !RE_TOTAL_HT.test(brut)) continue;
      // Ancres sur les intitulés de colonnes (x gauche de chaque en-tête).
      const at = (re: RegExp): number | undefined => row.toks.find((t) => re.test(t.str))?.x;
      const num = at(/^N/);
      const des = row.toks.find((t) => RE_DESIGNATION.test(t.str))?.x;
      const qte = at(/^Q/i);
      const uni = at(/^U/i);
      const prix = row.toks.find((t) => /prix/i.test(t.str))?.x;
      const tva = at(/^TVA/i);
      const total = row.toks.find((t) => RE_TOTAL_HT.test(t.str))?.x;
      if (des == null || qte == null || total == null) continue;
      const ancres: { col: keyof CellulesLigne; x: number }[] = [];
      if (qte != null) ancres.push({ col: 'qte', x: qte });
      if (uni != null) ancres.push({ col: 'unite', x: uni });
      if (prix != null) ancres.push({ col: 'prix', x: prix });
      if (tva != null) ancres.push({ col: 'tva', x: tva });
      ancres.push({ col: 'total', x: total });
      return {
        numMax: num != null ? (num + des) / 2 : des - 12,
        // La désignation s'arrête AVANT la colonne QTÉ. Les valeurs de QTÉ sont
        // cadrées à droite : selon le nombre de chiffres, leur bord GAUCHE varie
        // (« 1,00 » plus à droite que « 140,00 »). On place donc la frontière
        // assez à gauche de l'ancre d'en-tête pour capter aussi les quantités
        // longues, sans mordre sur la désignation (qui reste nettement à gauche).
        desMax: qte - 20,
        ancres,
      };
    }
  }
  return undefined;
}

/** Assigne les mots d'une ligne à leurs colonnes selon la géométrie détectée. */
function cellulesDeLigne(toks: MotToken[], col: Colonnes): CellulesLigne {
  const cells: CellulesLigne = {
    num: '',
    designation: '',
    qte: '',
    unite: '',
    prix: '',
    tva: '',
    total: '',
  };
  const push = (k: keyof CellulesLigne, s: string): void => {
    cells[k] = cells[k] ? `${cells[k]} ${s}` : s;
  };
  for (const t of toks) {
    if (t.x < col.numMax) push('num', t.str);
    else if (t.x < col.desMax) push('designation', t.str);
    else {
      // Zone des valeurs : colonne dont l'ancre est la plus proche du bord gauche.
      let best = col.ancres[0]!;
      for (const a of col.ancres) if (Math.abs(a.x - t.x) < Math.abs(best.x - t.x)) best = a;
      push(best.col, t.str);
    }
  }
  for (const k of Object.keys(cells) as (keyof CellulesLigne)[]) cells[k] = norm(cells[k]);
  return cells;
}

/* -------------------------------------------------------------------------- *
 * Classification des blocs
 * -------------------------------------------------------------------------- */
const RE_NUM_POSTE = /^\d{1,2}\.\d{1,2}$/;
const RE_NUM_LOT = /^\d{1,2}\.?$/;
const RE_MONTANT = /\d[\d\s]*,\d{2}/;
const RE_PIED = /(RCS|Page\s+\d+\s+sur\s+\d+|Tél\s*:|Email\s*:|SASU|SIRET)/i;
const RE_EXCLUSION =
  /(ATTENTION\s*:|n['’]est\s+pas\s+inclus|non\s+inclus|hors\s+devis|à\s+la\s+charge\s+du\s+client|non\s+compris(?:e)?\s+dans)/i;
const RE_OPTION = /(\boption\b|en\s+option|\bvariante\b|plus-value|à\s+titre\s+indicatif)/i;
const RE_TOTAL_GEN = /(total\s+net\s+ht|total\s+ttc|net\s+à\s+payer|\btva\b\s+\d)/i;
const RE_VENTIL_TVA = /(taux\s+tva|base\s+ht)/i;
const RE_ACOMPTE = /(acompte|reste\s+à\s+facturer|arrhes)/i;
const RE_ECHEANCE = /(à\s+la\s+signature|milieu\s+de\s+chantier|à\s+réception|échéanc)/i;
const RE_PAIEMENT = /(conditions?\s+de\s+paiement|méthodes?\s+de\s+paiement|chèque|virement)/i;
const RE_MENTIONS = /(je\s+certifie|article\s+257|cgi|code\s+civil|assurance\s+décennale)/i;
const RE_DECHETS =
  /(gestion\s+des\s+déchets|déchetterie|point\s+de\s+collecte|déchets?\s+(?:non\s+)?dangereux)/i;
const RE_SIGN =
  /(bon\s+pour\s+accord|pour\s+l['’]entreprise|pour\s+le\s+client|date\s+et\s+signature)/i;
const RE_NOTES = /^notes?$/i;
const RE_GARANTIE = /(garantie|décennale|parfait\s+achèvement)/i;
const RE_DELAI = /(délai|durée\s+estimée|début\s+des\s+travaux)/i;
const RE_REMISE = /(remise|rabais|geste\s+commercial)/i;

/** Une ligne a-t-elle au moins une valeur chiffrée (prix / total) ? */
const aValeurs = (c: CellulesLigne): boolean =>
  RE_MONTANT.test(c.total) || RE_MONTANT.test(c.prix) || RE_MONTANT.test(c.qte);

/**
 * Classe UNE ligne reconstruite en l'un des ~25 types de blocs. L'ordre des tests
 * vaut priorité (le plus spécifique d'abord) : pied de page, en-tête, prestation/
 * lot (colonne « N° » numérotée), puis blocs de fin de document (totaux, TVA,
 * acompte, mentions…), puis compléments/matériaux, enfin `indetermine` (repli).
 */
function classerLigne(c: CellulesLigne, brut: string): BlocType {
  if (RE_PIED.test(brut)) return 'pied_de_page';
  if (RE_DESIGNATION.test(brut) && RE_TOTAL_HT.test(brut)) return 'entete_tableau';

  // Prestation ou lot : la colonne « N° » porte un numéro.
  if (RE_NUM_POSTE.test(c.num)) {
    if (RE_EXCLUSION.test(c.designation)) return 'exclusion';
    if (RE_OPTION.test(c.designation)) return 'option';
    return 'prestation';
  }
  if (RE_NUM_LOT.test(c.num) && c.designation && RE_MONTANT.test(c.total) && !c.prix && !c.qte) {
    return 'lot';
  }

  // Ligne de DONNÉES de la ventilation TVA (« 5,5 % <base HT> <TVA> ») : un taux
  // en tête de colonne « valeurs », sans n° ni désignation → jamais une prestation.
  if (!c.num && !c.designation && /^\d{1,2}([.,]\d+)?\s*%$/.test(c.qte)) return 'ventilation_tva';

  // Blocs de fin de document (hors tableau des prestations).
  if (RE_VENTIL_TVA.test(brut)) return 'ventilation_tva';
  if (RE_TOTAL_GEN.test(brut)) return 'total_general';
  if (RE_ACOMPTE.test(brut)) return 'acompte';
  if (RE_ECHEANCE.test(brut)) return 'echeancier';
  if (RE_PAIEMENT.test(brut)) return 'conditions_paiement';
  if (RE_DECHETS.test(brut)) return 'gestion_dechets';
  if (RE_SIGN.test(brut)) return 'signature';
  if (RE_NOTES.test(brut)) return 'notes';
  if (RE_MENTIONS.test(brut)) return 'mentions_legales';
  if (RE_GARANTIE.test(brut)) return 'garantie';
  if (RE_REMISE.test(brut)) return 'remise';
  if (RE_DELAI.test(brut)) return 'delai';

  // Rattachable à une prestation en cours : complément ou matériau.
  if (c.designation && !c.num && !aValeurs(c)) {
    return /^[-•·]/.test(c.designation) ? 'materiau' : 'description_complement';
  }
  // Ligne de valeurs orpheline (num vide mais montants présents).
  if (!c.num && aValeurs(c)) return 'prestation_valeurs';

  return 'indetermine';
}

/* -------------------------------------------------------------------------- *
 * Libellés (contractuel exact + court opérationnel)
 * -------------------------------------------------------------------------- */
const nettoyerLabel = (s: string): string => norm(s.replace(/^[\s:–\-]+|[\s:–\-]+$/g, ''));

/** Dérive un libellé COURT opérationnel du libellé contractuel exact. */
function libelleCourt(exact: string): string {
  // On coupe à la première borne naturelle (comprenant / compris / « , » /
  // « : ») pour garder l'action, sans le détail contractuel.
  const coupe = exact.split(/\s+(?:comprenant|compris|,|:|\()/i)[0] ?? exact;
  const court = norm(coupe);
  if (court.length <= 70) return court;
  // Sinon, tronque sur une frontière de mot.
  const tronc = court.slice(0, 70);
  return `${tronc.slice(0, tronc.lastIndexOf(' '))}…`;
}

/* -------------------------------------------------------------------------- *
 * Pipeline complet
 * -------------------------------------------------------------------------- */

/**
 * Analyse un devis à partir de sa GÉOMÉTRIE. Si aucune colonne de tableau n'est
 * détectable (PDF non colonné, texte synthétique…), renvoie `fallbackTexte:true`
 * pour que l'appelant retombe sur le lecteur texte.
 */
export function analyserDevisGeo(pages: PageGeom[]): DevisAnalyseGeo {
  const vide = (fallback: boolean): DevisAnalyseGeo => ({
    reconciliation: reconcileTotals(undefined, undefined, undefined),
    lignes: [],
    controles: [],
    exclusions: [],
    options: [],
    metriques: {
      lotsDetectes: 0,
      postesConstruits: 0,
      lignesNumerotees: 0,
      exclusions: 0,
      options: 0,
    },
    versionMoteur: MOTEUR_VERSION,
    fallbackTexte: fallback,
  });

  const col = detecterColonnes(pages);
  if (!col) return vide(true);

  // 1-3) Lignes reconstruites + classées, dans l'ordre de lecture (pages, puis y↓).
  const lignes: LigneClasse[] = [];
  for (const pg of [...pages].sort((a, b) => a.page - b.page)) {
    for (const row of grouperLignes(pg.tokens)) {
      const cells = cellulesDeLigne(row.toks, col);
      const brut = norm(row.toks.map((t) => t.str).join(' '));
      if (!brut) continue;
      lignes.push({ page: pg.page, y: row.y, cells, brut, type: classerLigne(cells, brut) });
    }
  }

  // 4-5) Construction des prestations.
  const lots: DevisLot[] = [];
  const exclusions: ExclusionDetectee[] = [];
  const options: { posteId: string; label: string }[] = [];
  let currentLot: DevisLot | null = null;
  let current: { poste: DevisPoste; complements: string[] } | null = null;
  let seq = 0;
  let lignesNumerotees = 0;
  const orphelins: LigneClasse[] = [];

  const finaliser = (): void => {
    if (!current) return;
    const { poste, complements } = current;
    const exact = nettoyerLabel([poste.label, ...complements].join(' '));
    poste.label = exact;
    poste.libelleCourt = libelleCourt(exact);
    poste.verification = evaluerVerification(poste);
    current = null;
  };

  for (const l of lignes) {
    const c = l.cells;
    switch (l.type) {
      case 'lot': {
        finaliser();
        const lot: DevisLot = {
          id: `lot-${c.num.replace(/\.$/, '')}`,
          label: nettoyerLabel(c.designation.replace(/^\d{1,2}\.\s*/, '')),
          postes: [],
          statut: 'brouillon',
        };
        lots.push(lot);
        currentLot = lot;
        break;
      }
      case 'exclusion': {
        finaliser();
        lignesNumerotees += 1;
        exclusions.push({ page: l.page, texte: norm(c.designation) });
        break;
      }
      case 'option':
      case 'prestation': {
        finaliser();
        lignesNumerotees += 1;
        if (!currentLot) {
          orphelins.push(l);
          break;
        }
        seq += 1;
        const qte = parseMontantFr(c.qte);
        const pu = parseMontantFr(c.prix);
        const tva = parseTauxFr(c.tva);
        const montant = parseMontantFr(c.total);
        const poste: DevisPoste = {
          id: `p-${seq}`,
          label: nettoyerLabel(c.designation),
          montantHT: montant ?? 0,
          tva: tva ?? 0,
          sourcePage: l.page,
          sourceText: l.brut,
          verification: 'non_compris',
        };
        if (qte != null) poste.quantite = qte;
        if (c.unite) poste.unite = c.unite.replace(/\.$/, '');
        if (pu != null) poste.prixUnitaireHT = pu;
        if (l.type === 'option') {
          poste.option = true;
          options.push({ posteId: poste.id, label: poste.label });
        }
        currentLot.postes.push(poste);
        current = { poste, complements: [] };
        break;
      }
      case 'description_complement': {
        if (current) current.complements.push(norm(c.designation));
        break;
      }
      case 'prestation_valeurs': {
        // Valeurs sur une ligne séparée du poste précédent (layout alternatif).
        if (current && !(current.poste.montantHT > 0)) {
          const qte = parseMontantFr(c.qte);
          const pu = parseMontantFr(c.prix);
          const tva = parseTauxFr(c.tva);
          const montant = parseMontantFr(c.total);
          if (qte != null) current.poste.quantite = qte;
          if (c.unite) current.poste.unite = c.unite.replace(/\.$/, '');
          if (pu != null) current.poste.prixUnitaireHT = pu;
          if (tva != null) current.poste.tva = tva;
          if (montant != null) current.poste.montantHT = montant;
        } else {
          orphelins.push(l);
        }
        break;
      }
      // 'materiau' et tous les blocs non contractuels : ignorés du contrat.
      default:
        break;
    }
  }
  finaliser();

  // Lot sans poste détaillé → poste forfaitaire (repli, comme le lecteur texte).
  // (Non requis sur le corpus réel, mais garde la parité de comportement.)

  const devis = lots.some((l) => l.postes.length > 0) ? { lots } : undefined;
  const declared = declaredTotalsFrom(lignes);
  // Réconciliation sur le contrat FERME (hors options) : une option n'entre pas
  // dans le « Total net HT » du vendeur ; l'inclure fabriquerait un faux écart.
  const devisFerme = devis
    ? { lots: devis.lots.map((l) => ({ ...l, postes: l.postes.filter((p) => !p.option) })) }
    : undefined;
  const reconciliation = reconcileTotals(devisFerme, declared.ht, declared.ttc);

  // 6) Contrôles de cohérence.
  const controles = controlesCoherence({
    devis,
    reconciliation,
    lignesNumerotees,
    postes: devis ? devis.lots.flatMap((x) => x.postes) : [],
    orphelins,
    options,
    declaredTTC: declared.ttc,
  });

  return {
    devis,
    reconciliation,
    lignes,
    controles,
    exclusions,
    options,
    metriques: {
      lotsDetectes: lots.length,
      postesConstruits: devis ? devis.lots.reduce((a, l) => a + l.postes.length, 0) : 0,
      lignesNumerotees,
      exclusions: exclusions.length,
      options: options.length,
    },
    versionMoteur: MOTEUR_VERSION,
    fallbackTexte: false,
  };
}

/** Lit les totaux déclarés depuis les lignes de type total/ventilation. */
function declaredTotalsFrom(lignes: LigneClasse[]): { ht?: number; ttc?: number } {
  const blob = lignes
    .filter((l) => l.type === 'total_general' || l.type === 'ventilation_tva')
    .map((l) => l.brut)
    .join('\n');
  return extractDeclaredTotals(blob);
}

/* -------------------------------------------------------------------------- *
 * Contrôles de cohérence (déterministes)
 * -------------------------------------------------------------------------- */
function controlesCoherence(args: {
  devis?: Devis;
  reconciliation: TotalsReconciliation;
  lignesNumerotees: number;
  postes: DevisPoste[];
  orphelins: LigneClasse[];
  options: { posteId: string; label: string }[];
  declaredTTC?: number;
}): ControleCoherence[] {
  const { reconciliation, lignesNumerotees, postes, orphelins, options } = args;
  const out: ControleCoherence[] = [];

  // a) Réconciliation des montants HT.
  if (reconciliation.totalHTDeclare != null) {
    out.push({
      id: 'reconciliation-ht',
      libelle: 'Montants',
      gravite: reconciliation.coherent ? 'ok' : 'bloquant',
      message: reconciliation.coherent
        ? `Somme des lignes = total HT déclaré (${reconciliation.totalHTDeclare.toLocaleString('fr-FR')} €).`
        : `Écart de ${reconciliation.ecartHT?.toLocaleString('fr-FR')} € entre la somme des lignes et le total HT déclaré.`,
    });
  }

  // b) Comptage : chaque ligne numérotée (hors exclusion) doit devenir un poste.
  const attendus = lignesNumerotees; // exclusions incluses dans le comptage
  const construits = postes.length;
  const exclusions = attendus - construits; // exclusions retirées
  out.push({
    id: 'comptage-lignes',
    libelle: 'Comptage des lignes',
    gravite: construits <= attendus ? 'ok' : 'attention',
    message: `${construits} prestation(s) construite(s) pour ${attendus} ligne(s) numérotée(s)${
      exclusions > 0 ? ` (${exclusions} exclusion/note retirée(s))` : ''
    } — aucune ligne inventée.`,
  });

  // c) Prix orphelins (valeurs non rattachées à une prestation).
  if (orphelins.length > 0) {
    out.push({
      id: 'prix-orphelin',
      libelle: 'Prix orphelins',
      gravite: 'attention',
      message: `${orphelins.length} ligne(s) de valeurs sans prestation rattachée — à contrôler.`,
    });
  }

  // d) Cohérence quantité × prix unitaire = montant, par poste.
  const incoherents = postes.filter(
    (p) =>
      p.quantite != null &&
      p.prixUnitaireHT != null &&
      Math.abs(round2(p.quantite * p.prixUnitaireHT) - p.montantHT) > 1,
  );
  if (incoherents.length > 0) {
    out.push({
      id: 'qte-pu-montant',
      libelle: 'Quantité × prix',
      gravite: 'attention',
      message: `${incoherents.length} poste(s) où quantité × prix unitaire ≠ montant — à vérifier.`,
    });
  }

  // e) Options : jamais intégrées sans validation explicite.
  if (options.length > 0) {
    out.push({
      id: 'options',
      libelle: 'Options',
      gravite: 'info',
      message: `${options.length} option(s)/variante(s) détectée(s) — non intégrée(s) tant que non validée(s).`,
    });
  }

  return out;
}

/** Confiance affichée (vocabulaire premium) dérivée de l'état de vérification. */
export const CONFIANCE_LABEL: Record<VerificationNiveau, string> = {
  verifie: 'Fiable',
  a_verifier: 'À vérifier',
  non_compris: 'Incertain',
};
