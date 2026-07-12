/**
 * PHÉNIX 360 — MOTEUR DE TRANSCRIPTION CONTRACTUELLE (devis → contrat structuré)
 * ===========================================================================
 * Le document original (PDF/image) reste la SOURCE officielle, archivée et
 * ouvrable. À côté, PHÉNIX en produit une TRANSCRIPTION structurée : lots →
 * postes (libellé, quantité, unité, PU, montant HT, TVA), avec un niveau de
 * confiance par ligne et une source. La transcription n'est JAMAIS contractuelle
 * tant que le conducteur ne l'a pas VALIDÉE (statut `brouillon → valide`).
 *
 * Règle d'or : ne JAMAIS inventer. Une ligne dont un champ n'a pu être lu reste
 * partielle (montant/qté absents) et signalée « incertain ». Les totaux sont
 * réconciliés (somme des lignes vs total HT déclaré) : un écart BLOQUE la
 * validation automatique et exige un contrôle humain.
 *
 * Module PUR (déterministe, sans I/O). L'extraction binaire PDF→texte (et, plus
 * tard, l'OCR/l'analyse visuelle) vit côté application, derrière le port
 * `DossierAnalyzer` — on parse ici le TEXTE déjà extrait.
 */
import type { ConfidenceLevel, Devis, DevisLot, DevisPoste } from './devis.js';
import { consolidateDevis, consolidatedTotals } from './devis.js';

/** Cycle de vie d'une transcription : brouillon (à vérifier) → validé (contractuel). */
export const DEVIS_STATUTS = ['brouillon', 'valide'] as const;
export type DevisStatut = (typeof DEVIS_STATUTS)[number];

/**
 * Réconciliation des totaux : la somme des lignes transcrites doit correspondre
 * au total HT déclaré sur le document. Sinon, la transcription est suspecte.
 */
export interface TotalsReconciliation {
  /** Somme des montants HT des postes actifs transcrits. */
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

/** Résultat de la transcription structurée d'un devis. */
export interface ContractExtraction {
  /** Contrat structuré (lots → postes) — absent si aucun poste n'a pu être lu. */
  devis?: Devis;
  /** Réconciliation des totaux. */
  reconciliation: TotalsReconciliation;
  /** Nombre de postes transcrits. */
  postesCount: number;
  /** Part des postes à confiance élevée (0–100). */
  confidence: number;
}

/** Tolérance de réconciliation : 1 € OU 0,5 % du total déclaré (le plus grand). */
const reconcileTolerance = (declaredHT: number): number => Math.max(1, declaredHT * 0.005);

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Convertit un montant français (« 12 500,00 » / « 1 900,00 € ») en nombre. */
function parseAmount(raw: string): number | undefined {
  const s = raw.replace(/[\s €]/g, '').replace(/\.(?=\d{3}\b)/g, '');
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? round2(n) : undefined;
}

/** Convertit un taux (« 10,00 % » / « 5,5 ») en nombre. */
function parseRate(raw: string): number | undefined {
  const n = Number(raw.replace(/[\s%]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
}

const AMT = String.raw`\d[\d\s .]*,\d{2}`;

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
 * Transcrit le CONTRAT (lots → postes) à partir du texte du devis. Déterministe.
 * Format « Phenix-amo » (logiciel du conducteur) : tableau « N° DÉSIGNATION QTÉ
 * U. PRIX U. TVA TOTAL HT » — chaque lot est une ligne d'en-tête, chaque poste
 * une ligne « N.N libellé » éventuellement suivie de ses valeurs. Un lot sans
 * poste détaillé devient un poste forfaitaire (son total). Les totaux généraux
 * (Total net HT / Total TTC) servent à la réconciliation.
 */
export function extractDevisContract(rawText: string): ContractExtraction {
  const lines = rawText
    .replace(/ /g, ' ')
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
      // Ligne complète et chiffrée → confiance élevée.
      pendingPoste.confidence = montant != null && tva != null ? 'eleve' : 'moyen';
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
        confidence: 'faible', // tant qu'aucune valeur n'est lue
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
      l.postes.push({
        id: `p-${seq}`,
        label: l.label,
        montantHT: total ?? 0,
        tva: 0,
        unite: 'forfait',
        confidence: total != null ? 'moyen' : 'faible',
      });
    }
  }

  const allPostes = lots.flatMap((l) => l.postes);
  const devis = allPostes.length > 0 ? { lots } : undefined;

  const declared = extractDeclaredTotals(rawText);
  const reconciliation = reconcileTotals(devis, declared.ht, declared.ttc);

  const highConf = allPostes.filter((p) => p.confidence === 'eleve').length;
  const confidence = allPostes.length > 0 ? Math.round((highConf / allPostes.length) * 100) : 0;

  return { devis, reconciliation, postesCount: allPostes.length, confidence };
}

/** Lit les totaux GÉNÉRAUX déclarés (Total net HT / Total TTC / NET À PAYER). */
export function extractDeclaredTotals(rawText: string): { ht?: number; ttc?: number } {
  const t = rawText.replace(/ /g, ' ');
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
 * Réconcilie la somme des lignes transcrites avec les totaux déclarés. Sans
 * total déclaré, on ne peut rien affirmer → `coherent: true` (pas de contradiction),
 * mais l'écran de vérification invite quand même à contrôler.
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
 * Cycle de vie de la transcription (gating de tout l'aval)
 * -------------------------------------------------------------------------- */

/** La forme minimale nécessaire au gating (sous-ensemble de ProjectDossier). */
export interface ContractHolder {
  devis?: Devis;
  devisStatut?: DevisStatut;
}

/**
 * Le contrat est-il EXPLOITABLE en aval (pré-réception, budget « devis »,
 * prestations, Léon « certain ») ? Oui s'il existe et n'est pas en brouillon.
 * Rétro-compatible : un devis SANS statut (données historiques / démo) est
 * considéré comme validé — seul un brouillon EXPLICITE est mis en attente.
 */
export function contratValide(holder: ContractHolder | null | undefined): boolean {
  return Boolean(holder?.devis) && holder?.devisStatut !== 'brouillon';
}

/** Une transcription est-elle EN ATTENTE de vérification/validation humaine ? */
export function contratEnBrouillon(holder: ContractHolder | null | undefined): boolean {
  return Boolean(holder?.devis) && holder?.devisStatut === 'brouillon';
}
