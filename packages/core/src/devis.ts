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
}

/** Résumé express de la lecture du devis (alimente la note de lancement). */
export function buildDevisSummary(devis: Devis): DevisSummary {
  const totals = devisTotals(devis);
  const orders = new Set<string>();
  const selections = new Set<string>();
  const documents = new Set<string>();
  let postes = 0;
  for (const lot of devis.lots) {
    postes += lot.postes.length;
    lot.orderIds?.forEach((id) => orders.add(id));
    lot.selectionIds?.forEach((id) => selections.add(id));
    lot.documentIds?.forEach((id) => documents.add(id));
  }
  return {
    lots: devis.lots.length,
    postes,
    totalHT: totals.ht,
    totalTTC: totals.ttc,
    orders: orders.size,
    selections: selections.size,
    documents: documents.size,
  };
}

export interface DevisVigilance {
  id: string;
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
        message: `Lot « ${lot.label} » : ${sansMontant.length} poste(s) sans montant chiffré.`,
      });
    }
    if (METRE_LOT.test(lot.label)) {
      const sansQte = lot.postes.filter((p) => p.quantite == null);
      if (sansQte.length > 0) {
        out.push({
          id: `devis-qte-${lot.id}`,
          message: `Lot « ${lot.label} » : quantités à confirmer avant de commander.`,
        });
      }
    }
  }
  return out;
}
