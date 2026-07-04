import type { EventAttachment } from '@phenix360/core';

/**
 * Ouvre une pièce jointe (PDF / image) dans un NOUVEL ONGLET, pour aperçu.
 *
 * Les navigateurs bloquent la navigation directe vers une URL `data:` (anti-
 * hameçonnage) : on convertit donc le data URL en Blob puis en URL d'objet, qui
 * s'ouvre et se rend nativement. Sans fichier attaché, on ne fait RIEN (aucun
 * faux lien). 100 % local, aucun réseau.
 */
export function openAttachment(attachment: EventAttachment): void {
  const dataUrl = attachment.dataUrl;
  if (!dataUrl) return;
  try {
    const comma = dataUrl.indexOf(',');
    const meta = dataUrl.slice(0, comma);
    const base64 = dataUrl.slice(comma + 1);
    const mime =
      /^data:(.*?)(;base64)?$/.exec(meta)?.[1] || attachment.mimeType || 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    // Ouverture par ancre `target="_blank"` : fiable pour ouvrir un nouvel onglet
    // (contrairement à `window.open(..., 'noopener')` qui renvoie toujours null).
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    // Dernier recours : tenter le data URL tel quel.
    window.open(dataUrl, '_blank', 'noopener,noreferrer');
  }
}
