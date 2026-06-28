/**
 * PHÉNIX 360 — File d'attente offline (PoC)
 * ---------------------------------------------------------------------------
 * Stockage local des saisies terrain dans IndexedDB (persistant, survit au
 * rechargement et à la coupure réseau). Volontairement minimal et sans
 * dépendance : on prouve le RISQUE offline, pas une lib de sync complète.
 */
import type { ProjectStep } from '@phenix360/core';

const DB_NAME = 'phenix-compagnon-poc';
const STORE = 'outbox';
const VERSION = 1;

/** Une saisie chantier mise en file (≈ futur compte_rendu, ADR-002). */
export interface QueuedSaisie {
  id: string;
  texte: string;
  etape: ProjectStep;
  createdAt: string;
  status: 'pending' | 'synced';
  syncedAt?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/** Ajoute une saisie en file (fonctionne hors-ligne). */
export async function enqueue(input: Pick<QueuedSaisie, 'texte' | 'etape'>): Promise<QueuedSaisie> {
  const item: QueuedSaisie = {
    id: crypto.randomUUID(),
    texte: input.texte,
    etape: input.etape,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  await tx('readwrite', (s) => s.add(item));
  return item;
}

/** Met à jour une saisie (ex. passage à `synced`). */
export async function update(item: QueuedSaisie): Promise<void> {
  await tx('readwrite', (s) => s.put(item));
}

/** Toutes les saisies, plus récentes d'abord. */
export async function allItems(): Promise<QueuedSaisie[]> {
  const items = await tx<QueuedSaisie[]>(
    'readonly',
    (s) => s.getAll() as IDBRequest<QueuedSaisie[]>,
  );
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Réinitialise la file (confort de démo). */
export async function clearAll(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
}
