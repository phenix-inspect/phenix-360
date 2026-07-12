/**
 * PHÉNIX 360 — ANALYSE & VÉRIFICATION DU DEVIS (devis → contrat structuré)
 * ===========================================================================
 * Le document original (PDF/image) reste la SOURCE officielle, archivée et
 * ouvrable. À côté, PHÉNIX en produit une ANALYSE structurée : lots → postes
 * (libellé, quantité, unité, PU, montant HT, TVA), chaque ligne portant un état
 * de LECTURE lisible par un conducteur (🟢 vérifié · 🟠 à vérifier · 🔴 non
 * compris). Aucune ligne n'est contractuelle tant que son LOT n'a pas été
 * VÉRIFIÉ et validé par le conducteur. Chaque lot se valide indépendamment.
 *
 * Règle d'or : ne JAMAIS inventer. Une ligne dont le montant n'a pu être lu
 * reste à 0 et « non comprise ». Les totaux sont vérifiés (somme des lignes vs
 * total HT déclaré) : un écart hors tolérance exige un contrôle humain.
 *
 * Module PUR (déterministe, sans I/O). L'extraction binaire PDF→texte (et, plus
 * tard, l'OCR/l'analyse visuelle) vit côté application, derrière le port
 * `DossierAnalyzer` — on parse ici le TEXTE déjà extrait.
 */
import type { Devis, DevisLot, DevisPoste, VerificationNiveau } from './devis.js';
import { consolidateDevis, consolidatedTotals } from './devis.js';

/**
 * Version du MOTEUR d'analyse (tracée dans le journal de validation). À
 * incrémenter à chaque évolution des règles de lecture, pour qu'une
 * transcription validée sache par quelle version elle a été produite.
 */
export const MOTEUR_VERSION = 'devis-3.0-geometrie';

/** Statut de validation d'un LOT (repris de `DevisLot.statut`). */
export type LotStatut = 'brouillon' | 'valide';

/** Statut GLOBAL dérivé d'un devis, sans ambiguïté (jamais « à moitié validé »). */
export type DevisStatut = 'a_verifier' | 'partiellement_valide' | 'valide';

export const DEVIS_STATUT_LABEL: Record<DevisStatut, string> = {
  a_verifier: 'À vérifier',
  partiellement_valide: 'Partiellement validé',
  valide: 'Validé',
};

/* -------------------------------------------------------------------------- *
 * Vérification d'une ligne (déterministe) + explication « pourquoi »
 * -------------------------------------------------------------------------- */
/**
 * Évalue l'état de lecture d'un poste À PARTIR DE SES CHAMPS (déterministe) :
 *  • pas de montant lu → 🔴 non compris (jamais inventé) ;
 *  • forfait repris du total du lot (sans quantité) ou TVA absente → 🟠 à vérifier ;
 *  • ligne pleinement chiffrée → 🟢 vérifié.
 * Recalculé après chaque correction : corriger une ligne la fait passer au vert.
 */
export function evaluerVerification(p: DevisPoste): VerificationNiveau {
  // Montant NON LU (0) → non compris. Un montant NÉGATIF est une remise / moins-value
  // DÉLIBÉRÉE (ligne pleinement chiffrée) : il ne doit pas être pris pour « non lu ».
  if (p.montantHT === 0) return 'non_compris';
  if (p.unite === 'forfait' && p.quantite == null) return 'a_verifier';
  if (!(p.tva > 0)) return 'a_verifier';
  return 'verifie';
}

/** Explication déterministe de l'état d'une ligne (pour « Voir pourquoi »). */
export function raisonVerification(p: DevisPoste): string | undefined {
  const niveau = p.verification ?? evaluerVerification(p);
  if (niveau === 'verifie') return undefined;
  if (p.montantHT === 0) return 'Montant non lu sur cette ligne — à saisir face au devis.';
  if (p.unite === 'forfait' && p.quantite == null)
    return 'Montant forfaitaire repris du total du lot — le détail par poste n’a pas été lu.';
  if (!(p.tva > 0)) return 'Taux de TVA non lu — à confirmer face au devis.';
  return 'À contrôler face au document original.';
}

/* -------------------------------------------------------------------------- *
 * Réconciliation des totaux
 * -------------------------------------------------------------------------- */
export interface TotalsReconciliation {
  /** Somme des montants HT des postes actifs analysés. */
  sommeLignesHT: number;
  /** Total HT déclaré sur le document (si lu). */
  totalHTDeclare?: number;
  /** Total TTC déclaré sur le document (si lu). */
  totalTTCDeclare?: number;
  /** Écart absolu (€) entre la somme des lignes et le total HT déclaré. */
  ecartHT?: number;
  /** true si les totaux concordent (dans la tolérance) OU si rien n'est déclaré. */
  coherent: boolean;
}

/** Résultat de l'analyse structurée d'un devis. */
export interface ContractExtraction {
  /** Contrat structuré (lots → postes) — absent si aucun poste n'a pu être lu. */
  devis?: Devis;
  /** Vérification des totaux. */
  reconciliation: TotalsReconciliation;
}

/** Tolérance de réconciliation : 1 € OU 0,5 % du total déclaré (le plus grand). */
const reconcileTolerance = (declaredHT: number): number => Math.max(1, declaredHT * 0.005);

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Convertit un montant français (« 12 500,00 » / « 1 900,00 € ») en nombre. */
function parseAmount(raw: string): number | undefined {
  const s = raw.replace(/[\s €]/g, '').replace(/\.(?=\d{3}\b)/g, '');
  const n = Number(s.replace(',', '.'));
  // Les montants NÉGATIFS sont acceptés (remise / moins-value « -1 200,00 € »).
  return Number.isFinite(n) ? round2(n) : undefined;
}

/** Convertit un taux (« 10,00 % » / « 5,5 ») en nombre. */
function parseRate(raw: string): number | undefined {
  const n = Number(raw.replace(/[\s%]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
}

const AMT = String.raw`\d[\d\s .]*,\d{2}`;

/** En-tête de LOT : « N TITRE … montant € » (le titre peut débuter par « N. »). */
const LOT_RE = new RegExp(String.raw`^(\d{1,2})\s+(.+?)\s+(${AMT})\s*€?\s*$`);
/** Description d'un POSTE : « N.N libellé » (pas de montant en fin de ligne). */
const POSTE_DESC_RE = /^(\d{1,2}\.\d{1,2})\s+(.+?)\s*$/;
/** Ligne de VALEURS d'un poste : « qté unité PU € TVA % montant € ». */
const POSTE_VALS_RE = new RegExp(
  String.raw`^(${AMT}|\d+)\s+([A-Za-z0-9µ²³.]{1,12})\s+(${AMT})\s*€\s+([\d,]+)\s*%\s+(${AMT})\s*€\s*$`,
);

/** Nettoie un libellé (espaces, ponctuation de bord, numérotation « N. »). */
const cleanLabel = (s: string): string =>
  s
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:–\-]+|[\s:–\-]+$/g, '')
    .replace(/^\d{1,2}\.\s*/, '')
    .trim();

/**
 * Analyse le CONTRAT (lots → postes) à partir du texte du devis. Déterministe.
 * Format « Phenix-amo » (logiciel du conducteur) : tableau « N° DÉSIGNATION QTÉ
 * U. PRIX U. TVA TOTAL HT » — chaque lot est une ligne d'en-tête, chaque poste
 * une ligne « N.N libellé » éventuellement suivie de ses valeurs. Un lot sans
 * poste détaillé devient un poste forfaitaire (son total). Chaque lot démarre en
 * `brouillon` (à vérifier). Les totaux généraux servent à la réconciliation.
 */
export function extractDevisContract(rawText: string): ContractExtraction {
  const lines = rawText
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);

  const lots: DevisLot[] = [];
  let currentLot: DevisLot | null = null;
  const lotDeclaredTotal = new Map<string, number>();
  let pendingPoste: DevisPoste | null = null;
  let seq = 0;

  for (const line of lines) {
    // 1) Valeurs d'un poste en attente ? (« 1,00 u 850,00 € 10,00 % 850,00 € »)
    const vals = POSTE_VALS_RE.exec(line);
    if (vals && pendingPoste) {
      const qte = parseAmount(vals[1]!);
      const pu = parseAmount(vals[3]!);
      const tva = parseRate(vals[4]!);
      const montant = parseAmount(vals[5]!);
      if (qte != null) pendingPoste.quantite = qte;
      pendingPoste.unite = vals[2]!.replace(/\.$/, '');
      if (pu != null) pendingPoste.prixUnitaireHT = pu;
      if (tva != null) pendingPoste.tva = tva;
      if (montant != null) pendingPoste.montantHT = montant;
      pendingPoste.verification = evaluerVerification(pendingPoste);
      pendingPoste = null;
      continue;
    }

    // 2) Nouvelle description de poste ? (« 1.1 Installation… »)
    const desc = POSTE_DESC_RE.exec(line);
    if (desc && currentLot) {
      seq += 1;
      const poste: DevisPoste = {
        id: `p-${seq}`,
        label: cleanLabel(desc[2]!),
        montantHT: 0,
        tva: 0,
        verification: 'non_compris', // tant qu'aucune valeur n'est lue
        sourceText: line,
      };
      currentLot.postes.push(poste);
      pendingPoste = poste;
      continue;
    }

    // 3) En-tête de lot ? (« 1 1. INSTALLATION / PREPARATION 850,00 € »)
    const lotMatch = LOT_RE.exec(line);
    // Un vrai en-tête de lot a un titre à dominante alphabétique.
    if (lotMatch && /[A-Za-zÀ-ÿ]/.test(lotMatch[2]!)) {
      const lot: DevisLot = {
        id: `lot-${lotMatch[1]}`,
        label: cleanLabel(lotMatch[2]!),
        postes: [],
        statut: 'brouillon',
      };
      lots.push(lot);
      currentLot = lot;
      const total = parseAmount(lotMatch[3]!);
      if (total != null) lotDeclaredTotal.set(lot.id, total);
      pendingPoste = null;
    }
  }

  // Un lot sans poste détaillé → un poste forfaitaire = son total déclaré.
  for (const l of lots) {
    if (l.postes.length === 0) {
      const total = lotDeclaredTotal.get(l.id);
      seq += 1;
      const poste: DevisPoste = {
        id: `p-${seq}`,
        label: l.label,
        montantHT: total ?? 0,
        tva: 0,
        unite: 'forfait',
        sourceText: `${l.label} — ${total != null ? `${total} € (total du lot)` : 'montant non lu'}`,
      };
      poste.verification = evaluerVerification(poste);
      l.postes.push(poste);
    }
  }

  const devis = lots.some((l) => l.postes.length > 0) ? { lots } : undefined;
  const declared = extractDeclaredTotals(rawText);
  return { devis, reconciliation: reconcileTotals(devis, declared.ht, declared.ttc) };
}

/** Lit les totaux GÉNÉRAUX déclarés (Total net HT / Total TTC / NET À PAYER). */
export function extractDeclaredTotals(rawText: string): { ht?: number; ttc?: number } {
  const t = rawText.replace(/ /g, ' ');
  const ht = t.match(new RegExp(String.raw`Total\s+net\s+HT\s+(${AMT})`, 'i'));
  const ttc =
    t.match(new RegExp(String.raw`Total\s+TTC\s+(${AMT})`, 'i')) ??
    t.match(new RegExp(String.raw`NET\s+[ÀA]?\s*PAYER\s+(${AMT})`, 'i'));
  return {
    ht: ht ? parseAmount(ht[1]!) : undefined,
    ttc: ttc ? parseAmount(ttc[1]!) : undefined,
  };
}

/**
 * Réconcilie la somme des lignes analysées avec les totaux déclarés. Sans total
 * déclaré, on ne peut rien affirmer → `coherent: true` (pas de contradiction).
 */
export function reconcileTotals(
  devis: Devis | undefined,
  totalHTDeclare?: number,
  totalTTCDeclare?: number,
): TotalsReconciliation {
  const sommeLignesHT = devis ? round2(consolidatedTotals(consolidateDevis(devis, [])).ht) : 0;
  const out: TotalsReconciliation = { sommeLignesHT, coherent: true };
  if (totalHTDeclare != null) {
    out.totalHTDeclare = totalHTDeclare;
    const ecart = round2(Math.abs(sommeLignesHT - totalHTDeclare));
    out.ecartHT = ecart;
    out.coherent = ecart <= reconcileTolerance(totalHTDeclare);
  }
  if (totalTTCDeclare != null) out.totalTTCDeclare = totalTTCDeclare;
  return out;
}

/* -------------------------------------------------------------------------- *
 * Cycle de vie : validation PAR LOT + statut global strict (gating de l'aval)
 * -------------------------------------------------------------------------- */

/** La forme minimale nécessaire au gating (sous-ensemble de ProjectDossier). */
export interface ContractHolder {
  devis?: Devis;
  /**
   * Ancien statut global (donnée HÉRITÉE, avant validation par lot). Sert
   * uniquement à interpréter les lots dépourvus de `statut` : rétro-compatible.
   */
  devisStatut?: LotStatut;
}

/**
 * Un lot est-il EXPLOITABLE (validé) ? Un lot avec `statut` fait foi ; un lot
 * SANS statut est une donnée héritée : exploitable sauf si le devis global était
 * explicitement en brouillon (`holder.devisStatut === 'brouillon'`).
 */
export function lotValide(lot: DevisLot, holder: ContractHolder): boolean {
  if (lot.statut != null) return lot.statut === 'valide';
  return holder.devisStatut !== 'brouillon';
}

/** Nombre de lots validés / total (pour « X lots sur Y validés »). */
export function lotsValidesCount(holder: ContractHolder | null | undefined): {
  valides: number;
  total: number;
} {
  const h = holder ?? {};
  const lots = h.devis?.lots ?? [];
  return { valides: lots.filter((l) => lotValide(l, h)).length, total: lots.length };
}

/**
 * Statut GLOBAL, strict et sans ambiguïté : `a_verifier` (aucun lot validé),
 * `partiellement_valide` (une partie), `valide` (tous). `undefined` s'il n'y a
 * pas de devis. On ne présente JAMAIS un devis comme « validé » tant qu'un lot
 * reste à vérifier.
 */
export function devisStatutGlobal(
  holder: ContractHolder | null | undefined,
): DevisStatut | undefined {
  const lots = holder?.devis?.lots ?? [];
  if (lots.length === 0) return undefined;
  const { valides, total } = lotsValidesCount(holder);
  if (valides === 0) return 'a_verifier';
  if (valides === total) return 'valide';
  return 'partiellement_valide';
}

/** Le devis est-il ENTIÈREMENT validé (tous les lots) ? Sémantique stricte. */
export function contratValide(holder: ContractHolder | null | undefined): boolean {
  return devisStatutGlobal(holder) === 'valide';
}

/** Le devis est-il partiellement validé (au moins un lot validé, pas tous) ? */
export function devisPartiellementValide(holder: ContractHolder | null | undefined): boolean {
  return devisStatutGlobal(holder) === 'partiellement_valide';
}

/** Reste-t-il des lots à vérifier (devis non entièrement validé) ? */
export function devisAVerifier(holder: ContractHolder | null | undefined): boolean {
  const s = devisStatutGlobal(holder);
  return s === 'a_verifier' || s === 'partiellement_valide';
}

/** Y a-t-il au moins un lot EXPLOITABLE (validé) — pour alimenter l'aval ? */
export function devisAvecLotsExploitables(holder: ContractHolder | null | undefined): boolean {
  return lotsValidesCount(holder).valides > 0;
}

/**
 * Le devis RESTREINT aux lots validés — POINT DE PASSAGE UNIQUE des fonctions
 * opérationnelles (Préparation, pré-réception, budget). Un lot non validé
 * n'alimente JAMAIS silencieusement une fonctionnalité. `undefined` si aucun lot
 * exploitable.
 */
export function validatedDevis(holder: ContractHolder | null | undefined): Devis | undefined {
  const h = holder ?? {};
  const devis = h.devis;
  if (!devis) return undefined;
  const lots = devis.lots.filter((l) => lotValide(l, h));
  return lots.length > 0 ? { ...devis, lots } : undefined;
}

/* -------------------------------------------------------------------------- *
 * Cycle de vie DOCUMENTAIRE (5 états) + journal d'audit de la validation
 * -------------------------------------------------------------------------- */

/**
 * Cycle de vie de la TRANSCRIPTION d'un devis, du dépôt au contrat opposable :
 *  • `importe`               — document déposé, pas encore analysé ;
 *  • `analyse_en_cours`      — lecture automatique en cours (état transitoire app) ;
 *  • `analyse_a_verifier`    — analyse produite, des lots restent à valider ;
 *  • `transcription_validee` — tous les lots validés par le conducteur ;
 *  • `contrat_consolide`     — devis + avenants figés en un contrat versionné.
 * Dérivé de l'unique source de vérité (statut par lot) — jamais un état parallèle.
 */
export type EtatTranscription =
  | 'importe'
  | 'analyse_en_cours'
  | 'analyse_a_verifier'
  | 'transcription_validee'
  | 'contrat_consolide';

export const ETAT_TRANSCRIPTION_LABEL: Record<EtatTranscription, string> = {
  importe: 'Importé',
  analyse_en_cours: 'Analyse en cours',
  analyse_a_verifier: 'Analyse à vérifier',
  transcription_validee: 'Transcription validée',
  contrat_consolide: 'Contrat consolidé',
};

/**
 * État documentaire DÉRIVÉ (au repos) : `importe` sans devis, sinon
 * `contrat_consolide` si explicitement consolidé, `transcription_validee` quand
 * tous les lots sont validés, `analyse_a_verifier` tant qu'il reste à vérifier.
 * (`analyse_en_cours` est un état transitoire posé par l'application pendant la
 * lecture — il n'est pas dérivable d'un dossier au repos.)
 */
export function etatTranscription(
  holder: ContractHolder | null | undefined,
  opts: { consolide?: boolean } = {},
): EtatTranscription {
  if (!holder?.devis || holder.devis.lots.length === 0) return 'importe';
  if (opts.consolide) return 'contrat_consolide';
  return contratValide(holder) ? 'transcription_validee' : 'analyse_a_verifier';
}

/**
 * Une entrée du JOURNAL de validation (audit) : qui a fait quoi, quand, sur
 * quelle version de document, avec quelle version de moteur. Append-only.
 */
export interface JournalEntry {
  /** Horodatage ISO (fourni par l'appelant : le module core reste déterministe). */
  horodatage: string;
  /** Auteur de l'action (conducteur). */
  auteur: string;
  /** Action tracée : « import », « analyse », « validation lot », « consolidation »… */
  action: string;
  /** Numéro de version du document (devis initial = 1, puis avenants). */
  versionDocument?: number;
  /** Version du moteur d'analyse ayant produit/validé la transcription. */
  versionMoteur: string;
  /** Précision libre (ex. libellé du lot validé). */
  detail?: string;
}

/** Ajoute une entrée au journal (append-only) — retourne un NOUVEau tableau. */
export function appendJournal(
  journal: JournalEntry[] | undefined,
  entry: JournalEntry,
): JournalEntry[] {
  return [...(journal ?? []), entry];
}

/* Parsers de montants/taux français, réutilisables par le moteur géométrique. */
export const parseMontantFr = parseAmount;
export const parseTauxFr = parseRate;
