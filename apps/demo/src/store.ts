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
  annotationId as toAnnotationId,
  askPhenix as corePhenix,
  attachmentId as toAttachmentId,
  buildDecisionContent,
  coupDeCoeurId as toCoupId,
  decisionVisibility,
  filPhotoId as toFilPhotoId,
  messageId as toMessageId,
  momentId as toMomentId,
  momentPartageClient,
  nextReserveNumero,
  userId as toUserId,
  type Annotation,
  type AnnotationType,
  type BackendState,
  type CoupDeCoeur,
  type DemandeResolution,
  type EventActor,
  type EventId,
  type FilPhoto,
  type KeyValueStore,
  type Message,
  type Moment,
  type MomentType,
  type NewEvent,
  type NewMember,
  type NewProject,
  type PhenixAction,
  type PhenixSource,
  type PhenixTodo,
  type ProjectDossier,
  type ProjectId,
  type ProjectPatch,
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
  /** Cible transitoire : ouvrir une photo précise du Fil (lien retour). */
  filTarget: { momentId: string; photoId?: string } | null;
  /** Cible transitoire : navigation PHÉNIX dans l'Espace client. */
  clientTarget: ClientTarget | null;
}

const kv = new LocalStorageKeyValueStore();
const backend = new InMemoryBackend(kv);
const channel = new BroadcastChannel('phenix-demo');
const listeners = new Set<() => void>();

// Cibles transitoires (en mémoire) : lien retour « Voir la photo » + navigation
// PHÉNIX. Déclarées AVANT build() (elles y sont lues) pour éviter tout TDZ.
let filTarget: { momentId: string; photoId?: string } | null = null;
let clientTarget: ClientTarget | null = null;
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
    filTarget,
    clientTarget,
  };
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
  async createFromProposal(proposal: ProjectProposal): Promise<ProjectId> {
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
    refresh();
    broadcast();
    return project.id;
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
    const { state, people, activeProjectId, dossiers, fil } = buildDemoSeed();
    kv.save(state);
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeProjectId));
    localStorage.setItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    localStorage.removeItem(PINS_KEY);
    localStorage.setItem(FIL_MOMENTS_KEY, JSON.stringify(fil.moments));
    localStorage.setItem(FIL_COUPS_KEY, JSON.stringify(fil.coups));
    localStorage.setItem(FIL_MESSAGES_KEY, JSON.stringify(fil.messages));
    localStorage.setItem(FIL_ZONES_KEY, JSON.stringify(fil.zones));
    localStorage.setItem(FIL_ANNOTATIONS_KEY, JSON.stringify(fil.annotations));
    localStorage.removeItem(PHENIX_CONV_KEY);
    localStorage.setItem(SEEDED_KEY, '1');
    refresh();
    broadcast();
  },

  /** Repart de zéro (états vides élégants) — sans réamorcer la démo. */
  reset(): void {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(PEOPLE_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(DOSSIERS_KEY);
    localStorage.removeItem(PINS_KEY);
    localStorage.removeItem(FIL_MOMENTS_KEY);
    localStorage.removeItem(FIL_COUPS_KEY);
    localStorage.removeItem(FIL_MESSAGES_KEY);
    localStorage.removeItem(FIL_ZONES_KEY);
    localStorage.removeItem(FIL_ANNOTATIONS_KEY);
    localStorage.removeItem(PHENIX_CONV_KEY);
    localStorage.setItem(SEEDED_KEY, '1');
    refresh();
    broadcast();
  },
};

// Premier chargement : on amorce le chantier de démonstration une seule fois.
if (typeof localStorage !== 'undefined' && localStorage.getItem(SEEDED_KEY) === null) {
  demo.loadDemo();
}

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
