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
import type { Event } from './event.js';
import { pendingClientDecisions } from './views.js';

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
  for (const t of dossier.planning) {
    if (t.stepId) stepStart.set(t.stepId, new Date(`${t.start}T00:00:00`).getTime());
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
 * SYNTHÈSE « PHÉNIX surveille votre chantier » (accueil Compagnon)
 * -------------------------------------------------------------------------- *
 * Une seule lecture, claire : « Voici ce qui mérite votre attention
 * aujourd'hui. » Agrège commandes, documents, questions, décisions client et
 * prochaines échéances. Sélecteur pur — la logique vit ici, jamais dans l'UI.
 */
export type AttentionKind = 'commande' | 'document' | 'question' | 'decision' | 'echeance';

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  severity: OrderAlertSeverity;
  message: string;
  /** Document concerné (permet l'action « Demander au client »). */
  docId?: string;
}

const ATTENTION_RANK: Record<OrderAlertSeverity, number> = { warning: 0, info: 1, success: 2 };

export function buildChantierAttention(
  dossier: ProjectDossier | null,
  events: Event[],
  nowMs: number = Date.now(),
): AttentionItem[] {
  const items: AttentionItem[] = [];

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
          message: `Document recommandé manquant : ${d.label}.`,
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

    // Questions PHÉNIX en attente.
    for (const q of dossier.questions) {
      if (!q.answered) {
        items.push({ id: `q-${q.id}`, kind: 'question', severity: 'info', message: q.question });
      }
    }

    // Prochaines échéances du planning (≤ 14 jours).
    const soon = dossier.planning
      .map((t) => ({ t, d: days(new Date(`${t.start}T00:00:00`).getTime(), nowMs) }))
      .filter((x) => x.d >= 0 && x.d <= 14)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const { t, d } of soon) {
      items.push({
        id: `ech-${t.id}`,
        kind: 'echeance',
        severity: 'info',
        message:
          d === 0
            ? `La phase ${t.label} démarre aujourd'hui.`
            : `La phase ${t.label} démarre dans ${d} jour(s).`,
      });
    }
  }

  // Décisions client en attente.
  for (const dec of pendingClientDecisions(events)) {
    items.push({
      id: `dec-${dec.eventId}`,
      kind: 'decision',
      severity: 'warning',
      message: `Décision en attente du client : ${dec.question}`,
    });
  }

  return items.sort((a, b) => ATTENTION_RANK[a.severity] - ATTENTION_RANK[b.severity]);
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
