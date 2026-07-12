/**
 * PHÉNIX 360 — ASSISTANT CHANTIER : le copilote qui PRÉPARE, jamais ne décide.
 * =============================================================================
 * À partir du CONTRAT VALIDÉ (validatedDevis + avenants + détails techniques
 * dérivés), l'assistant prépare des BROUILLONS soumis au contrôle humain :
 *   • matériel / équipements potentiellement commandables ;
 *   • lignes de commande à préparer (statuts) ;
 *   • choix probables à demander au client ;
 *   • check-list de préparation enrichie ;
 *   • points de vigilance ;
 *   • documents à récupérer ;
 *   • photos recommandées.
 *
 * RÈGLES ABSOLUES :
 *  • Il NE RÉALISE JAMAIS d'action : ni commande, ni demande client, ni
 *    notification, ni modification du contrat. Il ne fait que PRÉPARER.
 *  • Il N'INVENTE JAMAIS. Toute suggestion est tracée jusqu'à la prestation, le
 *    lot et la page source. Quantité absente ⇒ « Quantité à confirmer ».
 *    Référence absente ⇒ « Référence à définir ». Dérivation incertaine ⇒
 *    niveau de confiance « À vérifier » (jamais présentée comme un fait).
 *  • Le conducteur vérifie, corrige, valide, puis déclenche l'action via les
 *    points d'entrée officiels (commandes, « Demander au client »…).
 *
 * Module PUR (aucune I/O, aucun réseau, aucun LLM). Déterministe.
 */
import { consolidateDevis, type Avenant, type Devis, type DevisPoste } from './devis.js';
import { validatedDevis, type ContractHolder } from './contract.js';
import {
  deriverDetailsPoste,
  type DetailTechnique,
  type NiveauConfiance,
} from './details-techniques.js';

/* -------------------------------------------------------------------------- *
 * Familles de lot (corps d'état) — pour dériver check-lists, vigilances, photos
 * -------------------------------------------------------------------------- */
export type FamilleLot =
  | 'electricite'
  | 'plomberie'
  | 'carrelage'
  | 'peinture'
  | 'cuisine'
  | 'menuiserie'
  | 'platrerie'
  | 'sols'
  | 'ventilation'
  | 'autre';

const strip = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Un des mots-clés apparaît-il comme MOT ENTIER (évite « sol » ⊂ « solius ») ? */
function motEntier(texte: string, mots: string[]): boolean {
  const s = ` ${strip(texte).replace(/[^a-z0-9]+/g, ' ')} `;
  return mots.some((m) => s.includes(` ${m} `));
}

/** Classe un lot par son intitulé (déterministe, tolérant aux variantes OBAT). */
export function familleLot(label: string): FamilleLot {
  const s = strip(label);
  if (/electric|courant|appareillage|tableau/.test(s)) return 'electricite';
  if (/plomb|sanitaire|salle d eau|salle de bain|douche|wc/.test(s)) return 'plomberie';
  if (/carrelage|faience|revetement mural|revetements/.test(s)) return 'carrelage';
  if (/peinture/.test(s)) return 'peinture';
  if (/cuisine|kitchenette/.test(s)) return 'cuisine';
  if (/menuiser|porte|fenetre|placard|dressing/.test(s)) return 'menuiserie';
  if (/platr|cloison|doublage|isolation|plafond/.test(s)) return 'platrerie';
  if (/\bsol\b|parquet|lame|plinthe|ragreage|revetement de sol/.test(s)) return 'sols';
  if (/ventilation|vmc/.test(s)) return 'ventilation';
  return 'autre';
}

/* -------------------------------------------------------------------------- *
 * 1) MATÉRIEL À COMMANDER (Mission 13)
 * -------------------------------------------------------------------------- */
/** Source contractuelle d'une suggestion (traçabilité obligatoire). */
export interface SourceContrat {
  prestationSourceId: string;
  lotLabel: string;
  sourcePage?: number;
  extraitSource: string;
}

/** Un matériel / équipement potentiellement commandable, PRÉPARÉ (jamais commandé). */
export interface MaterielDetecte {
  désignation: string;
  /** Quantité additionnée quand elle est fiable ; absente sinon. */
  quantité?: number;
  unité?: string;
  marque?: string;
  référence?: string;
  dimensions?: string;
  couleur?: string;
  pièce?: string;
  lot: string;
  niveauConfiance: NiveauConfiance;
  /** Affichage prudent quand une donnée manque (« Quantité à confirmer »…). */
  mentions: string[];
  sources: SourceContrat[];
}

/** Familles de matériaux de FINITION réellement commandables (hors consommables). */
const FINITIONS = [
  'peinture',
  'carrelage',
  'faience',
  'parquet',
  'lame pvc',
  'lame',
  'plinthe',
  'sol souple',
  'moquette',
  'papier peint',
  'lambris',
  'toile de renovation',
  'toile de verre',
  'sous couche',
];

/** Une puce de matériau est-elle « commandable » (équipement, ou finition) ? */
function estCommandable(d: DetailTechnique): boolean {
  if (d.type === 'équipement') return true;
  if (d.type !== 'matériau') return false;
  return motEntier(d.libellé, FINITIONS);
}

/** Le pire des deux niveaux de confiance (« À vérifier » l'emporte). */
const pireConfiance = (a: NiveauConfiance, b: NiveauConfiance): NiveauConfiance =>
  a === 'À vérifier' || b === 'À vérifier' ? 'À vérifier' : 'Fiable';

/**
 * Agrège les détails commandables par intitulé + pièce → MaterielDetecte.
 * On ADDITIONNE seulement les quantités FIABLES et dénombrables ; sinon on garde
 * la mention « Quantité à confirmer ». Aucune référence / marque inventée.
 */
function detecterMateriels(details: DetailTechnique[]): MaterielDetecte[] {
  const COMPTABLES = new Set(['u', 'pce', 'ens']);
  const map = new Map<string, MaterielDetecte>();
  for (const d of details) {
    if (!estCommandable(d)) continue;
    const clé = `${strip(d.libellé)}|${d.pièce ?? ''}`;
    let m = map.get(clé);
    if (!m) {
      m = {
        désignation: d.libellé,
        lot: d.lotLabel,
        niveauConfiance: 'Fiable',
        mentions: [],
        sources: [],
        ...(d.pièce ? { pièce: d.pièce } : {}),
      };
      map.set(clé, m);
    }
    m.niveauConfiance = pireConfiance(m.niveauConfiance, d.niveauConfiance);
    // Attributs : on ne remplace jamais une valeur déjà lue par une vide.
    if (d.marque && !m.marque) m.marque = d.marque;
    if (d.référence && !m.référence) m.référence = d.référence;
    if (d.dimensions && !m.dimensions) m.dimensions = d.dimensions;
    if (d.couleur && !m.couleur) m.couleur = d.couleur;
    // Quantité : somme des seules quantités FIABLES et dénombrables.
    const comptable = d.unité != null && COMPTABLES.has(d.unité);
    if (d.quantité != null && d.niveauConfiance === 'Fiable' && comptable) {
      m.quantité = (m.quantité ?? 0) + d.quantité;
      m.unité = d.unité;
    }
    m.sources.push({
      prestationSourceId: d.posteId,
      lotLabel: d.lotLabel,
      ...(d.sourcePage != null ? { sourcePage: d.sourcePage } : {}),
      extraitSource: d.extraitSource,
    });
  }
  // Mentions prudentes : quantité / référence manquantes.
  for (const m of map.values()) {
    if (m.quantité == null) m.mentions.push('Quantité à confirmer');
    if (!m.référence) m.mentions.push('Référence à définir');
  }
  return [...map.values()];
}

/* -------------------------------------------------------------------------- *
 * 2) PRÉPARATION DES COMMANDES (Mission 14)
 * -------------------------------------------------------------------------- */
export const COMMANDE_STATUTS = [
  'a_verifier',
  'choix_client',
  'pret_a_commander',
  'a_commander',
  'commande',
  'receptionne',
  'annule',
] as const;
export type CommandeStatut = (typeof COMMANDE_STATUTS)[number];

export const COMMANDE_STATUT_LABEL: Record<CommandeStatut, string> = {
  a_verifier: 'À vérifier',
  choix_client: 'Choix client nécessaire',
  pret_a_commander: 'Prêt à commander',
  a_commander: 'À commander',
  commande: 'Commandé',
  receptionne: 'Réceptionné',
  annule: 'Annulé',
};

/** Une ligne de PRÉPARATION de commande (brouillon — jamais une commande réelle). */
export interface LigneCommande {
  désignation: string;
  quantité?: number;
  unité?: string;
  lot: string;
  pièce?: string;
  statut: CommandeStatut;
  niveauConfiance: NiveauConfiance;
  mentions: string[];
  sources: SourceContrat[];
}

/**
 * Prépare une ligne de commande par matériel détecté. Statut par défaut prudent :
 * « Choix client nécessaire » si une donnée de choix manque (référence / couleur),
 * sinon « À vérifier ». JAMAIS « À commander » automatiquement.
 */
function preparerCommandes(materiels: MaterielDetecte[]): LigneCommande[] {
  return materiels.map((m) => {
    const besoinChoix =
      !m.référence || m.couleur === 'à définir' || m.niveauConfiance === 'À vérifier';
    return {
      désignation: m.désignation,
      lot: m.lot,
      statut: besoinChoix ? ('choix_client' as CommandeStatut) : ('a_verifier' as CommandeStatut),
      niveauConfiance: m.niveauConfiance,
      mentions: m.mentions,
      sources: m.sources,
      ...(m.quantité != null ? { quantité: m.quantité } : {}),
      ...(m.unité ? { unité: m.unité } : {}),
      ...(m.pièce ? { pièce: m.pièce } : {}),
    };
  });
}

/** Regroupe des lignes de commande par critère (aide à l'organisation). */
export function regrouperCommandes(
  lignes: LigneCommande[],
  par: 'lot' | 'pièce' | 'statut',
): Map<string, LigneCommande[]> {
  const map = new Map<string, LigneCommande[]>();
  for (const l of lignes) {
    const clé = par === 'lot' ? l.lot : par === 'pièce' ? (l.pièce ?? 'Non localisé') : l.statut;
    const arr = map.get(clé);
    if (arr) arr.push(l);
    else map.set(clé, [l]);
  }
  return map;
}

/* -------------------------------------------------------------------------- *
 * 3) CHOIX À DEMANDER AU CLIENT (Mission 15)
 * -------------------------------------------------------------------------- */
export const CHOIX_STATUTS = [
  'a_analyser',
  'choix_necessaire',
  'deja_defini',
  'a_demander',
  'demande_envoyee',
  'reponse_recue',
  'sans_objet',
] as const;
export type ChoixStatut = (typeof CHOIX_STATUTS)[number];

export const CHOIX_STATUT_LABEL: Record<ChoixStatut, string> = {
  a_analyser: 'À analyser',
  choix_necessaire: 'Choix nécessaire',
  deja_defini: 'Déjà défini dans le devis',
  a_demander: 'À demander au client',
  demande_envoyee: 'Demande envoyée',
  reponse_recue: 'Réponse reçue',
  sans_objet: 'Sans objet',
};

export type ChoixType = 'couleur' | 'référence' | 'dimension' | 'gamme' | 'modèle' | 'finition';

/** Un choix POTENTIEL à demander au client — préparé, jamais envoyé. */
export interface ChoixClientPotentiel {
  type: ChoixType;
  /** Ce qu'il faut choisir (« Couleur de la peinture », « Référence du carrelage »…). */
  libellé: string;
  raison: string;
  lot: string;
  pièce?: string;
  statut: ChoixStatut;
  niveauConfiance: NiveauConfiance;
  /** Options préparées par le conducteur (vide au départ — jamais inventées). */
  options: string[];
  sources: SourceContrat[];
}

/** Familles où le CLIENT choisit typiquement (finitions / équipements visibles). */
const CHOIX_FAMILLES = [
  'carrelage',
  'faience',
  'peinture',
  'parquet',
  'lame',
  'plinthe',
  'moquette',
  'receveur',
  'vasque',
  'lavabo',
  'meuble',
  'robinet',
  'mitigeur',
  'melangeur',
  'cuisine',
  'plan de travail',
  'luminaire',
  'applique',
  'spot',
  'bloc porte',
  'porte coulissante',
  'porte isoplane',
  'poignee',
  'facade',
];

/** Un intitulé relève-t-il d'une famille où le client choisit (mot entier) ? */
const familleChoix = (texte: string): boolean => motEntier(texte, CHOIX_FAMILLES);

const source = (d: DetailTechnique): SourceContrat => ({
  prestationSourceId: d.posteId,
  lotLabel: d.lotLabel,
  ...(d.sourcePage != null ? { sourcePage: d.sourcePage } : {}),
  extraitSource: d.extraitSource,
});

/**
 * Détecte les CHOIX probables à demander au client, sans jamais rien envoyer.
 * On ne signale un choix que si une donnée de finition est réellement absente ou
 * incertaine (couleur « à définir », gamme devinée, référence absente sur un
 * matériel visible). La référence part des MATÉRIELS commandables (pas des
 * consommables). Prudent : tout part au statut « À analyser ».
 */
function detecterChoix(
  details: DetailTechnique[],
  materiels: MaterielDetecte[],
): ChoixClientPotentiel[] {
  const out: ChoixClientPotentiel[] = [];
  const vus = new Set<string>();
  const push = (c: ChoixClientPotentiel): void => {
    const clé = `${c.type}|${strip(c.libellé)}|${c.lot}`;
    if (vus.has(clé)) return;
    vus.add(clé);
    out.push(c);
  };
  for (const d of details) {
    // Couleur « à définir » → choix de couleur (finition uniquement).
    if (d.couleur === 'à définir' && (familleChoix(d.lotLabel) || familleChoix(d.libellé)))
      push({
        type: 'couleur',
        libellé: `Couleur — ${d.lotLabel}`,
        raison: 'La teinte est indiquée « à définir » dans le contrat.',
        lot: d.lotLabel,
        statut: 'a_analyser',
        niveauConfiance: 'À vérifier',
        options: [],
        sources: [source(d)],
        ...(d.pièce ? { pièce: d.pièce } : {}),
      });
    // Gamme / marque devinée sur une finition → choix de gamme.
    if (
      (d.type === 'gamme' || d.type === 'marque') &&
      d.niveauConfiance === 'À vérifier' &&
      familleChoix(d.lotLabel)
    )
      push({
        type: 'gamme',
        libellé: `Gamme / modèle — ${d.lotLabel}`,
        raison: `Gamme lue « ${d.libellé} » mais à confirmer avec le client.`,
        lot: d.lotLabel,
        statut: 'a_analyser',
        niveauConfiance: 'À vérifier',
        options: [],
        sources: [source(d)],
        ...(d.pièce ? { pièce: d.pièce } : {}),
      });
  }
  // Référence absente sur un MATÉRIEL de finition/équipement visible → choix.
  for (const m of materiels) {
    if (m.référence || !familleChoix(m.désignation)) continue;
    push({
      type: 'référence',
      libellé: `Référence — ${m.désignation}`,
      raison: 'Aucune référence produit précise au contrat.',
      lot: m.lot,
      statut: 'a_analyser',
      niveauConfiance: 'À vérifier',
      options: [],
      sources: m.sources,
      ...(m.pièce ? { pièce: m.pièce } : {}),
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 * 4) CHECK-LIST DE PRÉPARATION (Mission 16)
 * -------------------------------------------------------------------------- */
export const CHECKLIST_STATUTS = [
  'a_faire',
  'en_attente',
  'a_demander_client',
  'a_commander',
  'commande',
  'receptionne',
  'termine',
  'sans_objet',
] as const;
export type ChecklistStatut = (typeof CHECKLIST_STATUTS)[number];

export const CHECKLIST_STATUT_LABEL: Record<ChecklistStatut, string> = {
  a_faire: 'À faire',
  en_attente: 'En attente',
  a_demander_client: 'À demander au client',
  a_commander: 'À commander',
  commande: 'Commandé',
  receptionne: 'Réceptionné',
  termine: 'Terminé',
  sans_objet: 'Sans objet',
};

/** Un élément de check-list DÉRIVÉ du contrat (enrichit la check-list commune). */
export interface ElementChecklist {
  libellé: string;
  statut: ChecklistStatut;
  origineLot: string;
  raison: string;
  niveauConfiance: NiveauConfiance;
  prestationSourceId?: string;
  sourcePage?: number;
}

/** Modèles de check-list par famille de lot (déterministes, prudents). */
const CHECKLIST_PAR_FAMILLE: Record<FamilleLot, { libellé: string; statut: ChecklistStatut }[]> = {
  electricite: [
    { libellé: 'Prévoir le Consuel (attestation de conformité électrique)', statut: 'a_faire' },
    { libellé: 'Contrôler le tableau électrique avant fermeture', statut: 'a_faire' },
  ],
  plomberie: [
    { libellé: 'Contrôler la livraison du receveur / sanitaires', statut: 'a_faire' },
    { libellé: 'Vérifier les évacuations avant fermeture', statut: 'a_faire' },
  ],
  carrelage: [
    {
      libellé: 'Faire valider le choix du carrelage / de la faïence par le client',
      statut: 'a_demander_client',
    },
    { libellé: "Contrôler l'étanchéité avant pose du carrelage", statut: 'a_faire' },
  ],
  peinture: [
    { libellé: 'Confirmer la référence / la teinte de peinture', statut: 'a_demander_client' },
  ],
  cuisine: [
    { libellé: 'Vérifier le délai de livraison de la cuisine', statut: 'a_faire' },
    { libellé: 'Programmer la pose de la cuisine', statut: 'en_attente' },
  ],
  menuiserie: [{ libellé: 'Vérifier le délai des menuiseries', statut: 'a_faire' }],
  ventilation: [{ libellé: 'Prévoir la mise en service de la VMC', statut: 'a_faire' }],
  platrerie: [],
  sols: [],
  autre: [],
};

function detecterChecklist(
  lots: { label: string; posteId?: string; sourcePage?: number }[],
): ElementChecklist[] {
  const out: ElementChecklist[] = [];
  const vus = new Set<string>();
  for (const lot of lots) {
    const fam = familleLot(lot.label);
    for (const modèle of CHECKLIST_PAR_FAMILLE[fam]) {
      const clé = strip(modèle.libellé);
      if (vus.has(clé)) continue;
      vus.add(clé);
      out.push({
        libellé: modèle.libellé,
        statut: modèle.statut,
        origineLot: lot.label,
        raison: `Dérivé du lot « ${lot.label} ».`,
        niveauConfiance: 'À vérifier',
        ...(lot.posteId ? { prestationSourceId: lot.posteId } : {}),
        ...(lot.sourcePage != null ? { sourcePage: lot.sourcePage } : {}),
      });
    }
  }
  // Éléments transverses (toujours utiles), sans prestation source.
  for (const g of [
    "Vérifier l'accès au chantier",
    'Prendre les photos avant fermeture des réseaux',
  ]) {
    out.push({
      libellé: g,
      statut: 'a_faire',
      origineLot: 'Chantier',
      raison: 'Préparation générale du chantier.',
      niveauConfiance: 'À vérifier',
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 * 5) POINTS DE VIGILANCE (Mission 17)
 * -------------------------------------------------------------------------- */
export interface PointVigilance {
  message: string;
  gravité: 'info' | 'attention';
  niveauConfiance: NiveauConfiance;
  lot?: string;
  prestationSourceId?: string;
  sourcePage?: number;
}

/** Familles à délai d'approvisionnement long (à anticiper). */
const DELAI_LONG: FamilleLot[] = ['cuisine', 'menuiserie'];
/** Mots-clés d'équipements nécessitant une mise en service / un contrôle. */
const MISE_EN_SERVICE = ['vmc', 'chauffe-eau', 'chauffe eau', 'climatiseur', 'tableau', 'ballon'];

function detecterVigilances(
  details: DetailTechnique[],
  materiels: MaterielDetecte[],
  lots: { label: string }[],
): PointVigilance[] {
  const out: PointVigilance[] = [];
  const vus = new Set<string>();
  const push = (v: PointVigilance): void => {
    const clé = strip(v.message);
    if (vus.has(clé)) return;
    vus.add(clé);
    out.push(v);
  };
  // Lots à délai long : à anticiper.
  for (const lot of lots) {
    if (DELAI_LONG.includes(familleLot(lot.label)))
      push({
        message: `Délai d'approvisionnement à anticiper pour « ${lot.label} » — à vérifier avec le conducteur.`,
        gravité: 'attention',
        niveauConfiance: 'À vérifier',
        lot: lot.label,
      });
  }
  // Équipements nécessitant une mise en service / un contrôle réglementaire.
  for (const d of details) {
    if (d.type !== 'équipement') continue;
    if (motEntier(d.libellé, MISE_EN_SERVICE))
      push({
        message: `Mise en service / contrôle réglementaire à prévoir pour « ${d.libellé} » — à vérifier.`,
        gravité: 'attention',
        niveauConfiance: 'À vérifier',
        lot: d.lotLabel,
        prestationSourceId: d.posteId,
        ...(d.sourcePage != null ? { sourcePage: d.sourcePage } : {}),
      });
  }
  // Quantités manquantes : une SEULE vigilance de synthèse (le détail « Quantité à
  // confirmer » figure déjà sur chaque matériel / ligne de commande).
  const sansQte = materiels.filter((m) => m.quantité == null).length;
  if (sansQte > 0)
    push({
      message: `${sansQte} matériel(s) sans quantité chiffrée lisible — à confirmer avant commande.`,
      gravité: 'info',
      niveauConfiance: 'À vérifier',
    });
  // Références manquantes sur des matériels visibles : synthèse.
  const sansRef = materiels.filter((m) => !m.référence && familleChoix(m.désignation)).length;
  if (sansRef > 0)
    push({
      message: `${sansRef} référence(s) produit à définir avec le client avant commande.`,
      gravité: 'attention',
      niveauConfiance: 'À vérifier',
    });
  return out;
}

/* -------------------------------------------------------------------------- *
 * 6) DOCUMENTS À RÉCUPÉRER (Mission 18)  &  7) PHOTOS RECOMMANDÉES (Mission 19)
 * -------------------------------------------------------------------------- */
export interface DocumentARecuperer {
  libellé: string;
  raison: string;
  origineLot: string;
}

export type PhotoPhase = 'avant' | 'pendant' | 'avant_fermeture' | 'apres' | 'controle';
export const PHOTO_PHASE_LABEL: Record<PhotoPhase, string> = {
  avant: 'Avant intervention',
  pendant: 'Pendant',
  avant_fermeture: 'Avant fermeture',
  apres: 'Après travaux',
  controle: 'Contrôle particulier',
};

export interface PhotoRecommandee {
  libellé: string;
  phase: PhotoPhase;
  raison: string;
  origineLot: string;
}

const DOCS_PAR_FAMILLE: Partial<Record<FamilleLot, string[]>> = {
  electricite: ['Attestation Consuel', 'Attestation de conformité électrique'],
  ventilation: ['Certificat de mise en service VMC', 'Notice / fiche technique'],
  cuisine: ['Fiche technique de la cuisine', 'Notice électroménager'],
  plomberie: ['Fiches techniques sanitaires'],
};

const PHOTOS_PAR_FAMILLE: Partial<Record<FamilleLot, { libellé: string; phase: PhotoPhase }[]>> = {
  electricite: [
    { libellé: 'Tableau électrique', phase: 'controle' },
    { libellé: 'Réseaux électriques avant fermeture', phase: 'avant_fermeture' },
  ],
  plomberie: [
    { libellé: 'Évacuations et raccordements avant fermeture', phase: 'avant_fermeture' },
  ],
  carrelage: [{ libellé: 'Étanchéité avant pose du carrelage', phase: 'avant_fermeture' }],
  platrerie: [{ libellé: 'Isolation avant fermeture', phase: 'avant_fermeture' }],
  ventilation: [{ libellé: 'Réseaux de ventilation avant fermeture', phase: 'avant_fermeture' }],
};

function detecterDocuments(lots: { label: string }[]): DocumentARecuperer[] {
  const out: DocumentARecuperer[] = [];
  const vus = new Set<string>();
  const push = (libellé: string, origineLot: string, raison: string): void => {
    const clé = strip(libellé);
    if (vus.has(clé)) return;
    vus.add(clé);
    out.push({ libellé, origineLot, raison });
  };
  for (const lot of lots)
    for (const doc of DOCS_PAR_FAMILLE[familleLot(lot.label)] ?? [])
      push(doc, lot.label, `Dérivé du lot « ${lot.label} ».`);
  // Documents transverses toujours utiles à la réception.
  for (const g of ['Garanties fournisseurs', 'PV de réception', 'Factures fournisseurs'])
    push(g, 'Chantier', 'Document de clôture / garantie recommandé.');
  return out;
}

function detecterPhotos(lots: { label: string }[]): PhotoRecommandee[] {
  const out: PhotoRecommandee[] = [];
  const vus = new Set<string>();
  for (const lot of lots)
    for (const p of PHOTOS_PAR_FAMILLE[familleLot(lot.label)] ?? []) {
      const clé = strip(p.libellé);
      if (vus.has(clé)) continue;
      vus.add(clé);
      out.push({
        libellé: p.libellé,
        phase: p.phase,
        origineLot: lot.label,
        raison: `Dérivé du lot « ${lot.label} ».`,
      });
    }
  return out;
}

/* -------------------------------------------------------------------------- *
 * PLAN COMPLET — « PHÉNIX 360 a préparé votre chantier »
 * -------------------------------------------------------------------------- */
export interface AssistantResume {
  materiels: number;
  commandes: number;
  choix: number;
  vigilances: number;
  documents: number;
  photos: number;
  controlesPreReception: number;
}

export interface AssistantChantierPlan {
  /** Le contrat est-il validé ? Sinon, tout est vide et l'assistant est bloqué. */
  contratValide: boolean;
  materiels: MaterielDetecte[];
  commandes: LigneCommande[];
  choix: ChoixClientPotentiel[];
  checklist: ElementChecklist[];
  vigilances: PointVigilance[];
  documents: DocumentARecuperer[];
  photos: PhotoRecommandee[];
  /** Nombre de prestations à contrôler en pré-réception (postes fermes actifs). */
  controlesPreReception: number;
  resume: AssistantResume;
}

const PLAN_VIDE: AssistantChantierPlan = {
  contratValide: false,
  materiels: [],
  commandes: [],
  choix: [],
  checklist: [],
  vigilances: [],
  documents: [],
  photos: [],
  controlesPreReception: 0,
  resume: {
    materiels: 0,
    commandes: 0,
    choix: 0,
    vigilances: 0,
    documents: 0,
    photos: 0,
    controlesPreReception: 0,
  },
};

/** Aplati les postes ACTIFS (devis validé + avenants) — postes remplacés exclus. */
function contratConsolide(
  devis: Devis,
  avenants: Avenant[],
): {
  lots: { label: string; posteId?: string; sourcePage?: number }[];
  postes: { poste: DevisPoste; lotLabel: string }[];
} {
  const consolidated = consolidateDevis(devis, avenants);
  const lots: { label: string; posteId?: string; sourcePage?: number }[] = [];
  const postes: { poste: DevisPoste; lotLabel: string }[] = [];
  for (const lot of consolidated.lots) {
    const actifs = lot.postes.filter((cp) => cp.replacedByNumero == null).map((cp) => cp.poste);
    const premier = actifs[0];
    lots.push({
      label: lot.label,
      ...(premier ? { posteId: premier.id } : {}),
      ...(premier?.sourcePage != null ? { sourcePage: premier.sourcePage } : {}),
    });
    for (const p of actifs) postes.push({ poste: p, lotLabel: lot.label });
  }
  return { lots, postes };
}

/**
 * PRÉPARE le chantier à partir du CONTRAT VALIDÉ (validatedDevis + avenants).
 * Renvoie un plan de BROUILLONS traçables ; rien n'est exécuté. Si aucun contrat
 * n'est validé, renvoie un plan vide marqué `contratValide: false`.
 */
export function preparerAssistantChantier(
  holder: ContractHolder | null | undefined,
  avenants: Avenant[] = [],
): AssistantChantierPlan {
  const devis = validatedDevis(holder ?? undefined);
  if (!devis) return PLAN_VIDE;

  const { lots, postes } = contratConsolide(devis, avenants);
  const details = postes.flatMap(({ poste, lotLabel }) => deriverDetailsPoste(poste, lotLabel));

  const materiels = detecterMateriels(details);
  const commandes = preparerCommandes(materiels);
  const choix = detecterChoix(details, materiels);
  const checklist = detecterChecklist(lots);
  const vigilances = detecterVigilances(details, materiels, lots);
  const documents = detecterDocuments(lots);
  const photos = detecterPhotos(lots);
  const controlesPreReception = postes.length;

  return {
    contratValide: true,
    materiels,
    commandes,
    choix,
    checklist,
    vigilances,
    documents,
    photos,
    controlesPreReception,
    resume: {
      materiels: materiels.length,
      commandes: commandes.length,
      choix: choix.length,
      vigilances: vigilances.length,
      documents: documents.length,
      photos: photos.length,
      controlesPreReception,
    },
  };
}
