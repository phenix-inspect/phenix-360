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
  type BackendState,
  type DemandeResolution,
  type EventId,
  type KeyValueStore,
  type NewEvent,
  type NewMember,
  type NewProject,
  type ProjectId,
  type ProjectPatch,
  type UserId,
} from '@phenix360/core';
import { buildDemoSeed } from './seed';

const STATE_KEY = 'phenix-demo:state:v1';
const PEOPLE_KEY = 'phenix-demo:people:v1';
const ACTIVE_KEY = 'phenix-demo:active:v1';
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

  /** Charge le chantier de démonstration (jeu de données vivant). */
  loadDemo(): void {
    const { state, people, activeProjectId } = buildDemoSeed();
    kv.save(state);
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeProjectId));
    localStorage.setItem(SEEDED_KEY, '1');
    refresh();
    broadcast();
  },

  /** Repart de zéro (états vides élégants) — sans réamorcer la démo. */
  reset(): void {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(PEOPLE_KEY);
    localStorage.removeItem(ACTIVE_KEY);
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
