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
 *   1. Reconstruction des lignes   (regroupement par y, tri par x, fusion milliers)
 *   2. Détection des colonnes       (sémantique de l'en-tête + positions APPRISES
 *                                     des données : ordre des colonnes agnostique)
 *   3. Retrait en-têtes / pieds     (pieds de page répétés, QR, bandeaux)
 *   4. Classification des blocs      (~25 types, STRUCTURELLE ; numéro OPTIONNEL ;
 *                                     « indéterminé » n'est JAMAIS une prestation)
 *   5. Construction des prestations  (libellé exact + libellé court, source,
 *                                     confiance, statut brouillon ; sections nommées)
 *   6. Contrôles de cohérence        (montants, comptage, prix orphelin, options)
 *
 * Qualifié sur un corpus RÉEL hétérogène : Phenix-amo, Renovely, bon de commande
 * SANS numéro (sections nommées), devis multi-corps d'état à numérotation 3 niveaux
 * et colonnes réordonnées (TVA avant Qté). Aucune règle calée sur un logiciel donné.
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
  | 'liste_prix'
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
  'liste_prix',
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
  /** Profil d'analyse retenu : `obat` (spécialisé) ou `generique`. */
  profil?: ProfilAnalyse;
}

/** Profil d'analyse appliqué au document. */
export type ProfilAnalyse = 'obat' | 'generique';

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
  /** Profil d'analyse retenu : `obat` (spécialisé, colonnes ancrées sur l'en-tête)
   *  ou `generique` (colonnes apprises des données). */
  profil: ProfilAnalyse;
  /** true quand la géométrie n'expose pas de tableau colonné exploitable : il
   *  faut retomber sur le lecteur texte (`extractDevisContract`). */
  fallbackTexte: boolean;
}

/* -------------------------------------------------------------------------- *
 * Petits utilitaires
 * -------------------------------------------------------------------------- */
const round2 = (n: number): number => Math.round(n * 100) / 100;
const norm = (s: string): string => s.replace(/\s{2,}/g, ' ').trim();

/**
 * Fusionne un montant coupé par le SÉPARATEUR DE MILLIERS (« 1 127,50 » rendu en
 * deux mots « 1 » + « 127,50 ») quand les deux mots sont adjacents. Sans cela, la
 * partie « milliers » pollue la reconstruction des colonnes (grappe des totaux
 * élargie) et l'assignation. Ne fusionne que des chiffres réellement contigus.
 */
function fusionnerMilliers(toks: MotToken[]): MotToken[] {
  const sorted = [...toks].sort((a, b) => a.x - b.x);
  const out: MotToken[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const t = sorted[i]!;
    const n = sorted[i + 1];
    if (
      n &&
      /^\d{1,3}$/.test(t.str) &&
      /^\d{3}([.,\s]\d{1,3})*\s*€?$/.test(n.str) &&
      n.x - (t.x + t.w) < 12
    ) {
      out.push({ x: t.x, y: t.y, w: n.x + n.w - t.x, str: `${t.str} ${n.str}` });
      i += 1;
    } else out.push(t);
  }
  return out;
}

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
 * Détection des colonnes — PILOTÉE PAR LES DONNÉES, agnostique au logiciel
 * -------------------------------------------------------------------------- *
 * L'en-tête (« … DÉSIGNATION … TOTAL HT ») donne la SÉMANTIQUE et l'ORDRE des
 * colonnes de valeurs ; leurs positions RÉELLES sont apprises des données (les
 * montants sont cadrés à droite, leur bord gauche varie selon le nombre de
 * chiffres). On regroupe les mots « valeurs » des lignes de prestation en
 * grappes (séparées par les plus grands écarts horizontaux), reliées aux
 * colonnes de l'en-tête dans l'ordre des x. La DÉSIGNATION est tout ce qui est à
 * GAUCHE de la première colonne de valeurs ; le NUMÉRO (optionnel) est détecté
 * par motif, pas par position. Fonctionne pour Phenix-amo/Renovely (Qté U Prix
 * TVA Total), les bons de commande SANS numéro, et les devis à colonnes
 * réordonnées (TVA avant Qté), sans règle calée sur un logiciel donné.
 */
type ColKey = 'qte' | 'unite' | 'prix' | 'tva' | 'total';
interface ColonneValeur {
  col: ColKey;
  min: number;
  max: number;
  center: number;
}
export interface Colonnes {
  /** Bord gauche de la zone des valeurs (à gauche = désignation). */
  valueLeft: number;
  cols: ColonneValeur[];
}

const RE_DESIGNATION = /d[eé]signation/i;
const RE_TOTAL_HT = /total\s*ht/i;
/**
 * Un mot est-il une VALEUR (montant/quantité/taux/unité) — motif ANCRÉ, pas un
 * simple « contient un chiffre » : une désignation comme « classe P3, 7.5 » ou
 * « doublage BA13 » ne doit PAS être prise pour une valeur (sinon la reconstruction
 * des colonnes avale la désignation).
 */
const UNITE_RE = /^(u|u\.|ml|m2|m²|m3|m³|ens\.?|forfait|ff|f|pce|pcs|pc|lot|kg|g|l|h|j)$/i;
const RE_MONTANT_TOK = /^\d[\d\s ]*([.,]\d{1,3})?\s*€?$/;
const RE_TAUX_TOK = /^\d{1,3}([.,]\d+)?\s*%$/;
const estValeur = (s: string): boolean =>
  RE_MONTANT_TOK.test(s) || RE_TAUX_TOK.test(s) || UNITE_RE.test(s);
/** Un mot finit-il une ligne par un MONTANT (« 1 234,56 € ») ? */
const finitParMontant = (s: string): boolean => /\d[\d\s]*,\d{2}\s*€?$/.test(s);

/** Colonnes sémantiques de l'en-tête, dans l'ordre des x (num/désignation exclues). */
function colonnesEntete(toks: MotToken[]): { col: ColKey; x: number }[] {
  const desX = toks.find((t) => RE_DESIGNATION.test(t.str))?.x ?? -1;
  const out: { col: ColKey; x: number }[] = [];
  const seen = new Set<ColKey>();
  for (const t of [...toks].sort((a, b) => a.x - b.x)) {
    if (t.x <= desX) continue;
    let col: ColKey | undefined;
    if (/^(qt|quantit)/i.test(t.str)) col = 'qte';
    else if (/^(u\.?$|unit)/i.test(t.str)) col = 'unite';
    else if (/prix/i.test(t.str)) col = 'prix';
    else if (/^tva/i.test(t.str)) col = 'tva';
    else if (/^total/i.test(t.str)) col = 'total';
    if (col && !seen.has(col)) {
      seen.add(col);
      out.push({ col, x: t.x });
    }
  }
  return out;
}

/** Détecte l'en-tête, puis apprend les colonnes de valeurs à partir des données. */
function detecterColonnes(pages: PageGeom[]): Colonnes | undefined {
  let headerToks: MotToken[] | undefined;
  for (const pg of pages) {
    for (const row of grouperLignes(pg.tokens)) {
      const brut = norm(row.toks.map((t) => t.str).join(' '));
      if (RE_DESIGNATION.test(brut) && RE_TOTAL_HT.test(brut)) {
        headerToks = row.toks;
        break;
      }
    }
    if (headerToks) break;
  }
  if (!headerToks) return undefined;
  const entete = colonnesEntete(headerToks);
  if (entete.length < 2) return undefined;

  // Apprentissage : centres des mots-valeurs des lignes de PRESTATION (finissant
  // par un montant). On privilégie les lignes à NUMÉRO de tête (vraies lignes du
  // tableau) : cela écarte les blocs de fin de page (acompte, ventilation TVA) qui
  // finissent aussi par un montant. À défaut de numérotation (bons de commande),
  // on retombe sur toutes les lignes finissant par un montant.
  type Span = { c: number; left: number; right: number };
  const spansNum: Span[] = [];
  const spansAll: Span[] = [];
  for (const pg of pages) {
    for (const row of grouperLignes(pg.tokens)) {
      const toks = fusionnerMilliers(row.toks);
      const last = toks[toks.length - 1];
      if (!last || !finitParMontant(last.str)) continue;
      let i = toks.length - 1;
      while (i >= 0 && estValeur(toks[i]!.str)) i -= 1;
      const vals = toks.slice(i + 1);
      if (vals.length < 2) continue; // au moins prix + total
      const cible = /^\d/.test(toks[0]!.str) ? spansNum : spansAll;
      for (const t of vals) cible.push({ c: t.x + t.w / 2, left: t.x, right: t.x + t.w });
    }
  }
  const K = entete.length;
  const spans = spansNum.length >= K ? spansNum : [...spansNum, ...spansAll];
  if (spans.length < K) return undefined;

  // Grappes par écarts : K colonnes → K-1 plus grands écarts entre centres triés.
  const sorted = [...spans.map((s) => s.c)].sort((a, b) => a - b);
  const cuts = sorted
    .slice(1)
    .map((v, i) => ({ gap: v - sorted[i]!, at: i }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, K - 1)
    .map((g) => g.at)
    .sort((a, b) => a - b);
  const bornes = cuts.map((cut) => (sorted[cut]! + sorted[cut + 1]!) / 2);
  const clusterOf = (c: number): number => {
    let k = 0;
    while (k < bornes.length && c >= bornes[k]!) k += 1;
    return k;
  };
  const agg = Array.from({ length: K }, () => ({ min: Infinity, max: -Infinity, sum: 0, n: 0 }));
  for (const s of spans) {
    const a = agg[clusterOf(s.c)]!;
    a.min = Math.min(a.min, s.left);
    a.max = Math.max(a.max, s.right);
    a.sum += s.c;
    a.n += 1;
  }
  // Relie chaque grappe (ordre x) à sa colonne sémantique (en-tête, ordre x).
  const cols: ColonneValeur[] = [];
  for (let k = 0; k < K; k += 1) {
    const a = agg[k]!;
    if (a.n === 0) continue;
    cols.push({ col: entete[k]!.col, min: a.min, max: a.max, center: a.sum / a.n });
  }
  if (cols.length === 0) return undefined;
  return { valueLeft: Math.min(...cols.map((c) => c.min)), cols };
}

/**
 * PROFIL OBAT — colonnes ANCRÉES SUR L'EN-TÊTE (positions fixes du gabarit OBAT),
 * et non apprises des données. L'en-tête OBAT « N° DÉSIGNATION QTÉ U. PRIX U. TVA
 * TOTAL HT » donne les x de chaque colonne ; on en déduit des frontières par
 * milieux. Fiable même sur un devis à une seule ligne (pas de dépendance aux
 * données), là où l'apprentissage générique peut vaciller. Renvoie `undefined`
 * si l'en-tête OBAT n'est pas trouvé (→ repli générique).
 */
export function colonnesObat(pages: PageGeom[]): Colonnes | undefined {
  let headerToks: MotToken[] | undefined;
  for (const pg of pages) {
    for (const row of grouperLignes(pg.tokens)) {
      const brut = norm(row.toks.map((t) => t.str).join(' '));
      if (RE_DESIGNATION.test(brut) && RE_TOTAL_HT.test(brut)) {
        headerToks = row.toks;
        break;
      }
    }
    if (headerToks) break;
  }
  if (!headerToks) return undefined;
  const entete = colonnesEntete(headerToks); // colonnes de valeurs, ordre x
  if (entete.length < 2) return undefined;
  const xs = entete.map((e) => e.x);
  // Frontières = milieux entre x d'en-tête consécutifs ; la désignation s'arrête
  // 15 px avant la 1ʳᵉ colonne de valeurs (quantités cadrées à droite comprises).
  const cols: ColonneValeur[] = entete.map((e, i) => {
    const min = i === 0 ? xs[0]! - 15 : (xs[i - 1]! + xs[i]!) / 2;
    const max = i === entete.length - 1 ? Infinity : (xs[i]! + xs[i + 1]!) / 2;
    return { col: e.col, min, max, center: e.x };
  });
  return { valueLeft: xs[0]! - 15, cols };
}

/** Assigne les mots d'une ligne à leurs colonnes (désignation = à gauche des valeurs). */
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
  // Dé-doublonnage du texte rendu DEUX FOIS (même mot, position quasi identique).
  const dedup: MotToken[] = [];
  for (const t of fusionnerMilliers(toks)) {
    const prev = dedup[dedup.length - 1];
    if (prev && prev.str === t.str && Math.abs(prev.x - t.x) <= 2) continue;
    dedup.push(t);
  }
  // Numéro de tête (optionnel), détecté PAR MOTIF (« 1 », « 1.1 », « 2.1.1 »).
  let rest = dedup;
  const first = dedup[0];
  if (
    first &&
    first.x + first.w / 2 < col.valueLeft &&
    /^\d{1,2}(\.\d{1,2}){0,3}\.?$/.test(first.str)
  ) {
    cells.num = first.str.replace(/\.$/, '');
    rest = dedup.slice(1);
  }
  for (const t of rest) {
    const c = t.x + t.w / 2;
    if (c < col.valueLeft) {
      push('designation', t.str);
      continue;
    }
    let best = col.cols[0]!;
    for (const cc of col.cols) {
      const inCc = c >= cc.min && c <= cc.max;
      const inBest = c >= best.min && c <= best.max;
      if (inCc && !inBest) best = cc;
      else if (inCc === inBest && Math.abs(cc.center - c) < Math.abs(best.center - c)) best = cc;
    }
    push(best.col, t.str);
  }
  for (const k of Object.keys(cells) as (keyof CellulesLigne)[]) cells[k] = norm(cells[k]);
  return cells;
}

/* -------------------------------------------------------------------------- *
 * Classification des blocs
 * -------------------------------------------------------------------------- */
const RE_MONTANT = /\d[\d\s]*,\d{2}/;
const RE_PIED =
  /(RCS|Page\s+\d+\s+sur\s+\d+|^\s*\d{1,3}\s*\/\s*\d{1,3}\s*$|Tél\s*:|Email\s*:|SASU|SIRET|APE\s|scannez\s+le\s+code|retrouver\s+ce\s+(?:bon|devis))/i;
const RE_EXCLUSION =
  /(ATTENTION\s*:|n['’]est\s+pas\s+inclus|non\s+inclus|hors\s+devis|à\s+la\s+charge\s+du\s+client|non\s+compris(?:e)?\s+dans)/i;
// « plus-value » est un SUPPLÉMENT ferme (pas une option) : on ne le capte PAS ici.
const RE_OPTION =
  /(\ben\s+option\b|option\s*:|\bvariante\b|à\s+titre\s+indicatif|pour\s+information)/i;
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
// « Transparence des prix » / « prestations supplémentaires » (OBAT) : liste de
// PRIX À LA CARTE (add-ons à quantité 0), non contractuelle — jamais des prestations.
const RE_LISTE_PRIX = /(transparence\s+des\s+prix|prestations?\s+suppl[ée]mentaires?)/i;
/** Quantité entre parenthèses d'une ligne de matériau (« (2 u) », « (15 ml) »). */
const RE_QTE_PAREN = /\(\d+([.,]\d+)?\s*(u|ml|m2|m²|m3|m³|pce|pcs|pc|kg|g|l|h)\b/i;

/** Une ligne a-t-elle au moins une valeur chiffrée (prix / total) ? */
const aValeurs = (c: CellulesLigne): boolean =>
  RE_MONTANT.test(c.total) || RE_MONTANT.test(c.prix) || RE_MONTANT.test(c.qte);

/**
 * Classe UNE ligne reconstruite en l'un des ~25 types de blocs. STRUCTUREL (le
 * numéro est optionnel) : une PRESTATION = désignation + valeurs (total + prix ou
 * quantité) ; un LOT/section = désignation sans prix ni quantité. L'ordre vaut
 * priorité : pied de page, en-tête, blocs de fin de document (par mot-clé, robuste
 * à la zone), puis prestation, exclusion, lot/section, sous-total, matériau, et
 * enfin `indetermine` (repli — JAMAIS une prestation). Le contexte (lot courant,
 * prestation en cours, dans/hors tableau) est tranché dans la boucle de construction.
 */
function classerLigne(c: CellulesLigne, brut: string): BlocType {
  if (RE_PIED.test(brut)) return 'pied_de_page';
  if (RE_DESIGNATION.test(brut) && RE_TOTAL_HT.test(brut)) return 'entete_tableau';
  // Liste de prix à la carte (add-ons non contractuels) : ouvre une zone d'options.
  if (RE_LISTE_PRIX.test(brut)) return 'liste_prix';

  // Blocs de fin STRUCTURELS (colonnes de valeurs) : à écarter avant la prestation.
  if (RE_VENTIL_TVA.test(brut)) return 'ventilation_tva';
  if (!c.num && !c.designation && /^\d{1,2}([.,]\d+)?\s*%$/.test(c.qte)) return 'ventilation_tva';
  if (RE_TOTAL_GEN.test(brut)) return 'total_general';

  const hasTotal = RE_MONTANT.test(c.total);
  const hasPrix = c.prix !== '';
  const hasQte = c.qte !== '';
  const numSimple = /^\d{1,2}$/.test(c.num);
  const numMulti = /^\d{1,2}(\.\d{1,2}){1,3}$/.test(c.num);

  const estPrestation = c.designation !== '' && hasTotal && (hasPrix || hasQte);
  const classerPrestation = (): BlocType => {
    if (RE_EXCLUSION.test(c.designation)) return 'exclusion';
    if (RE_OPTION.test(c.designation)) return 'option';
    return 'prestation';
  };

  // PRESTATION NUMÉROTÉE — prioritaire sur les mots-clés : une ligne chiffrée
  // « 10.2 Remise commerciale exceptionnelle -1 200,00 € » est une PRESTATION
  // (remise / moins-value), pas une note. Le NUMÉRO distingue une vraie ligne du
  // tableau d'un bloc de fin (acompte, ventilation TVA) qui, lui, n'en a pas.
  if ((numSimple || numMulti) && estPrestation) return classerPrestation();

  // Blocs de fin de document reconnus par MOT-CLÉ (lignes SANS numéro de tableau).
  if (RE_ACOMPTE.test(brut)) return 'acompte';
  if (RE_ECHEANCE.test(brut)) return 'echeancier';
  if (RE_PAIEMENT.test(brut)) return 'conditions_paiement';
  if (RE_DECHETS.test(brut)) return 'gestion_dechets';
  if (RE_SIGN.test(brut)) return 'signature';
  if (RE_MENTIONS.test(brut)) return 'mentions_legales';
  if (RE_GARANTIE.test(brut)) return 'garantie';
  if (RE_REMISE.test(brut)) return 'remise';
  if (RE_DELAI.test(brut)) return 'delai';
  if (RE_NOTES.test(brut)) return 'notes';

  // PRESTATION NON NUMÉROTÉE (bons de commande sans numéro), après les mots-clés.
  if (estPrestation) return classerPrestation();
  // EXCLUSION explicite (« … N'EST PAS INCLUSE »), même sans valeurs exploitables.
  if (c.designation && RE_EXCLUSION.test(c.designation)) return 'exclusion';

  // LOT / SECTION : désignation sans prix ni quantité (total = sous-total éventuel).
  if (c.designation && !hasPrix && !hasQte) {
    if (numSimple) return 'lot'; // lot numéroté (« 1 INSTALLATION »)
    if (numMulti) return 'sous_total_lot'; // sous-section numérotée (« 2.1 »)
    if (/^[-•·]/.test(brut.trim())) return 'materiau'; // puce matériau
    // Sans numéro : continuation d'un libellé OU intitulé de section → décidé au contexte.
    return 'description_complement';
  }
  // Sous-total « <libellé> : <montant> » sans désignation (en zone valeurs).
  if (!c.designation && hasTotal) return 'sous_total_lot';
  // Ligne de valeurs orpheline (montants présents, ni désignation ni numéro).
  if (!c.designation && aValeurs(c)) return 'prestation_valeurs';

  return 'indetermine';
}

/** Un texte court ressemble-t-il à un INTITULÉ DE SECTION (bon de commande sans n°) ? */
function estIntituleSection(txt: string): boolean {
  return txt.length > 0 && txt.length <= 40 && !/[.;]/.test(txt) && txt.split(/\s+/).length <= 5;
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
export function analyserDevisGeo(
  pages: PageGeom[],
  opts: { colonnes?: Colonnes; profil?: ProfilAnalyse } = {},
): DevisAnalyseGeo {
  const profil: ProfilAnalyse = opts.profil ?? 'generique';
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
    profil,
    fallbackTexte: fallback,
  });

  // Colonnes fournies (profil OBAT ancré sur l'en-tête) ou apprises des données.
  const col = opts.colonnes ?? detecterColonnes(pages);
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
  let current: {
    poste: DevisPoste;
    complements: string[];
    /** Sous-listes de matériaux brutes (puces) — dérivées, jamais dans le libellé. */
    materiaux: string[];
    dernierY: number;
    dernierPage: number;
  } | null = null;
  let seq = 0;
  let lignesNumerotees = 0;
  // On ne crée lots/prestations qu'À L'INTÉRIEUR du tableau (entre l'en-tête et le
  // bloc des totaux) : les intitulés courts des mentions de fin ne deviennent pas
  // des lots. Un devis mono-page sans en-tête distinct reste couvert (repli texte).
  let dansTableau = false;
  // Profil OBAT : les lots sont TOUJOURS numérotés. On désactive donc la promotion
  // en section des intitulés NON numérotés (une ligne courte en majuscules dans une
  // description — « POSE … », « NUMERO 6 », une référence produit — n'est pas un lot).
  // Le moteur générique (bons de commande sans numéro) garde cette promotion.
  const sectionsAutorisees = profil !== 'obat';
  // Après une « Transparence des prix » / « prestations supplémentaires » : les
  // lignes chiffrées sont des OPTIONS à la carte (jamais intégrées sans validation).
  let apresListePrix = false;
  const orphelins: LigneClasse[] = [];

  const ouvrirLot = (id: string, label: string): DevisLot => {
    finaliser();
    const lot: DevisLot = { id, label: nettoyerLabel(label), postes: [], statut: 'brouillon' };
    lots.push(lot);
    return lot;
  };

  const finaliser = (): void => {
    if (!current) return;
    const { poste, complements, materiaux } = current;
    const exact = nettoyerLabel([poste.label, ...complements].join(' '));
    poste.label = exact;
    poste.libelleCourt = libelleCourt(exact);
    poste.verification = evaluerVerification(poste);
    // Sous-listes de matériaux conservées BRUTES (dérivation technique, hors libellé).
    if (materiaux.length > 0) poste.detailsSource = materiaux;
    current = null;
  };

  // La prochaine ligne « de contenu » (prestation/exclusion/lot) est-elle une
  // PRESTATION ? Sert à trancher intitulé de section (bon de commande) vs simple
  // continuation de libellé : une section est suivie de prestations, pas d'un lot.
  const prestationSuit = (idx: number): boolean => {
    for (let j = idx + 1; j < lignes.length; j += 1) {
      const t = lignes[j]!.type;
      if (t === 'lot') return false;
      if (t === 'prestation' || t === 'option') return true;
      // 'exclusion' et blocs neutres : on continue de chercher une vraie prestation.
    }
    return false;
  };
  let lastExclusion: ExclusionDetectee | null = null;

  for (let idx = 0; idx < lignes.length; idx += 1) {
    const l = lignes[idx]!;
    const c = l.cells;
    switch (l.type) {
      case 'entete_tableau': {
        dansTableau = true;
        break;
      }
      case 'total_general':
      case 'ventilation_tva': {
        // Fin du tableau : au-delà, les intitulés ne créent plus de lots.
        finaliser();
        lastExclusion = null;
        dansTableau = false;
        break;
      }
      case 'liste_prix': {
        // Début de la liste de prix à la carte : bascule en zone d'OPTIONS.
        finaliser();
        lastExclusion = null;
        apresListePrix = true;
        break;
      }
      case 'lot': {
        dansTableau = true;
        lastExclusion = null;
        currentLot = ouvrirLot(
          `lot-${c.num.replace(/\.$/, '')}`,
          c.designation.replace(/^\d{1,2}\.\s*/, ''),
        );
        break;
      }
      case 'exclusion': {
        finaliser();
        lignesNumerotees += 1;
        lastExclusion = { page: l.page, texte: norm(c.designation) };
        exclusions.push(lastExclusion);
        break;
      }
      case 'option':
      case 'prestation': {
        finaliser();
        lastExclusion = null;
        lignesNumerotees += 1;
        // Devis PLAT (OBAT sans lots : prestations numérotées 1, 2, 3… directement) :
        // on ouvre un lot IMPLICITE unique pour ne jamais perdre de prestation.
        if (!currentLot) {
          dansTableau = true;
          currentLot = ouvrirLot('lot-prestations', 'Prestations');
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
        if (l.type === 'option' || apresListePrix) {
          poste.option = true;
          options.push({ posteId: poste.id, label: poste.label });
        }
        currentLot.postes.push(poste);
        current = { poste, complements: [], materiaux: [], dernierY: l.y, dernierPage: l.page };
        break;
      }
      case 'description_complement': {
        const txt = norm(c.designation);
        // Un intitulé de SECTION est court, commence par une majuscule ET est suivi
        // de prestations (≠ continuation de libellé, qui précède un lot).
        const sectionLike =
          sectionsAutorisees &&
          dansTableau &&
          estIntituleSection(txt) &&
          /^[A-ZÀ-Þ]/.test(txt) &&
          !RE_QTE_PAREN.test(txt) && // une ligne de matériau (« … (2 u) ») n'est pas une section
          prestationSuit(idx);

        if (current) {
          // 1ʳᵉ ligne de description d'une prestation à libellé COURT (« Faïence »
          // + « Dépose et évacuation de faïence » en dessous) : toujours rattachée.
          const besoinDescription =
            current.complements.length === 0 && current.poste.label.length < 22;
          if (besoinDescription || !sectionLike) {
            current.complements.push(txt);
            current.dernierY = l.y;
            current.dernierPage = l.page;
            break;
          }
          // Sinon (libellé déjà complet + intitulé de section) : nouvelle section.
        } else if (lastExclusion && !sectionLike) {
          // Continuation d'une EXCLUSION multi-lignes (« … N'EST PAS / INCLUSE… »).
          lastExclusion.texte = norm(`${lastExclusion.texte} ${txt}`);
          break;
        }
        if (!dansTableau) break; // hors tableau : mention, jamais un lot
        // Suite du LIBELLÉ d'un lot fraîchement ouvert (titre sur plusieurs lignes) —
        // prioritaire sur la détection de section quand le lot n'a pas encore de poste.
        if (
          !current &&
          currentLot &&
          currentLot.postes.length === 0 &&
          currentLot.label.length < 60
        ) {
          currentLot.label = nettoyerLabel(`${currentLot.label} ${txt}`);
          break;
        }
        // Sinon, INTITULÉ DE SECTION sans numéro (bon de commande) → nouveau lot.
        if (sectionLike) {
          lastExclusion = null;
          currentLot = ouvrirLot(`lot-s${lots.length + 1}`, txt);
        }
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
      // Blocs « à mot-clé » (déchetterie, garantie, délai, mentions, acompte…) :
      // un tel mot dans la DESCRIPTION d'une prestation en cours (ligne juste en
      // dessous, même page) n'est PAS un bloc de fin → on le rattache. Sinon
      // (footer, hors contexte de prestation) : ignoré.
      case 'gestion_dechets':
      case 'garantie':
      case 'delai':
      case 'remise':
      case 'notes':
      case 'mentions_legales':
      case 'conditions_paiement':
      case 'echeancier':
      case 'acompte': {
        if (
          current &&
          l.page === current.dernierPage &&
          current.dernierY - l.y >= 0 &&
          current.dernierY - l.y < 22 &&
          c.designation &&
          !c.num &&
          !RE_MONTANT.test(c.total) &&
          !c.prix
        ) {
          current.complements.push(norm(c.designation));
          current.dernierY = l.y;
          current.dernierPage = l.page;
        }
        break;
      }
      case 'materiau': {
        // Puce de MATÉRIAU sous le poste courant (« - Prise 2P+T (18 u) »…). On la
        // CONSERVE brute, rattachée à la prestation en cours, pour la DÉRIVATION
        // technique (details-techniques.ts). Elle n'entre JAMAIS dans le libellé
        // contractuel. Hors contexte de poste (aucun `current`) : rien à rattacher.
        if (current && c.designation) {
          current.materiaux.push(norm(c.designation));
          current.dernierY = l.y;
          current.dernierPage = l.page;
        }
        break;
      }
      // Tous les autres blocs non contractuels : ignorés du contrat.
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

  // 6) Contrôles de cohérence (moteur principal) + CONTRÔLEUR SECONDAIRE indépendant.
  const controles = controlesCoherence({
    devis,
    reconciliation,
    lignesNumerotees,
    postes: devis ? devis.lots.flatMap((x) => x.postes) : [],
    orphelins,
    options,
    declaredTTC: declared.ttc,
  });
  // Double vérification : angle DIFFÉRENT (numéros, libellés, montants, totaux). En
  // cas de doute il rétrograde la confiance de la ligne — jamais d'invention.
  controles.push(...controleurSecondaire(devis, reconciliation));

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
    profil,
    fallbackTexte: false,
  };
}

/** Lit les totaux déclarés depuis les lignes de type total/ventilation. */
function declaredTotalsFrom(lignes: LigneClasse[]): { ht?: number; ttc?: number } {
  const blob = lignes
    .filter((l) => l.type === 'total_general' || l.type === 'ventilation_tva')
    .map((l) => l.brut)
    .join('\n');
  // On accepte « Total net HT » ET « Total HT … <montant> » (bons de commande) —
  // le lecteur texte (extractDeclaredTotals) reste strict pour ne pas changer son
  // comportement. La recherche « Total HT » balaie TOUTES les lignes (sans changer
  // la classification ni la fin de tableau) et exige un montant à la suite.
  const declared = extractDeclaredTotals(blob);
  if (declared.ht == null) {
    for (const l of lignes) {
      const m = l.brut.match(new RegExp(String.raw`Total\s+HT\s+(\d[\d\s .]*,\d{2})`, 'i'));
      if (m) {
        declared.ht = parseMontantFr(m[1]!);
        break;
      }
    }
  }
  return declared;
}

/* -------------------------------------------------------------------------- *
 * Contrôles de cohérence (déterministes)
 * -------------------------------------------------------------------------- */
/**
 * CONTRÔLEUR SECONDAIRE (double vérification) — INDÉPENDANT du moteur géométrique.
 * Il ne rejoue pas la reconstruction : il inspecte la TRANSCRIPTION déjà produite
 * (numéros, libellés, montants, totaux) sous un autre angle et signale les
 * incohérences. En cas de doute il rétrograde la confiance de la ligne à « à
 * vérifier » — jamais d'invention, jamais de masquage.
 */
function controleurSecondaire(
  devis: Devis | undefined,
  reconciliation: TotalsReconciliation,
): ControleCoherence[] {
  const out: ControleCoherence[] = [];
  if (!devis) return out;
  const postes = devis.lots.flatMap((l) => l.postes);

  // 1) Saut de NUMÉROTATION dans un lot (prestation retirée / non lue).
  const sauts: string[] = [];
  for (const lot of devis.lots) {
    const nums = lot.postes
      .filter((p) => !p.option) // les options (liste de prix) ont leur propre numérotation
      .map((p) => p.sourceText?.match(/^\s*(\d+(?:\.\d+)*)/)?.[1])
      .filter((n): n is string => n != null);
    const feuilles = nums.map((n) => Number(n.split('.').pop()));
    for (let i = 1; i < feuilles.length; i += 1) {
      const a = feuilles[i - 1]!;
      const b = feuilles[i]!;
      if (Number.isFinite(a) && Number.isFinite(b) && b > a + 1)
        sauts.push(`${nums[i - 1]}→${nums[i]}`);
    }
  }
  if (sauts.length > 0)
    out.push({
      id: 'sec-numerotation',
      libelle: 'Numérotation',
      gravite: 'attention',
      message: `Saut de numérotation (${sauts.join(', ')}) — une prestation a peut-être été retirée du devis.`,
    });

  // 2) Description probablement TRONQUÉE (finit par une conjonction/préposition ou
  //    une virgule). On rétrograde la ligne à « à vérifier » (jamais silencieux).
  const RE_TRONC =
    /(\b(et|de|des|du|à|au|aux|pour|en|sur|avec|dans|par|sous|ou|le|la|les|un|une)|[,:]|d['’]|l['’])$/i;
  const tronquees = postes.filter(
    (p) => !p.option && p.montantHT !== 0 && RE_TRONC.test(p.label.trim()),
  );
  for (const p of tronquees) if (p.verification === 'verifie') p.verification = 'a_verifier';
  if (tronquees.length > 0)
    out.push({
      id: 'sec-troncature',
      libelle: 'Descriptions',
      gravite: 'attention',
      message: `${tronquees.length} description(s) finissent de façon suspecte (possible troncature) — passées « à vérifier ».`,
    });

  // 3) Prestation ferme SANS MONTANT lu (montant sans prestation = orphelin, déjà vu).
  const sansMontant = postes.filter((p) => !p.option && p.montantHT === 0);
  if (sansMontant.length > 0)
    out.push({
      id: 'sec-sans-montant',
      libelle: 'Montant manquant',
      gravite: 'attention',
      message: `${sansMontant.length} prestation(s) sans montant lu — à saisir face au document.`,
    });

  // 4) Total NON RAPPROCHÉ — rappel du contrôleur indépendant (jamais masqué).
  if (reconciliation.totalHTDeclare != null && !reconciliation.coherent)
    out.push({
      id: 'sec-total',
      libelle: 'Réconciliation (2ᵉ moteur)',
      gravite: 'bloquant',
      message: `Écart de ${reconciliation.ecartHT} € non résorbé entre la somme des lignes et le total déclaré — vérification humaine requise.`,
    });

  return out;
}

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
