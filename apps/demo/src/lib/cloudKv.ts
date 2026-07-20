/**
 * PHÉNIX 360 — Coffre clé→valeur dans le cloud (satellites, M4)
 * ===========================================================================
 * Miroir DURABLE et PRIVÉ des « satellites » du conducteur (préparation, carnet
 * de contacts, Le Fil, réglages « Mon espace », accusés de lecture) — aujourd'hui
 * en localStorage. Objectif : qu'ils suivent le conducteur d'un appareil à
 * l'autre, comme le chantier lui-même. La table `app_kv` est protégée par RLS
 * (chaque utilisateur ne voit que ses clés) ; le contenu reste une chaîne JSON
 * opaque — ce n'est PAS un modèle métier, juste un cache durable.
 *
 * Le store reste synchrone (l'UI ne change pas) : au login, on HYDRATE tout dans
 * le miroir mémoire ; ensuite chaque écriture locale déclenche une synchro cloud
 * best-effort. On COALESCE par clé (dernière valeur gagnante) et on SÉRIALISE les
 * écritures d'une même clé, pour éviter les courses (une synchro lente suivie
 * d'une rapide ne doit pas réécrire une valeur périmée).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordError } from './diagnostics';

const TABLE = 'app_kv';
/** Marqueur « supprimer cette clé » dans la file d'attente. */
const DELETE = Symbol('delete');

export class CloudKv {
  private readonly pending = new Map<string, string | typeof DELETE>();
  private readonly inflight = new Set<string>();

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  /** Charge toutes les paires (clé → valeur) de l'utilisateur. Tolérant : {} si échec. */
  async loadAll(): Promise<Record<string, string>> {
    try {
      const res = await this.client.from(TABLE).select('k,v').eq('user_id', this.userId);
      if (res.error) throw new Error(res.error.message);
      const out: Record<string, string> = {};
      for (const row of (res.data ?? []) as { k: string; v: string }[]) out[row.k] = row.v;
      return out;
    } catch (e) {
      recordError('error', `cloudKv loadAll: ${msg(e)}`);
      return {};
    }
  }

  /** Programme l'écriture (cloud) d'une clé — best-effort, coalescée par clé. */
  set(k: string, value: string): void {
    this.pending.set(k, value);
    void this.flush(k);
  }

  /** Programme la suppression (cloud) d'une clé — best-effort, coalescée par clé. */
  remove(k: string): void {
    this.pending.set(k, DELETE);
    void this.flush(k);
  }

  private async flush(k: string): Promise<void> {
    if (this.inflight.has(k)) return; // une écriture de cette clé est déjà en vol
    this.inflight.add(k);
    try {
      while (this.pending.has(k)) {
        const v = this.pending.get(k)!;
        this.pending.delete(k);
        try {
          if (v === DELETE) {
            const res = await this.client
              .from(TABLE)
              .delete()
              .eq('user_id', this.userId)
              .eq('k', k);
            if (res.error) throw new Error(res.error.message);
          } else {
            const res = await this.client
              .from(TABLE)
              .upsert(
                { user_id: this.userId, k, v, updated_at: new Date().toISOString() },
                { onConflict: 'user_id,k' },
              );
            if (res.error) throw new Error(res.error.message);
          }
        } catch (e) {
          // Best-effort : le stockage local reste la vérité de session ; on trace
          // le diagnostic sans jamais interrompre l'utilisateur.
          recordError('error', `cloudKv ${v === DELETE ? 'remove' : 'set'} ${k}: ${msg(e)}`);
        }
      }
    } finally {
      this.inflight.delete(k);
    }
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
