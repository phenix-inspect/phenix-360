/**
 * PHÉNIX 360 — Lecture RÉELLE du devis (extraction déterministe, sans réseau)
 * ===========================================================================
 * Ce module ne SIMULE plus : il LIT le texte réellement extrait d'un devis PDF
 * (l'extraction binaire PDF→texte vit côté app, hors du modèle pur) et en tire
 * les informations exploitables par des motifs déterministes. Règle d'or : ne
 * JAMAIS inventer. Un champ non trouvé reste vide (« non détecté »). Si aucun
 * texte n'a pu être lu (devis scanné/image), on le dit clairement.
 *
 * Model-ready : un LLM/OCR pourra remplacer `extractDevisFields` derrière la même
 * sortie, sans changer les écrans (port `DossierAnalyzer`).
 */

/** Champs bruts détectés dans le texte du devis (tous facultatifs — jamais inventés). */
export interface DevisFields {
  clientName?: string;
  address?: string;
  email?: string;
  phone?: string;
  /** Montant TTC en euros, si trouvé. */
  montantTTC?: number;
  /** Montant HT en euros, si trouvé. */
  montantHT?: number;
  /** Date du devis au format ISO (YYYY-MM-DD) si convertible, sinon brute. */
  date?: string;
  /** Prestations / lots principaux détectés (libellés canoniques). */
  prestations: string[];
  /** Pièces concernées détectées. */
  pieces: string[];
  /** Matériaux importants détectés. */
  materiaux: string[];
  /** Délais / durée mentionnés (extrait brut). */
  delais?: string;
  /** Acompte / conditions de paiement (extrait brut). */
  paiement?: string;
  /** Entreprise émettrice (raison sociale) si identifiable. */
  emetteur?: string;
}

/** Un champ affiché comme « détecté » dans la synthèse. */
export interface DetectedField {
  key: string;
  label: string;
  value: string;
}

/**
 * Compte rendu de lecture du devis, présenté dans l'écran « PHÉNIX prépare ».
 * `readable=false` + `imageOnly=true` ⇒ PDF non lisible (scan/image).
 */
export interface DevisExtraction {
  /** Au moins un document a fourni du texte exploitable. */
  readable: boolean;
  /** Des PDF ont été déposés mais aucun texte exploitable (probable scan/image). */
  imageOnly: boolean;
  /** Ce que PHÉNIX a réellement lu. */
  detected: DetectedField[];
  /** Ce qui était recherché mais non trouvé (jamais inventé). */
  missing: string[];
  /** Indice de confiance 0–100 (part des informations clés retrouvées). */
  confidence: number;
  /** Nombre de caractères de texte réellement extraits (traçabilité). */
  chars: number;
}

/** Les informations recherchées, dans l'ordre d'affichage. */
const FIELD_LABELS = {
  clientName: 'Nom du client',
  address: 'Adresse du chantier',
  montant: 'Montant du devis',
  date: 'Date du devis',
  emetteur: 'Entreprise émettrice',
  prestations: 'Prestations / lots',
  pieces: 'Pièces concernées',
  materiaux: 'Matériaux',
  delais: 'Délais',
  paiement: 'Acompte / paiement',
} as const;

/** Champs « clés » qui pèsent dans l'indice de confiance. */
const KEY_FIELDS: (keyof typeof FIELD_LABELS)[] = [
  'clientName',
  'address',
  'montant',
  'date',
  'emetteur',
];

/** En dessous, on considère qu'aucun texte exploitable n'a été lu (scan probable). */
export const MIN_READABLE_CHARS = 40;

const PRESTATION_RULES: { re: RegExp; label: string }[] = [
  { re: /d[ée]moli|d[ée]pose/i, label: 'Dépose & démolition' },
  { re: /gros[\s-]?œuvre|ma[çc]onn/i, label: 'Maçonnerie' },
  { re: /[ée]lectric/i, label: 'Électricité' },
  { re: /plomberie|sanitaire/i, label: 'Plomberie' },
  { re: /isolation/i, label: 'Isolation' },
  { re: /pl[âa]tr|placo|cloison|doublage/i, label: 'Plâtrerie' },
  { re: /menuiser/i, label: 'Menuiseries' },
  { re: /carrelage|fa[iï]ence/i, label: 'Carrelage & faïence' },
  { re: /peinture/i, label: 'Peinture' },
  { re: /parquet|rev[êe]tement\s+de\s+sol|\bsols?\b/i, label: 'Sols' },
  { re: /cuisine/i, label: 'Cuisine' },
  { re: /chauffage|chaudi[èe]re|radiateur|pompe\s+[àa]\s+chaleur|\bpac\b/i, label: 'Chauffage' },
  { re: /toiture|couverture|charpente/i, label: 'Toiture & charpente' },
];

const PIECE_RULES: { re: RegExp; label: string }[] = [
  { re: /salle\s+de\s+bains?|salle\s+d['’ ]eau/i, label: 'Salle de bain' },
  { re: /cuisine/i, label: 'Cuisine' },
  { re: /s[ée]jour|salon/i, label: 'Séjour' },
  { re: /chambre/i, label: 'Chambre' },
  { re: /\bwc\b|toilettes/i, label: 'WC' },
  { re: /entr[ée]e|hall/i, label: 'Entrée' },
  { re: /d[ée]gagement|couloir|palier/i, label: 'Dégagement' },
  { re: /garage/i, label: 'Garage' },
  { re: /buanderie|cellier/i, label: 'Buanderie' },
  { re: /bureau/i, label: 'Bureau' },
  { re: /dressing/i, label: 'Dressing' },
  { re: /balcon|terrasse/i, label: 'Terrasse' },
];

const MATERIAU_RULES: { re: RegExp; label: string }[] = [
  { re: /gr[èe]s\s+c[ée]rame/i, label: 'Grès cérame' },
  { re: /fa[iï]ence/i, label: 'Faïence' },
  { re: /carrelage/i, label: 'Carrelage' },
  { re: /ch[êe]ne/i, label: 'Chêne' },
  { re: /parquet/i, label: 'Parquet' },
  { re: /placo|ba\s?13|pl[âa]tre/i, label: 'Placo / plâtre' },
  { re: /laine\s+de\s+(verre|roche)/i, label: 'Laine minérale' },
  { re: /\binox\b/i, label: 'Inox' },
  { re: /\bpvc\b/i, label: 'PVC' },
  { re: /aluminium|\balu\b/i, label: 'Aluminium' },
  { re: /granit|quartz/i, label: 'Pierre / quartz' },
  { re: /stratifi[ée]/i, label: 'Stratifié' },
  { re: /b[ée]ton\s+cir[ée]/i, label: 'Béton ciré' },
];

/** Convertit un montant français (« 12 500,00 » / « 12.500,00 ») en nombre. */
function parseAmount(raw: string): number | undefined {
  let s = raw.replace(/[\s\u00a0€]/g, '');
  // Sépare le décimal (dernier , ou .) des séparateurs de milliers.
  const dec = s.match(/[.,](\d{2})$/);
  if (dec) s = s.slice(0, dec.index) + '.' + dec[1];
  s = s.replace(/(?<=\d)[.,](?=\d{3}\b)/g, '');
  const n = Number(s.replace(/,/g, '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

const MONTHS: Record<string, string> = {
  janvier: '01',
  fevrier: '02',
  mars: '03',
  avril: '04',
  mai: '05',
  juin: '06',
  juillet: '07',
  aout: '08',
  septembre: '09',
  octobre: '10',
  novembre: '11',
  decembre: '12',
};
const stripAccents = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Convertit une date FR (12/03/2024, 12 mars 2024) en ISO si possible. */
function parseFrDate(raw: string): string | undefined {
  const num = raw.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (num) {
    const d = num[1]!.padStart(2, '0');
    const m = num[2]!.padStart(2, '0');
    let y = num[3]!;
    if (y.length === 2) y = `20${y}`;
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31)
      return `${y}-${m}-${d}`;
  }
  const txt = stripAccents(raw.toLowerCase()).match(/(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/);
  if (txt && MONTHS[txt[2]!]) return `${txt[3]}-${MONTHS[txt[2]!]}-${txt[1]!.padStart(2, '0')}`;
  return undefined;
}

const collect = (text: string, rules: { re: RegExp; label: string }[]): string[] => {
  const out: string[] = [];
  for (const r of rules) if (r.re.test(text) && !out.includes(r.label)) out.push(r.label);
  return out;
};

const cleanLine = (s: string): string =>
  s
    .replace(/[\t\r]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:–-]+|[\s:–-]+$/g, '')
    .trim();

/**
 * Extrait les champs d'un devis à partir de son TEXTE réel (déterministe, pur).
 * Aucun champ n'est inventé : ce qui n'est pas trouvé reste absent.
 */
export function extractDevisFields(rawText: string): DevisFields {
  // On garde les retours à la ligne pour les motifs « en tête de ligne », et une
  // version aplatie pour les recherches globales.
  const text = rawText.replace(/\u00a0/g, ' ');
  const flat = text.replace(/\s+/g, ' ');

  const fields: DevisFields = {
    prestations: collect(flat, PRESTATION_RULES),
    pieces: collect(flat, PIECE_RULES),
    materiaux: collect(flat, MATERIAU_RULES),
  };

  const email = flat.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) fields.email = email[0];
  const phone = flat.match(/\b0[1-9](?:[\s.-]?\d{2}){4}\b/);
  if (phone) fields.phone = phone[0].replace(/[\s.-]+/g, ' ').trim();

  // Client : après une étiquette explicite (client, maître d'ouvrage, adressé à…).
  const client = text.match(
    /(?:client|ma[iî]tre\s+d['’ ]ouvrage|adress[ée]\s+[àa]|[àa]\s+l['’ ]attention\s+de|doit)\s*:?\s*([^\n]{2,60})/i,
  );
  if (client) {
    const v = cleanLine(client[1]!);
    if (v && !/^devis|^facture/i.test(v)) fields.clientName = v;
  }

  // Adresse : une voie explicite, sinon une ligne portant un code postal.
  const voie = text.match(
    /\b(\d{1,4}(?:\s?(?:bis|ter))?\s+(?:rue|avenue|av\.|bd|boulevard|chemin|impasse|all[ée]e|route|place|quai|cours|lotissement)\b[^\n]{0,70})/i,
  );
  // Code postal + ville, sur UNE ligne (le séparateur ne franchit pas le retour).
  const cp = text.match(/([^\n]{0,60}?\b\d{5}[ \t]+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ \-]{1,40})/);
  if (voie) fields.address = cleanLine(voie[1]!);
  else if (cp) fields.address = cleanLine(cp[1]!);

  // Montants : TTC prioritaire (« total TTC », « net à payer »), puis HT.
  const ttc = flat.match(
    /(?:total\s*t\.?t\.?c\.?|montant\s*t\.?t\.?c\.?|net\s*[àa]\s*payer)\D{0,15}((?:\d[\d\s.]*)?\d(?:[.,]\d{2})?)\s*€?/i,
  );
  if (ttc) fields.montantTTC = parseAmount(ttc[1]!);
  const ht = flat.match(
    /(?:total\s*h\.?t\.?|montant\s*h\.?t\.?)\D{0,15}((?:\d[\d\s.]*)?\d(?:[.,]\d{2})?)\s*€?/i,
  );
  if (ht) fields.montantHT = parseAmount(ht[1]!);

  // Date du devis.
  const dateLabelled = text.match(
    /(?:devis|facture|[ée]tabli|date)[^\n\d]{0,20}(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i,
  );
  const dateAny = text.match(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\b/);
  const dateTxt = text.match(/\b(\d{1,2}\s+[a-zA-ZÀ-ÿ]+\.?\s+\d{4})\b/);
  const dateRaw = dateLabelled?.[1] ?? dateAny?.[1] ?? dateTxt?.[1];
  if (dateRaw) fields.date = parseFrDate(dateRaw) ?? dateRaw;

  // Délais / durée.
  const delais = flat.match(
    /(?:d[ée]lai|dur[ée]e|ex[ée]cution|livraison)[^.\n]{0,50}?(\d+\s*(?:semaines?|mois|jours?\s*(?:ouvr[ée]s?)?|ans?))/i,
  );
  if (delais) fields.delais = cleanLine(delais[0]);

  // Acompte / conditions de paiement (borné à la ligne : on lit `text`, pas `flat`).
  const paiement = text.match(
    /(?:acompte|arrhes|[àa]\s+la\s+commande|solde|[ée]ch[ée]ancier|\bpaiement\b)[^.\n]{0,60}/i,
  );
  if (paiement) fields.paiement = cleanLine(paiement[0]);

  // Entreprise émettrice : raison sociale (forme juridique) ou contexte SIRET.
  const forme = text.match(
    /([A-ZÉÈÀ0-9][\wÀ-ÿ&'’.\- ]{1,45}?\s(?:SARL|S\.A\.R\.L|SAS|SASU|EURL|SA|EI|E\.I))\b/,
  );
  const siret = text.match(/([^\n]{2,50})\n[^\n]{0,40}siret/i);
  if (forme) fields.emetteur = cleanLine(forme[1]!);
  else if (siret) fields.emetteur = cleanLine(siret[1]!);

  return fields;
}

const euro = (n: number): string =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);

/** Construit le compte rendu de lecture (détecté / non détecté / confiance). */
export function buildDevisExtraction(
  fields: DevisFields,
  chars: number,
  imageOnly: boolean,
): DevisExtraction {
  if (imageOnly) {
    return {
      readable: false,
      imageOnly: true,
      detected: [],
      missing: Object.values(FIELD_LABELS),
      confidence: 0,
      chars,
    };
  }

  const detected: DetectedField[] = [];
  const missing: string[] = [];
  const push = (key: keyof typeof FIELD_LABELS, value: string | undefined): void => {
    if (value && value.trim())
      detected.push({ key, label: FIELD_LABELS[key], value: value.trim() });
    else missing.push(FIELD_LABELS[key]);
  };

  push('clientName', fields.clientName);
  push('address', fields.address);
  const montant =
    fields.montantTTC != null
      ? `${euro(fields.montantTTC)} TTC`
      : fields.montantHT != null
        ? `${euro(fields.montantHT)} HT`
        : undefined;
  push('montant', montant);
  push('date', fields.date);
  push('emetteur', fields.emetteur);
  push('prestations', fields.prestations.join(', ') || undefined);
  push('pieces', fields.pieces.join(', ') || undefined);
  push('materiaux', fields.materiaux.join(', ') || undefined);
  push('delais', fields.delais);
  push('paiement', fields.paiement);

  const found = KEY_FIELDS.filter((k) =>
    k === 'montant'
      ? fields.montantTTC != null || fields.montantHT != null
      : Boolean(fields[k as keyof DevisFields]),
  ).length;
  const confidence = Math.round((found / KEY_FIELDS.length) * 100);

  return { readable: true, imageOnly: false, detected, missing, confidence, chars };
}
