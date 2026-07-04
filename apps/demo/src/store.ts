/**
 * PHÉNIX 360 — Store du Mode Démo
 * ---------------------------------------------------------------------------
 * Réactif, mais SANS logique métier : il ne fait qu'orchestrer les ports
 * `@phenix360/core` (InMemoryBackend) et exposer un snapshot à React. Passer en
 * Supabase = remplacer le backend par un adaptateur des mêmes ports, sans
 * toucher aux surfaces ni à la logique (qui vit dans core).
 *
 * Persistance : localStorage (démo multi-onglets) + BroadcastChannel pour la
 * synchro instantanée entre onglets/fenêtres. Les « noms » (people) et le projet
 * actif sont des détails de démo, hors modèle core.
 */
import { useSyncExternalStore } from 'react';
import {
  DEFAULT_AUDIENCE,
  INTERNAL_AUDIENCE,
  SHARED_AUDIENCE,
  InMemoryBackend,
  PROJECT_STEPS,
  PROJECT_STEP_LABEL,
  annotationId as toAnnotationId,
  askPhenix as corePhenix,
  attachmentId as toAttachmentId,
  buildDecisionContent,
  choixClientValides,
  coupDeCoeurId as toCoupId,
  decisionVisibility,
  mockAnalyzeDossier,
  type AnalyzeInput,
  type DossierAnalyzer,
  filPhotoId as toFilPhotoId,
  messageId as toMessageId,
  momentId as toMomentId,
  momentPartageClient,
  nextReserveNumero,
  userId as toUserId,
  type Annotation,
  type AnnotationType,
  type BackendState,
  type CommCanal,
  type Contact,
  type ClientSelection,
  type CoupDeCoeur,
  type DecisionEvent,
  type DemandeResolution,
  type SelectionOption,
  type ActionPriorite,
  type Event,
  type EventActor,
  type EventAttachment,
  type EventId,
  type FilPhoto,
  type KeyValueStore,
  type Message,
  type MissionKind,
  type MissionPreparation,
  type Moment,
  type MomentType,
  type NewEvent,
  type NewMember,
  type NewProject,
  type PhenixAction,
  type PhenixSource,
  type PhenixTodo,
  type PrepDocCategory,
  type Project,
  type ProjectDocument,
  type ProjectDossier,
  type ProjectId,
  type ProjectPatch,
  type ProjectStep,
  type ProjectProposal,
  type ProjectZone,
  type UploadedMedia,
  type UserId,
  type ZoneId,
} from '@phenix360/core';
import { buildDemoSeed } from './seed';

const STATE_KEY = 'phenix-demo:state:v1';
const PEOPLE_KEY = 'phenix-demo:people:v1';
const ACTIVE_KEY = 'phenix-demo:active:v1';
const DOSSIERS_KEY = 'phenix-demo:dossiers:v1';
const PINS_KEY = 'phenix-demo:pins:v1';
const SEEDED_KEY = 'phenix-demo:seeded:v1';
// Le Fil — agrégat distinct du Journal (persisté à part, par projet).
const FIL_MOMENTS_KEY = 'phenix-demo:fil-moments:v1';
const FIL_COUPS_KEY = 'phenix-demo:fil-coups:v1';
const FIL_MESSAGES_KEY = 'phenix-demo:fil-messages:v1';
const FIL_ZONES_KEY = 'phenix-demo:fil-zones:v1';
const FIL_ANNOTATIONS_KEY = 'phenix-demo:fil-annotations:v1';
// PHÉNIX (conversation client) — agrégat léger, distinct du Journal.
const PHENIX_CONV_KEY = 'phenix-demo:phenix-conv:v1';
// Gestion du chantier — journal des partages (simulation / aperçu, hors Journal).
const SHARES_KEY = 'phenix-demo:shares:v1';
// Annuaire du conducteur (contacts) — global, réutilisable entre chantiers.
const CONTACTS_KEY = 'phenix-demo:contacts:v1';
// État « lu » des Moments, par RÔLE (device-local) : ce que CE poste a consulté.
// Ce n'est pas un fait du Journal (qui reste l'unique source de vérité) mais un
// simple accusé de lecture qui éteint les notifications une fois consultées.
const SEEN_KEY = 'phenix-demo:seen:v1';
// Choix client validés « pris en compte » par le conducteur (device-local) :
// `decisionEventId → ISO`. Éteint la notification « choix à traiter » une fois
// l'action engagée (commande, artisan, planning). Accusé, pas un fait métier.
const CHOIX_TRAITES_KEY = 'phenix-demo:choix-traites:v1';

/** Une entrée du journal des partages (aperçu / journalisation, pas d'envoi réel). */
export interface ShareLog {
  id: string;
  missionEventId: string;
  audiences: string[];
  at: string;
}

/** Un message du fil de conversation PHÉNIX (côté client). */
export interface PhenixMessage {
  id: string;
  role: 'client' | 'phenix';
  texte: string;
  at: string;
  kind?: 'reponse' | 'escalade';
  sources?: PhenixSource[];
  avancer?: PhenixTodo;
  /** Navigation associée (bouton dans le fil). */
  action?: PhenixAction;
  /** Commande explicite → l'UI ouvre d'emblée (TRANSITOIRE, jamais persisté). */
  autoOpen?: boolean;
  /** Si escaladée : l'événement `demande` créé au Journal (pour la reprise). */
  demandeRef?: string;
}

/** Cible de navigation posée par PHÉNIX (consommée par l'Espace client). */
export interface ClientTarget {
  kind: 'document' | 'decision' | 'etapes' | 'fil';
  ref?: string;
}

/**
 * Accusés de lecture des Moments, par rôle : `role → momentId → ISO consulté`.
 * Un message de l'AUTRE partie est « non lu » tant que le rôle n'a pas consulté
 * le Moment depuis. Purement local (accusé de réception), jamais un fait métier.
 */
export type SeenState = Record<string, Record<string, string>>;

/**
 * Cible transitoire : ouvrir un Moment précis dans le Récit (depuis une
 * notification), le mettre en évidence et poser le curseur dans la réponse.
 * `role` cible le bon Récit en vue Côte à côte (conducteur vs client).
 */
export interface MomentFocus {
  momentId: string;
  role: string;
}

const emptyState = (): BackendState => ({ projects: [], members: [], events: [] });

class LocalStorageKeyValueStore implements KeyValueStore {
  load(): BackendState | null {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as BackendState) : null;
  }
  save(state: BackendState): void {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }
}

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

/**
 * Crée ou met à jour le CONTACT qui incarne le client d'un chantier (source
 * unique de ses coordonnées, VISION Art. 6). L'identité qui pilote le client-safe
 * reste `Project.clientId` ; ce contact la rend éditable en un seul endroit et
 * joignable depuis le Carnet. Persiste dans CONTACTS_KEY (pas de refresh ici :
 * l'appelant rafraîchit).
 */
function upsertClientContact(input: {
  projectId: string;
  clientId: UserId;
  nom: string;
  phone?: string;
  email?: string;
  address?: string;
}): void {
  const list = readJson<Contact[]>(CONTACTS_KEY, []);
  const existing = list.find((c) => c.userId === input.clientId);
  if (existing) {
    existing.nom = input.nom;
    if (input.phone) existing.phone = input.phone;
    if (input.email) existing.email = input.email;
    if (input.address) existing.address = input.address;
    if (!existing.projectIds.includes(input.projectId)) existing.projectIds.push(input.projectId);
  } else {
    list.push({
      id: crypto.randomUUID(),
      nom: input.nom,
      role: 'client',
      userId: input.clientId,
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.address ? { address: input.address } : {}),
      projectIds: [input.projectId],
      createdAt: new Date().toISOString(),
    });
  }
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
}

/** Snapshot exposé à React (immuable entre deux changements). */
export interface DemoSnapshot extends BackendState {
  /** userId → nom affichable (détail de démo, hors core). */
  people: Record<string, string>;
  activeProjectId: ProjectId | null;
  /** projectId → dossier préparé par PHÉNIX Start (hors colonne vertébrale). */
  dossiers: Record<string, ProjectDossier>;
  /** projectId → eventIds épinglés à l'historique (annotation, hors journal). */
  pins: Record<string, string[]>;
  /** Le Fil (par projet) — agrégat distinct du Journal. */
  fil: {
    moments: Record<string, Moment[]>;
    coups: Record<string, CoupDeCoeur[]>;
    messages: Record<string, Message[]>;
    zones: Record<string, ProjectZone[]>;
    annotations: Record<string, Annotation[]>;
  };
  /** Conversation PHÉNIX (par projet) — fil client, distinct du Journal. */
  phenix: Record<string, PhenixMessage[]>;
  /** Journal des partages (par projet) — aperçu / simulation, hors Journal. */
  shares: Record<string, ShareLog[]>;
  /** Annuaire du conducteur — contacts globaux, réutilisables entre chantiers. */
  contacts: Contact[];
  /** Cible transitoire : ouvrir une photo précise du Fil (lien retour). */
  filTarget: { momentId: string; photoId?: string } | null;
  /** Cible transitoire : ouvrir un Moment précis du Récit (depuis une notification). */
  momentFocus: MomentFocus | null;
  /** Cible transitoire : navigation PHÉNIX dans l'Espace client. */
  clientTarget: ClientTarget | null;
  /** Accusés de lecture des Moments, par rôle (éteint les notifications). */
  seen: SeenState;
  /** Choix client validés « pris en compte » : `decisionEventId → ISO`. */
  choixTraites: Record<string, string>;
  /**
   * L'espace de travail est-il initialisé ? `false` au tout premier lancement :
   * on propose alors un CHOIX (découvrir la démo / démarrer à vide) plutôt que
   * d'imposer la démo. Passe à `true` dès qu'un choix est fait.
   */
  seeded: boolean;
}

const kv = new LocalStorageKeyValueStore();
const backend = new InMemoryBackend(kv);
const channel = new BroadcastChannel('phenix-demo');
const listeners = new Set<() => void>();

// Cibles transitoires (en mémoire) : lien retour « Voir la photo » + navigation
// PHÉNIX. Déclarées AVANT build() (elles y sont lues) pour éviter tout TDZ.
let filTarget: { momentId: string; photoId?: string } | null = null;
let momentFocus: MomentFocus | null = null;
let clientTarget: ClientTarget | null = null;
// PORT D'ANALYSE (unique) — la simulation déterministe `mockAnalyzeDossier`
// aujourd'hui, un vrai LLM demain via `setDossierAnalyzer`, SANS toucher aux
// écrans : toute l'app passe par `demo.analyzeDossier`.
let dossierAnalyzer: DossierAnalyzer = mockAnalyzeDossier;
let snapshot: DemoSnapshot = build();

function build(): DemoSnapshot {
  return {
    ...(kv.load() ?? emptyState()),
    people: readJson<Record<string, string>>(PEOPLE_KEY, {}),
    activeProjectId: readJson<ProjectId | null>(ACTIVE_KEY, null),
    dossiers: readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {}),
    pins: readJson<Record<string, string[]>>(PINS_KEY, {}),
    fil: {
      moments: readJson<Record<string, Moment[]>>(FIL_MOMENTS_KEY, {}),
      coups: readJson<Record<string, CoupDeCoeur[]>>(FIL_COUPS_KEY, {}),
      messages: readJson<Record<string, Message[]>>(FIL_MESSAGES_KEY, {}),
      zones: readJson<Record<string, ProjectZone[]>>(FIL_ZONES_KEY, {}),
      annotations: readJson<Record<string, Annotation[]>>(FIL_ANNOTATIONS_KEY, {}),
    },
    phenix: readJson<Record<string, PhenixMessage[]>>(PHENIX_CONV_KEY, {}),
    shares: readJson<Record<string, ShareLog[]>>(SHARES_KEY, {}),
    contacts: readJson<Contact[]>(CONTACTS_KEY, []),
    filTarget,
    momentFocus,
    clientTarget,
    seen: readJson<SeenState>(SEEN_KEY, {}),
    choixTraites: readJson<Record<string, string>>(CHOIX_TRAITES_KEY, {}),
    seeded: typeof localStorage !== 'undefined' ? localStorage.getItem(SEEDED_KEY) !== null : true,
  };
}

/**
 * Toutes les clés qui composent l'espace de travail local (hors marqueur
 * d'initialisation `SEEDED_KEY`). Source unique pour vider, exporter et
 * restaurer : chantiers/journal (`STATE_KEY`), noms, projet actif, dossiers,
 * épingles, tout le Fil, la conversation PHÉNIX et le journal des partages.
 */
const WORKSPACE_KEYS = [
  STATE_KEY,
  PEOPLE_KEY,
  ACTIVE_KEY,
  DOSSIERS_KEY,
  PINS_KEY,
  FIL_MOMENTS_KEY,
  FIL_COUPS_KEY,
  FIL_MESSAGES_KEY,
  FIL_ZONES_KEY,
  FIL_ANNOTATIONS_KEY,
  PHENIX_CONV_KEY,
  SHARES_KEY,
  CONTACTS_KEY,
  SEEN_KEY,
  CHOIX_TRAITES_KEY,
] as const;

/** Marqueur du format de sauvegarde (pour reconnaître un fichier valide). */
const BACKUP_APP = 'phenix-360';
const BACKUP_VERSION = 1;

/** Vide TOUT l'espace de travail (toutes les clés) et le marque initialisé. */
function clearWorkspace(): void {
  for (const key of WORKSPACE_KEYS) localStorage.removeItem(key);
  localStorage.setItem(SEEDED_KEY, '1');
}

function refresh(): void {
  snapshot = build();
  for (const l of listeners) l();
}

function broadcast(): void {
  channel.postMessage('changed');
}

channel.onmessage = () => refresh();

async function mutate<T>(p: Promise<T>): Promise<T> {
  const r = await p;
  refresh();
  broadcast();
  return r;
}

export const demo = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): DemoSnapshot {
    return snapshot;
  },

  // Identités de démo (noms) — hors modèle core.
  setPerson(userId: UserId, name: string): void {
    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    people[userId] = name;
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
    refresh();
    broadcast();
  },
  setActiveProject(id: ProjectId | null): void {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(id));
    refresh();
    broadcast();
  },

  /** Demande l'ouverture d'une photo précise du Fil (lien retour depuis le Journal). */
  openFilPhoto(momentId: string, photoId?: string): void {
    filTarget = { momentId, ...(photoId ? { photoId } : {}) };
    refresh();
  },
  /** Cible consommée par la galerie. */
  clearFilTarget(): void {
    filTarget = null;
    refresh();
  },

  /**
   * Ouvre un Moment précis du Récit depuis une notification : le Récit défile
   * jusqu'à lui, le met en évidence et pose le curseur dans la réponse. `role`
   * cible le bon Récit (conducteur / client) en vue Côte à côte.
   */
  focusMoment(momentId: string, role: string): void {
    momentFocus = { momentId, role };
    refresh();
  },
  /** Cible consommée par le Récit. */
  clearMomentFocus(): void {
    momentFocus = null;
    refresh();
  },
  /**
   * Marque un Moment comme LU par un rôle (accusé de lecture local) : éteint la
   * notification correspondante sans exiger de réponse. « Consulter suffit ».
   */
  markMomentSeen(role: string, momentId: string): void {
    const seen = readJson<SeenState>(SEEN_KEY, {});
    const forRole = seen[role] ?? {};
    forRole[momentId] = new Date().toISOString();
    seen[role] = forRole;
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    refresh();
    broadcast();
  },
  /**
   * Marque un choix client validé comme PRIS EN COMPTE par le conducteur : il a
   * lancé l'action (commande, artisan, planning). Éteint la notification.
   */
  markChoixTraite(decisionEventId: string): void {
    const map = readJson<Record<string, string>>(CHOIX_TRAITES_KEY, {});
    map[decisionEventId] = new Date().toISOString();
    localStorage.setItem(CHOIX_TRAITES_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /** PHÉNIX ouvre un écran de l'Espace client (navigation). */
  openClientTarget(kind: ClientTarget['kind'], ref?: string): void {
    clientTarget = { kind, ...(ref ? { ref } : {}) };
    refresh();
  },
  /** Cible consommée par l'Espace client. */
  clearClientTarget(): void {
    clientTarget = null;
    refresh();
  },

  // Ports core (le produit passe par là).
  createProject: (input: NewProject) => mutate(backend.createProject(input)),
  updateProject: (id: ProjectId, patch: ProjectPatch) => mutate(backend.updateProject(id, patch)),
  addMember: (input: NewMember) => mutate(backend.addMember(input)),
  appendEvent: (input: NewEvent) => mutate(backend.appendEvent(input)),
  publishEvent: (id: EventId, by: UserId) => mutate(backend.publishEvent(id, by)),
  resolveDemande: (id: EventId, resolution: DemandeResolution) =>
    mutate(backend.resolveDemande(id, resolution)),

  /**
   * Crée le projet À PARTIR de la proposition validée par l'humain (PHÉNIX
   * Start). « PHÉNIX prépare, vous validez » : rien n'est créé avant cet appel.
   * Passe par les ports core (projet, membres, événements) ; le dossier préparé
   * est persisté à part (hors colonne vertébrale).
   */
  /**
   * PORT D'ANALYSE unique : la démo utilise `mockAnalyzeDossier` (déterministe),
   * remplaçable par un vrai LLM via `setDossierAnalyzer` sans changer les écrans.
   */
  analyzeDossier(input: AnalyzeInput): Promise<ProjectProposal> {
    return Promise.resolve(dossierAnalyzer(input));
  },
  setDossierAnalyzer(fn: DossierAnalyzer): void {
    dossierAnalyzer = fn;
  },

  async createFromProposal(
    proposal: ProjectProposal,
    photosAvantTravaux: UploadedMedia[] = [],
  ): Promise<ProjectId> {
    const clientId = toUserId(crypto.randomUUID());
    const compaId = toUserId(crypto.randomUUID());
    const project = await backend.createProject({
      name: proposal.projectName,
      status: 'en_preparation',
      clientId,
    });
    await backend.addMember({ projectId: project.id, userId: compaId, role: 'compagnon' });
    await backend.addMember({ projectId: project.id, userId: clientId, role: 'client' });

    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    people[compaId] = 'Mickaël';
    people[clientId] = proposal.dossier.infos.clientName ?? 'Client';
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
    // Le client devient un CONTACT (source unique de ses coordonnées).
    upsertClientContact({
      projectId: project.id,
      clientId,
      nom: proposal.dossier.infos.clientName ?? 'Client',
      ...(proposal.dossier.infos.phone ? { phone: proposal.dossier.infos.phone } : {}),
      ...(proposal.dossier.infos.email ? { email: proposal.dossier.infos.email } : {}),
      ...(proposal.dossier.infos.address ? { address: proposal.dossier.infos.address } : {}),
    });

    const compaActor: EventActor = { userId: compaId, role: 'compagnon', displayName: 'Mickaël' };

    // Le devis signé est la pièce fondatrice : il ouvre le journal du chantier.
    await backend.appendEvent({
      projectId: project.id,
      actor: compaActor,
      type: 'document',
      visibility: 'client',
      state: 'publie',
      content: {
        attachment: {
          id: toAttachmentId(crypto.randomUUID()),
          kind: 'document',
          bucket: 'demo',
          storagePath: `${project.id}/devis-signe.pdf`,
          mimeType: 'application/pdf',
          fileName: 'Devis-signé.pdf',
          createdAt: new Date().toISOString(),
        },
        libelle: 'Devis signé',
      },
    });

    await backend.appendEvent({
      projectId: project.id,
      actor: compaActor,
      type: 'compte_rendu',
      visibility: 'interne',
      state: 'publie',
      content: {
        texte: `Dossier analysé et préparé par PHÉNIX Start — ${proposal.dossier.roadmap.length} étapes, ${proposal.dossier.orders.length} commandes, ${proposal.dossier.selections.length} choix client.`,
      },
    });

    // Choix proposés au client → « décision envoyée au client » tracée au journal
    // (événement structuré, source unique ; le client validera depuis son espace).
    for (const sel of proposal.dossier.selections) {
      if (sel.statut === 'propose') {
        await backend.appendEvent({
          projectId: project.id,
          actor: compaActor,
          type: 'decision',
          visibility: decisionVisibility('envoyee'),
          state: 'publie',
          content: buildDecisionContent({
            kind: 'envoyee',
            origin: 'phenix',
            selection: sel,
            statutApres: 'propose',
          }),
        });
      }
    }

    // Documents « demandés au client » → une demande apparaît dans l'espace client.
    for (const doc of proposal.dossier.documents) {
      if (doc.status === 'demande_client') {
        await backend.appendEvent({
          projectId: project.id,
          actor: compaActor,
          type: 'demande',
          visibility: 'client',
          state: 'ouverte',
          content: {
            question: `Pour préparer votre chantier, pouvez-vous nous transmettre : ${doc.label} ?`,
            destinataire: 'client',
          },
        });
      }
    }

    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    dossiers[project.id] = proposal.dossier;
    localStorage.setItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(project.id));
    // Photos déposées → un Moment « Avant travaux » dans le Récit (partagé au
    // client) : l'état des lieux d'origine, matérialisé par PHÉNIX.
    if (photosAvantTravaux.length > 0) {
      demo.addMoment({
        projectId: project.id,
        actor: compaActor,
        title: 'Avant travaux',
        type: 'visite',
        medias: photosAvantTravaux,
        legende: 'État des lieux avant le démarrage du chantier',
        shareWithClient: true,
      });
    }
    refresh();
    broadcast();
    return project.id;
  },

  /**
   * Crée un CHANTIER RÉEL à la main (Lot 2 — App réelle locale) : nom, client,
   * adresse, étape de départ. Pas de dossier de démo, pas de tunnel — un vrai
   * chantier vide, prêt à recevoir comptes rendus / photos / réserves. On atterrit
   * directement dedans (projet actif). VISION Art. 2.
   */
  async createChantier(input: {
    name: string;
    clientName?: string;
    address?: string;
    startStep?: ProjectStep;
  }): Promise<ProjectId> {
    const name = input.name.trim();
    const clientId = toUserId(crypto.randomUUID());
    const compaId = toUserId(crypto.randomUUID());
    const address = input.address?.trim();
    const project = await backend.createProject({
      name,
      status: 'en_cours',
      clientId,
      ...(address ? { address } : {}),
      ...(input.startStep ? { currentStep: input.startStep } : {}),
    });
    await backend.addMember({ projectId: project.id, userId: compaId, role: 'compagnon' });
    await backend.addMember({ projectId: project.id, userId: clientId, role: 'client' });

    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    people[compaId] = 'Mickaël';
    people[clientId] = input.clientName?.trim() || 'Client';
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
    // Le client devient un CONTACT (source unique de ses coordonnées).
    upsertClientContact({
      projectId: project.id,
      clientId,
      nom: input.clientName?.trim() || 'Client',
      ...(address ? { address } : {}),
    });
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(project.id));
    refresh();
    broadcast();
    return project.id;
  },

  /** Modifie les infos d'un chantier réel (nom, client, adresse, étape). */
  async updateChantier(
    projectId: ProjectId,
    input: { name?: string; clientName?: string; address?: string; startStep?: ProjectStep },
  ): Promise<void> {
    const patch: ProjectPatch = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.address !== undefined) patch.address = input.address.trim();
    if (input.startStep !== undefined) patch.currentStep = input.startStep;
    if (Object.keys(patch).length > 0) await backend.updateProject(projectId, patch);

    if (input.clientName !== undefined) {
      const clientId = snapshot.projects.find((p) => p.id === projectId)?.clientId;
      if (clientId) {
        const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
        people[clientId] = input.clientName.trim() || 'Client';
        localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
        // Source unique : on synchronise le contact « client ».
        upsertClientContact({
          projectId,
          clientId,
          nom: input.clientName.trim() || 'Client',
          ...(input.address !== undefined ? { address: input.address.trim() } : {}),
        });
      }
    }
    refresh();
    broadcast();
  },

  /**
   * Garantit qu'un chantier a un DOSSIER de préparation (EPIC 1). Un chantier
   * créé à la main n'en a pas : on en crée un vide, amorcé depuis ses infos
   * (client, adresse) et la feuille de route standard. Idempotent.
   */
  ensureDossier(project: Project): void {
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    if (dossiers[project.id]) return;
    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    const clientName = project.clientId ? (people[project.clientId] ?? '') : '';
    dossiers[project.id] = {
      infos: {
        ...(clientName ? { clientName } : {}),
        ...(project.address ? { address: project.address } : {}),
      },
      roadmap: PROJECT_STEPS.map((s) => ({ id: s, label: PROJECT_STEP_LABEL[s] })),
      planning: [],
      orders: [],
      selections: [],
      documents: [],
      questions: [],
      sources: [],
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    refresh();
    broadcast();
  },

  /* ------------------------- Annuaire & communication -------------------- */

  /**
   * Garantit qu'un chantier a un CONTACT « client » (source unique de ses
   * coordonnées). Idempotent — pour les chantiers importés/anciens sans contact
   * client. Renvoie l'id du contact.
   */
  ensureClientContact(project: Project): string {
    const clientId = project.clientId;
    if (!clientId) return '';
    const existing = readJson<Contact[]>(CONTACTS_KEY, []).find((c) => c.userId === clientId);
    if (existing) return existing.id;
    const infos = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {})[project.id]?.infos;
    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    upsertClientContact({
      projectId: project.id,
      clientId,
      nom: people[clientId] || infos?.clientName || 'Client',
      ...(infos?.phone ? { phone: infos.phone } : {}),
      ...(infos?.email ? { email: infos.email } : {}),
      ...((infos?.address ?? project.address)
        ? { address: infos?.address ?? project.address }
        : {}),
    });
    refresh();
    broadcast();
    return readJson<Contact[]>(CONTACTS_KEY, []).find((c) => c.userId === clientId)!.id;
  },

  /** Ajoute ou met à jour un contact de l'annuaire (upsert par id). */
  saveContact(contact: Contact): void {
    const list = readJson<Contact[]>(CONTACTS_KEY, []);
    const idx = list.findIndex((c) => c.id === contact.id);
    if (idx >= 0) list[idx] = contact;
    else list.push(contact);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
    // Le contact est la SOURCE UNIQUE : on rafraîchit les instantanés dénormalisés
    // qui le référencent (nom de fournisseur mis en cache sur les commandes du
    // dossier — mutable). Les événements (réserves) sont append-only : leur nom
    // figé reste, mais l'affichage résout toujours le nom vivant via l'id.
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    let touched = false;
    for (const d of Object.values(dossiers)) {
      for (const o of d.orders) {
        if (o.fournisseurContactId === contact.id && o.fournisseur !== contact.nom) {
          o.fournisseur = contact.nom;
          touched = true;
        }
      }
    }
    if (touched) localStorage.setItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    // Si ce contact incarne le client d'un chantier, on tient à jour son nom
    // affichable (people) — un seul endroit d'édition (VISION Art. 6).
    if (contact.userId) {
      const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
      if (people[contact.userId] !== contact.nom) {
        people[contact.userId] = contact.nom;
        localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
      }
    }
    refresh();
    broadcast();
  },

  /** Supprime un contact de l'annuaire. */
  deleteContact(id: string): void {
    const list = readJson<Contact[]>(CONTACTS_KEY, []).filter((c) => c.id !== id);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
    refresh();
    broadcast();
  },

  /** Lie / délie un contact à un chantier (toggle). */
  toggleContactProject(id: string, projectId: string): void {
    const list = readJson<Contact[]>(CONTACTS_KEY, []).map((c) => {
      if (c.id !== id) return c;
      const has = c.projectIds.includes(projectId);
      return {
        ...c,
        projectIds: has
          ? c.projectIds.filter((p) => p !== projectId)
          : [...c.projectIds, projectId],
      };
    });
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
    refresh();
    broadcast();
  },

  /**
   * Trace une COMMUNICATION lancée depuis PHÉNIX (l'app native s'ouvre à côté).
   * Append-only au Journal du chantier, TOUJOURS interne (jamais côté client,
   * VISION Art. 9). Sans chantier (annuaire global d'un contact non lié), on
   * n'écrit pas au Journal — l'app native s'ouvre quand même.
   */
  async logCommunication(
    projectId: ProjectId | null,
    input: {
      canal: CommCanal;
      contactNom: string;
      contactId?: string;
      role?: string;
      sujet?: string;
    },
  ): Promise<void> {
    if (!projectId) return;
    const member = snapshot.members.find(
      (m) => m.projectId === projectId && m.role === 'compagnon',
    );
    const uid = member?.userId ?? toUserId('compagnon-demo');
    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    const actor: EventActor = {
      userId: uid,
      role: 'compagnon',
      displayName: people[uid] ?? 'Mickaël',
    };
    await backend.appendEvent({
      projectId,
      actor,
      type: 'communication',
      visibility: 'interne',
      state: 'publie',
      content: {
        canal: input.canal,
        contactNom: input.contactNom,
        ...(input.contactId ? { contactId: input.contactId } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.sujet ? { sujet: input.sujet } : {}),
      },
    });
    refresh();
    broadcast();
  },

  /**
   * Dépose un DOCUMENT de préparation. Le FICHIER rejoint la base UNIQUE (un
   * événement `document` du Journal = la bibliothèque `vault`), INTERNE par
   * défaut (client-safe) ; la checklist du dossier ne fait que POINTER vers lui
   * (`eventId`). Sans fichier, on ajoute une simple entrée « à fournir » (suivi
   * d'obtention). Fini le silo : un document préparé remonte au Journal.
   */
  async addPrepDocument(
    projectId: ProjectId,
    input: { label: string; categorie?: PrepDocCategory; attachment?: EventAttachment },
  ): Promise<void> {
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    const dossier = dossiers[projectId];
    if (!dossier) return;
    let eventId: string | undefined;
    if (input.attachment) {
      const member = snapshot.members.find(
        (m) => m.projectId === projectId && m.role === 'compagnon',
      );
      const uid = member?.userId ?? toUserId('compagnon-demo');
      const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
      const actor: EventActor = {
        userId: uid,
        role: 'compagnon',
        displayName: people[uid] ?? 'Mickaël',
      };
      const ev = await backend.appendEvent({
        projectId,
        actor,
        type: 'document',
        visibility: 'interne',
        state: 'publie',
        content: {
          attachment: input.attachment,
          libelle: input.label,
          ...(input.categorie ? { categorie: input.categorie } : {}),
        },
      });
      eventId = ev.id;
    }
    const doc: ProjectDocument = {
      id: crypto.randomUUID(),
      label: input.label,
      ...(input.categorie ? { categorie: input.categorie } : {}),
      status: input.attachment ? 'fourni' : 'a_fournir',
      ...(eventId ? { eventId } : {}),
    };
    dossier.documents = [...dossier.documents, doc];
    dossiers[projectId] = dossier;
    localStorage.setItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    refresh();
    broadcast();
  },

  /** Met à jour le dossier préparé d'un projet (éditions ultérieures). */
  saveDossier(projectId: ProjectId, dossier: ProjectDossier): void {
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    dossiers[projectId] = dossier;
    localStorage.setItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    refresh();
    broadcast();
  },

  /**
   * Crée une DÉCISION CLIENT depuis « Nouvelle mission » : un choix PROPOSÉ
   * (titre + contexte + photos + options, la délégation PHÉNIX est offerte
   * d'office par la galerie). Réutilise le modèle existant — une `ClientSelection`
   * dans le dossier (donc `ensureDossier`) alimente « Une décision vous attend » ;
   * une trace `decision`/`envoyee` (interne) est ajoutée au Journal (append-only).
   */
  async createClientDecision(
    project: Project,
    actor: EventActor,
    input: { titre: string; contexte?: string; photos?: string[]; options: SelectionOption[] },
  ): Promise<void> {
    demo.ensureDossier(project);
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    const dossier = dossiers[project.id];
    if (!dossier) return;
    const selection: ClientSelection = {
      id: crypto.randomUUID(),
      categorie: input.titre,
      label: input.titre,
      statut: 'propose',
      ...(input.contexte ? { contexte: input.contexte } : {}),
      ...(input.photos && input.photos.length > 0 ? { photos: input.photos } : {}),
      options: input.options,
    };
    dossiers[project.id] = { ...dossier, selections: [...dossier.selections, selection] };
    localStorage.setItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    const content = buildDecisionContent({
      kind: 'envoyee',
      origin: 'conducteur',
      selection,
      statutApres: 'propose',
    });
    await backend.appendEvent({
      projectId: project.id,
      actor,
      type: 'decision',
      visibility: decisionVisibility('envoyee'),
      state: 'publie',
      content,
    });
    refresh();
    broadcast();
  },

  /**
   * Épingle / retire un événement de l'historique. C'est une ANNOTATION (on
   * référence l'événement du journal), jamais une copie — le journal reste la
   * source unique.
   */
  togglePin(projectId: ProjectId, eventId: string): void {
    const pins = readJson<Record<string, string[]>>(PINS_KEY, {});
    const current = pins[projectId] ?? [];
    pins[projectId] = current.includes(eventId)
      ? current.filter((id) => id !== eventId)
      : [...current, eventId];
    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
    refresh();
    broadcast();
  },

  /* ------------------------------- Le Fil -------------------------------- */

  /**
   * Crée un MOMENT de chantier — le geste unique du conducteur. Le Moment est
   * INTERNE par défaut (`INTERNAL_AUDIENCE`) : il n'apparaît dans l'espace client
   * que si `shareWithClient` est vrai (ou plus tard via `shareMoment`). Une OU
   * plusieurs photos (album) : `medias` dans l'ordre, `coverIndex` = couverture.
   * `observations` = le récit libre ; `intervenants` = qui était présent.
   */
  addMoment(input: {
    projectId: ProjectId;
    actor: EventActor;
    title: string;
    medias: UploadedMedia[];
    coverIndex?: number;
    zoneId?: ZoneId;
    legende?: string;
    type?: MomentType;
    observations?: string;
    intervenants?: string[];
    shareWithClient?: boolean;
  }): void {
    if (input.medias.length === 0) return;
    const now = new Date().toISOString();
    const coverIdx = Math.min(Math.max(input.coverIndex ?? 0, 0), input.medias.length - 1);
    const legende = input.legende?.trim();
    const observations = input.observations?.trim();
    const intervenants = (input.intervenants ?? []).map((s) => s.trim()).filter(Boolean);
    const photos: FilPhoto[] = input.medias.map((m, i) => ({
      id: toFilPhotoId(crypto.randomUUID()),
      imageUrl: m.imageUrl,
      bucket: m.bucket,
      storagePath: m.storagePath,
      mimeType: m.mimeType,
      width: m.width,
      height: m.height,
      ...(i === coverIdx && legende ? { legende } : {}),
      ordre: i,
      createdAt: now,
    }));
    const moment: Moment = {
      id: toMomentId(crypto.randomUUID()),
      projectId: input.projectId,
      authorId: input.actor.userId,
      authorRole: input.actor.role,
      createdAt: now,
      publishedAt: now,
      state: 'publie',
      type: input.type ?? 'note',
      title: input.title.trim(),
      visibleTo: input.shareWithClient ? SHARED_AUDIENCE : INTERNAL_AUDIENCE,
      photos,
      coverPhotoId: photos[coverIdx]!.id,
      ...(observations ? { observations } : {}),
      ...(intervenants.length ? { intervenants } : {}),
      ...(input.zoneId ? { zoneId: input.zoneId } : {}),
    };
    const map = readJson<Record<string, Moment[]>>(FIL_MOMENTS_KEY, {});
    map[input.projectId] = [...(map[input.projectId] ?? []), moment];
    localStorage.setItem(FIL_MOMENTS_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /**
   * PARTAGER un Moment avec le client (ou le repasser en interne). « Partager »
   * est une ACTION, jamais un nouvel objet : on bascule seulement l'audience du
   * Moment. Une fois partagé, il apparaît dans le Fil client (projection).
   */
  shareMoment(projectId: ProjectId, momentId: string, shared = true): void {
    const map = readJson<Record<string, Moment[]>>(FIL_MOMENTS_KEY, {});
    map[projectId] = (map[projectId] ?? []).map((m) =>
      m.id === momentId ? { ...m, visibleTo: shared ? SHARED_AUDIENCE : INTERNAL_AUDIENCE } : m,
    );
    localStorage.setItem(FIL_MOMENTS_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /** Supprime un Moment (l'UI ne l'autorise que tant qu'il n'est pas verrouillé). */
  deleteMoment(projectId: ProjectId, momentId: string): void {
    const map = readJson<Record<string, Moment[]>>(FIL_MOMENTS_KEY, {});
    map[projectId] = (map[projectId] ?? []).filter((m) => m.id !== momentId);
    localStorage.setItem(FIL_MOMENTS_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /** Bascule le ♡ coup de cœur d'un utilisateur sur un Moment. */
  toggleCoupDeCoeur(projectId: ProjectId, momentId: string, actor: EventActor): void {
    const map = readJson<Record<string, CoupDeCoeur[]>>(FIL_COUPS_KEY, {});
    const current = map[projectId] ?? [];
    const existing = current.find((c) => c.momentId === momentId && c.userId === actor.userId);
    map[projectId] = existing
      ? current.filter((c) => c.id !== existing.id)
      : [
          ...current,
          {
            id: toCoupId(crypto.randomUUID()),
            momentId: momentId as CoupDeCoeur['momentId'],
            userId: actor.userId,
            userRole: actor.role,
            createdAt: new Date().toISOString(),
          },
        ];
    localStorage.setItem(FIL_COUPS_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /**
   * Laisse un message sous un Moment. `photoId` null = message du Moment
   * (niveau 1) ; renseigné = message attaché à une PHOTO précise (niveau 2).
   */
  addMessage(
    projectId: ProjectId,
    momentId: string,
    actor: EventActor,
    texte: string,
    photoId: string | null = null,
  ): void {
    const trimmed = texte.trim();
    if (!trimmed) return;
    const map = readJson<Record<string, Message[]>>(FIL_MESSAGES_KEY, {});
    const message: Message = {
      id: toMessageId(crypto.randomUUID()),
      momentId: momentId as Message['momentId'],
      photoId: photoId as Message['photoId'],
      parentId: null,
      authorId: actor.userId,
      authorRole: actor.role,
      texte: trimmed,
      createdAt: new Date().toISOString(),
    };
    map[projectId] = [...(map[projectId] ?? []), message];
    localStorage.setItem(FIL_MESSAGES_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /**
   * Ajoute une ANNOTATION sur une photo (calque indépendant — l'image d'origine
   * n'est jamais modifiée). Si `note` est fournie, on crée aussi un message
   * (niveau 2) rattaché à l'annotation (commentaire contextualisé).
   */
  addAnnotation(
    projectId: ProjectId,
    input: {
      momentId: string;
      photoId: string;
      actor: EventActor;
      type: AnnotationType;
      points: { x: number; y: number }[];
      color?: string;
      texte?: string;
      numero?: number;
      note?: string;
    },
  ): void {
    const now = new Date().toISOString();
    let linkedMessageId: Annotation['messageId'] = null;

    const note = input.note?.trim();
    if (note) {
      const msgMap = readJson<Record<string, Message[]>>(FIL_MESSAGES_KEY, {});
      const message: Message = {
        id: toMessageId(crypto.randomUUID()),
        momentId: input.momentId as Message['momentId'],
        photoId: input.photoId as Message['photoId'],
        parentId: null,
        authorId: input.actor.userId,
        authorRole: input.actor.role,
        texte: note,
        createdAt: now,
      };
      msgMap[projectId] = [...(msgMap[projectId] ?? []), message];
      localStorage.setItem(FIL_MESSAGES_KEY, JSON.stringify(msgMap));
      linkedMessageId = message.id;
    }

    const annotation: Annotation = {
      id: toAnnotationId(crypto.randomUUID()),
      projectId,
      momentId: input.momentId as Annotation['momentId'],
      photoId: input.photoId as Annotation['photoId'],
      type: input.type,
      points: input.points,
      color: input.color ?? '#d4452f',
      ...(input.texte ? { texte: input.texte } : {}),
      ...(input.numero != null ? { numero: input.numero } : {}),
      authorId: input.actor.userId,
      authorRole: input.actor.role,
      visibleTo: DEFAULT_AUDIENCE,
      createdAt: now,
      messageId: linkedMessageId,
    };
    const map = readJson<Record<string, Annotation[]>>(FIL_ANNOTATIONS_KEY, {});
    map[projectId] = [...(map[projectId] ?? []), annotation];
    localStorage.setItem(FIL_ANNOTATIONS_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /** Supprime une annotation (le calque ; l'image d'origine est intacte). */
  deleteAnnotation(projectId: ProjectId, annotationId: string): void {
    const map = readJson<Record<string, Annotation[]>>(FIL_ANNOTATIONS_KEY, {});
    map[projectId] = (map[projectId] ?? []).filter((a) => a.id !== annotationId);
    localStorage.setItem(FIL_ANNOTATIONS_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /**
   * PONT MANUEL annotation → Réserve. Crée une RÉSERVE (vrai objet de pilotage)
   * dans le Journal — numérotée, datée, avec responsable/échéance et lien retour
   * vers la photo annotée. Marque l'annotation comme convertie.
   */
  async createReserveFromAnnotation(
    projectId: ProjectId,
    annotationId: string,
    actor: EventActor,
    options: { responsable?: string; echeance?: string } = {},
  ): Promise<void> {
    const map = readJson<Record<string, Annotation[]>>(FIL_ANNOTATIONS_KEY, {});
    const list = map[projectId] ?? [];
    const annotation = list.find((a) => a.id === annotationId);
    if (!annotation || annotation.action) return;

    const messages = readJson<Record<string, Message[]>>(FIL_MESSAGES_KEY, {})[projectId] ?? [];
    const linked = annotation.messageId
      ? messages.find((m) => m.id === annotation.messageId)
      : undefined;
    const libelle = (linked?.texte ?? annotation.texte ?? 'Point signalé sur une photo').trim();

    const projectEvents = snapshot.events.filter((e) => e.projectId === projectId);
    const responsable = options.responsable?.trim();
    const echeance = options.echeance?.trim();

    const event = await backend.appendEvent({
      projectId,
      actor,
      type: 'reserve',
      visibility: 'interne',
      state: 'ouverte',
      content: {
        numero: nextReserveNumero(projectEvents),
        libelle,
        ...(responsable ? { responsable } : {}),
        ...(echeance ? { echeance } : {}),
        source: {
          kind: 'fil',
          momentId: annotation.momentId,
          photoId: annotation.photoId,
          annotationId: annotation.id,
        },
      },
    });

    map[projectId] = list.map((a) =>
      a.id === annotationId ? { ...a, action: { kind: 'reserve', ref: event.id } } : a,
    );
    localStorage.setItem(FIL_ANNOTATIONS_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /**
   * Création MANUELLE d'une réserve par le conducteur (registre pilotable). Même
   * objet que celles nées d'une photo annotée — interne, ouverte, numérotée par
   * projet — mais sans source Fil. Append-only : elle rejoint le Journal, la
   * lentille Réserves la lit, Aujourd'hui/soir la comptent (VISION Art. 7, 8, 9).
   */
  async createReserve(
    projectId: ProjectId,
    actor: EventActor,
    input: {
      libelle: string;
      responsableContactId?: string;
      echeance?: string;
      priorite?: ActionPriorite;
    },
  ): Promise<void> {
    const libelle = input.libelle.trim();
    if (!libelle) return;
    const projectEvents = snapshot.events.filter((e) => e.projectId === projectId);
    // Le responsable est un CONTACT (source unique) ; on fige son nom au moment
    // de la création (instantané append-only, jamais ressaisi).
    const contact = input.responsableContactId
      ? snapshot.contacts.find((c) => c.id === input.responsableContactId)
      : undefined;
    const echeance = input.echeance?.trim();
    await backend.appendEvent({
      projectId,
      actor,
      type: 'reserve',
      visibility: 'interne',
      state: 'ouverte',
      content: {
        numero: nextReserveNumero(projectEvents),
        libelle,
        ...(contact ? { responsableContactId: contact.id, responsable: contact.nom } : {}),
        ...(echeance ? { echeance } : {}),
        ...(input.priorite ? { priorite: input.priorite } : {}),
      },
    });
    refresh();
    broadcast();
  },

  /* --------------------------- Mode Artisan ------------------------------- */

  /**
   * L'artisan SIGNALE au conducteur une intervention terminée (« à valider »).
   * Canal distinct des questions client (`destinataire: 'conducteur'`), toujours
   * INTERNE : jamais exposé au client (VISION Art. 9). Le conducteur le voit dans
   * son journal / le radar, puis valide (ex. lève la réserve).
   */
  async artisanSignal(projectId: ProjectId, actor: EventActor, libelle: string): Promise<void> {
    const question = libelle.trim();
    if (!question) return;
    await backend.appendEvent({
      projectId,
      actor,
      type: 'demande',
      visibility: 'interne',
      state: 'ouverte',
      content: { question, destinataire: 'conducteur' },
    });
    refresh();
    broadcast();
  },

  /**
   * L'artisan PARTAGE une photo (et un mot en légende) de son avancement. Photo
   * interne (visible de l'équipe, jamais du client tant qu'elle n'est pas
   * repartagée). Réutilise le même modèle de pièce jointe que le reste du Fil.
   */
  async artisanPhoto(
    projectId: ProjectId,
    actor: EventActor,
    input: { legende?: string; piece?: string },
  ): Promise<void> {
    const legende = input.legende?.trim();
    const piece = input.piece?.trim();
    await backend.appendEvent({
      projectId,
      actor,
      type: 'photo',
      visibility: 'interne',
      state: 'publie',
      content: {
        attachment: {
          id: toAttachmentId(crypto.randomUUID()),
          kind: 'photo',
          bucket: 'demo',
          storagePath: `${projectId}/${crypto.randomUUID()}.jpg`,
          mimeType: 'image/jpeg',
          createdAt: new Date().toISOString(),
        },
        ...(legende ? { legende } : {}),
        ...(piece ? { piece } : {}),
      },
    });
    refresh();
    broadcast();
  },

  /**
   * LEVÉE d'une réserve (append-only). On n'efface ni ne modifie jamais la
   * réserve : on AJOUTE au Journal un événement `levee` qui pointe vers elle,
   * avec une note et une photo de preuve facultatives. L'auteur et la date de
   * levée sont portés par l'enveloppe. Le statut « levée » se LIT ensuite
   * (présence de cet événement) — la réserve garde son origine intacte.
   */
  async leverReserve(
    projectId: ProjectId,
    reserveEventId: string,
    actor: EventActor,
    options: { note?: string; preuve?: UploadedMedia } = {},
  ): Promise<void> {
    const reserve = snapshot.events.find((e) => e.id === reserveEventId && e.type === 'reserve');
    if (!reserve || reserve.type !== 'reserve') return;
    // Idempotence : une réserve déjà levée ne se relève pas.
    const dejaLevee = snapshot.events.some(
      (e) => e.type === 'levee' && e.content.reserveId === reserveEventId,
    );
    if (dejaLevee) return;

    const note = options.note?.trim();
    const m = options.preuve;
    const preuve = m
      ? {
          imageUrl: m.imageUrl,
          bucket: m.bucket,
          storagePath: m.storagePath,
          mimeType: m.mimeType,
          ...(m.width != null ? { width: m.width } : {}),
          ...(m.height != null ? { height: m.height } : {}),
        }
      : undefined;

    await backend.appendEvent({
      projectId,
      actor,
      type: 'levee',
      visibility: 'interne',
      state: 'publie',
      content: {
        reserveId: reserveEventId,
        reserveNumero: reserve.content.numero,
        ...(note ? { note } : {}),
        ...(preuve ? { preuve } : {}),
      },
    });
    refresh();
    broadcast();
  },

  /* ------------------------- Gestion du chantier ------------------------- */

  /**
   * Crée une MISSION (le geste unique du conducteur). Le contexte = un Moment
   * (type = mission), INTERNE par défaut. PHÉNIX a préparé (`prepared`) ; on
   * matérialise les FAITS dans le Journal (append-only) : 1 `compte_rendu` (le
   * fait de la mission, avec sa structure) + N `reserve` (points à reprendre).
   * Aucune donnée n'atteint le client tant qu'on ne partage pas.
   */
  async createMission(
    projectId: ProjectId,
    actor: EventActor,
    input: {
      kind: MissionKind;
      medias: UploadedMedia[];
      recit: string;
      presents: string[];
      zoneId?: ZoneId;
      prepared: MissionPreparation;
    },
  ): Promise<{ missionEventId: string; momentId: string }> {
    const now = new Date().toISOString();
    const momentId = toMomentId(crypto.randomUUID());

    // 1) Le contexte : un Moment interne (photos + récit + présents).
    const photos: FilPhoto[] = input.medias.map((m, i) => ({
      id: toFilPhotoId(crypto.randomUUID()),
      imageUrl: m.imageUrl,
      bucket: m.bucket,
      storagePath: m.storagePath,
      mimeType: m.mimeType,
      width: m.width,
      height: m.height,
      ordre: i,
      createdAt: now,
    }));
    const recit = input.recit.trim();
    const presents = input.prepared.presents;
    const moment: Moment = {
      id: momentId,
      projectId,
      authorId: actor.userId,
      authorRole: actor.role,
      createdAt: now,
      publishedAt: now,
      state: 'publie',
      type: input.kind,
      title: input.prepared.docTitre,
      visibleTo: INTERNAL_AUDIENCE,
      photos,
      ...(photos[0] ? { coverPhotoId: photos[0].id } : {}),
      ...(recit ? { observations: recit } : {}),
      ...(presents.length ? { intervenants: presents } : {}),
      ...(input.zoneId ? { zoneId: input.zoneId } : {}),
    };
    const momentsMap = readJson<Record<string, Moment[]>>(FIL_MOMENTS_KEY, {});
    momentsMap[projectId] = [...(momentsMap[projectId] ?? []), moment];
    localStorage.setItem(FIL_MOMENTS_KEY, JSON.stringify(momentsMap));

    // 2) Le fait « compte rendu » de la mission (interne).
    const crEvent = await backend.appendEvent({
      projectId,
      actor,
      type: 'compte_rendu',
      visibility: 'interne',
      state: 'publie',
      content: {
        texte: input.prepared.corps,
        missionKind: input.kind,
        docTitre: input.prepared.docTitre,
        momentId,
        ...(presents.length ? { presents } : {}),
        ...(input.prepared.decisions.length ? { decisions: input.prepared.decisions } : {}),
        ...(input.prepared.actions.length ? { actions: input.prepared.actions } : {}),
        ...(input.prepared.questionsClient.length
          ? { questionsClient: input.prepared.questionsClient }
          : {}),
        ...(input.prepared.manquants.length ? { manquants: input.prepared.manquants } : {}),
        texteClient: input.prepared.texteClient,
      },
    });

    // 3) Les faits « réserve » (append-only, numérotés, avec responsable/échéance).
    let numero = nextReserveNumero(snapshot.events.filter((e) => e.projectId === projectId));
    for (const r of input.prepared.reserves) {
      await backend.appendEvent({
        projectId,
        actor,
        type: 'reserve',
        visibility: 'interne',
        state: 'ouverte',
        content: {
          numero,
          libelle: r.libelle,
          ...(r.responsable ? { responsable: r.responsable } : {}),
          ...(r.echeance ? { echeance: r.echeance } : {}),
          source: {
            kind: 'fil',
            momentId,
            ...(r.photoId ? { photoId: r.photoId } : {}),
          },
        },
      });
      numero += 1;
    }

    // 4) Les faits « action » — les engagements nés de la mission (« PHÉNIX ne
    //    lâche rien »). Interne, à faire, rattachés à la mission.
    for (const a of input.prepared.actions) {
      await backend.appendEvent({
        projectId,
        actor,
        type: 'action',
        visibility: 'interne',
        state: 'publie',
        content: {
          libelle: a.label,
          statut: 'a_faire',
          ...(a.responsable ? { responsable: a.responsable } : {}),
          ...(a.echeance ? { echeance: a.echeance } : {}),
          ...(a.priorite ? { priorite: a.priorite } : {}),
          ...(a.commentaire ? { commentaire: a.commentaire } : {}),
          source: { kind: 'fil', momentId },
        },
      });
    }

    refresh();
    broadcast();
    return { missionEventId: crEvent.id, momentId };
  },

  /**
   * PARTAGER une mission. « Partager » est une ACTION, jamais un objet. Vers le
   * CLIENT : on émet une projection CLIENT-SAFE (la voix client) + on partage les
   * photos ; jamais de réserve, responsable ni donnée interne. Vers les autres
   * audiences (artisan, architecte, BC, MOE, investisseur) : simulation /
   * journalisation / aperçu (pas d'envoi mail réel, pas de signature réelle).
   */
  async shareMission(
    projectId: ProjectId,
    actor: EventActor,
    input: {
      missionEventId: string;
      momentId: string;
      audiences: string[];
      texteClient: string;
      docTitre: string;
    },
  ): Promise<void> {
    if (input.audiences.includes('client')) {
      // Projection CLIENT-SAFE : uniquement un compte rendu en voix client. Le
      // Moment (photos + récit brut interne) N'EST JAMAIS partagé tel quel — il
      // contient des observations internes (actions, réserves) qui ne doivent
      // pas fuiter. Le client ne voit que ce texte reformulé et neutre.
      await backend.appendEvent({
        projectId,
        actor,
        type: 'compte_rendu',
        visibility: 'client',
        state: 'publie',
        content: {
          texte: input.texteClient,
          docTitre: input.docTitre,
        },
      });
    }

    // Journalisation du partage (aperçu / simulation) pour toutes les audiences.
    const shares = readJson<Record<string, ShareLog[]>>(SHARES_KEY, {});
    shares[projectId] = [
      ...(shares[projectId] ?? []),
      {
        id: crypto.randomUUID(),
        missionEventId: input.missionEventId,
        audiences: input.audiences,
        at: new Date().toISOString(),
      },
    ];
    localStorage.setItem(SHARES_KEY, JSON.stringify(shares));
    refresh();
    broadcast();
  },

  /**
   * PHÉNIX répond au client (B1). Le fil de conversation est un agrégat léger
   * (hors Journal). PHÉNIX ne répond QUE s'il a une donnée fiable ; sinon il
   * escalade en créant une demande (`destinataire: 'phenix'`) au Journal, qui
   * remonte côté conducteur (« Répondre au client » / le radar).
   */
  async askPhenix(
    projectId: ProjectId,
    actor: EventActor,
    question: string,
  ): Promise<PhenixMessage | null> {
    const texte = question.trim();
    if (!texte) return null;
    const now = new Date().toISOString();
    const conv = readJson<Record<string, PhenixMessage[]>>(PHENIX_CONV_KEY, {});
    const list = conv[projectId] ?? [];

    const clientMsg: PhenixMessage = {
      id: crypto.randomUUID(),
      role: 'client',
      texte,
      at: now,
    };

    const events = snapshot.events.filter((e) => e.projectId === projectId);
    const dossier = snapshot.dossiers[projectId] ?? null;
    // PHÉNIX est le concierge du CLIENT : il ne connaît que les Moments partagés
    // (jamais l'interne). Le Fil client est une projection — la règle est unique.
    const moments = (snapshot.fil.moments[projectId] ?? []).filter(momentPartageClient);
    const zones = snapshot.fil.zones[projectId] ?? [];
    const history = list.map((m) => ({ role: m.role, texte: m.texte }));
    const reply = corePhenix({ question: texte, events, dossier, moments, zones, history });

    const phenixMsg: PhenixMessage = {
      id: crypto.randomUUID(),
      role: 'phenix',
      texte: reply.message,
      at: now,
      kind: reply.kind,
      ...(reply.sources.length ? { sources: reply.sources } : {}),
      ...(reply.avancer ? { avancer: reply.avancer } : {}),
      ...(reply.action ? { action: reply.action } : {}),
    };

    conv[projectId] = [...list, clientMsg, phenixMsg];
    localStorage.setItem(PHENIX_CONV_KEY, JSON.stringify(conv));

    // Escalade : on ouvre une demande au Journal et on la relie au message.
    if (reply.kind === 'escalade' && reply.escaladeQuestion) {
      const event = await backend.appendEvent({
        projectId,
        actor,
        type: 'demande',
        visibility: 'client',
        state: 'ouverte',
        content: { question: reply.escaladeQuestion, destinataire: 'phenix' },
      });
      const map = readJson<Record<string, PhenixMessage[]>>(PHENIX_CONV_KEY, {});
      map[projectId] = (map[projectId] ?? []).map((m) =>
        m.id === phenixMsg.id ? { ...m, demandeRef: event.id } : m,
      );
      localStorage.setItem(PHENIX_CONV_KEY, JSON.stringify(map));
    }
    refresh();
    broadcast();
    // On renvoie le message (avec `autoOpen` TRANSITOIRE — jamais persisté) pour
    // que l'UI exécute l'ouverture des commandes explicites.
    return { ...phenixMsg, ...(reply.autoOpen ? { autoOpen: true } : {}) };
  },

  /** Charge le chantier de démonstration (jeu de données vivant). */
  loadDemo(): void {
    const { state, people, activeProjectId, dossiers, contacts, fil } = buildDemoSeed();
    kv.save(state);
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeProjectId));
    localStorage.setItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    localStorage.removeItem(PINS_KEY);
    localStorage.setItem(FIL_MOMENTS_KEY, JSON.stringify(fil.moments));
    localStorage.setItem(FIL_COUPS_KEY, JSON.stringify(fil.coups));
    localStorage.setItem(FIL_MESSAGES_KEY, JSON.stringify(fil.messages));
    localStorage.setItem(FIL_ZONES_KEY, JSON.stringify(fil.zones));
    localStorage.setItem(FIL_ANNOTATIONS_KEY, JSON.stringify(fil.annotations));
    localStorage.removeItem(PHENIX_CONV_KEY);
    localStorage.removeItem(SHARES_KEY);
    localStorage.setItem(SEEDED_KEY, '1');
    refresh();
    broadcast();
  },

  /** Repart de zéro (états vides élégants) — sans réamorcer la démo. */
  reset(): void {
    clearWorkspace();
    refresh();
    broadcast();
  },

  /**
   * Démarrer à vide au premier lancement : un espace de travail propre, prêt
   * pour de VRAIS chantiers (pas la démo). Marque l'espace initialisé.
   */
  startBlank(): void {
    clearWorkspace();
    refresh();
    broadcast();
  },

  /**
   * SAUVEGARDE (Lot 4) : sérialise tout l'espace de travail local en une chaîne
   * JSON lisible. Le fichier contient chantiers/journal, missions, réserves,
   * actions, tout le Fil (photos localStorage comprises), les dossiers, les
   * paramètres (noms, projet actif) et les conversations PHÉNIX.
   */
  exportWorkspace(): string {
    const data: Record<string, unknown> = {};
    for (const key of WORKSPACE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
    return JSON.stringify(
      { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data },
      null,
      2,
    );
  },

  /**
   * RESTAURATION (Lot 4) : remplace INTÉGRALEMENT l'espace de travail par une
   * sauvegarde. Validation stricte AVANT toute écriture — en cas de fichier
   * invalide, rien n'est modifié (aucune perte silencieuse). Sur succès, l'état
   * courant est entièrement remplacé (les clés absentes de la sauvegarde sont
   * retirées) : ce qui est restauré est exactement le contenu du fichier.
   */
  importWorkspace(json: string): { ok: true } | { ok: false; error: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, error: 'Fichier illisible : ce n’est pas un JSON valide.' };
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, error: 'Fichier invalide : structure inattendue.' };
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.app !== BACKUP_APP) {
      return { ok: false, error: 'Ce fichier n’est pas une sauvegarde PHÉNIX 360.' };
    }
    if (typeof obj.data !== 'object' || obj.data === null) {
      return { ok: false, error: 'Sauvegarde invalide : données manquantes.' };
    }
    const data = obj.data as Record<string, unknown>;
    // Restauration COMPLÈTE : on remplace l'espace par la sauvegarde.
    for (const key of WORKSPACE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        localStorage.setItem(key, JSON.stringify(data[key]));
      } else {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem(SEEDED_KEY, '1');
    refresh();
    broadcast();
    return { ok: true };
  },
};

// Au tout premier lancement, on N'IMPOSE PAS la démo : l'application propose un
// choix (découvrir la démo / démarrer à vide). Le marqueur `SEEDED_KEY` reste
// donc absent tant qu'aucun choix n'a été fait (cf. `snapshot.seeded`).

export function useDemo(): DemoSnapshot {
  return useSyncExternalStore(demo.subscribe, demo.getSnapshot, demo.getSnapshot);
}

/** Nom affichable d'un utilisateur (fallback générique). */
export function nameOf(snap: DemoSnapshot, userId: string | null | undefined): string {
  if (!userId) return 'PHÉNIX';
  return snap.people[userId] ?? 'PHÉNIX';
}

/** Dossier préparé d'un projet (s'il a été créé via PHÉNIX Start). */
export function dossierOf(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): ProjectDossier | null {
  if (!projectId) return null;
  return snap.dossiers[projectId] ?? null;
}

/** Identifiants d'événements épinglés à l'historique d'un projet. */
export function pinnedOf(snap: DemoSnapshot, projectId: string | null | undefined): Set<string> {
  if (!projectId) return new Set();
  return new Set(snap.pins[projectId] ?? []);
}

/** Le fil de conversation PHÉNIX d'un projet (côté client). */
export function conversationOf(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): PhenixMessage[] {
  if (!projectId) return [];
  return snap.phenix[projectId] ?? [];
}

/** Contacts de l'annuaire liés à un chantier. */
export function contactsOf(snap: DemoSnapshot, projectId: string | null | undefined): Contact[] {
  if (!projectId) return [];
  return snap.contacts.filter((c) => c.projectIds.includes(projectId));
}

/** Le CONTACT qui incarne le client d'un chantier (source unique de ses coordonnées). */
export function clientContactOf(
  snap: DemoSnapshot,
  clientId: string | null | undefined,
): Contact | undefined {
  if (!clientId) return undefined;
  return snap.contacts.find((c) => c.userId === clientId);
}

/** Historique des communications tracées vers un contact (tous chantiers, récentes d'abord). */
export function communicationsOf(snap: DemoSnapshot, contactId: string): Event[] {
  return snap.events
    .filter((e) => e.type === 'communication' && e.content.contactId === contactId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Dernier message de chaque Moment (source unique des « en attente »). */
function lastMessagePerMoment(messages: Message[]): Map<string, Message> {
  const byMoment = new Map<string, Message[]>();
  for (const m of messages) {
    const arr = byMoment.get(m.momentId) ?? [];
    arr.push(m);
    byMoment.set(m.momentId, arr);
  }
  const last = new Map<string, Message>();
  for (const [id, arr] of byMoment) {
    const l = [...arr].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
    if (l) last.set(id, l);
  }
  return last;
}

/** Le Moment `id` a-t-il été consulté par `role` depuis son dernier message ? */
function momentSeenSince(snap: DemoSnapshot, role: string, id: string, last: Message): boolean {
  const at = snap.seen[role]?.[id];
  return at !== undefined && at >= last.createdAt;
}

/**
 * Moments dont le DERNIER message est du CLIENT — en attente d'une réponse du
 * CONDUCTEUR (« la balle est dans son camp »). Signalé dans Aujourd'hui + sur le
 * Moment. S'éteint de DEUX façons : le conducteur RÉPOND (son message devient le
 * dernier) OU il CONSULTE le Moment (accusé de lecture `seen['compagnon']`).
 */
export function pendingClientMoments(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): Set<string> {
  const pending = new Set<string>();
  if (!projectId) return pending;
  for (const [id, last] of lastMessagePerMoment(snap.fil.messages[projectId] ?? []))
    if (last.authorRole === 'client' && !momentSeenSince(snap, 'compagnon', id, last))
      pending.add(id);
  return pending;
}

/** Nombre de moments en attente d'une réponse du conducteur (commentaires clients). */
export function pendingClientCommentCount(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): number {
  return pendingClientMoments(snap, projectId).size;
}

/**
 * SYMÉTRIQUE côté client : moments PARTAGÉS au client dont le dernier message est
 * de l'ÉQUIPE (conducteur). C'est un mot du conducteur que le client n'a pas
 * encore vu/traité → on le notifie dans son espace. Répondre (côté client) vide
 * l'état. Ne concerne que les moments visibles du client (jamais l'interne).
 */
export function pendingTeamMoments(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): Set<string> {
  const pending = new Set<string>();
  if (!projectId) return pending;
  const shared = new Set<string>(
    (snap.fil.moments[projectId] ?? []).filter(momentPartageClient).map((m) => m.id),
  );
  for (const [id, last] of lastMessagePerMoment(snap.fil.messages[projectId] ?? []))
    if (
      shared.has(id) &&
      last.authorRole !== 'client' &&
      !momentSeenSince(snap, 'client', id, last)
    )
      pending.add(id);
  return pending;
}

/** Nombre de moments avec un message d'équipe en attente côté client. */
export function pendingTeamMessageCount(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): number {
  return pendingTeamMoments(snap, projectId).size;
}

/**
 * Le Moment le plus RÉCENT parmi un ensemble (dernier message le plus tardif) :
 * la cible qu'une notification ouvre quand plusieurs sont en attente (« ouvrir
 * la plus récente »). Le compteur, lui, montre le nombre total.
 */
function mostRecentMoment(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
  ids: Set<string>,
): string | undefined {
  if (!projectId || ids.size === 0) return undefined;
  const last = lastMessagePerMoment(snap.fil.messages[projectId] ?? []);
  let bestId: string | undefined;
  let bestAt = '';
  for (const id of ids) {
    const at = last.get(id)?.createdAt ?? '';
    if (at >= bestAt) {
      bestAt = at;
      bestId = id;
    }
  }
  return bestId;
}

/** Le commentaire client le plus récent en attente (cible de la notification conducteur). */
export function mostRecentPendingClientMoment(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): string | undefined {
  return mostRecentMoment(snap, projectId, pendingClientMoments(snap, projectId));
}

/** Le message d'équipe le plus récent en attente (cible de la notification client). */
export function mostRecentPendingTeamMoment(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): string | undefined {
  return mostRecentMoment(snap, projectId, pendingTeamMoments(snap, projectId));
}

/**
 * Choix client validés que le CONDUCTEUR doit encore prendre en compte : les
 * choix validés du chantier, moins ceux déjà marqués « pris en compte » (accusé
 * local). Symétrique des décisions « en attente » — ici, c'est à lui d'agir.
 */
export function choixClientValidesATraiter(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): DecisionEvent[] {
  if (!projectId) return [];
  const events = snap.events.filter((e) => e.projectId === projectId);
  return choixClientValides(events).filter((e) => snap.choixTraites[e.id] === undefined);
}

/** Le Fil d'un projet (moments + annotations + zones). */
export function filOf(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): {
  moments: Moment[];
  coups: CoupDeCoeur[];
  messages: Message[];
  zones: ProjectZone[];
  annotations: Annotation[];
} {
  if (!projectId) return { moments: [], coups: [], messages: [], zones: [], annotations: [] };
  return {
    moments: snap.fil.moments[projectId] ?? [],
    coups: snap.fil.coups[projectId] ?? [],
    messages: snap.fil.messages[projectId] ?? [],
    zones: snap.fil.zones[projectId] ?? [],
    annotations: snap.fil.annotations[projectId] ?? [],
  };
}
