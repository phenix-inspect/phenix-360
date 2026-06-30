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
  InMemoryBackend,
  attachmentId as toAttachmentId,
  buildDecisionContent,
  coupDeCoeurId as toCoupId,
  decisionVisibility,
  filPhotoId as toFilPhotoId,
  messageId as toMessageId,
  momentId as toMomentId,
  userId as toUserId,
  type BackendState,
  type CoupDeCoeur,
  type DemandeResolution,
  type EventActor,
  type EventId,
  type KeyValueStore,
  type Message,
  type Moment,
  type NewEvent,
  type NewMember,
  type NewProject,
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
  };
}

const kv = new LocalStorageKeyValueStore();
const backend = new InMemoryBackend(kv);
const channel = new BroadcastChannel('phenix-demo');
const listeners = new Set<() => void>();

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
    },
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

  /** Ajoute un Moment (brique 1 : mono-photo, publié immédiatement). */
  addMoment(input: {
    projectId: ProjectId;
    actor: EventActor;
    title: string;
    media: UploadedMedia;
    zoneId?: ZoneId;
    legende?: string;
  }): void {
    const now = new Date().toISOString();
    const photoId = toFilPhotoId(crypto.randomUUID());
    const moment: Moment = {
      id: toMomentId(crypto.randomUUID()),
      projectId: input.projectId,
      authorId: input.actor.userId,
      authorRole: input.actor.role,
      createdAt: now,
      publishedAt: now,
      state: 'publie',
      title: input.title.trim(),
      visibleTo: DEFAULT_AUDIENCE,
      photos: [
        {
          id: photoId,
          imageUrl: input.media.imageUrl,
          bucket: input.media.bucket,
          storagePath: input.media.storagePath,
          mimeType: input.media.mimeType,
          width: input.media.width,
          height: input.media.height,
          legende: input.legende?.trim() || undefined,
          ordre: 0,
          createdAt: now,
        },
      ],
      coverPhotoId: photoId,
      ...(input.zoneId ? { zoneId: input.zoneId } : {}),
    };
    const map = readJson<Record<string, Moment[]>>(FIL_MOMENTS_KEY, {});
    map[input.projectId] = [...(map[input.projectId] ?? []), moment];
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

  /** Laisse un message (niveau 1) sous un Moment. */
  addMessage(projectId: ProjectId, momentId: string, actor: EventActor, texte: string): void {
    const trimmed = texte.trim();
    if (!trimmed) return;
    const map = readJson<Record<string, Message[]>>(FIL_MESSAGES_KEY, {});
    const message: Message = {
      id: toMessageId(crypto.randomUUID()),
      momentId: momentId as Message['momentId'],
      photoId: null,
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

/** Le Fil d'un projet (moments + annotations + zones). */
export function filOf(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): { moments: Moment[]; coups: CoupDeCoeur[]; messages: Message[]; zones: ProjectZone[] } {
  if (!projectId) return { moments: [], coups: [], messages: [], zones: [] };
  return {
    moments: snap.fil.moments[projectId] ?? [],
    coups: snap.fil.coups[projectId] ?? [],
    messages: snap.fil.messages[projectId] ?? [],
    zones: snap.fil.zones[projectId] ?? [],
  };
}
