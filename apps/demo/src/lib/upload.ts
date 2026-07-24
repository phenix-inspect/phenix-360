/**
 * PHÉNIX 360 — Lecture de VRAIS fichiers (Lot 3, App réelle locale)
 * ---------------------------------------------------------------------------
 * Transforme un fichier choisi par l'utilisateur en pièce jointe stockable en
 * LOCAL (data URL base64, persistée dans localStorage). Images compressées via
 * canvas ; documents (PDF) encodés tels quels. Limites de taille claires pour ne
 * pas saturer le navigateur (~5 Mo de localStorage) — jamais de perte
 * silencieuse : au-delà, on renvoie une erreur explicite, rien n'est écrit.
 */
import { attachmentId, type EventAttachment } from '@phenix360/core';
import { fileToImageUrl } from './image';

/** Taille max de l'image d'ENTRÉE (avant compression). */
export const MAX_IMAGE_MB = 15;
/** Taille max d'un document local (localStorage ~5 Mo : on reste prudent). */
export const MAX_DOC_MB = 2;

const mb = (bytes: number): number => bytes / (1024 * 1024);

export type Loaded<T> = { ok: true; value: T } | { ok: false; error: string };

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error('lecture impossible'));
    r.readAsDataURL(file);
  });

/** Vraie PHOTO → pièce jointe avec aperçu local (data URL compressé). */
export async function readPhotoAttachment(
  projectId: string,
  file: File,
): Promise<Loaded<EventAttachment>> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: `« ${file.name} » n’est pas une image.` };
  }
  if (mb(file.size) > MAX_IMAGE_MB) {
    return {
      ok: false,
      error: `Image trop lourde (${mb(file.size).toFixed(1)} Mo). Maximum ${MAX_IMAGE_MB} Mo.`,
    };
  }
  let dataUrl: string;
  try {
    dataUrl = await fileToImageUrl(file, 1600, 0.82);
  } catch {
    return { ok: false, error: `Impossible de lire « ${file.name} ».` };
  }
  return {
    ok: true,
    value: {
      id: attachmentId(crypto.randomUUID()),
      kind: 'photo',
      bucket: 'local',
      storagePath: `${projectId}/${crypto.randomUUID()}.jpg`,
      mimeType: 'image/jpeg',
      fileName: file.name,
      sizeBytes: dataUrl.length,
      dataUrl,
      createdAt: new Date().toISOString(),
    },
  };
}

/** Vrai DOCUMENT (PDF ou image) → pièce jointe avec aperçu local. */
export async function readDocumentAttachment(
  projectId: string,
  file: File,
): Promise<Loaded<EventAttachment>> {
  const isPdf = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');
  if (!isPdf && !isImage) {
    return {
      ok: false,
      error: `Format non pris en charge : « ${file.name} » (PDF ou image attendus).`,
    };
  }
  if (mb(file.size) > MAX_DOC_MB) {
    return {
      ok: false,
      error: `Document trop lourd (${mb(file.size).toFixed(1)} Mo). Maximum ${MAX_DOC_MB} Mo en stockage local.`,
    };
  }
  let dataUrl: string;
  try {
    dataUrl = isImage ? await fileToImageUrl(file, 2000, 0.85) : await readAsDataUrl(file);
  } catch {
    return { ok: false, error: `Impossible de lire « ${file.name} ».` };
  }
  return {
    ok: true,
    value: {
      id: attachmentId(crypto.randomUUID()),
      kind: 'document',
      bucket: 'local',
      storagePath: `${projectId}/${crypto.randomUUID()}`,
      mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
      fileName: file.name,
      sizeBytes: dataUrl.length,
      dataUrl,
      createdAt: new Date().toISOString(),
    },
  };
}
