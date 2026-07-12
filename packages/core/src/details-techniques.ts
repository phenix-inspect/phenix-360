/**
 * PHÉNIX 360 — DÉRIVATION TECHNIQUE du contrat validé (couche traçable, jamais inventée)
 * =============================================================================
 * Le libellé contractuel d'une prestation reste la SOURCE DE VÉRITÉ, INTACTE. Ce
 * module en DÉRIVE une lecture technique : quantités, unités, dimensions, marques,
 * gammes, couleurs, références, pièces — extraites des SOUS-LISTES de matériaux
 * (`poste.detailsSource`) et de la description contractuelle (`poste.label`).
 *
 * RÈGLES ABSOLUES (sécurité) :
 *  • On NE MODIFIE JAMAIS le libellé contractuel : `detailsTechniques` est une
 *    couche AJOUTÉE, en lecture seule sur le contrat.
 *  • On N'INVENTE JAMAIS. Toute donnée porte son `extraitSource` (le texte d'où
 *    elle vient) et sa traçabilité (poste, lot, page).
 *  • En cas d'AMBIGUÏTÉ (quantité tronquée, marque devinée, gamme incertaine) : on
 *    garde l'extrait et on marque `niveauConfiance: 'À vérifier'` — jamais de
 *    valeur affirmée à tort.
 *
 * Module PUR (aucune I/O, aucun réseau, aucun LLM). Déterministe.
 */
import { validatedDevis, type ContractHolder } from './contract.js';
import type { Devis, DevisPoste } from './devis.js';

/** Nature d'un détail technique dérivé. */
export type DetailType =
  'équipement' | 'matériau' | 'dimension' | 'gamme' | 'marque' | 'couleur' | 'référence';

/** Niveau de confiance de la dérivation (jamais « certain » quand c'est deviné). */
export type NiveauConfiance = 'Fiable' | 'À vérifier';

/**
 * Un DÉTAIL TECHNIQUE dérivé d'une prestation. Chaque champ absent = « non lu »
 * (jamais deviné). `extraitSource` permet de comparer au document original.
 */
export interface DetailTechnique {
  type: DetailType;
  /** Intitulé technique (désignation nettoyée du matériau / de l'équipement). */
  libellé: string;
  quantité?: number;
  unité?: string;
  marque?: string;
  référence?: string;
  dimensions?: string;
  couleur?: string;
  pièce?: string;
  niveauConfiance: NiveauConfiance;
  /** Extrait BRUT d'où la dérivation est tirée (traçabilité mot pour mot). */
  extraitSource: string;
  /* ---- Traçabilité jusqu'au contrat (jamais de détail hors contrat) ---- */
  posteId: string;
  lotLabel: string;
  sourcePage?: number;
}

/* -------------------------------------------------------------------------- *
 * Vocabulaire métier (déterministe, versionné avec le module)
 * -------------------------------------------------------------------------- */
/** Familles d'ÉQUIPEMENTS (le reste est « matériau »). Racines minuscules. */
const EQUIPEMENTS = [
  'radiateur',
  'panneau rayonnant',
  'seche serviette',
  'seche-serviette',
  'convecteur',
  'prise',
  'interrupteur',
  'disjoncteur',
  'tableau electrique',
  'coffret',
  'receveur',
  'vasque',
  'lavabo',
  'melangeur',
  'mitigeur',
  'robinet',
  'douche',
  'bonde',
  'siphon',
  'chauffe-eau',
  'chauffe eau',
  'ballon',
  'vmc',
  'extracteur',
  'bouche',
  'sonnette',
  'applique',
  'spot',
  'luminaire',
  'kitchenette',
  'evier',
  'plaque induction',
  'plaque de cuisson',
  'refrigerateur',
  'hotte',
  'four',
  'bloc-porte',
  'bloc porte',
  'porte',
  'fenetre',
  'volet',
  'sonde',
  'thermostat',
  'wc',
];

/** Pièces / localisations reconnues (depuis le lot ou le libellé). */
const PIECES: { mots: string[]; label: string }[] = [
  {
    mots: ['salle de bain', 'salle de bains', 'salle d eau', "salle d'eau", 'sdb'],
    label: 'Salle de bain',
  },
  { mots: ['cuisine', 'kitchenette'], label: 'Cuisine' },
  { mots: ['wc', 'toilette'], label: 'WC' },
  { mots: ['chambre'], label: 'Chambre' },
  { mots: ['sejour', 'salon', 'piece de vie'], label: 'Séjour' },
  { mots: ['entree'], label: 'Entrée' },
  { mots: ['dressing'], label: 'Dressing' },
  { mots: ['buanderie'], label: 'Buanderie' },
  { mots: ['garage'], label: 'Garage' },
  { mots: ['terrasse'], label: 'Terrasse' },
  { mots: ['plafond'], label: 'Plafond' },
  { mots: ['exterieur'], label: 'Extérieur' },
];

/** Couleurs reconnues (mot entier). */
const COULEURS = [
  'blanc',
  'blanche',
  'noir',
  'noire',
  'gris',
  'grise',
  'beige',
  'taupe',
  'anthracite',
  'bleu',
  'bleue',
  'vert',
  'verte',
  'rouge',
  'jaune',
  'sable',
  'ivoire',
  'creme',
  'chene',
  'noyer',
];

/** Normalisation : minuscule, sans accent, espaces compactés. */
const strip = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Nettoie une désignation de matériau (retire la puce et la queue de quantité). */
const nettoyer = (s: string): string =>
  s
    .replace(/^[\s\-•·]+/, '')
    .replace(/\s*\([^)]*\)\s*$/, '') // « (18 u) » final
    .replace(/\s*\(\s*[\d.,]+\s*$/, '') // « (6 » tronqué
    .replace(/[\s,:;]+$/, '')
    .trim();

/* -------------------------------------------------------------------------- *
 * Extracteurs élémentaires (chacun renvoie undefined si rien de sûr)
 * -------------------------------------------------------------------------- */
/** Quantité + unité en fin de ligne. Tronquée (« (6 ») ⇒ non fiable. */
function extraireQuantite(
  brut: string,
): { quantité: number; unité?: string; fiable: boolean } | undefined {
  const clos = brut.match(/\(\s*([\d]+(?:[.,][\d]+)?)\s*(u|pce|pcs|ml|ens|m²|m2|kg|h|l|cm|mm)\b/i);
  if (clos) {
    const q = Number(clos[1]!.replace(',', '.'));
    if (Number.isFinite(q)) return { quantité: q, unité: normUnite(clos[2]!), fiable: true };
  }
  // Parenthèse ouvrante + nombre en fin de ligne (« … (6 ») : quantité TRONQUÉE.
  const tronq = brut.match(/\(\s*([\d]+(?:[.,][\d]+)?)\s*$/);
  if (tronq) {
    const q = Number(tronq[1]!.replace(',', '.'));
    if (Number.isFinite(q)) return { quantité: q, fiable: false };
  }
  return undefined;
}

const normUnite = (u: string): string => {
  const s = u.toLowerCase().replace('m2', 'm²');
  return s === 'pcs' ? 'pce' : s;
};

/** Dimensions (« 800 x 800 mm », « 30 × 60 cm », « Ø 20 mm »). */
function extraireDimensions(brut: string): string | undefined {
  const diam = brut.match(/Ø\s*([\d]+(?:[.,][\d]+)?)\s*(mm|cm)?/i);
  const dims = brut.match(
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?\s*(mm|cm|m)\b/i,
  );
  if (dims) {
    const unit = dims[4]!;
    const parts = [dims[1], dims[2], dims[3]].filter(Boolean).join(' × ');
    return `${parts} ${unit}`.replace(/\s+/g, ' ').trim();
  }
  if (diam) return `Ø ${diam[1]}${diam[2] ? ` ${diam[2]}` : ' mm'}`;
  return undefined;
}

/** Référence produit (« PR00064660 », « réf. X »). */
function extraireReference(brut: string): string | undefined {
  const pr = brut.match(/\b(PR\d{5,})\b/);
  if (pr) return pr[1];
  const ref = brut.match(/\br[eé]f(?:[eé]rence)?\.?\s*:?\s*([A-Z0-9][\w.\/-]{2,})/i);
  if (ref) return ref[1];
  return undefined;
}

/**
 * Marque / gamme (« de chez Legrand », « type dooxie de chez Legrand »,
 * « gamme confort »). Deviné ⇒ toujours « À vérifier ».
 */
function extraireMarqueGamme(brut: string): { marque?: string; gamme?: string } {
  const out: { marque?: string; gamme?: string } = {};
  const chez = brut.match(/\bchez\s+([A-ZÉÈ][\wÀ-ÿ'’-]+)/);
  if (chez && plausibleNom(chez[1]!)) out.marque = chez[1];
  const type = brut.match(/\btype\s+([A-Za-zÀ-ÿ][\wÀ-ÿ'’-]+)/);
  if (type && plausibleNom(type[1]!)) out.gamme = type[1];
  const gamme = brut.match(/\bgamme\s+([A-Za-zÀ-ÿ][\wÀ-ÿ'’-]+)/);
  if (gamme && plausibleNom(gamme[1]!)) out.gamme = gamme[1];
  return out;
}

/** Codes techniques à NE PAS prendre pour une marque / gamme (« type AC », « type A »). */
const NON_MARQUES = new Set([
  'ac',
  'dc',
  'led',
  'pvc',
  'ip',
  'rj',
  'usb',
  'tv',
  'a',
  'b',
  'c',
  'f',
  'standard',
  'equivalent',
  'nid',
]);
/** Un nom de marque/gamme plausible : ≥ 3 lettres, pas un code technique connu. */
const plausibleNom = (s: string): boolean => s.length >= 3 && !NON_MARQUES.has(s.toLowerCase());

/** Couleur / teinte (mot entier connu, « teinte à définir », « RAL 9010 »). */
function extraireCouleur(brut: string): { couleur: string; fiable: boolean } | undefined {
  const s = strip(brut);
  const ral = brut.match(/\bRAL\s*([\d]{3,4})\b/i);
  if (ral) return { couleur: `RAL ${ral[1]}`, fiable: true };
  if (/teinte\s+a\s+definir/.test(s)) return { couleur: 'à définir', fiable: false };
  const mots = new Set(s.split(/[^a-z0-9]+/).filter(Boolean));
  for (const c of COULEURS) if (mots.has(c)) return { couleur: c, fiable: true };
  const teinte = brut.match(/\bteinte\s+([A-Za-zÀ-ÿ][\wÀ-ÿ'’-]+)/i);
  if (teinte) return { couleur: teinte[1]!, fiable: false };
  return undefined;
}

/** Pièce concernée, depuis le lot puis le libellé. */
function extrairePiece(...textes: string[]): string | undefined {
  const s = strip(textes.join(' '));
  const mots = ` ${s} `;
  for (const p of PIECES)
    if (p.mots.some((m) => mots.includes(` ${m} `) || s.includes(m))) return p.label;
  return undefined;
}

/** Type d'un matériau : « équipement » si famille reconnue, sinon « matériau ». */
function typeDe(designation: string): DetailType {
  const s = strip(designation);
  const mots = ` ${s} `;
  for (const e of EQUIPEMENTS) {
    if (e.includes(' ') ? s.includes(e) : mots.includes(` ${e} `) || mots.includes(` ${e}s `))
      return 'équipement';
  }
  return 'matériau';
}

/* -------------------------------------------------------------------------- *
 * Dérivation d'une prestation → détails techniques
 * -------------------------------------------------------------------------- */
/**
 * Dérive les détails techniques d'UNE prestation, SANS toucher à son libellé.
 * Source : les sous-listes de matériaux (`detailsSource`) + la description
 * contractuelle (`label`). Chaque détail est tracé et prudent.
 */
export function deriverDetailsPoste(poste: DevisPoste, lotLabel: string): DetailTechnique[] {
  const out: DetailTechnique[] = [];
  const pièce = extrairePiece(lotLabel, poste.label);
  const base = {
    posteId: poste.id,
    lotLabel,
    ...(poste.sourcePage != null ? { sourcePage: poste.sourcePage } : {}),
    ...(pièce ? { pièce } : {}),
  };

  // 1) Sous-listes de matériaux (la matière la plus riche : quantités, dimensions…).
  for (const brut of poste.detailsSource ?? []) {
    const libellé = nettoyer(brut);
    if (!libellé) continue;
    const q = extraireQuantite(brut);
    const dimensions = extraireDimensions(brut);
    const référence = extraireReference(brut);
    const { marque } = extraireMarqueGamme(brut);
    const type = typeDe(libellé);
    // Fiable si la quantité est LUE en entier ; sinon (tronquée / absente) à vérifier.
    const fiable = q?.fiable === true;
    out.push({
      type,
      libellé,
      ...(q ? { quantité: q.quantité } : {}),
      ...(q?.unité ? { unité: q.unité } : {}),
      ...(marque ? { marque } : {}),
      ...(référence ? { référence } : {}),
      ...(dimensions ? { dimensions } : {}),
      niveauConfiance: fiable ? 'Fiable' : 'À vérifier',
      extraitSource: brut.trim(),
      ...base,
    });
  }

  // 2) Faits techniques portés par la DESCRIPTION contractuelle elle-même
  //    (dimensions d'un receveur/faïence, gamme, marque, couleur) — utiles quand
  //    ils ne figurent dans aucune puce. On ne DUPLIQUE pas : on ajoute ce que les
  //    sous-listes ne portent pas déjà.
  const label = poste.label;
  const { marque, gamme } = extraireMarqueGamme(label);
  if (gamme)
    out.push({
      type: 'gamme',
      libellé: gamme,
      ...(marque ? { marque } : {}),
      niveauConfiance: 'À vérifier',
      extraitSource: label,
      ...base,
    });
  else if (marque)
    out.push({
      type: 'marque',
      libellé: marque,
      niveauConfiance: 'À vérifier',
      extraitSource: label,
      ...base,
    });

  const couleur = extraireCouleur(label);
  if (couleur)
    out.push({
      type: 'couleur',
      libellé: couleur.couleur,
      couleur: couleur.couleur,
      niveauConfiance: couleur.fiable ? 'Fiable' : 'À vérifier',
      extraitSource: label,
      ...base,
    });

  const dimsLabel = extraireDimensions(label);
  if (dimsLabel && !out.some((d) => d.dimensions === dimsLabel))
    out.push({
      type: 'dimension',
      libellé: dimsLabel,
      dimensions: dimsLabel,
      niveauConfiance: 'Fiable',
      extraitSource: label,
      ...base,
    });

  return out;
}

/**
 * Dérive les détails techniques de TOUT le contrat validé (postes fermes, hors
 * options). Le devis passé DOIT être le contrat validé (`validatedDevis`) : on ne
 * dérive jamais un lot non validé.
 */
export function deriverDetailsContrat(devis: Devis | undefined | null): DetailTechnique[] {
  if (!devis) return [];
  const out: DetailTechnique[] = [];
  for (const lot of devis.lots)
    for (const p of lot.postes) {
      if (p.option) continue;
      out.push(...deriverDetailsPoste(p, lot.label));
    }
  return out;
}

/** Détails techniques du contrat validé porté par un dossier (chokepoint contractuel). */
export function detailsTechniquesDuContrat(
  holder: ContractHolder | null | undefined,
): DetailTechnique[] {
  return deriverDetailsContrat(validatedDevis(holder ?? undefined));
}

/** Détails techniques regroupés par PIÈCE (aide au contrôle / à la commande). */
export function detailsParPiece(details: DetailTechnique[]): Map<string, DetailTechnique[]> {
  const map = new Map<string, DetailTechnique[]>();
  for (const d of details) {
    const clé = d.pièce ?? 'Non localisé';
    const arr = map.get(clé);
    if (arr) arr.push(d);
    else map.set(clé, [d]);
  }
  return map;
}

/* -------------------------------------------------------------------------- *
 * Agrégation : « besoins matériels » (PRÉPARÉS, jamais transformés en commande)
 * -------------------------------------------------------------------------- */
/** Un besoin agrégé (préparation de commande / de choix client — non créé). */
export interface BesoinMateriel {
  libellé: string;
  type: DetailType;
  /** Somme des quantités FIABLES (unité countable). */
  quantitéTotale?: number;
  unité?: string;
  /** Nombre de lignes contributrices (traçabilité). */
  lignes: number;
  /** Une ou plusieurs quantités étaient tronquées / absentes → à confirmer. */
  aVérifier: boolean;
  /** Postes d'origine (id + page) — on remonte toujours au contrat. */
  sources: { posteId: string; lotLabel: string; sourcePage?: number; extraitSource: string }[];
}

/** Unités dénombrables (pour additionner un « combien »). */
const COMPTABLES = new Set(['u', 'pce', 'ens']);

/**
 * Agrège les détails par intitulé technique — PRÉPARE (sans les créer) les
 * commandes / choix client : quantités additionnées quand elles sont fiables,
 * sinon marquées « à vérifier ». Le conducteur reste décideur.
 */
export function agregerBesoins(details: DetailTechnique[]): BesoinMateriel[] {
  const map = new Map<string, BesoinMateriel>();
  for (const d of details) {
    if (d.type !== 'équipement' && d.type !== 'matériau') continue;
    const clé = strip(d.libellé);
    let b = map.get(clé);
    if (!b) {
      b = { libellé: d.libellé, type: d.type, lignes: 0, aVérifier: false, sources: [] };
      map.set(clé, b);
    }
    b.lignes += 1;
    b.sources.push({
      posteId: d.posteId,
      lotLabel: d.lotLabel,
      ...(d.sourcePage != null ? { sourcePage: d.sourcePage } : {}),
      extraitSource: d.extraitSource,
    });
    const comptable = d.unité != null && COMPTABLES.has(d.unité);
    if (d.quantité != null && d.niveauConfiance === 'Fiable' && comptable) {
      b.quantitéTotale = (b.quantitéTotale ?? 0) + d.quantité;
      b.unité = d.unité;
    } else {
      b.aVérifier = true;
    }
  }
  return [...map.values()];
}

/**
 * PRÉPARE (sans les créer) les besoins matériels du contrat validé — matière
 * première d'une future commande / d'un choix client. On NE crée AUCUNE commande
 * ni demande client ici : le conducteur reste décideur. Simple lecture agrégée,
 * traçable, prudente (quantités additionnées seulement quand elles sont fiables).
 */
export function preparerBesoinsContrat(
  holder: ContractHolder | null | undefined,
): BesoinMateriel[] {
  return agregerBesoins(detailsTechniquesDuContrat(holder));
}
