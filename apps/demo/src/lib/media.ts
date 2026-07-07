/**
 * PHÉNIX 360 — MediaUploader (démo)
 * ---------------------------------------------------------------------------
 * Réalisation du port `MediaUploader` de core pour le Mode Démo : l'upload est
 * RÉEL côté utilisateur (vraie photo, aperçu immédiat), mais sans backend — on
 * redimensionne via canvas et on renvoie une data URL + des champs de stockage
 * synthétiques. En production, on remplacera cette fonction par un upload
 * S3-compatible renvoyant une URL signée, sans toucher au reste.
 */
import type { MediaUploader, UploadedMedia } from '@phenix360/core';

/**
 * Types acceptés par les sélecteurs de PHOTO — source unique, pour un comportement
 * IDENTIQUE partout (coulisses, compte rendu, pré/réception, réserves, décisions…).
 *
 * Sur SMARTPHONE, `accept="image/*"` déclenche le sélecteur NATIF du téléphone :
 * l'utilisateur peut prendre une photo à l'instant avec l'appareil, choisir dans sa
 * galerie, ou piocher un fichier (Drive / Fichiers / iCloud). On n'impose JAMAIS
 * l'attribut `capture` : il forcerait l'appareil photo et masquerait galerie et
 * fichiers — or les trois options doivent rester offertes. Sur ORDINATEUR, le même
 * attribut ouvre la sélection d'un ou plusieurs fichiers (le glisser-déposer reste
 * géré là où il est proposé). On ne réinvente pas l'interface : on laisse l'OS faire.
 */
export const ACCEPT_IMAGE = 'image/*';

/** Sélecteurs de DOCUMENT : un PDF, ou la PHOTO d'un document (prise sur mobile). */
export const ACCEPT_DOCUMENT = '.pdf,application/pdf,image/*';

const MAX = 1600;
const QUALITY = 0.82;

export const mediaUploader: MediaUploader = async (file: File): Promise<UploadedMedia> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('image illisible'));
    i.src = dataUrl;
  });

  const scale = Math.min(1, MAX / Math.max(img.width, img.height) || 1);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  let imageUrl = dataUrl;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    try {
      ctx.drawImage(img, 0, 0, width, height);
      imageUrl = canvas.toDataURL('image/jpeg', QUALITY);
    } catch {
      // Canvas non exportable → on garde l'image d'origine.
    }
  }

  return {
    imageUrl,
    bucket: 'demo',
    storagePath: `fil/${crypto.randomUUID()}.jpg`,
    mimeType: 'image/jpeg',
    width,
    height,
  };
};
