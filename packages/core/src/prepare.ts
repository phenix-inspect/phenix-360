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
export const ORDER_STATUSES = ['a_commander', 'commande', 'expedie', 'livre', 'pose'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  a_commander: 'À commander',
  commande: 'Commandé',
  expedie: 'Expédié',
  livre: 'Livré',
  pose: 'Posé',
};

export interface Order {
  id: string;
  label: string;
  fournisseur?: string;
  reference?: string;
  montant?: number;
  /** Date prévisionnelle de commande (ISO). */
  datePrevisionnelle?: string;
  /** Date de livraison prévue (ISO). */
  livraison?: string;
  garantie?: string;
  /** Notice disponible (présence). */
  notice?: boolean;
  /** Facture disponible (présence). */
  facture?: boolean;
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

export interface ClientSelection {
  id: string;
  categorie: string;
  label: string;
  statut: SelectionStatus;
  detail?: string;
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

export interface ProjectDocument {
  id: string;
  label: string;
  status: DocumentStatus;
  /** Indispensable au démarrage / à la sécurité ? (jamais bloquant sinon). */
  recommande?: boolean;
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
export interface ProjectDossier {
  infos: ProjectInfos;
  roadmap: RoadmapStep[];
  planning: PlanningTask[];
  orders: Order[];
  selections: ClientSelection[];
  documents: ProjectDocument[];
  questions: PreparationQuestion[];
  /** Noms des fichiers déposés (traçabilité de l'analyse). */
  sources: string[];
  createdAt: IsoDateTime;
}

/** Ce que PHÉNIX PROPOSE (pas encore le projet). */
export interface ProjectProposal {
  projectName: string;
  dossier: ProjectDossier;
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
  { icon: '👷', label: 'Détection des intervenants' },
  { icon: '📅', label: 'Construction du planning' },
  { icon: '📂', label: 'Vérification des documents' },
  { icon: '🤖', label: "Préparation de l'assistant PHÉNIX" },
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

/** Mémoire du projet = lecture du dossier (alimente l'assistant). */
export function buildProjectMemory(dossier: ProjectDossier): ProjectMemory {
  return {
    travaux: dossier.roadmap.map((s) => s.label),
    materiaux: dossier.orders.map((o) => o.label),
    choix: dossier.selections.map((s) => `${s.categorie} : ${s.label}`),
    commandes: dossier.orders.map((o) =>
      o.fournisseur ? `${o.label} (${o.fournisseur})` : o.label,
    ),
    documents: dossier.documents.filter((d) => d.status === 'fourni').map((d) => d.label),
    garanties: dossier.orders.filter((o) => o.garantie).map((o) => `${o.label} : ${o.garantie}`),
  };
}

/* -------------------------------------------------------------------------- *
 * Port d'analyse + implémentation MOCK (scénarisée)
 * -------------------------------------------------------------------------- */
export interface AnalyzeInput {
  /** Fichiers déposés (on n'utilise que le nom dans la démo). */
  files: { name: string }[];
}

export type DossierAnalyzer = (input: AnalyzeInput) => ProjectProposal | Promise<ProjectProposal>;

const has = (files: { name: string }[], needle: string): boolean =>
  files.some((f) => f.name.toLowerCase().includes(needle));

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
      montant: 12500,
      garantie: '5 ans',
      statut: 'a_commander',
    },
    {
      id: 'ord-receveur',
      label: 'Receveur & robinetterie',
      fournisseur: 'Grohe',
      montant: 1850,
      garantie: '10 ans',
      statut: 'a_commander',
    },
    {
      id: 'ord-carrelage',
      label: 'Carrelage & faïence',
      fournisseur: 'Porcelanosa',
      montant: 3200,
      statut: 'a_commander',
    },
    {
      id: 'ord-radiateurs',
      label: 'Radiateurs',
      fournisseur: 'Acova',
      montant: 2400,
      garantie: '2 ans',
      statut: 'a_commander',
    },
    {
      id: 'ord-parquet',
      label: 'Parquet chêne',
      fournisseur: 'Panaget',
      montant: 2800,
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
      id: 'q-plombier',
      question: "Je n'ai pas identifié le plombier. Qui interviendra sur le lot plomberie ?",
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

  const dossier: ProjectDossier = {
    infos,
    roadmap,
    planning: [],
    orders,
    selections,
    documents,
    questions,
    sources: files.map((f) => f.name),
    createdAt: new Date().toISOString(),
  };

  return { projectName: 'Maison Dubois — Rénovation', dossier };
};
