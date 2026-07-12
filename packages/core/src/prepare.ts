/**
 * PHÉNIX 360 — PHÉNIX Start : préparation du chantier (modèle canonique)
 * ===========================================================================
 * « L'IA prépare. L'humain valide. » On ne crée plus un projet en remplissant
 * un formulaire : on dépose un dossier, PHÉNIX l'analyse et PROPOSE un projet
 * presque prêt (feuille de route, planning, commandes, choix client, documents,
 * questions). Rien n'est créé sans validation finale.
 *
 * Comme l'assistant (assistant.ts), l'analyse est injectable derrière un port
 * (`DossierAnalyzer`) : `mockAnalyzeDossier` ici (scénarisé, sans réseau) pour
 * la démo ; un fournisseur réel (LLM + OCR) viendra plus tard SANS changer
 * l'expérience ni les écrans.
 *
 * Note d'architecture : la feuille de route remplace la notion FIXE d'étapes
 * (gros œuvre / second œuvre / finitions). Chaque projet possède désormais sa
 * propre feuille de route, construite à partir du devis.
 */
import type { IsoDateTime } from './ids.js';
import type { EventAttachment } from './attachment.js';
import type {
  DecisionEventContent,
  DecisionEventKind,
  DecisionOrigin,
  Event,
  EventVisibility,
} from './event.js';
import { pendingClientDecisions } from './views.js';
import {
  avenantImpact,
  buildDevisSummary,
  describeAvenantImpact,
  devisVigilances,
  type Avenant,
  type Devis,
} from './devis.js';
import {
  MIN_READABLE_CHARS,
  buildDevisExtraction,
  extractDevisFields,
  type DevisExtraction,
} from './devis-extract.js';
import {
  contratValide,
  extractDevisContract,
  lotsValidesCount,
  validatedDevis,
  type LotStatut,
  type TotalsReconciliation,
} from './contract.js';
import {
  DEFAULT_CALENDAR,
  addCalendarDays,
  businessToCalendarDays,
  nextWorkingDay,
  nthWorkingDay,
  previousWorkingDay,
  type BusinessCalendar,
} from './calendar.js';

/* -------------------------------------------------------------------------- *
 * Feuille de route (étapes propres au projet)
 * -------------------------------------------------------------------------- */
export interface RoadmapStep {
  id: string;
  label: string;
}

/* -------------------------------------------------------------------------- *
 * Planning (proposé à partir des étapes + début + durée)
 * -------------------------------------------------------------------------- */
export interface PlanningTask {
  id: string;
  /** Étape de la feuille de route associée (si applicable). */
  stepId?: string;
  label: string;
  /** Dates ISO (YYYY-MM-DD). */
  start: string;
  end: string;
}

/* -------------------------------------------------------------------------- *
 * Commandes (fiches d'achat détectées dans le devis)
 * -------------------------------------------------------------------------- */
export const ORDER_STATUSES = [
  'a_commander',
  'commandee',
  'en_preparation',
  'expediee',
  'livree',
  'posee',
  'terminee',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  a_commander: 'À commander',
  commandee: 'Commandée',
  en_preparation: 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  posee: 'Posée',
  terminee: 'Terminée',
};

/** Statuts considérés comme « la commande est passée » (≠ à commander). */
export const ORDER_PLACED: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'commandee',
  'en_preparation',
  'expediee',
  'livree',
  'posee',
  'terminee',
]);
/** Statuts considérés comme « réceptionnée ». */
export const ORDER_RECEIVED: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'livree',
  'posee',
  'terminee',
]);

/**
 * Une COMMANDE est un objet vivant (pilier de PHÉNIX 360), reliée à une ou
 * plusieurs étapes de la feuille de route pour permettre l'anticipation.
 */
export interface Order {
  id: string;
  label: string;
  /** Fournisseur — un CONTACT de l'annuaire (source unique). */
  fournisseurContactId?: string;
  /**
   * Nom du fournisseur (instantané d'affichage / recherche). Le lien vivant est
   * `fournisseurContactId` ; ce libellé est maintenu depuis le contact, jamais
   * ressaisi une fois le contact choisi.
   */
  fournisseur?: string;
  reference?: string;
  quantite?: number;
  montant?: number;
  /** Lien vers le devis fournisseur (URL/fichier). */
  devisFournisseur?: string;
  /** Bon de commande (URL/fichier). */
  bonCommande?: string;
  /** Facture (URL/fichier). */
  facture?: string;
  /** Notice / documentation (URL/fichier). */
  notice?: string;
  garantie?: string;
  /** Numéro de suivi transporteur. */
  numeroSuivi?: string;
  /** Date de commande (ISO YYYY-MM-DD). */
  dateCommande?: string;
  /** Délai annoncé par le fournisseur, en jours. */
  delaiJours?: number;
  /** Date estimée de livraison (ISO). */
  dateLivraisonEstimee?: string;
  /** Date réelle de livraison (ISO). */
  dateLivraisonReelle?: string;
  /** Étapes de la feuille de route servies par cette commande. */
  stepIds?: string[];
  statut: OrderStatus;
}

/* -------------------------------------------------------------------------- *
 * Choix client (fiches alimentant l'espace client)
 * -------------------------------------------------------------------------- */
export const SELECTION_STATUSES = ['a_choisir', 'propose', 'valide'] as const;
export type SelectionStatus = (typeof SELECTION_STATUSES)[number];
export const SELECTION_STATUS_LABEL: Record<SelectionStatus, string> = {
  a_choisir: 'À choisir',
  propose: 'Proposé',
  valide: 'Validé',
};

/** Caractéristique d'une proposition (couleur, matériau, finition…). */
export interface SelectionOptionAttribute {
  label: string;
  value: string;
}

/**
 * Une PROPOSITION client (ambiance soigneusement préparée) — brique générique
 * valable pour tout choix : cuisine, carrelage, parquet, peinture, sanitaires,
 * luminaires, mobilier, poignées, robinetterie… Jamais un formulaire : une
 * sélection visuelle. La photo est facultative (tuile éditoriale en attendant).
 */
export interface SelectionOption {
  id: string;
  /** Repère affiché (A, B, C…). */
  ref?: string;
  title: string;
  description?: string;
  /** Graine pour la tuile éditoriale déterministe (sans vraie image). */
  imageSeed?: string;
  /** Vraie image, quand elle existera. */
  imageUrl?: string;
  attributs?: SelectionOptionAttribute[];
}

export interface ClientSelection {
  id: string;
  categorie: string;
  label: string;
  statut: SelectionStatus;
  detail?: string;
  /** Explication libre du conducteur (le contexte de la décision, côté client). */
  contexte?: string;
  /** Photos qui illustrent la décision elle-même (data URLs), hors options. */
  photos?: string[];
  /** Jusqu'à 5 propositions présentées au client (A–E). */
  options?: SelectionOption[];
  /** Proposition retenue (id) — par le client, ou par PHÉNIX après délégation. */
  chosenOptionId?: string;
  /** Le client a délégué le choix à PHÉNIX (reste vrai même après arbitrage). */
  delegatedToPhenix?: boolean;
  /** Le client a demandé une modification : à renvoyer par le conducteur. */
  modificationRequested?: boolean;
  /** Commentaire libre laissé par le client en validant son choix (facultatif). */
  clientComment?: string;
}

/**
 * Proposition SIGNATURE « Je laisse PHÉNIX choisir pour moi » — toujours offerte,
 * en dernière position, sur CHAQUE décision client, HORS limite des 5. Transforme
 * la confiance (« fais comme tu veux ») en fonctionnalité : le client délègue le
 * choix à PHÉNIX, la décision est validée, et plus aucun rappel n'est envoyé.
 */
export const PHENIX_DELEGATE_ID = '__phenix_delegate__';
export const isPhenixDelegate = (optionId?: string): boolean => optionId === PHENIX_DELEGATE_ID;

/** Repère affiché d'une proposition (A, B, C…) selon sa position. */
export function optionRef(selection: ClientSelection, optionId: string): string {
  const opts = selection.options ?? [];
  const i = opts.findIndex((o) => o.id === optionId);
  if (i < 0) return '';
  return opts[i]!.ref ?? String.fromCharCode(65 + i);
}

/**
 * Critères d'évaluation d'une proposition (catalogue des raisons possibles).
 * PHÉNIX justifie chaque recommandation avec 3 à 4 de ces critères.
 */
export const RECO_REASONS = {
  style: 'cohérence avec le style général du projet',
  budget: 'respect du budget',
  entretien: "facilité d'entretien",
  delai: 'disponibilité et délai',
  harmonie: 'harmonie avec les autres choix',
  robustesse: 'robustesse dans le temps',
  premium: 'rendu premium',
  miseEnOeuvre: 'simplicité de mise en œuvre',
} as const;
export type RecoReasonKey = keyof typeof RECO_REASONS;
const RECO_REASON_KEYS = Object.keys(RECO_REASONS) as RecoReasonKey[];

/** Score déterministe 0–100 pour une graine (placeholder du futur moteur). */
function recoScore(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 101;
}

/**
 * Le client a délégué : PHÉNIX recommande la proposition la plus cohérente et la
 * justifie (3–4 raisons). Sélecteur PUR. V1 DÉTERMINISTE mais MODEL-READY : on
 * note chaque proposition par critère, on retient la meilleure et ses meilleurs
 * critères comme raisons. Un vrai moteur (style + budget + harmonie réels)
 * remplacera `recoScore` SANS changer la sortie ni l'UI.
 */
export interface DelegationRecommendation {
  optionId: string;
  ref: string;
  title: string;
  /** Critères retenus (traçables / branchables au vrai moteur). */
  reasonKeys: RecoReasonKey[];
  /** Libellés lisibles des critères retenus. */
  reasons: string[];
}
export function recommendDelegatedOption(
  selection: ClientSelection,
): DelegationRecommendation | null {
  const opts = selection.options ?? [];
  if (opts.length === 0) return null;

  // Note chaque proposition, critère par critère (placeholder du moteur PHÉNIX).
  const scored = opts.map((o, i) => {
    const perCriterion = RECO_REASON_KEYS.map((k) => ({
      k,
      score: recoScore(`${selection.id}:${o.id}:${k}`),
    }));
    const total = perCriterion.reduce((a, c) => a + c.score, 0);
    return { o, i, perCriterion, total };
  });

  const best = scored.reduce((a, b) => (b.total > a.total ? b : a));
  const count = 3 + (recoScore(`${selection.id}:n`) % 2); // 3 ou 4 raisons
  const reasonKeys = [...best.perCriterion]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((c) => c.k);

  return {
    optionId: best.o.id,
    ref: best.o.ref ?? String.fromCharCode(65 + best.i),
    title: best.o.title,
    reasonKeys,
    reasons: reasonKeys.map((k) => RECO_REASONS[k]),
  };
}

/* -------------------------------------------------------------------------- *
 * JOURNAL — fabrique et projection des événements de DÉCISION (source unique)
 * -------------------------------------------------------------------------- *
 * Une seule fabrique construit le contenu structuré ; un seul projecteur le rend
 * lisible. Toutes les vues lisent ces champs, aucune ne recopie de texte.
 */

/** Visibilité par type d'action : ce que le client voit dans son récit. */
const DECISION_VISIBILITY: Record<DecisionEventKind, EventVisibility> = {
  envoyee: 'interne', // mécanique conducteur (le client le vit via le bandeau)
  renvoyee: 'interne',
  reco_confirmee: 'interne',
  validee: 'client', // action du client → visible dans son récit
  deleguee: 'client',
  modification: 'client',
};
export const decisionVisibility = (kind: DecisionEventKind): EventVisibility =>
  DECISION_VISIBILITY[kind];

/** Construit le contenu structuré d'un événement de décision (fabrique unique). */
export function buildDecisionContent(args: {
  kind: DecisionEventKind;
  origin: DecisionOrigin;
  selection: ClientSelection;
  statutApres: SelectionStatus;
  optionId?: string;
  message?: string;
}): DecisionEventContent {
  const { kind, origin, selection, statutApres, optionId, message } = args;
  const opt = optionId ? (selection.options ?? []).find((o) => o.id === optionId) : undefined;
  const optionLabel = isPhenixDelegate(optionId) ? 'PHÉNIX décide' : opt?.title;
  return {
    kind,
    origin,
    selectionId: selection.id,
    categorie: selection.categorie,
    statutAvant: selection.statut,
    statutApres,
    ...(optionId ? { optionId } : {}),
    ...(optionLabel ? { optionLabel } : {}),
    ...(message ? { message } : {}),
  };
}

/** Projette un événement de décision en titre + description (lecture unique). */
export function describeDecisionEvent(c: DecisionEventContent): {
  title: string;
  description: string;
} {
  const cat = c.categorie.toLowerCase();
  const retenu = c.optionLabel ? ` : ${c.optionLabel}` : '';
  switch (c.kind) {
    case 'envoyee':
      return {
        title: 'Décision envoyée au client',
        description: `Choix ${cat} — propositions transmises.`,
      };
    case 'renvoyee':
      return {
        title: 'Propositions renvoyées au client',
        description: `Choix ${cat} — mises à jour après modification.`,
      };
    case 'validee':
      return { title: 'Choix validé par le client', description: `Choix ${cat}${retenu}.` };
    case 'deleguee':
      return {
        title: 'Choix confié à PHÉNIX',
        description: `Le client a confié le choix ${cat} à PHÉNIX.`,
      };
    case 'modification':
      return {
        title: 'Modification demandée par le client',
        description: `Choix ${cat}${c.message ? ` : ${c.message}` : ''}.`,
      };
    case 'reco_confirmee':
      return {
        title: 'Recommandation PHÉNIX confirmée',
        description: `Choix ${cat}${retenu} retenu après délégation du client.`,
      };
  }
}

/**
 * Mot adapté au type de choix pour présenter les propositions au client (toujours
 * féminin → « celle que vous préférez ») :
 *   • cuisine / décoration / mobilier      → « ambiances »
 *   • carrelage / parquet / peinture       → « propositions »
 *   • robinetterie / sanitaires / luminaires → « options »
 */
export function proposalNoun(categorie: string): 'ambiances' | 'propositions' | 'options' {
  const c = categorie.toLowerCase();
  if (/cuisine|d[ée]co|mobilier|meuble|dressing|am[ée]nagement/.test(c)) return 'ambiances';
  if (
    /robinet|sanitaire|vasque|douche|luminaire|[ée]clairage|poign[ée]e|interrupteur|prise/.test(c)
  )
    return 'options';
  return 'propositions';
}

/* -------------------------------------------------------------------------- *
 * Documents (jamais bloquant — chaque document a un état)
 * -------------------------------------------------------------------------- */
export const DOCUMENT_STATUSES = [
  'fourni',
  'demande_client',
  'non_applicable',
  'a_fournir',
  'manquant',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  fourni: 'Fourni',
  demande_client: 'Demandé au client',
  non_applicable: 'Non applicable',
  a_fournir: 'À fournir plus tard',
  manquant: 'Recommandé mais manquant',
};

/** Pastille de couleur (présentation) — l'UI mappe sur les tokens. */
export const DOCUMENT_STATUS_TONE: Record<
  DocumentStatus,
  'success' | 'warning' | 'neutral' | 'info' | 'danger'
> = {
  fourni: 'success',
  demande_client: 'warning',
  non_applicable: 'neutral',
  a_fournir: 'info',
  manquant: 'danger',
};

/** Familles de documents d'un chantier (préparation). */
export const PREP_DOC_CATEGORIES = [
  'devis',
  'acompte',
  'facture_finale',
  'plan',
  'diagnostic',
  'dpe',
  'assurance',
  'contrat',
  'photo_avant',
  'autre',
] as const;
export type PrepDocCategory = (typeof PREP_DOC_CATEGORIES)[number];

export const PREP_DOC_CATEGORY_LABEL: Record<PrepDocCategory, string> = {
  devis: 'Devis',
  acompte: 'Acompte',
  facture_finale: 'Facture finale',
  plan: 'Plan',
  diagnostic: 'Diagnostic',
  dpe: 'DPE',
  assurance: 'Assurance',
  contrat: 'Contrat',
  photo_avant: 'Photo avant travaux',
  autre: 'Autre',
};

/**
 * Un document vaut-il PREUVE D'ACOMPTE ? Soit classé explicitement « Acompte »
 * (catégorie), soit reconnu au libellé (rétro-compat des dossiers existants et de
 * l'analyse du devis). Source unique de la règle « Acompte reçu » (checklist de
 * partage client + cockpit de préparation), pour ne jamais diverger.
 */
export const isAcompteDocument = (doc: ProjectDocument): boolean =>
  doc.categorie === 'acompte' || /acompte|arrhes/i.test(doc.label);

export interface ProjectDocument {
  id: string;
  label: string;
  status: DocumentStatus;
  /** Indispensable au démarrage / à la sécurité ? (jamais bloquant sinon). */
  recommande?: boolean;
  /** Famille de document (devis, plan, diagnostic, DPE, assurance…). */
  categorie?: PrepDocCategory;
  /**
   * Fichier fourni → référence l'événement `document` du Journal (base UNIQUE des
   * fichiers, `vault`). La checklist ne stocke plus le fichier : elle suit
   * l'obtention et pointe vers la bibliothèque. Consolidation Documents (04/07) —
   * le fichier remonte ainsi au Journal et (si partagé) au client.
   */
  eventId?: string;
  /**
   * DÉPRÉCIÉ pour les documents (remplacé par `eventId`). Encore utilisé par la
   * catégorie `photo_avant`, en attendant la consolidation Photos (#3).
   */
  attachment?: EventAttachment;
}

/* -------------------------------------------------------------------------- *
 * Questions de l'IA (jamais inventer : demander)
 * -------------------------------------------------------------------------- */
export interface PreparationQuestion {
  id: string;
  question: string;
  /** Champ d'`infos` que la réponse renseignerait (optionnel). */
  field?: keyof ProjectInfos;
  answered: boolean;
  answer?: string;
}

/* -------------------------------------------------------------------------- *
 * Informations générales
 * -------------------------------------------------------------------------- */
export interface ProjectInfos {
  clientName?: string;
  phone?: string;
  email?: string;
  address?: string;
  propertyType?: string;
  /** Surface en m². */
  surface?: number;
  /** Budget en €. */
  budget?: number;
  /** Durée annoncée (texte libre, ex. « 3 mois »). */
  duration?: string;
  /** Date de début souhaitée (ISO YYYY-MM-DD). */
  startDate?: string;
}

/* -------------------------------------------------------------------------- *
 * Mémoire du projet (ce que l'assistant « connaît »)
 * -------------------------------------------------------------------------- */
export interface ProjectMemory {
  travaux: string[];
  materiaux: string[];
  choix: string[];
  commandes: string[];
  documents: string[];
  garanties: string[];
}

/* -------------------------------------------------------------------------- *
 * Dossier préparé + proposition
 * -------------------------------------------------------------------------- */
/**
 * Intervenants du chantier (artisans, fournisseurs, architecte…) : ce ne sont
 * plus des entrées texte du dossier mais des **Contacts** de l'annuaire, liés au
 * chantier (source unique — cf. `Contact`, `contactsOf`). Le Carnet du chantier
 * les présente et les rend joignables. Plus de `SousTraitant` / `Fournisseur`.
 */

/** Un point de lancement MANUEL ajouté par le conducteur (check-list). */
export interface ChecklistManuel {
  id: string;
  label: string;
  done: boolean;
}

/**
 * Check-list de lancement STANDARD PHÉNIX — les CONTRÔLES QUALITÉ internes,
 * préremplis à la création de CHAQUE chantier (le conducteur n'a jamais une
 * check-list vide). Ils ne BLOQUENT JAMAIS : les 3 bloquants (devis signé ·
 * acompte reçu · date de démarrage) vivent dans la check-list de PARTAGE, seuls
 * à piloter l'ouverture de l'espace client et le passage « En cours ». Ici, le
 * conducteur coche à son rythme, ajoute ses propres points, ou en retire.
 */
export const PHENIX_LAUNCH_CHECKLIST: readonly string[] = [
  'Clés récupérées',
  'Déclaration de travaux effectuée (si nécessaire)',
  'Panneau de chantier posé',
  'Sous-traitants informés',
  'Commandes principales passées',
  'Accès chantier confirmé',
];

/** Une COPIE fraîche de la check-list standard (ids stables, tout décoché). */
export const defaultLaunchChecklist = (): ChecklistManuel[] =>
  PHENIX_LAUNCH_CHECKLIST.map((label, i) => ({ id: `chk-${i + 1}`, label, done: false }));

export interface ProjectDossier {
  infos: ProjectInfos;
  roadmap: RoadmapStep[];
  planning: PlanningTask[];
  orders: Order[];
  selections: ClientSelection[];
  documents: ProjectDocument[];
  questions: PreparationQuestion[];
  /** Points de lancement manuels du conducteur (en plus des vérifs automatiques). */
  checklist?: ChecklistManuel[];
  /** Budget prévisionnel saisi (sinon dérivé du total TTC devis + avenants). */
  budgetPrevisionnel?: number;
  /** Lecture structurée du devis signé (lots, postes, montants, TVA). */
  devis?: Devis;
  /**
   * Statut global HÉRITÉ (avant la validation par lot) : `brouillon` / `valide`.
   * La validation se fait désormais PAR LOT (`DevisLot.statut`) ; ce champ ne sert
   * qu'à interpréter les lots dépourvus de statut (données historiques/démo). Voir
   * `lotValide` / `devisStatutGlobal` / `contratValide`.
   */
  devisStatut?: LotStatut;
  /** Vérification des totaux du devis analysé (somme des lignes vs déclaré). */
  reconciliation?: TotalsReconciliation;
  /**
   * Avenants signés (append-only). Chacun est un nouveau devis lié à l'initial :
   * il ajoute des postes, peut en remplacer (le poste d'origine reste visible).
   * On ne modifie JAMAIS le devis initial.
   */
  avenants?: Avenant[];
  /** Noms des fichiers déposés (traçabilité de l'analyse). */
  sources: string[];
  createdAt: IsoDateTime;
}

/** Ce que PHÉNIX PROPOSE (pas encore le projet). */
export interface ProjectProposal {
  projectName: string;
  dossier: ProjectDossier;
  /**
   * Compte rendu de la LECTURE RÉELLE du devis (ce qui a été extrait, ce qui
   * manque, confiance). Présent dès qu'un document a été analysé ; absent en
   * création rapide. Transitoire (affiché à la préparation), non persisté.
   */
  extraction?: DevisExtraction;
}

/** Étapes scénarisées de l'écran d'analyse (présentation). */
export const PREPARATION_STAGES: { icon: string; label: string }[] = [
  { icon: '📄', label: 'Lecture des documents' },
  { icon: '👤', label: 'Identification du client' },
  { icon: '📍', label: "Recherche de l'adresse" },
  { icon: '🏠', label: 'Analyse du bien' },
  { icon: '🔨', label: 'Détection des travaux' },
  { icon: '📦', label: 'Détection des commandes' },
  { icon: '🎨', label: 'Détection des choix client' },
  { icon: '📅', label: 'Construction du planning' },
  { icon: '📂', label: 'Vérification des documents' },
  { icon: '✨', label: 'PHÉNIX mémorise votre chantier' },
];

/* -------------------------------------------------------------------------- *
 * Sélecteurs purs (réutilisables UI + assistant)
 * -------------------------------------------------------------------------- */
const DAY_MS = 86_400_000;
const iso = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Construit un planning séquentiel à partir de la feuille de route, d'une date
 * de début et d'une durée totale (jours). Dépendances logiques simplifiées :
 * les étapes s'enchaînent, pondérées également. Proposition modifiable.
 */
export function buildPlanning(
  roadmap: RoadmapStep[],
  startDate: string,
  totalDays: number,
): PlanningTask[] {
  if (roadmap.length === 0) return [];
  const per = Math.max(1, Math.floor(totalDays / roadmap.length));
  const start = new Date(`${startDate}T00:00:00`);
  let cursor = 0;
  return roadmap.map((step, i) => {
    const s = new Date(start.getTime() + cursor * DAY_MS);
    const span = i === roadmap.length - 1 ? Math.max(1, totalDays - cursor) : per;
    const e = new Date(start.getTime() + (cursor + span - 1) * DAY_MS);
    cursor += span;
    return {
      id: `task-${step.id}`,
      stepId: step.id,
      label: step.label,
      start: iso(s),
      end: iso(e),
    };
  });
}

/* -------------------------------------------------------------------------- *
 * PLANNING INTELLIGENT — une conséquence de tout ce qui a été préparé
 * -------------------------------------------------------------------------- *
 * Pas une table de dates : un planning DÉRIVÉ (sélecteur pur, vivant) qui tient
 * compte des dépendances métier (ordre des lots + durées réalistes), des temps
 * de séchage incompressibles, des délais de commande (« à commander avant »),
 * et des choix client à figer avant chaque étape. Durées heuristiques (démo) —
 * une vraie IA pourra les affiner, même sortie.
 */
export const parseDurationDays = (duration?: string): number => {
  if (!duration) return 60;
  const m = duration.match(/(\d+)\s*(mois|semaine|jour|an)/i);
  if (!m) {
    // Nombre nu (« 31 ») → jours calendaires : c'est une DURÉE, pas un défaut.
    // Sans le moindre chiffre, faute de repère, défaut prudent.
    const bare = duration.match(/\d+/);
    return bare ? Number(bare[0]) : 60;
  }
  const n = Number(m[1]);
  const u = (m[2] ?? '').toLowerCase();
  if (u.startsWith('an')) return n * 365;
  if (u.startsWith('mois')) return n * 30;
  if (u.startsWith('sem')) return n * 7;
  // Jours « ouvrés / ouvrables » → jours calendaires (5 j travaillés ≈ 7 j).
  if (/ouvr/i.test(duration)) return Math.round((n * 7) / 5);
  return n;
};

const STEP_DURATION: { re: RegExp; days: number }[] = [
  { re: /d[ée]pose|d[ée]molition/, days: 3 },
  { re: /gros|ma[çc]onn|structure|dalle|chape/, days: 12 },
  { re: /plomberie/, days: 6 },
  { re: /[ée]lectric/, days: 6 },
  { re: /isolation/, days: 4 },
  { re: /pl[âa]tr|placo|cloison/, days: 8 },
  { re: /menuiser/, days: 4 },
  { re: /carrelage|fa[iï]ence/, days: 7 },
  { re: /peinture/, days: 6 },
  { re: /\bsol|parquet|rev[êe]tement/, days: 4 },
  { re: /cuisine/, days: 3 },
  { re: /nettoyage/, days: 2 },
  { re: /r[ée]ception|livraison/, days: 1 },
];
const stepDuration = (label: string): number =>
  STEP_DURATION.find((d) => d.re.test(label.toLowerCase()))?.days ?? 5;
const stepDrying = (label: string): number => {
  const l = label.toLowerCase();
  if (/gros|dalle|chape/.test(l)) return 5; // séchage dalle/chape
  if (/pl[âa]tr|enduit/.test(l)) return 2; // séchage enduits
  if (/carrelage/.test(l)) return 2; // séchage colle
  return 0;
};

/** Rattache un choix client à l'étape qui le consomme (par mots-clés). */
const SELECTION_STEP: { re: RegExp; step: RegExp }[] = [
  { re: /carrelage/, step: /carrelage/ },
  { re: /fa[iï]ence/, step: /carrelage|fa[iï]ence/ },
  { re: /cuisine/, step: /cuisine/ },
  { re: /parquet|sol/, step: /\bsol|parquet|rev[êe]tement/ },
  { re: /peinture/, step: /peinture/ },
  { re: /sanitaire|robinet|vasque|douche|wc/, step: /plomberie|sanitaire/ },
  { re: /luminaire|[ée]clairage/, step: /[ée]lectric/ },
];

interface BasePhase {
  stepId: string;
  label: string;
  start: string;
  end: string;
  durationDays: number;
  drying?: number;
}

interface PhaseDuration {
  stepId: string;
  label: string;
  durationDays: number;
  drying?: number;
}

/**
 * Durées par étape (toujours disponibles, même sans date de démarrage) :
 * pondérées par métier + tampons de séchage. Ce sont des durées RÉALISTES — la
 * durée annoncée au client ne les raccourcit JAMAIS (une cuisine ne se pose pas
 * deux fois plus vite parce qu'on a annoncé un chantier plus court, les temps de
 * séchage et les délais fournisseurs sont incompressibles). PHÉNIX adapte le
 * planning à la réalité, pas l'inverse : l'écart avec la durée annoncée
 * devient une vigilance (cf. durationCheck), pas une compression.
 */
export function phaseDurations(dossier: ProjectDossier): PhaseDuration[] {
  if (dossier.roadmap.length === 0) return [];
  return dossier.roadmap.map((s) => ({
    stepId: s.id,
    label: s.label,
    durationDays: stepDuration(s.label),
    drying: stepDrying(s.label) || undefined,
  }));
}

/**
 * Estimation HONNÊTE de PHÉNIX, en jours CALENDAIRES (comparable à la durée
 * annoncée). Les durées métier sont en jours ouvrés → converties en calendaire
 * (week-ends inclus) ; les séchages sont déjà calendaires (incompressibles).
 * SANS aucune mise à l'échelle sur la durée annoncée : c'est le calcul propre
 * de PHÉNIX, confronté ensuite à l'engagement pris auprès du client.
 */
export function estimateRawDays(dossier: ProjectDossier): number {
  const work = dossier.roadmap.reduce((a, s) => a + stepDuration(s.label), 0);
  const drying = dossier.roadmap.reduce((a, s) => a + stepDrying(s.label), 0);
  return businessToCalendarDays(work) + drying;
}

/** Phrase courte pour une durée (« 9 semaines », « 2 mois », « 10 jours »). */
export function describeDuration(days: number): string {
  if (days <= 0) return '—';
  if (days < 14) return `${days} jour${days > 1 ? 's' : ''}`;
  if (days < 60) return `environ ${Math.round(days / 7)} semaines`;
  return `environ ${Math.round(days / 30)} mois`;
}

/**
 * Confronte la durée ANNONCÉE au client (notre engagement, connu dès le devis)
 * et l'estimation réaliste de PHÉNIX. Le raisonnement est ASYMÉTRIQUE : la
 * durée annoncée prime. PHÉNIX ne cherche pas à finir au plus vite, mais à
 * tenir l'engagement tout en réalisant un chantier de qualité.
 *   • estimation ≤ durée annoncée → aucune alerte. L'écart est une MARGE de
 *     sécurité confortable (imprévus, retards fournisseurs, levée de réserves).
 *   • estimation > durée annoncée → VIGILANCE : l'engagement paraît ambitieux.
 * Même règle pour le planning ET la note de lancement (pas de divergence).
 */
const DURATION_RISK_RATIO = 0.1; // tolérance avant de juger l'engagement « ambitieux »
const MARGIN_RATIO = 0.1; // marge à partir de laquelle on la signale comme confortable
export function durationCheck(dossier: ProjectDossier): {
  announcedLabel: string | null;
  announcedDays: number | null;
  estimatedDays: number;
  /** L'estimation dépasse nettement la durée annoncée → engagement à risque. */
  risk: boolean;
  /** Jours de marge disponibles (durée annoncée − estimation), ≥ 0. */
  marginDays: number;
  /** Une marge de sécurité confortable existe (sans aucun risque). */
  comfortable: boolean;
} {
  const announcedLabel = dossier.infos.duration ?? null;
  const announcedDays = announcedLabel ? parseDurationDays(announcedLabel) : null;
  const estimatedDays = estimateRawDays(dossier);
  const hasBoth = announcedDays != null && estimatedDays > 0;
  const risk = hasBoth ? estimatedDays > announcedDays * (1 + DURATION_RISK_RATIO) : false;
  const marginDays = hasBoth && announcedDays > estimatedDays ? announcedDays - estimatedDays : 0;
  const comfortable = hasBoth && !risk && marginDays > announcedDays * MARGIN_RATIO;
  return { announcedLabel, announcedDays, estimatedDays, risk, marginDays, comfortable };
}

/**
 * Résumé express du dossier, affiché juste après l'analyse du devis — avant même
 * le planning. En quelques lignes, le conducteur voit si le chantier est
 * confortable ou tendu : durée annoncée ⇆ durée réaliste, étapes, commandes
 * critiques, décisions client à obtenir, principal risque. Sélecteur PUR.
 */
export interface DossierSummary {
  /** Durée annoncée au client (libellé saisi), si connue. */
  announcedLabel: string | null;
  /** Durée réaliste estimée par PHÉNIX (jours calendaires). */
  estimatedDays: number;
  /** L'engagement client paraît ambitieux (estimation > durée annoncée). */
  durationRisk: boolean;
  /** Marge de sécurité disponible (jours), si la durée annoncée est confortable. */
  marginDays: number;
  steps: number;
  /** Commandes à passer dont le délai fournisseur est long (≥ 21 j). */
  criticalOrders: number;
  /** Choix client à obtenir + décisions client en attente. */
  clientDecisions: number;
  /** Risque principal (commande au délai le plus long encore à passer). */
  mainRisk: string | null;
}

const CRITICAL_DELAY_DAYS = 21;
export function buildDossierSummary(dossier: ProjectDossier, events: Event[] = []): DossierSummary {
  const { announcedLabel, estimatedDays, risk, marginDays } = durationCheck(dossier);
  const critical = dossier.orders.filter(
    (o) => o.statut === 'a_commander' && (o.delaiJours ?? 0) >= CRITICAL_DELAY_DAYS,
  );
  const worst = critical.reduce<Order | null>(
    (acc, o) => (acc && (acc.delaiJours ?? 0) >= (o.delaiJours ?? 0) ? acc : o),
    null,
  );
  const toDecide = dossier.selections.filter((s) => s.statut !== 'valide').length;
  return {
    announcedLabel,
    estimatedDays,
    durationRisk: risk,
    marginDays,
    steps: dossier.roadmap.length,
    criticalOrders: critical.length,
    clientDecisions: toDecide + pendingClientDecisions(events).length,
    mainRisk: worst ? `${worst.label} (délai ${worst.delaiJours} j)` : null,
  };
}

/**
 * Dates par étape (« planning daté ») sur le CALENDRIER MÉTIER : les durées
 * métier s'écoulent en jours ouvrés (week-ends, fériés, ponts sautés), tandis
 * que les temps de séchage s'écoulent en jours calendaires (incompressibles,
 * y compris le week-end). [] tant que la date n'est pas fixée. Source commune
 * au planning ET aux alertes/vigilances (pas de dates divergentes).
 */
export function computePhaseDates(
  dossier: ProjectDossier,
  cal: BusinessCalendar = DEFAULT_CALENDAR,
): BasePhase[] {
  const start = dossier.infos.startDate;
  if (!start) return [];
  let cursor = nextWorkingDay(start, cal);
  return phaseDurations(dossier).map((d) => {
    const dry = d.drying ?? 0;
    const s = cursor;
    const e = nthWorkingDay(s, d.durationDays, cal); // durée métier en jours ouvrés
    // Séchage : jours calendaires après la fin des travaux ; on reprend ensuite
    // au premier jour ouvré disponible.
    cursor = nextWorkingDay(addCalendarDays(e, dry + 1), cal);
    return {
      stepId: d.stepId,
      label: d.label,
      start: s,
      end: e,
      durationDays: d.durationDays,
      drying: d.drying,
    };
  });
}

/* -------------------------------------------------------------------------- *
 * DÉCISIONS CLIENT DATÉES — chaque choix client a une date limite de décision
 * -------------------------------------------------------------------------- *
 * Une décision client n'est pas « à obtenir un jour » : elle a une échéance
 * précise, calée sur le calendrier métier. Si la décision alimente une commande
 * (ex. le choix du carrelage déclenche la commande du carrelage), il faut
 * décider assez tôt pour pouvoir COMMANDER (délai fournisseur) avant l'étape.
 * Sinon, il suffit de figer le choix un peu avant l'étape. Sélecteur PUR.
 */
const FIGER_BUFFER = 14; // jours avant l'étape pour figer un choix sans commande
const DECISION_ORDER_BUFFER = 3; // jours pour passer commande une fois la décision prise
const DECISION_SOON_DAYS = 10; // seuil « échéance proche »

/** Date limite de décision, sur le calendrier métier (jour ouvré). */
function decisionDeadline(
  stepStart: string,
  maxOrderDelai: number,
  cal: BusinessCalendar = DEFAULT_CALENDAR,
): string {
  const lead = maxOrderDelai > 0 ? maxOrderDelai + DECISION_ORDER_BUFFER : FIGER_BUFFER;
  return previousWorkingDay(addCalendarDays(stepStart, -lead), cal);
}

export type ClientDecisionStatus = 'obtenu' | 'a_obtenir' | 'proche' | 'en_retard';

export interface ClientDecision {
  id: string;
  categorie: string;
  label: string;
  /** Détail du choix proposé (le cas échéant). */
  detail: string | null;
  /** Statut brut du choix (a_choisir / propose / valide). */
  selectionStatus: SelectionStatus;
  /** Décision encore à obtenir (choix non validé). */
  pending: boolean;
  /** Le client peut agir : un choix lui a été PROPOSÉ (à valider ou amender). */
  clientActionable: boolean;
  /** Étape qui consomme la décision. */
  stepLabel: string | null;
  /** Date limite de décision (planning daté seulement), sur le calendrier métier. */
  decideAvant: string | null;
  status: ClientDecisionStatus;
  /** Contexte libre rédigé par le conducteur (le cas échéant). */
  contexte: string | null;
  /** Photos illustrant la décision (data URLs), hors options. */
  photos: string[];
  /** Propositions présentées au client (A–E), le cas échéant. */
  options: SelectionOption[];
  /** Option retenue par le client (id), une fois le choix validé. */
  chosenOptionId: string | null;
  /** Commentaire libre laissé par le client en validant (le cas échéant). */
  clientComment: string | null;
}

/**
 * Les décisions client, DATÉES. Chaque choix est rattaché à l'étape qui le
 * consomme ; sa date limite tient compte du délai fournisseur si la décision
 * déclenche une commande. Triées par urgence (échéance la plus proche d'abord).
 */
export function buildClientDecisions(
  dossier: ProjectDossier,
  nowMs: number = Date.now(),
  cal: BusinessCalendar = DEFAULT_CALENDAR,
): ClientDecision[] {
  const datedById = new Map(computePhaseDates(dossier, cal).map((p) => [p.stepId, p]));
  const phases = phaseDurations(dossier);

  const decisions = dossier.selections.map((s): ClientDecision => {
    const hay = `${s.categorie} ${s.label}`.toLowerCase();
    const rule = SELECTION_STEP.find((m) => m.re.test(hay));
    const phase = rule ? phases.find((p) => rule.step.test(p.label.toLowerCase())) : undefined;
    const datedPhase = phase ? datedById.get(phase.stepId) : undefined;
    // Une décision n'est « obtenue » qu'une fois VALIDÉE : un choix simplement
    // proposé attend encore la validation du client.
    const pending = s.statut !== 'valide';

    let decideAvant: string | null = null;
    if (datedPhase?.start) {
      const maxDelai = dossier.orders
        .filter((o) => (o.stepIds ?? []).includes(phase!.stepId))
        .reduce((m, o) => Math.max(m, o.delaiJours ?? 0), 0);
      decideAvant = decisionDeadline(datedPhase.start, maxDelai, cal);
    }

    let status: ClientDecisionStatus = pending ? 'a_obtenir' : 'obtenu';
    if (pending && decideAvant) {
      const limit = new Date(`${decideAvant}T00:00:00`).getTime();
      if (limit <= nowMs) status = 'en_retard';
      else if (limit - nowMs <= DECISION_SOON_DAYS * DAY_MS) status = 'proche';
    }

    return {
      id: s.id,
      categorie: s.categorie,
      label: s.label,
      detail: s.detail ?? null,
      selectionStatus: s.statut,
      pending,
      clientActionable: s.statut === 'propose',
      stepLabel: phase?.label ?? null,
      decideAvant,
      status,
      contexte: s.contexte ?? null,
      photos: s.photos ?? [],
      options: s.options ?? [],
      chosenOptionId: s.chosenOptionId ?? null,
      clientComment: s.clientComment ?? null,
    };
  });

  const rank: Record<ClientDecisionStatus, number> = {
    en_retard: 0,
    proche: 1,
    a_obtenir: 2,
    obtenu: 3,
  };
  return decisions.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.decideAvant && b.decideAvant) return a.decideAvant < b.decideAvant ? -1 : 1;
    return 0;
  });
}

export interface PlanningOrderMarker {
  orderId: string;
  label: string;
  /** Délai fournisseur annoncé (jours), si connu. */
  delaiJours?: number;
  /** Date limite pour commander (présente seulement si planning daté). */
  commanderAvant?: string;
  /** Trop tard / trop tendu et commande pas encore passée (mode daté). */
  risk?: boolean;
}
export interface PlanningChoiceMarker {
  selectionId: string;
  categorie: string;
  label: string;
  /** Date limite pour figer le choix (présente seulement si planning daté). */
  figerAvant?: string;
  /** Choix encore à faire. */
  pending: boolean;
}
export interface PlanningPhase extends PhaseDuration {
  /** Présents seulement quand la date de démarrage est fixée. */
  start?: string;
  end?: string;
  orders: PlanningOrderMarker[];
  choices: PlanningChoiceMarker[];
}
export interface SmartPlanning {
  /** false = planning préparé (sans dates) ; true = planning daté. */
  dated: boolean;
  startDate: string | null;
  phases: PlanningPhase[];
  /**
   * Réception estimée (fin du chantier) = démarrage + DURÉE (source de vérité).
   * Jamais dérivée de la somme des durées d'étapes. null tant que non daté.
   */
  endDate: string | null;
  /**
   * Pré-réception estimée = réception − fenêtre de levée des réserves (une
   * PROPORTION de la durée, jamais un nombre de jours figé). Jamais antérieure au
   * démarrage. null tant que non daté.
   */
  preReceptionDate: string | null;
  /** Nombre de jours retenu pour dater le chantier (durée annoncée, sinon estimation). */
  durationDays: number | null;
  /** Durée ANNONCÉE au client (jours) — cadrage connu dès le devis. null si non renseignée. */
  announcedDays: number | null;
  /** Libellé saisi de la durée annoncée (« 2 mois », « 45 jours ouvrés »). */
  announcedLabel: string | null;
  /** Estimation réaliste de PHÉNIX (jours calendaires) — pas une saisie. */
  estimatedDays: number;
  /** Vrai si l'engagement client paraît ambitieux (estimation > durée annoncée). */
  durationRisk: boolean;
  /** Marge de sécurité disponible (jours) si la durée annoncée est confortable. */
  marginDays: number;
  /** Une marge de sécurité confortable existe (sans risque). */
  comfortable: boolean;
}

/**
 * Fenêtre de LEVÉE DES RÉSERVES entre la pré-réception et la réception. C'est une
 * PROPORTION de la durée du chantier (règle métier), JAMAIS un nombre de jours
 * codé en dur : un long chantier laisse plus de temps pour lever les réserves
 * qu'un court. Bornée à au moins un jour, pour que la pré-réception précède
 * toujours la réception.
 */
const LEVEE_RESERVES_RATIO = 0.1;
const leveeReservesDays = (durationDays: number): number =>
  Math.max(1, Math.round(durationDays * LEVEE_RESERVES_RATIO));

/**
 * Dates de jalons du client, DÉRIVÉES DE LA DURÉE (source de vérité), jamais de
 * la somme des durées d'étapes :
 *  • réception (fin du chantier)      = démarrage + durée ;
 *  • pré-réception (avant la réception) = réception − fenêtre de levée des réserves,
 *    et JAMAIS antérieure au démarrage.
 * Renvoie { reception, preReception } = { null, null } tant que le chantier n'est
 * pas daté ou que la durée est inconnue.
 */
function receptionMilestones(
  startDate: string | null,
  durationDays: number | null,
): { reception: string | null; preReception: string | null } {
  if (!startDate || durationDays == null || durationDays <= 0) {
    return { reception: null, preReception: null };
  }
  const reception = addCalendarDays(startDate, durationDays);
  const pre = addCalendarDays(reception, -leveeReservesDays(durationDays));
  // Aucune date ne peut être antérieure au démarrage (chantiers très courts).
  const preReception = pre < startDate ? startDate : pre;
  return { reception, preReception };
}

/**
 * Le planning intelligent, en DEUX états :
 *  • préparé (pas de date de démarrage) → ordre, durées, dépendances, commandes
 *    à anticiper, décisions à obtenir — sans dates calendaires ;
 *  • daté (date validée) → dates de début/fin, dates limites de commande et de
 *    décision client. Dérivé du dossier (vivant), une seule source de vérité.
 */
export function buildSmartPlanning(
  dossier: ProjectDossier,
  nowMs: number = Date.now(),
): SmartPlanning {
  const durations = phaseDurations(dossier);
  const { announcedLabel, announcedDays, estimatedDays, risk, marginDays, comfortable } =
    durationCheck(dossier);
  // La DURÉE pilote le planning : durée annoncée au client si connue, sinon
  // l'estimation réaliste de PHÉNIX. C'est elle (et non la somme des étapes) qui
  // date la réception.
  const durationDays = announcedDays ?? (estimatedDays > 0 ? estimatedDays : null);
  const startDate = dossier.infos.startDate ?? null;
  const dated = Boolean(startDate);
  const { reception, preReception } = receptionMilestones(dated ? startDate : null, durationDays);

  if (durations.length === 0) {
    return {
      dated,
      startDate,
      phases: [],
      endDate: reception,
      preReceptionDate: preReception,
      durationDays,
      announcedDays,
      announcedLabel,
      estimatedDays,
      durationRisk: risk,
      marginDays,
      comfortable,
    };
  }
  const datedById = new Map(computePhaseDates(dossier).map((p) => [p.stepId, p]));

  const phases: PlanningPhase[] = durations.map((d) => {
    const dd = datedById.get(d.stepId);
    return { ...d, start: dd?.start, end: dd?.end, orders: [], choices: [] };
  });
  const byId = new Map(phases.map((p) => [p.stepId, p]));

  for (const o of dossier.orders) {
    const sid = (o.stepIds ?? []).find((id) => byId.has(id));
    if (!sid) continue;
    const ph = byId.get(sid)!;
    const marker: PlanningOrderMarker = { orderId: o.id, label: o.label, delaiJours: o.delaiJours };
    if (ph.start) {
      // Le délai fournisseur court en jours calendaires ; on cale la date
      // limite sur un jour ouvré (on ne « commande » pas un dimanche).
      const limit = previousWorkingDay(addCalendarDays(ph.start, -(o.delaiJours ?? 7)));
      marker.commanderAvant = limit;
      marker.risk = !ORDER_PLACED.has(o.statut) && new Date(`${limit}T00:00:00`).getTime() <= nowMs;
    }
    ph.orders.push(marker);
  }

  for (const s of dossier.selections) {
    const hay = `${s.categorie} ${s.label}`.toLowerCase();
    const rule = SELECTION_STEP.find((m) => m.re.test(hay));
    const ph = rule ? phases.find((p) => rule.step.test(p.label.toLowerCase())) : undefined;
    if (!ph) continue;
    const marker: PlanningChoiceMarker = {
      selectionId: s.id,
      categorie: s.categorie,
      label: s.label,
      pending: s.statut === 'a_choisir',
    };
    if (ph.start) {
      const maxDelai = ph.orders.reduce((m, o) => Math.max(m, o.delaiJours ?? 0), 0);
      marker.figerAvant = decisionDeadline(ph.start, maxDelai);
    }
    ph.choices.push(marker);
  }

  return {
    dated,
    startDate,
    phases,
    endDate: reception,
    preReceptionDate: preReception,
    durationDays,
    announcedDays,
    announcedLabel,
    estimatedDays,
    durationRisk: risk,
    marginDays,
    comfortable,
  };
}

/** Mémoire du projet = lecture du dossier (alimente l'assistant). */
export function buildProjectMemory(dossier: ProjectDossier): ProjectMemory {
  return {
    travaux: dossier.roadmap.map((s) => s.label),
    materiaux: dossier.orders.map((o) => o.label),
    choix: dossier.selections.map((s) => `${s.categorie} : ${s.label}`),
    commandes: dossier.orders.map(
      (o) =>
        `${o.label}${o.fournisseur ? ` — ${o.fournisseur}` : ''}${o.reference ? ` (réf. ${o.reference})` : ''} : ${ORDER_STATUS_LABEL[o.statut]}`,
    ),
    documents: dossier.documents.filter((d) => d.status === 'fourni').map((d) => d.label),
    garanties: dossier.orders.filter((o) => o.garantie).map((o) => `${o.label} : ${o.garantie}`),
  };
}

/* -------------------------------------------------------------------------- *
 * IA PROACTIVE sur les commandes — anticiper les oublis et les retards
 * -------------------------------------------------------------------------- *
 * PHÉNIX ne se contente pas d'enregistrer les commandes : il les surveille en
 * croisant le planning (dates d'étapes), les délais fournisseurs et l'état réel
 * des commandes. Sélecteur pur — la logique vit ici, jamais dans l'UI.
 */
export type OrderAlertSeverity = 'warning' | 'info' | 'success';

export interface OrderAlert {
  id: string;
  severity: OrderAlertSeverity;
  message: string;
  orderId?: string;
  stepId?: string;
}

const days = (a: number, b: number): number => Math.round((a - b) / DAY_MS);
/** Date courte en français (« 7 juillet ») pour les messages de briefing. */
const frShortDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const formatEuro = (n: number): string =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
const weeksOrDays = (d: number): string =>
  d >= 14 && d % 7 === 0
    ? `${d / 7} semaines`
    : d >= 14
      ? `${Math.round(d / 7)} semaines`
      : `${d} jour(s)`;

/**
 * Construit les alertes PHÉNIX sur les commandes. Déterministe (démo) :
 *  • livraison imminente / dépassée ;
 *  • étape qui approche alors que la commande n'est pas passée ;
 *  • délai fournisseur incompatible avec le début d'étape ;
 *  • phase dont les commandes sont au complet (positif).
 */
export function buildOrderAlerts(
  dossier: ProjectDossier,
  nowMs: number = Date.now(),
): OrderAlert[] {
  const alerts: OrderAlert[] = [];
  const stepStart = new Map<string, number>();
  for (const ph of computePhaseDates(dossier)) {
    stepStart.set(ph.stepId, new Date(`${ph.start}T00:00:00`).getTime());
  }
  const stepLabel = (id: string): string =>
    dossier.roadmap.find((s) => s.id === id)?.label ?? 'cette étape';

  for (const o of dossier.orders) {
    const placed = ORDER_PLACED.has(o.statut);
    const received = ORDER_RECEIVED.has(o.statut);

    // Livraison imminente / dépassée.
    if (o.dateLivraisonEstimee && !received) {
      const d = days(new Date(`${o.dateLivraisonEstimee}T00:00:00`).getTime(), nowMs);
      if (d >= 0 && d <= 14) {
        alerts.push({
          id: `liv-${o.id}`,
          severity: 'info',
          orderId: o.id,
          message: `${o.label} devrait être livrée dans ${d} jour(s).`,
        });
      } else if (d < 0) {
        alerts.push({
          id: `liv-${o.id}`,
          severity: 'warning',
          orderId: o.id,
          message: `${o.label} : livraison estimée dépassée de ${-d} jour(s).`,
        });
      }
    }

    // Étape qui approche / délai fournisseur incompatible.
    if (!placed) {
      for (const sid of o.stepIds ?? []) {
        const start = stepStart.get(sid);
        if (start == null) continue;
        const ds = days(start, nowMs);
        if (ds < 0) continue;
        if (o.delaiJours != null && ds < o.delaiJours) {
          alerts.push({
            id: `del-${o.id}-${sid}`,
            severity: 'warning',
            orderId: o.id,
            stepId: sid,
            message: `${o.label} est annoncée à ${weeksOrDays(o.delaiJours)} de délai, mais la phase ${stepLabel(sid)} commence dans ${weeksOrDays(ds)} — à commander rapidement.`,
          });
        } else if (ds <= 21) {
          alerts.push({
            id: `app-${o.id}-${sid}`,
            severity: 'warning',
            orderId: o.id,
            stepId: sid,
            message: `Le chantier approche de la phase ${stepLabel(sid)} mais ${o.label} n'est pas encore commandée.`,
          });
        }
      }
    }
  }

  // Phases dont toutes les commandes sont passées (positif).
  for (const step of dossier.roadmap) {
    const linked = dossier.orders.filter((o) => (o.stepIds ?? []).includes(step.id));
    if (linked.length > 0 && linked.every((o) => ORDER_PLACED.has(o.statut))) {
      const start = stepStart.get(step.id);
      if (start == null || days(start, nowMs) >= -7) {
        alerts.push({
          id: `ok-${step.id}`,
          severity: 'success',
          stepId: step.id,
          message: `Les commandes de la phase ${step.label} sont au complet.`,
        });
      }
    }
  }

  const rank: Record<OrderAlertSeverity, number> = { warning: 0, info: 1, success: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 6);
}

/* -------------------------------------------------------------------------- *
 * LA NOTE DE LANCEMENT — le « cerveau » de PHÉNIX avant le démarrage
 * -------------------------------------------------------------------------- *
 * Comme un conducteur de travaux senior qui aurait étudié le dossier avant la
 * réunion de lancement et laissé sa note de passation. Équilibrée : ce qui est
 * déjà préparé, ce qui rassure, ce qui mérite l'attention, ce qu'il conseille
 * de faire ensuite. Sélecteur PUR : recalculé à chaque évolution (avenant,
 * document, commande…) → la note reste VIVANTE, jamais une photo du jour 1.
 * Règles déterministes (démo) ; une vraie IA viendra derrière, même sortie.
 */
export type NoteKind =
  'commande' | 'document' | 'choix' | 'planning' | 'technique' | 'devis' | 'budget' | 'oubli';

export interface NoteFinding {
  id: string;
  kind: NoteKind;
  title: string;
}

export type NoteAction = { type: 'document'; docId: string } | { type: 'preparation' };

export interface NoteAdvice extends NoteFinding {
  action?: NoteAction;
}

export interface LaunchNote {
  prepared: {
    roadmap: number;
    orders: number;
    selections: number;
    documents: number;
    hasPlanning: boolean;
  };
  reassuring: NoteFinding[];
  attention: NoteFinding[];
  advice: NoteAdvice[];
}

export function studyProject(
  dossier: ProjectDossier | null,
  events: Event[],
  nowMs: number = Date.now(),
): LaunchNote {
  const reassuring: NoteFinding[] = [];
  const attention: NoteFinding[] = [];
  const advice: NoteAdvice[] = [];

  if (!dossier) {
    return {
      prepared: { roadmap: 0, orders: 0, selections: 0, documents: 0, hasPlanning: false },
      reassuring,
      attention,
      advice,
    };
  }

  const labels = dossier.roadmap.map((s) => s.label.toLowerCase());
  const hasStep = (re: RegExp): boolean => labels.some((l) => re.test(l));

  // Commandes : on réutilise le moteur d'alertes (vivant).
  for (const a of buildOrderAlerts(dossier, nowMs)) {
    if (a.severity === 'warning')
      attention.push({ id: `o-${a.id}`, kind: 'commande', title: a.message });
    else reassuring.push({ id: `o-${a.id}`, kind: 'commande', title: a.message });
  }

  // Lecture du devis signé (matière première) : ce que PHÉNIX en a extrait.
  if (dossier.devis) {
    const ds = buildDevisSummary(dossier.devis, dossier.avenants);
    reassuring.push({
      id: 'devis-lu',
      kind: 'devis',
      title: `J'ai lu le devis : ${ds.lots} lots, ${ds.postes} postes, ${formatEuro(ds.totalHT)} HT (${formatEuro(ds.totalTTC)} TTC).`,
    });
    if (ds.avenants > 0) {
      reassuring.push({
        id: 'devis-avenants',
        kind: 'devis',
        title: `${ds.avenants} avenant${ds.avenants > 1 ? 's' : ''} intégré${ds.avenants > 1 ? 's' : ''} au devis : le devis initial reste intact, les montants ci-dessus sont à jour.`,
      });
    }
    if (ds.orders > 0 || ds.selections > 0) {
      reassuring.push({
        id: 'devis-liens',
        kind: 'devis',
        title: `J'en ai déduit ${ds.orders} commande(s) et ${ds.selections} choix client à préparer.`,
      });
    }
    for (const v of devisVigilances(dossier.devis).slice(0, 2)) {
      attention.push({ id: v.id, kind: 'devis', title: v.message });
    }
  }

  // Ce qui rassure (confiance).
  if (dossier.roadmap.length > 0 && dossier.orders.length > 0) {
    reassuring.push({
      id: 'coherence',
      kind: 'devis',
      title: 'Le devis est cohérent avec la feuille de route.',
    });
  }
  const withMontant = dossier.orders.filter((o) => o.montant != null);
  if (dossier.infos.budget && withMontant.length >= 2) {
    reassuring.push({
      id: 'budget',
      kind: 'budget',
      title: `Le budget se répartit proprement sur ${withMontant.length} postes de commande.`,
    });
  }

  // Vigilances techniques & oublis fréquents.
  const sdb =
    dossier.selections.some((s) =>
      /bain|douche|sanitaire|fa[iï]ence/i.test(`${s.categorie} ${s.label}`),
    ) || hasStep(/carrelage|fa[iï]ence/);
  if (sdb && !hasStep(/[ée]tanch/)) {
    attention.push({
      id: 'etanch',
      kind: 'technique',
      title: "Salle de bain : je ne vois pas d'étanchéité prévue avant le carrelage.",
    });
    advice.push({
      id: 'etanch-a',
      kind: 'technique',
      title: "Vérifier l'étanchéité de la salle de bain avec le plombier avant la pose.",
    });
  }
  if (hasStep(/carrelage|\bsol|parquet/) && !hasStep(/chape|ragr[ée]|pr[ée]paration/)) {
    attention.push({
      id: 'chape',
      kind: 'technique',
      title: 'Pose de sol prévue sans préparation (chape / ragréage) détectée dans le devis.',
    });
  }
  if (!hasStep(/gravats|benne|[ée]vacuation/)) {
    attention.push({
      id: 'gravats',
      kind: 'oubli',
      title: 'Aucune évacuation des gravats détectée dans le devis.',
    });
    advice.push({
      id: 'gravats-a',
      kind: 'oubli',
      title: "Prévoir l'évacuation des gravats (benne) dès le début du chantier.",
    });
  }
  if (!hasStep(/nettoyage/)) {
    attention.push({
      id: 'nettoyage',
      kind: 'oubli',
      title: 'Pas d’étape de nettoyage de fin de chantier prévue.',
    });
  }

  // Documents manquants → attention + conseil actionnable.
  for (const d of dossier.documents) {
    if (d.status === 'manquant') {
      attention.push({
        id: `doc-${d.id}`,
        kind: 'document',
        title: `${d.label} : recommandé mais absent du dossier.`,
      });
      advice.push({
        id: `doc-a-${d.id}`,
        kind: 'document',
        title: `Demander ${d.label} au client.`,
        action: { type: 'document', docId: d.id },
      });
    }
  }

  // Choix client à obtenir.
  const aChoisir = dossier.selections.filter((s) => s.statut === 'a_choisir').length;
  if (aChoisir > 0) {
    attention.push({
      id: 'choix',
      kind: 'choix',
      title: `${aChoisir} choix client restent à obtenir au bon moment.`,
    });
    advice.push({
      id: 'choix-a',
      kind: 'choix',
      title: 'Obtenir les choix client avant les phases concernées.',
    });
  }
  for (const dec of pendingClientDecisions(events)) {
    attention.push({
      id: `dec-${dec.eventId}`,
      kind: 'choix',
      title: `Décision client en attente : ${dec.question}`,
    });
  }

  // Conseil de tête si des commandes sont tendues.
  if (attention.some((a) => a.kind === 'commande')) {
    advice.unshift({
      id: 'cmd-a',
      kind: 'commande',
      title: 'Lancer cette semaine les commandes dont le délai est tendu.',
      action: { type: 'preparation' },
    });
  }

  // Planning.
  if (!dossier.infos.startDate) {
    attention.push({
      id: 'startdate',
      kind: 'planning',
      title: "La date de début n'est pas encore fixée.",
    });
    advice.push({
      id: 'startdate-a',
      kind: 'planning',
      title: 'Fixer la date de début pour caler le planning et les commandes.',
    });
  } else {
    reassuring.push({
      id: 'planning-ok',
      kind: 'planning',
      title: 'Un planning prévisionnel est calé sur la date de début.',
    });
  }

  // Engagement client (durée annoncée) ⇆ estimation de PHÉNIX — asymétrique :
  // la durée annoncée prime ; on n'alerte que si elle paraît ambitieuse.
  const dur = durationCheck(dossier);
  if (dur.announcedLabel) {
    if (dur.risk) {
      attention.push({
        id: 'duree-ambitieuse',
        kind: 'planning',
        title: `Vous avez annoncé ${dur.announcedLabel} au client ; d'après mon analyse, ce chantier nécessite plutôt ${describeDuration(dur.estimatedDays)}.`,
      });
      advice.push({
        id: 'duree-a',
        kind: 'planning',
        title: 'Revoir le planning avant de le valider : la durée annoncée paraît ambitieuse.',
      });
    } else if (dur.comfortable) {
      reassuring.push({
        id: 'duree-marge',
        kind: 'planning',
        title: `La durée annoncée (${dur.announcedLabel}) laisse une marge de sécurité confortable (${describeDuration(dur.marginDays)}).`,
      });
    } else {
      reassuring.push({
        id: 'duree-ok',
        kind: 'planning',
        title: `Mon estimation tient dans la durée annoncée au client (${dur.announcedLabel}).`,
      });
    }
  }

  return {
    prepared: {
      roadmap: dossier.roadmap.length,
      orders: dossier.orders.length,
      selections: dossier.selections.length,
      documents: dossier.documents.length,
      hasPlanning: dossier.planning.length > 0,
    },
    reassuring: reassuring.slice(0, 5),
    attention: attention.slice(0, 6),
    advice: advice.slice(0, 6),
  };
}

/* -------------------------------------------------------------------------- *
 * SYNTHÈSE « PHÉNIX surveille votre chantier » (accueil Compagnon)
 * -------------------------------------------------------------------------- *
 * Une seule lecture, claire : « Voici ce qui mérite votre attention
 * aujourd'hui. » Agrège commandes, documents, questions, décisions client et
 * prochaines échéances. Sélecteur pur — la logique vit ici, jamais dans l'UI.
 */
export type AttentionKind =
  'commande' | 'document' | 'question' | 'decision' | 'echeance' | 'avenant';

/** Fenêtre de « fraîcheur » d'un avenant : il remonte au briefing tant qu'il est récent. */
const AVENANT_RECENT_DAYS = 30;

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  severity: OrderAlertSeverity;
  message: string;
  /** Document concerné (permet l'action « Demander au client »). */
  docId?: string;
  /** Détail d'impact d'un avenant (badge « +ajoutées / ~modifiées »). */
  avenant?: { added: number; replaced: number };
}

const ATTENTION_RANK: Record<OrderAlertSeverity, number> = { warning: 0, info: 1, success: 2 };

export function buildChantierAttention(
  dossier: ProjectDossier | null,
  events: Event[],
  nowMs: number = Date.now(),
): AttentionItem[] {
  const items: AttentionItem[] = [];
  // Catégories déjà couvertes par une décision DATÉE → évite le doublon avec une
  // demande du journal qui concerne exactement le même choix.
  const decidedCats = new Set<string>();

  if (dossier) {
    // Commandes (réutilise le moteur d'alertes).
    for (const a of buildOrderAlerts(dossier, nowMs)) {
      items.push({ id: `cmd-${a.id}`, kind: 'commande', severity: a.severity, message: a.message });
    }

    // Documents à demander.
    for (const d of dossier.documents) {
      if (d.status === 'manquant') {
        items.push({
          id: `doc-${d.id}`,
          kind: 'document',
          severity: 'warning',
          message: `Il manque un document recommandé : ${d.label}.`,
          docId: d.id,
        });
      } else if (d.status === 'a_fournir') {
        items.push({
          id: `doc-${d.id}`,
          kind: 'document',
          severity: 'info',
          message: `À fournir plus tard : ${d.label}.`,
          docId: d.id,
        });
      }
    }

    // Décisions client DATÉES dont l'échéance approche ou est dépassée : ce sont
    // des alertes prioritaires (sans elles, le planning glisse).
    for (const dec of buildClientDecisions(dossier, nowMs)) {
      if (dec.status !== 'proche' && dec.status !== 'en_retard') continue;
      const cat = dec.categorie.toLowerCase();
      decidedCats.add(cat);
      items.push({
        id: `cdec-${dec.id}`,
        kind: 'decision',
        severity: 'warning',
        message:
          dec.status === 'en_retard'
            ? `Le choix « ${cat} » est attendu — échéance dépassée${dec.decideAvant ? ` depuis le ${frShortDate(dec.decideAvant)}` : ''}.`
            : `Le choix « ${cat} » est attendu${dec.decideAvant ? ` avant le ${frShortDate(dec.decideAvant)}` : ''}.`,
      });
    }

    // Impact d'un avenant RÉCEMMENT intégré : PHÉNIX fait remonter ce qui mérite
    // vraiment l'attention (impact planning, commande à mettre à jour). Même
    // sélecteur d'impact que la mini-note : une seule source de calcul.
    for (const av of dossier.avenants ?? []) {
      if (av.date) {
        const age = days(nowMs, new Date(`${av.date}T00:00:00`).getTime());
        if (age > AVENANT_RECENT_DAYS) continue; // avenant ancien → déjà digéré
      }
      const before = (dossier.avenants ?? []).filter((a) => a.numero < av.numero);
      const impact = avenantImpact(dossier.devis, before, av);
      // Message porté par le sélecteur partagé : formulation déterministe
      // aujourd'hui, texte libre IA demain (cf. describeAvenantImpact).
      items.push({
        id: `avenant-${av.numero}`,
        kind: 'avenant',
        severity: 'warning',
        message: describeAvenantImpact(impact),
        avenant: { added: impact.postesAjoutes, replaced: impact.postesRemplaces },
      });

      // Une SEULE alerte commande, même si plusieurs commandes sont concernées
      // (le détail s'ouvre dans la fiche « Le devis »).
      if (impact.commandesAMettreAJour === 1) {
        const o = dossier.orders.find((x) => x.id === impact.commandeIds[0]);
        items.push({
          id: `avenant-cmd-${av.numero}`,
          kind: 'commande',
          severity: 'warning',
          message: `La commande « ${o?.label ?? 'concernée'} » est à actualiser suite à l'avenant n°${av.numero}.`,
        });
      } else if (impact.commandesAMettreAJour > 1) {
        items.push({
          id: `avenant-cmd-${av.numero}`,
          kind: 'commande',
          severity: 'warning',
          message: `${impact.commandesAMettreAJour} commandes sont à actualiser suite à l'avenant n°${av.numero}.`,
        });
      }
    }

    // Questions PHÉNIX en attente.
    for (const q of dossier.questions) {
      if (!q.answered) {
        items.push({ id: `q-${q.id}`, kind: 'question', severity: 'info', message: q.question });
      }
    }

    // Prochaines échéances du planning (≤ 14 jours).
    const soon = computePhaseDates(dossier)
      .map((ph) => ({ ph, d: days(new Date(`${ph.start}T00:00:00`).getTime(), nowMs) }))
      .filter((x) => x.d >= 0 && x.d <= 14)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const { ph, d } of soon) {
      items.push({
        id: `ech-${ph.stepId}`,
        kind: 'echeance',
        severity: 'info',
        message:
          d === 0
            ? `La phase ${ph.label} démarre aujourd'hui.`
            : `La phase ${ph.label} démarre dans ${d} jour(s).`,
      });
    }
  }

  // Décisions client en attente (journal). On déduplique : si une décision datée
  // couvre déjà ce choix (même catégorie), on ne répète pas la demande.
  for (const dec of pendingClientDecisions(events)) {
    const q = dec.question.toLowerCase();
    if ([...decidedCats].some((c) => q.includes(c))) continue;
    items.push({
      id: `dec-${dec.eventId}`,
      kind: 'decision',
      severity: 'warning',
      message: `Le client doit encore se prononcer : ${dec.question}`,
    });
  }

  return items.sort((a, b) => ATTENTION_RANK[a.severity] - ATTENTION_RANK[b.severity]);
}

/* -------------------------------------------------------------------------- *
 * BUREAU DE PRÉPARATION — synthèse « Prêt à démarrer ? » (EPIC 5)
 * -------------------------------------------------------------------------- *
 * Sélecteur PUR, déterministe (aucune IA) : à partir du seul dossier, il répond
 * en un coup d'œil à « ce chantier peut-il démarrer ? ». Budget, check-list de
 * lancement, points bloquants, intervenants, dates. Chaque item est DÉRIVÉ des
 * données du dossier — jamais inventé (VISION Art. 7).
 */
export type PrepVerdict = 'pret' | 'presque' | 'pas_pret';
export type ChecklistTone = 'fait' | 'a_verifier' | 'bloquant';

export interface PrepBudget {
  previsionnel: number;
  engage: number;
  restant: number;
  /** TTC des lots VALIDÉS uniquement (budget opérationnel fiabilisé). */
  devisTTC: number;
  /** Engagé au-dessus du prévisionnel. */
  depasse: boolean;
  source: 'saisi' | 'devis' | 'infos' | 'aucun';
  /** Nombre de lots validés / total (complétude de l'analyse du devis). */
  lotsValides: number;
  lotsTotal: number;
  /**
   * Montant TTC total DÉCLARÉ sur le document (information) — non présenté comme
   * budget fiabilisé tant que tous les lots ne sont pas validés.
   */
  montantDeclareTTC?: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  tone: ChecklistTone;
  detail?: string;
  /** Vérification automatique (dérivée) vs point manuel du conducteur. */
  auto: boolean;
}

export type BloquantKind = 'document' | 'decision' | 'budget' | 'devis';
export interface PrepBloquant {
  id: string;
  kind: BloquantKind;
  message: string;
  docId?: string;
}

export interface PrepDate {
  id: string;
  label: string;
  date: string;
  kind: 'demarrage' | 'jalon' | 'livraison';
}

export interface PreparationSummary {
  budget: PrepBudget;
  checklist: ChecklistItem[];
  readiness: { prets: number; total: number; verdict: PrepVerdict };
  bloquants: PrepBloquant[];
  materielsACommander: Order[];
  datesImportantes: PrepDate[];
}

const round2p = (n: number): number => Math.round(n * 100) / 100;

export function buildPreparation(
  dossier: ProjectDossier,
  nowMs: number = Date.now(),
): PreparationSummary {
  const { orders, documents } = dossier;

  // — Budget (déterministe) : le budget opérationnel se base UNIQUEMENT sur les
  // lots VALIDÉS. Le montant déclaré du document reste visible en information,
  // jamais présenté comme fiabilisé tant que tous les lots ne sont pas validés.
  const { valides: lotsValides, total: lotsTotal } = lotsValidesCount(dossier);
  const devisTTC = buildDevisSummary(validatedDevis(dossier), dossier.avenants ?? []).totalTTC;
  const montantDeclareTTC =
    dossier.reconciliation?.totalTTCDeclare ??
    (dossier.devis ? buildDevisSummary(dossier.devis, dossier.avenants ?? []).totalTTC : undefined);
  const source: PrepBudget['source'] =
    dossier.budgetPrevisionnel != null
      ? 'saisi'
      : devisTTC > 0
        ? 'devis'
        : dossier.infos.budget != null
          ? 'infos'
          : 'aucun';
  const previsionnel =
    dossier.budgetPrevisionnel ?? (devisTTC > 0 ? devisTTC : (dossier.infos.budget ?? 0));
  const engage = round2p(
    orders.filter((o) => ORDER_PLACED.has(o.statut)).reduce((a, o) => a + (o.montant ?? 0), 0),
  );
  const depasse = previsionnel > 0 && engage > previsionnel;
  const budget: PrepBudget = {
    previsionnel: round2p(previsionnel),
    engage,
    restant: round2p(previsionnel - engage),
    devisTTC,
    depasse,
    source,
    lotsValides,
    lotsTotal,
    ...(montantDeclareTTC != null ? { montantDeclareTTC } : {}),
  };

  // — Décisions client (bloquantes si en retard) —
  const decisions = buildClientDecisions(dossier, nowMs);
  const decisionsEnRetard = decisions.filter((d) => d.status === 'en_retard');
  const decisionsProches = decisions.filter((d) => d.status === 'proche');

  // — Documents clés —
  const findDoc = (rx: RegExp): ProjectDocument | undefined =>
    documents.find((d) => rx.test(d.label));
  const plans = findDoc(/plan/i);
  const assurance = findDoc(/assurance|attestation/i);
  const docsRecommandesManquants = documents.filter((d) => d.recommande && d.status === 'manquant');
  const docTone = (d?: ProjectDocument): ChecklistTone =>
    d == null
      ? 'a_verifier'
      : d.status === 'fourni'
        ? 'fait'
        : d.recommande && d.status === 'manquant'
          ? 'bloquant'
          : 'a_verifier';
  const nbACommander = orders.filter((o) => o.statut === 'a_commander').length;

  // — Check-list de lancement (auto) —
  const auto: ChecklistItem[] = [
    {
      id: 'devis',
      label: 'Devis signé',
      // Un devis TRANSCRIT mais non validé (brouillon) reste bloquant : la
      // transcription doit être vérifiée avant de faire foi.
      tone: contratValide(dossier) ? 'fait' : 'bloquant',
      detail: dossier.devis?.reference,
      auto: true,
    },
    { id: 'plans', label: 'Plans', tone: docTone(plans), auto: true },
    { id: 'assurance', label: "Attestation d'assurance", tone: docTone(assurance), auto: true },
    {
      id: 'budget',
      label: 'Budget prévisionnel',
      tone: previsionnel > 0 ? (depasse ? 'bloquant' : 'fait') : 'a_verifier',
      detail: depasse ? 'Engagé au-dessus du prévisionnel' : undefined,
      auto: true,
    },
    {
      id: 'demarrage',
      label: 'Date de démarrage fixée',
      tone: dossier.infos.startDate ? 'fait' : 'a_verifier',
      auto: true,
    },
    {
      id: 'planning',
      label: 'Planning défini',
      tone: dossier.planning.length > 0 ? 'fait' : 'a_verifier',
      auto: true,
    },
    {
      id: 'decisions',
      label: 'Décisions client bloquantes levées',
      tone:
        decisionsEnRetard.length > 0
          ? 'bloquant'
          : decisionsProches.length > 0
            ? 'a_verifier'
            : 'fait',
      detail:
        decisionsEnRetard.length > 0
          ? `${decisionsEnRetard.length} en retard`
          : decisionsProches.length > 0
            ? `${decisionsProches.length} échéance(s) proche(s)`
            : undefined,
      auto: true,
    },
    {
      id: 'commandes',
      label: 'Matériels commandés',
      tone: nbACommander > 0 ? 'a_verifier' : 'fait',
      detail: nbACommander > 0 ? `${nbACommander} à commander` : undefined,
      auto: true,
    },
  ];

  // — Check-list manuelle (conducteur) —
  const manuel: ChecklistItem[] = (dossier.checklist ?? []).map((c) => ({
    id: `m-${c.id}`,
    label: c.label,
    tone: c.done ? 'fait' : ('a_verifier' as ChecklistTone),
    auto: false,
  }));

  const checklist = [...auto, ...manuel];
  const prets = checklist.filter((c) => c.tone === 'fait').length;
  const verdict: PrepVerdict = checklist.some((c) => c.tone === 'bloquant')
    ? 'pas_pret'
    : checklist.some((c) => c.tone === 'a_verifier')
      ? 'presque'
      : 'pret';

  // — Points bloquants (mêmes causes que la check-list, listés pour agir) —
  const bloquants: PrepBloquant[] = [];
  if (!dossier.devis)
    bloquants.push({ id: 'b-devis', kind: 'devis', message: 'Aucun devis signé au dossier.' });
  for (const d of docsRecommandesManquants)
    bloquants.push({
      id: `b-doc-${d.id}`,
      kind: 'document',
      message: `Document recommandé manquant : ${d.label}.`,
      docId: d.id,
    });
  for (const dec of decisionsEnRetard)
    bloquants.push({
      id: `b-dec-${dec.id}`,
      kind: 'decision',
      message: `Décision client en retard : ${dec.categorie}.`,
    });
  if (depasse)
    bloquants.push({
      id: 'b-budget',
      kind: 'budget',
      message: `Budget dépassé : engagé ${Math.round(engage)} € au-dessus du prévisionnel ${Math.round(previsionnel)} €.`,
    });

  // — Dates importantes à venir (démarrage / jalons / livraisons) —
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const dates: PrepDate[] = [];
  if (dossier.infos.startDate && dossier.infos.startDate >= today)
    dates.push({
      id: 'd-start',
      label: 'Démarrage du chantier',
      date: dossier.infos.startDate,
      kind: 'demarrage',
    });
  for (const t of dossier.planning)
    if (t.start >= today)
      dates.push({ id: `d-jalon-${t.id}`, label: t.label, date: t.start, kind: 'jalon' });
  for (const o of orders) {
    const liv = o.dateLivraisonReelle ?? o.dateLivraisonEstimee;
    if (liv && liv >= today && o.statut !== 'a_commander')
      dates.push({
        id: `d-liv-${o.id}`,
        label: `Livraison : ${o.label}`,
        date: liv,
        kind: 'livraison',
      });
  }
  const datesImportantes = dates.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  return {
    budget,
    checklist,
    readiness: { prets, total: checklist.length, verdict },
    bloquants,
    materielsACommander: orders.filter((o) => o.statut === 'a_commander'),
    datesImportantes,
  };
}

/* -------------------------------------------------------------------------- *
 * Port d'analyse : lecture RÉELLE (défaut) + MOCK scénarisé (référence)
 * -------------------------------------------------------------------------- */
/** Un fichier déposé, avec le texte réellement extrait quand c'est un PDF lisible. */
export interface AnalyzeFile {
  name: string;
  /** Texte extrait du document (PDF lisible). Absent si non extractible. */
  text?: string;
  /** PDF déposé dont AUCUN texte n'a pu être extrait (probable scan/image). */
  imagePdf?: boolean;
}

export interface AnalyzeInput {
  files: AnalyzeFile[];
}

export type DossierAnalyzer = (input: AnalyzeInput) => ProjectProposal | Promise<ProjectProposal>;

const has = (files: { name: string }[], needle: string): boolean =>
  files.some((f) => f.name.toLowerCase().includes(needle));

const isPdfName = (name: string): boolean => /\.pdf$/i.test(name);

/** Un document du dossier, dérivé d'un fichier réellement déposé (jamais inventé). */
function documentFromFile(name: string, i: number): ProjectDocument {
  const n = name.toLowerCase();
  const map: { re: RegExp; label: string; categorie: PrepDocCategory }[] = [
    { re: /devis/, label: 'Devis signé', categorie: 'devis' },
    { re: /acompte|arrhes/, label: 'Acompte versé', categorie: 'acompte' },
    { re: /facture/, label: 'Facture finale', categorie: 'facture_finale' },
    { re: /plan/, label: 'Plans', categorie: 'plan' },
    { re: /dpe/, label: 'DPE', categorie: 'dpe' },
    { re: /diag|amiante|plomb/, label: 'Diagnostics', categorie: 'diagnostic' },
    { re: /assurance/, label: "Attestation d'assurance", categorie: 'assurance' },
    { re: /contrat/, label: 'Contrat', categorie: 'contrat' },
  ];
  const hit = map.find((m) => m.re.test(n));
  return {
    id: `doc-file-${i}`,
    label: hit?.label ?? name,
    status: 'fourni',
    categorie: hit?.categorie ?? 'autre',
    recommande: hit?.categorie === 'devis',
  };
}

/**
 * LECTURE RÉELLE du devis (analyseur par défaut). PHÉNIX lit le TEXTE réellement
 * extrait des documents (l'extraction binaire PDF→texte se fait côté app) et en
 * tire les informations exploitables — sans jamais inventer. Deux issues :
 *  • aucun texte exploitable alors que des PDF ont été déposés → devis probablement
 *    scanné/image : on le DIT (extraction.imageOnly), rien n'est fabriqué ;
 *  • du texte lisible → on extrait client, adresse, montant, date, prestations,
 *    pièces, matériaux, délais, paiement, émetteur, et on bâtit un dossier à
 *    partir du RÉEL (feuille de route dérivée des lots réellement détectés).
 * Un LLM/OCR pourra remplacer l'extraction derrière la même signature.
 */
export const realAnalyzeDossier: DossierAnalyzer = ({ files }) => {
  const documents = files.map((f, i) => documentFromFile(f.name, i));
  const sources = files.map((f) => f.name);
  const fullText = files
    .map((f) => f.text ?? '')
    .join('\n')
    .trim();
  const chars = fullText.replace(/\s+/g, ' ').trim().length;
  const hasPdf = files.some((f) => isPdfName(f.name) || f.imagePdf);
  const readable = chars >= MIN_READABLE_CHARS;

  const baseDossier = (extra: Partial<ProjectDossier>): ProjectDossier => ({
    infos: {},
    roadmap: [],
    planning: [],
    orders: [],
    selections: [],
    documents,
    questions: [],
    checklist: defaultLaunchChecklist(),
    sources,
    createdAt: new Date().toISOString(),
    ...extra,
  });

  // Aucun texte exploitable mais des PDF déposés → probable scan/image.
  if (!readable && hasPdf) {
    return {
      projectName: 'Nouveau chantier',
      dossier: baseDossier({}),
      extraction: buildDevisExtraction({ prestations: [], pieces: [], materiaux: [] }, chars, true),
    };
  }

  const fields = extractDevisFields(fullText);
  const infos: ProjectInfos = {};
  if (fields.clientName) infos.clientName = fields.clientName;
  if (fields.address) infos.address = fields.address;
  if (fields.phone) infos.phone = fields.phone;
  if (fields.email) infos.email = fields.email;
  const montant = fields.montantTTC ?? fields.montantHT;
  if (montant != null) infos.budget = montant;
  const duree = fields.delais?.match(/(\d+\s*(?:semaines?|mois|jours?|ans?))/i);
  if (duree) infos.duration = duree[1];
  // IMPORTANT : la date « Début des travaux » du devis est ADMINISTRATIVE — jamais
  // la vraie date officielle de démarrage. On ne préremplit donc PAS
  // `infos.startDate` : le conducteur la saisit à la main (bloquant partage client).

  // ANALYSE STRUCTURÉE du contrat : lots → postes (jamais inventée). Chaque lot
  // démarre en BROUILLON (à vérifier) — non exploitable en aval tant que le
  // conducteur ne l'a pas validé (VISION Art. 9 : le conducteur contrôle).
  const contract = extractDevisContract(fullText);

  // Feuille de route DÉRIVÉE des lots réellement transcrits, sinon des lots
  // détectés par mots-clés. Jamais de feuille de route générique fabriquée.
  const roadmap: RoadmapStep[] = (
    contract.devis ? contract.devis.lots.map((l) => l.label) : fields.prestations
  ).map((label, i) => ({ id: `step-${i + 1}`, label }));

  const city = fields.address?.match(/\d{5}\s+([A-Za-zÀ-ÿ'’ \-]{2,30})/)?.[1]?.trim();
  const projectName = fields.clientName
    ? `Chantier ${fields.clientName}`
    : city
      ? `Chantier ${city}`
      : 'Nouveau chantier';

  return {
    projectName,
    dossier: baseDossier({
      infos,
      roadmap,
      // Les lots portent leur propre statut (`brouillon`) — pas de statut global.
      ...(contract.devis ? { devis: contract.devis, reconciliation: contract.reconciliation } : {}),
    }),
    extraction: buildDevisExtraction(fields, chars, false),
  };
};

/**
 * Analyse SCÉNARISÉE : renvoie un dossier riche et crédible. L'état de certains
 * documents s'adapte légèrement aux fichiers déposés (devis/plan/DPE…) pour
 * renforcer la crédibilité, sans jamais inventer d'information chiffrée.
 */
export const mockAnalyzeDossier: DossierAnalyzer = ({ files }) => {
  const roadmap: RoadmapStep[] = [
    'Dépose',
    'Électricité',
    'Plomberie',
    'Isolation',
    'Plâtrerie',
    'Menuiseries',
    'Carrelage & faïence',
    'Peinture',
    'Sols',
    'Cuisine',
    'Nettoyage',
    'Réception',
  ].map((label, i) => ({ id: `step-${i + 1}`, label }));

  const docStatus = (present: boolean, fallback: DocumentStatus): DocumentStatus =>
    present ? 'fourni' : fallback;

  const documents: ProjectDocument[] = [
    {
      id: 'doc-devis',
      label: 'Devis signé',
      status: docStatus(has(files, 'devis'), 'a_fournir'),
      recommande: true,
    },
    {
      id: 'doc-acompte',
      label: 'Acompte versé',
      status: docStatus(has(files, 'acompte'), 'a_fournir'),
      recommande: true,
    },
    { id: 'doc-plans', label: 'Plans', status: docStatus(has(files, 'plan'), 'demande_client') },
    {
      id: 'doc-dpe',
      label: 'DPE',
      status: docStatus(has(files, 'dpe'), 'manquant'),
      recommande: true,
    },
    {
      id: 'doc-diag',
      label: 'Diagnostics (amiante / plomb)',
      status: docStatus(has(files, 'diag') || has(files, 'amiante'), 'manquant'),
      recommande: true,
    },
    { id: 'doc-assurance', label: "Attestation d'assurance", status: 'a_fournir' },
    { id: 'doc-copro', label: 'Autorisation de copropriété', status: 'non_applicable' },
  ];

  const orders: Order[] = [
    {
      id: 'ord-cuisine',
      label: 'Cuisine équipée',
      fournisseur: 'Cuisines Schmidt',
      reference: 'SCH-PERFORMA-LAQUE',
      quantite: 1,
      montant: 12500,
      garantie: '5 ans',
      delaiJours: 56,
      dateCommande: iso(new Date(Date.now() - 12 * DAY_MS)),
      dateLivraisonEstimee: iso(new Date(Date.now() + 9 * DAY_MS)),
      devisFournisseur: 'devis-cuisine-schmidt.pdf',
      bonCommande: 'BC-2024-118.pdf',
      stepIds: ['step-10'],
      statut: 'commandee',
    },
    {
      id: 'ord-receveur',
      label: 'Receveur & robinetterie',
      fournisseur: 'Grohe',
      reference: 'GRO-RAINSHOWER',
      quantite: 1,
      montant: 1850,
      garantie: '10 ans',
      delaiJours: 21,
      stepIds: ['step-3'],
      statut: 'a_commander',
    },
    {
      id: 'ord-carrelage',
      label: 'Carrelage & faïence',
      fournisseur: 'Porcelanosa',
      reference: 'POR-STON-60',
      quantite: 45,
      montant: 3200,
      delaiJours: 28,
      stepIds: ['step-7'],
      statut: 'a_commander',
    },
    {
      id: 'ord-radiateurs',
      label: 'Radiateurs',
      fournisseur: 'Acova',
      quantite: 5,
      montant: 2400,
      garantie: '2 ans',
      delaiJours: 42,
      stepIds: ['step-2'],
      statut: 'a_commander',
    },
    {
      id: 'ord-parquet',
      label: 'Parquet chêne',
      fournisseur: 'Panaget',
      reference: 'PAN-CHENE-RUSTIQUE',
      quantite: 60,
      montant: 2800,
      delaiJours: 14,
      stepIds: ['step-9'],
      statut: 'a_commander',
    },
  ];

  const selections: ClientSelection[] = [
    { id: 'sel-cuisine', categorie: 'Cuisine', label: 'Modèle & finitions', statut: 'a_choisir' },
    { id: 'sel-parquet', categorie: 'Parquet', label: 'Essence & teinte', statut: 'a_choisir' },
    { id: 'sel-peinture', categorie: 'Peinture', label: 'Teintes par pièce', statut: 'a_choisir' },
    {
      id: 'sel-carrelage',
      categorie: 'Carrelage',
      label: 'Sol salle de bain',
      statut: 'propose',
      detail: 'Effet pierre, grand format',
    },
    { id: 'sel-faience', categorie: 'Faïence', label: 'Murs salle de bain', statut: 'a_choisir' },
    {
      id: 'sel-sanitaires',
      categorie: 'Sanitaires',
      label: 'Vasque, WC, douche',
      statut: 'a_choisir',
    },
    {
      id: 'sel-luminaires',
      categorie: 'Luminaires',
      label: 'Points lumineux',
      statut: 'a_choisir',
    },
  ];

  const questions: PreparationQuestion[] = [
    {
      id: 'q-start',
      question:
        "Je n'ai pas trouvé la date de début souhaitée. Quand le chantier doit-il démarrer ?",
      field: 'startDate',
      answered: false,
    },
    {
      id: 'q-budget',
      question: 'Pouvez-vous confirmer le budget global du projet ?',
      field: 'budget',
      answered: false,
    },
  ];

  const infos: ProjectInfos = {
    clientName: 'M. et Mme Dubois',
    phone: '06 12 34 56 78',
    email: 'famille.dubois@email.fr',
    address: '12 rue des Tilleuls, 69300 Caluire-et-Cuire',
    propertyType: 'Maison',
    surface: 120,
    budget: 95000,
    duration: '3 mois',
    // startDate volontairement absent → question posée par l'IA.
  };

  const devis: Devis = {
    reference: 'DEV-2024-0312',
    date: iso(new Date(Date.now() - 30 * DAY_MS)),
    lots: [
      {
        id: 'lot-depose',
        label: 'Dépose & démolition',
        stepId: 'step-1',
        documentIds: ['doc-diag'],
        postes: [
          {
            id: 'p-depose-1',
            label: 'Démolition cloisons existantes',
            unite: 'forfait',
            montantHT: 3500,
            tva: 10,
          },
          {
            id: 'p-depose-2',
            label: 'Évacuation des gravats (benne)',
            unite: 'forfait',
            montantHT: 1200,
            tva: 10,
          },
        ],
      },
      {
        id: 'lot-elec',
        label: 'Électricité',
        stepId: 'step-2',
        orderIds: ['ord-radiateurs'],
        selectionIds: ['sel-luminaires'],
        postes: [
          {
            id: 'p-elec-1',
            label: 'Mise aux normes tableau + réseau',
            unite: 'ens.',
            montantHT: 6200,
            tva: 10,
          },
          {
            id: 'p-elec-2',
            label: 'Points lumineux & prises',
            quantite: 34,
            unite: 'u',
            prixUnitaireHT: 75,
            montantHT: 2550,
            tva: 10,
          },
        ],
      },
      {
        id: 'lot-plomberie',
        label: 'Plomberie & sanitaires',
        stepId: 'step-3',
        orderIds: ['ord-receveur'],
        selectionIds: ['sel-sanitaires'],
        postes: [
          {
            id: 'p-plomb-1',
            label: 'Réseau & évacuations',
            unite: 'ens.',
            montantHT: 6400,
            tva: 10,
          },
          {
            id: 'p-plomb-2',
            label: 'Fourniture & pose sanitaires',
            unite: 'ens.',
            montantHT: 2300,
            tva: 10,
            materiau: 'Grès émaillé',
          },
        ],
      },
      {
        id: 'lot-platrerie',
        label: 'Plâtrerie & isolation',
        stepId: 'step-5',
        postes: [
          {
            id: 'p-platre-1',
            label: 'Cloisons placo BA13',
            quantite: 85,
            unite: 'm²',
            prixUnitaireHT: 42,
            montantHT: 3570,
            tva: 10,
            materiau: 'Placo BA13',
          },
          {
            id: 'p-platre-2',
            label: 'Doublage isolant',
            quantite: 60,
            unite: 'm²',
            prixUnitaireHT: 38,
            montantHT: 2280,
            tva: 10,
            materiau: 'Laine de verre',
          },
        ],
      },
      {
        id: 'lot-carrelage',
        label: 'Carrelage & faïence',
        stepId: 'step-7',
        orderIds: ['ord-carrelage'],
        selectionIds: ['sel-carrelage', 'sel-faience'],
        postes: [
          {
            id: 'p-carr-1',
            label: 'Carrelage sol',
            quantite: 28,
            unite: 'm²',
            prixUnitaireHT: 95,
            montantHT: 2660,
            tva: 10,
            materiau: 'Grès cérame',
          },
          {
            id: 'p-carr-2',
            label: 'Faïence murale',
            quantite: 22,
            unite: 'm²',
            prixUnitaireHT: 78,
            montantHT: 1716,
            tva: 10,
          },
          {
            id: 'p-carr-3',
            label: 'Étanchéité sous carrelage (SPEC)',
            unite: 'forfait',
            montantHT: 650,
            tva: 10,
          },
        ],
      },
      {
        id: 'lot-peinture',
        label: 'Peinture',
        stepId: 'step-8',
        selectionIds: ['sel-peinture'],
        postes: [
          {
            id: 'p-peint-1',
            label: 'Préparation + 2 couches',
            quantite: 210,
            unite: 'm²',
            prixUnitaireHT: 28,
            montantHT: 5880,
            tva: 10,
          },
        ],
      },
      {
        id: 'lot-sols',
        label: 'Revêtements de sol',
        stepId: 'step-9',
        orderIds: ['ord-parquet'],
        selectionIds: ['sel-parquet'],
        postes: [
          {
            id: 'p-sol-1',
            label: 'Parquet chêne fourniture & pose',
            quantite: 60,
            unite: 'm²',
            prixUnitaireHT: 89,
            montantHT: 5340,
            tva: 10,
            materiau: 'Chêne',
          },
        ],
      },
      {
        id: 'lot-cuisine',
        label: 'Cuisine',
        stepId: 'step-10',
        orderIds: ['ord-cuisine'],
        selectionIds: ['sel-cuisine'],
        postes: [
          {
            id: 'p-cuis-1',
            label: 'Fourniture cuisine équipée',
            unite: 'ens.',
            montantHT: 12500,
            tva: 20,
          },
          {
            id: 'p-cuis-2',
            label: 'Pose & raccordements',
            unite: 'forfait',
            montantHT: 1800,
            tva: 10,
          },
        ],
      },
    ],
  };

  const dossier: ProjectDossier = {
    infos,
    roadmap,
    planning: [],
    orders,
    selections,
    documents,
    questions,
    checklist: defaultLaunchChecklist(),
    devis,
    sources: files.map((f) => f.name),
    createdAt: new Date().toISOString(),
  };

  return { projectName: 'Maison Dubois — Rénovation', dossier };
};
