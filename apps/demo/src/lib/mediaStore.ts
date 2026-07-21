/**
 * PHÉNIX 360 — Stockage des médias (M5 : base64 → Supabase Storage)
 * ---------------------------------------------------------------------------
 * En mode SaaS, les photos/documents ne sont plus embarqués en base64 dans le
 * journal (lourd, limité) : on téléverse les octets vers un bucket PUBLIC
 * `attachments` et on ne conserve qu'une URL publique courte (+ `bucket` /
 * `storagePath`). Les composants d'affichage ne changent pas : ils reçoivent une
 * URL `https://…` au lieu d'une URL `data:…` — un `<img src>` et un lien
 * fonctionnent à l'identique.
 *
 * RÉTRO-COMPATIBLE + REPLI SÛR : en démo (pas de Supabase) ou si l'upload échoue
 * (réseau, bucket non public…), on garde le base64 exactement comme avant. La
 * session n'est JAMAIS interrompue — au pire, on se comporte comme aujourd'hui.
 *
 * Modèle d'accès : bucket PUBLIC + chemins en UUID aléatoire (URL-capacité). Sert
 * à la fois l'app interne (authentifiée) et la page cliente (anonyme, lien+code)
 * sans fonction serveur. Réversible (bucket privé + URLs signées) si durcissement.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase';
import { recordError } from './diagnostics';

export const ATTACHMENTS_BUCKET = 'attachments';

/** Un `src` est-il déjà une URL distante (https) plutôt qu'un `data:` base64 ? */
export function isRemoteUrl(u: string | undefined | null): boolean {
  return typeof u === 'string' && /^https?:\/\//.test(u);
}

/** URL publique déterministe d'un objet d'un bucket PUBLIC. '' si non configuré. */
export function publicUrl(bucket: string, storagePath: string): string {
  const cfg = supabaseConfig();
  if (!cfg || !bucket || bucket === 'local' || bucket === 'demo') return '';
  const path = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${cfg.url}/storage/v1/object/public/${bucket}/${path}`;
}

/** Convertit un data URL base64 en Blob (pour téléverser ce qui est déjà lu). */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const meta = dataUrl.slice(0, comma);
    const mime = /^data:(.*?)(;base64)?$/.exec(meta)?.[1] || 'application/octet-stream';
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Téléverse des octets vers le bucket PUBLIC `attachments`. Renvoie l'URL publique
 * (via `getPublicUrl`, donc fondée sur l'URL du client) + le chemin, ou `null` en
 * cas d'échec — l'appelant retombe alors sur le base64 (jamais d'interruption).
 */
export async function uploadBytes(
  client: SupabaseClient,
  projectId: string,
  data: Blob,
  ext: string,
  contentType: string,
): Promise<{ url: string; bucket: string; storagePath: string } | null> {
  try {
    const storagePath = `${projectId}/${crypto.randomUUID()}${ext}`;
    const bucket = client.storage.from(ATTACHMENTS_BUCKET);
    const up = await bucket.upload(storagePath, data, { contentType, upsert: false });
    if (up.error) {
      recordError('error', `storage upload: ${up.error.message}`);
      return null;
    }
    const url = bucket.getPublicUrl(storagePath).data.publicUrl;
    return { url, bucket: ATTACHMENTS_BUCKET, storagePath };
  } catch (e) {
    recordError('error', `storage upload: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Extension de fichier à partir du type MIME (défaut : .bin). */
function extFromMime(mime: string): string {
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'image/png') return '.png';
  if (mime.startsWith('image/')) return '.jpg';
  return '.bin';
}

const DATA_URL_RE = /^data:[^,]*;base64,/;

/**
 * Parcourt récursivement une valeur (contenu d'événement, résolution…) et
 * remplace tout data URL base64 par une URL Storage publique (SaaS). Renvoie une
 * COPIE ; en démo (pas de client), renvoie la valeur telle quelle. Si un upload
 * échoue, on GARDE le base64 pour cet élément (jamais d'interruption). Générique :
 * aucune connaissance des formes de contenu — toute image/PDF base64 est migrée.
 */
export async function uploadMediaDeep<T>(
  client: SupabaseClient,
  projectId: string,
  value: T,
): Promise<T> {
  return (await walk(client, value, projectId)) as T;
}

async function walk(client: SupabaseClient, v: unknown, projectId: string): Promise<unknown> {
  if (typeof v === 'string') {
    if (!DATA_URL_RE.test(v)) return v;
    const blob = dataUrlToBlob(v);
    if (!blob) return v;
    const stored = await uploadBytes(client, projectId, blob, extFromMime(blob.type), blob.type);
    return stored ? stored.url : v; // échec → on garde le base64
  }
  if (Array.isArray(v)) return Promise.all(v.map((x) => walk(client, x, projectId)));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = await walk(client, val, projectId);
    }
    return out;
  }
  return v;
}
