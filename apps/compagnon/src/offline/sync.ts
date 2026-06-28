/**
 * PHÉNIX 360 — Rejeu de la file offline (PoC)
 * ---------------------------------------------------------------------------
 * Draine les saisies `pending` en les « envoyant » via `send`. À la
 * reconnexion, l'app appelle `drainOutbox` : les saisies créées hors-ligne sont
 * rejouées. En cas d'échec (toujours hors-ligne), elles restent en file.
 */
import { allItems, update, type QueuedSaisie } from './queue.js';

export type SendFn = (item: QueuedSaisie) => Promise<void>;

export interface DrainResult {
  sent: number;
  failed: number;
}

export async function drainOutbox(send: SendFn): Promise<DrainResult> {
  const pending = (await allItems()).filter((i) => i.status === 'pending');
  let sent = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      await send(item);
      await update({ ...item, status: 'synced', syncedAt: new Date().toISOString() });
      sent += 1;
    } catch {
      failed += 1; // reste en file, sera rejoué au prochain passage en ligne
    }
  }
  return { sent, failed };
}
