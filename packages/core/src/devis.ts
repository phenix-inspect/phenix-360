/**
 * PHÉNIX 360 — Lecture fine du DEVIS SIGNÉ (matière première du chantier)
 * ===========================================================================
 * Le devis signé est la source : PHÉNIX le LIT et en extrait une structure
 * exploitable (lots → postes, montants, TVA, matériaux, quantités), reliée aux
 * commandes, aux choix client et aux documents. Le conducteur ne saisit pas le
 * chantier : il relit et ajuste les 20 % restants.
 *
 * Modèle PUR (types + sélecteurs). L'extraction réelle (OCR + LLM) viendra
 * derrière le port `DossierAnalyzer` SANS changer ce modèle ni les écrans.
 */

/** Un POSTE du devis : une ligne chiffrée (fourniture et/ou pose). */
export interface DevisPoste {
  id: string;
  label: string;
  quantite?: number;
  /** Unité : « m² », « ml », « u », « ens. », « forfait »… */
  unite?: string;
  prixUnitaireHT?: number;
  montantHT: number;
  /** Taux de TVA en % (5.5 / 10 / 20). */
  tva: number;
  /** Matériau principal identifié, le cas échéant. */
  materiau?: string;
  /** Poste (du devis initial ou d'un avenant précédent) que ce poste remplace. */
  remplacePosteId?: string;
}

/** Un LOT du devis : un corps d'état regroupant des postes. */
export interface DevisLot {
  id: string;
  label: string;
  /** Étape de la feuille de route correspondante. */
  stepId?: string;
  postes: DevisPoste[];
  /** Commandes probables rattachées à ce lot (ids d'Order). */
  orderIds?: string[];
  /** Choix client probables rattachés (ids de ClientSelection). */
  selectionIds?: string[];
  /** Documents nécessaires pour ce lot (ids de ProjectDocument). */
  documentIds?: string[];
}

/** Le devis signé, lu et structuré. */
export interface Devis {
  reference?: string;
  date?: string;
  lots: DevisLot[];
}

/**
 * Un AVENANT = un nouveau devis signé, AJOUTÉ au projet (append-only). Il ne
 * modifie jamais le devis initial : il ajoute des postes, et peut en remplacer
 * (le poste d'origine reste visible, marqué « remplacé par avenant n°X »).
 */
export interface Avenant {
  id: string;
  numero: number;
  reference?: string;
  date?: string;
  label?: string;
  lots: DevisLot[];
}

/* --------------------- consolidation devis + avenants ---------------------- */

export type PosteOrigin = { kind: 'initial' } | { kind: 'avenant'; numero: number };

export const originLabel = (o: PosteOrigin): string =>
  o.kind === 'initial' ? 'Devis initial' : `Avenant n°${o.numero}`;

export interface ConsolidatedPoste {
  poste: DevisPoste;
  origin: PosteOrigin;
  /** Numéro de l'avenant qui remplace ce poste (le poste reste visible). */
  replacedByNumero?: number;
}

export interface ConsolidatedLot {
  label: string;
  stepId?: string;
  postes: ConsolidatedPoste[];
  orderIds: string[];
  selectionIds: string[];
  documentIds: string[];
}

export interface ConsolidatedDevis {
  lots: ConsolidatedLot[];
  avenants: { numero: number; reference?: string; date?: string; label?: string }[];
}

/**
 * Vue consolidée APPEND-ONLY : devis initial + avenants, regroupés par lot.
 * Chaque poste connaît son origine ; les postes remplacés restent présents,
 * marqués du numéro d'avenant qui les remplace. On n'écrase jamais rien.
 */
export function consolidateDevis(devis?: Devis, avenants: Avenant[] = []): ConsolidatedDevis {
  const replacedBy = new Map<string, number>();
  for (const av of avenants) {
    for (const lot of av.lots) {
      for (const p of lot.postes) {
        if (p.remplacePosteId) replacedBy.set(p.remplacePosteId, av.numero);
      }
    }
  }

  const order: string[] = [];
  const byLabel = new Map<string, ConsolidatedLot>();
  const ensure = (lot: DevisLot): ConsolidatedLot => {
    let c = byLabel.get(lot.label);
    if (!c) {
      c = {
        label: lot.label,
        stepId: lot.stepId,
        postes: [],
        orderIds: [],
        selectionIds: [],
        documentIds: [],
      };
      byLabel.set(lot.label, c);
      order.push(lot.label);
    }
    if (c.stepId == null && lot.stepId != null) c.stepId = lot.stepId;
    for (const id of lot.orderIds ?? []) if (!c.orderIds.includes(id)) c.orderIds.push(id);
    for (const id of lot.selectionIds ?? [])
      if (!c.selectionIds.includes(id)) c.selectionIds.push(id);
    for (const id of lot.documentIds ?? []) if (!c.documentIds.includes(id)) c.documentIds.push(id);
    return c;
  };
  const add = (lots: DevisLot[], origin: PosteOrigin): void => {
    for (const lot of lots) {
      const c = ensure(lot);
      for (const p of lot.postes) {
        c.postes.push({ poste: p, origin, replacedByNumero: replacedBy.get(p.id) });
      }
    }
  };

  if (devis) add(devis.lots, { kind: 'initial' });
  for (const av of avenants) add(av.lots, { kind: 'avenant', numero: av.numero });

  return {
    lots: order.map((l) => byLabel.get(l)!),
    avenants: avenants.map((a) => ({
      numero: a.numero,
      reference: a.reference,
      date: a.date,
      label: a.label,
    })),
  };
}

/** Total HT d'un lot consolidé (postes ACTIFS uniquement, hors remplacés). */
export const consolidatedLotTotalHT = (lot: ConsolidatedLot): number =>
  round2(
    lot.postes.filter((p) => p.replacedByNumero == null).reduce((a, p) => a + p.poste.montantHT, 0),
  );

/** Totaux du devis consolidé (postes ACTIFS uniquement). */
export function consolidatedTotals(c: ConsolidatedDevis): DevisTotals {
  const lots: DevisLot[] = c.lots.map((lot) => ({
    id: lot.label,
    label: lot.label,
    postes: lot.postes.filter((p) => p.replacedByNumero == null).map((p) => p.poste),
  }));
  return devisTotals({ lots });
}

/* ------------------------------- sélecteurs -------------------------------- */

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Total HT d'un lot (somme de ses postes). */
export const lotTotalHT = (lot: DevisLot): number =>
  round2(lot.postes.reduce((a, p) => a + p.montantHT, 0));

export interface DevisTotals {
  ht: number;
  tva: number;
  ttc: number;
  /** Détail par taux de TVA (croissant). */
  parTaux: { taux: number; ht: number; tva: number }[];
}

/** Totaux HT / TVA / TTC du devis, avec ventilation par taux. */
export function devisTotals(devis: Devis): DevisTotals {
  const byRate = new Map<number, number>();
  for (const lot of devis.lots) {
    for (const p of lot.postes) {
      byRate.set(p.tva, (byRate.get(p.tva) ?? 0) + p.montantHT);
    }
  }
  const parTaux = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, ht]) => ({ taux, ht: round2(ht), tva: round2((ht * taux) / 100) }));
  const ht = round2(parTaux.reduce((a, r) => a + r.ht, 0));
  const tva = round2(parTaux.reduce((a, r) => a + r.tva, 0));
  return { ht, tva, ttc: round2(ht + tva), parTaux };
}

export interface DevisSummary {
  lots: number;
  postes: number;
  totalHT: number;
  totalTTC: number;
  /** Liens préparés automatiquement à partir du devis. */
  orders: number;
  selections: number;
  documents: number;
  /** Avenants intégrés au devis. */
  avenants: number;
}

/**
 * Résumé express de la lecture du devis (alimente la note de lancement) — sur la
 * vue CONSOLIDÉE (devis initial + avenants, postes actifs). Une seule vérité :
 * les montants ici correspondent au détail « Le devis ».
 */
export function buildDevisSummary(devis?: Devis, avenants: Avenant[] = []): DevisSummary {
  const c = consolidateDevis(devis, avenants);
  const totals = consolidatedTotals(c);
  const orders = new Set<string>();
  const selections = new Set<string>();
  const documents = new Set<string>();
  let postes = 0;
  for (const lot of c.lots) {
    postes += lot.postes.filter((p) => p.replacedByNumero == null).length;
    lot.orderIds.forEach((id) => orders.add(id));
    lot.selectionIds.forEach((id) => selections.add(id));
    lot.documentIds.forEach((id) => documents.add(id));
  }
  return {
    lots: c.lots.length,
    postes,
    totalHT: totals.ht,
    totalTTC: totals.ttc,
    orders: orders.size,
    selections: selections.size,
    documents: documents.size,
    avenants: c.avenants.length,
  };
}

export interface DevisVigilance {
  id: string;
  /** Lot concerné (par libellé) — pour rattacher la vigilance à son lot. */
  lotLabel: string;
  message: string;
}

/** Lots « au métré » dont les quantités manquent → à confirmer avant commande. */
const METRE_LOT = /carrelage|fa[iï]ence|peinture|\bsol|parquet|cloison|pl[âa]tr|isolation/i;

/** Vigilances métier issues de la lecture du devis (sélecteur pur). */
export function devisVigilances(devis: Devis): DevisVigilance[] {
  const out: DevisVigilance[] = [];
  for (const lot of devis.lots) {
    const sansMontant = lot.postes.filter((p) => !p.montantHT);
    if (sansMontant.length > 0) {
      out.push({
        id: `devis-montant-${lot.id}`,
        lotLabel: lot.label,
        message: `Lot « ${lot.label} » : ${sansMontant.length} poste(s) sans montant chiffré.`,
      });
    }
    if (METRE_LOT.test(lot.label)) {
      const sansQte = lot.postes.filter((p) => p.quantite == null);
      if (sansQte.length > 0) {
        out.push({
          id: `devis-qte-${lot.id}`,
          lotLabel: lot.label,
          message: `Lot « ${lot.label} » : quantités à confirmer avant de commander.`,
        });
      }
    }
  }
  return out;
}
