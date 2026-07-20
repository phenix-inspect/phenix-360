/**
 * PHÉNIX 360 — Connexion à Supabase (branchement SaaS)
 * ----------------------------------------------------------------------------
 * Point d'entrée UNIQUE côté app vers Supabase. Volontairement dormant : tant
 * que les variables d'environnement ne sont pas fournies (démo, tests e2e),
 * `supabaseConfigured()` est faux et rien n'est chargé — l'app reste 100 %
 * locale, à l'identique. La bibliothèque `@supabase/supabase-js` n'est importée
 * QU'À LA DEMANDE (import dynamique) : elle ne pèse pas sur le bundle de la démo.
 *
 * Les clés sont PUBLIQUES par conception (URL + clé « anon ») : la sécurité réelle
 * vient de la RLS côté base, jamais du secret de la clé.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** Configuration Supabase si (et seulement si) les deux variables sont fournies. */
export function supabaseConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Vrai si l'app doit fonctionner en mode SaaS (Supabase), faux = mode démo local. */
export function supabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Client Supabase partagé (singleton), créé à la première demande. Renvoie `null`
 * en mode démo (non configuré) — l'appelant retombe alors sur le stockage local.
 * Import dynamique : aucun octet Supabase chargé tant qu'on ne l'appelle pas.
 */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    );
  }
  return clientPromise;
}
