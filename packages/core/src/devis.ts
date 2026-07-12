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

/**
 * État de VÉRIFICATION d'une ligne lue automatiquement, en langage de chantier :
 *  • `verifie`      🟢 vérifié automatiquement (ligne pleinement chiffrée) ;
 *  • `a_verifier`   🟠 à vérifier (donnée partielle, ex. forfait / TVA absente) ;
 *  • `non_compris`  🔴 non compris (montant non lu — PHÉNIX n'invente pas).
 * Une ligne non 🟢 ne doit JAMAIS être présentée comme un fait certain :
 * l'écran de vérification l'affiche et explique « pourquoi ».
 */
export type VerificationNiveau = 'verifie' | 'a_verifier' | 'non_compris';

export const VERIFICATION_LABEL: Record<VerificationNiveau, string> = {
  verifie: 'Vérifié automatiquement',
  a_verifier: 'À vérifier',
  non_compris: 'Non compris',
};

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
  /**
   * Résultat de la LECTURE automatique (issu de l'analyse). Absent ⇒ donnée
   * saisie/validée à la main (certaine). Une ligne non `verifie` doit être
   * contrôlée avant de valider son lot.
   */
  verification?: VerificationNiveau;
  /** Extrait de texte source (traçabilité : comparer au document original). */
  sourceText?: string;
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
  /**
   * Statut de VALIDATION du lot : `brouillon` = lu automatiquement, pas encore
   * vérifié → NON exploitable en aval ; `valide` = contrôlé par le conducteur →
   * exploitable (Préparation, pré-réception, budget). Chaque lot se valide
   * indépendamment. Absent ⇒ donnée historique/démo (voir `lotValide`).
   */
  statut?: 'brouillon' | 'valide';
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
  /**
   * Note d'impact en TEXTE LIBRE. Vide aujourd'hui (la formulation est
   * déterministe). En V2, l'IA pourra y déposer un message contextuel — p. ex.
   * « L'avenant modifie la cuisine. Pensez à vérifier les commandes déjà passées
   * et le planning de pose. ». S'il est présent, il PRIME sur la formulation
   * déterministe du briefing, sans changer la structure (cf. describeAvenantImpact).
   */
  impactNote?: string;
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

/* ----------------------- impact d'un avenant déposé ------------------------ */

/**
 * Impact RECALCULÉ d'un avenant fraîchement déposé : ce que PHÉNIX en déduit
 * pour le chantier. Sélecteur PUR, dérivé du devis initial + des avenants
 * précédents (état AVANT) confronté au nouvel avenant. On n'écrase rien : on
 * mesure seulement l'écart introduit par cet avenant.
 */
export interface AvenantImpact {
  numero: number;
  /** Note d'impact en texte libre (IA, V2). Si présente, prime sur la formulation déterministe. */
  note?: string;
  /** Postes du devis (initial ou avenant antérieur) remplacés par cet avenant. */
  postesRemplaces: number;
  /** Postes apportés par l'avenant (lignes ajoutées au document). */
  postesAjoutes: number;
  /** Variation de montant HT introduite par l'avenant (ajouts − remplacés). */
  deltaHT: number;
  /** Variation de montant TTC introduite par l'avenant. */
  deltaTTC: number;
  /** Commandes liées à un lot dont un poste est remplacé → à mettre à jour. */
  commandesAMettreAJour: number;
  /** Ids des commandes à mettre à jour (pour relier au briefing / aux fiches). */
  commandeIds: string[];
  /** Nouveaux choix client introduits par l'avenant (à obtenir). */
  choixAObtenir: number;
  /** Documents nouvellement nécessaires d'après l'avenant. */
  documentsNecessaires: number;
  /** L'avenant touche un lot rattaché au planning → impact à vérifier. */
  impactPlanning: boolean;
  /** Vigilances métier nouvelles issues des postes de l'avenant. */
  vigilances: number;
}

export function avenantImpact(
  devis: Devis | undefined,
  before: Avenant[],
  avenant: Avenant,
): AvenantImpact {
  // État AVANT cet avenant (devis initial + avenants antérieurs).
  const base = consolidateDevis(devis, before);
  const baseByLabel = new Map(base.lots.map((l) => [l.label, l]));
  const basePostes = new Map<string, DevisPoste>();
  for (const lot of devis?.lots ?? []) for (const p of lot.postes) basePostes.set(p.id, p);
  for (const av of before)
    for (const lot of av.lots) for (const p of lot.postes) basePostes.set(p.id, p);

  let postesRemplaces = 0;
  let postesAjoutes = 0;
  let addedHT = 0;
  let removedHT = 0;
  let addedTTC = 0;
  let removedTTC = 0;
  const ordersToUpdate = new Set<string>();
  const newChoices = new Set<string>();
  const newDocuments = new Set<string>();
  let impactPlanning = false;

  for (const lot of avenant.lots) {
    const baseLot = baseByLabel.get(lot.label);
    if (baseLot?.stepId != null || lot.stepId != null) impactPlanning = true;
    for (const id of lot.selectionIds ?? []) newChoices.add(id);
    for (const id of lot.documentIds ?? []) newDocuments.add(id);

    let lotHasReplacement = false;
    for (const p of lot.postes) {
      postesAjoutes += 1;
      addedHT += p.montantHT;
      addedTTC += p.montantHT * (1 + p.tva / 100);
      if (p.remplacePosteId) {
        lotHasReplacement = true;
        const old = basePostes.get(p.remplacePosteId);
        if (old) {
          postesRemplaces += 1;
          removedHT += old.montantHT;
          removedTTC += old.montantHT * (1 + old.tva / 100);
        }
      }
    }
    // Une commande rattachée à un lot dont un poste change doit être mise à jour.
    if (lotHasReplacement) for (const id of baseLot?.orderIds ?? []) ordersToUpdate.add(id);
  }

  const vigilances = devisVigilances({ lots: avenant.lots }).length;

  return {
    note: avenant.impactNote,
    numero: avenant.numero,
    postesRemplaces,
    postesAjoutes,
    deltaHT: round2(addedHT - removedHT),
    deltaTTC: round2(addedTTC - removedTTC),
    commandesAMettreAJour: ordersToUpdate.size,
    commandeIds: [...ordersToUpdate],
    choixAObtenir: newChoices.size,
    documentsNecessaires: newDocuments.size,
    impactPlanning,
    vigilances,
  };
}

/**
 * Phrase d'impact d'un avenant pour le briefing. SEAM V2 : si une note en texte
 * libre est présente (générée par l'IA, p. ex. « L'avenant modifie la cuisine.
 * Pensez à vérifier les commandes déjà passées et le planning de pose. »), elle
 * prime intégralement ; sinon, formulation déterministe. Le composant ne fige
 * donc aucune structure — il affiche le texte tel quel.
 */
export function describeAvenantImpact(impact: AvenantImpact): string {
  if (impact.note && impact.note.trim()) return impact.note.trim();
  // Court et orienté action : le détail chiffré (+ajoutées / ~modifiées) est déjà
  // porté par le badge du radar — on ne le répète pas dans le message.
  const scope =
    impact.impactPlanning && impact.commandesAMettreAJour > 0
      ? 'le planning et les commandes'
      : impact.impactPlanning
        ? 'le planning'
        : impact.commandesAMettreAJour > 0
          ? 'les commandes'
          : null;
  return scope
    ? `Avenant n°${impact.numero} — à répercuter sur ${scope}.`
    : `Avenant n°${impact.numero} intégré.`;
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
