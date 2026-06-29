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
  InMemoryBackend,
  attachmentId as toAttachmentId,
  userId as toUserId,
  type BackendState,
  type DemandeResolution,
  type EventActor,
  type EventId,
  type KeyValueStore,
  type NewEvent,
  type NewMember,
  type NewProject,
  type ProjectDossier,
  type ProjectId,
  type ProjectPatch,
  type ProjectProposal,
  type UserId,
} from '@phenix360/core';
import { buildDemoSeed } from './seed';

const STATE_KEY = 'phenix-demo:state:v1';
const PEOPLE_KEY = 'phenix-demo:people:v1';
const ACTIVE_KEY = 'phenix-demo:active:v1';
const DOSSIERS_KEY = 'phenix-demo:dossiers:v1';
const PINS_KEY = 'phenix-demo:pins:v1';
const SEEDED_KEY = 'phenix-demo:seeded:v1';

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

    // Choix proposés au client → on trace « décision envoyée au client » au journal
    // (le client la validera depuis son espace). Interne : c'est un jalon de suivi.
    for (const sel of proposal.dossier.selections) {
      if (sel.statut === 'propose') {
        await backend.appendEvent({
          projectId: project.id,
          actor: compaActor,
          type: 'demande',
          visibility: 'interne',
          state: 'close',
          content: {
            question: `Décision envoyée au client : choix ${sel.categorie.toLowerCase()} (${sel.label}).`,
            destinataire: 'equipe',
            resolution: {
              texte: 'En attente de validation du client.',
              resolvedBy: compaId,
              resolvedAt: new Date().toISOString(),
            },
          },
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

  /** Charge le chantier de démonstration (jeu de données vivant). */
  loadDemo(): void {
    const { state, people, activeProjectId, dossiers } = buildDemoSeed();
    kv.save(state);
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeProjectId));
    localStorage.setItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    localStorage.removeItem(PINS_KEY);
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
