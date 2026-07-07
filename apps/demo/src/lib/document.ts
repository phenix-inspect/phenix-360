import type { EventAttachment } from '@phenix360/core';

/**
 * Ouvre un Blob dans un NOUVEL ONGLET (aperçu natif du navigateur).
 *
 * Les navigateurs bloquent la navigation directe vers une URL `data:` (anti-
 * hameçonnage) : on passe donc par une URL d'objet, qui s'ouvre et se rend
 * nativement. Ouverture par ancre `target="_blank"` : fiable (contrairement à
 * `window.open(..., 'noopener')` qui renvoie toujours null). 100 % local.
 */
function openBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Ouvre une pièce jointe RÉELLE (PDF / image, data URL base64) dans un nouvel
 * onglet. Sans fichier attaché, on ne fait RIEN (aucun faux lien). 100 % local.
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
    openBlob(new Blob([bytes], { type: mime }));
  } catch {
    // Dernier recours : tenter le data URL tel quel.
    window.open(dataUrl, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Ouvre un document GÉNÉRÉ par PHÉNIX (compte rendu, PV de réception, fiche de
 * référence…) : une page HTML autonome, lisible et imprimable, rendue dans un
 * nouvel onglet. Même mécanique d'ouverture que les fichiers réels — pour
 * l'utilisateur, tout document se consulte de la même façon.
 */
export function openHtmlDocument(html: string): void {
  openBlob(new Blob([html], { type: 'text/html;charset=utf-8' }));
}

/** Télécharge un Blob sous un nom de fichier donné (ancre `download`). 100 % local. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Nettoie un libellé pour en faire un nom de fichier sûr. */
const safeName = (name: string): string =>
  name
    .replace(/[^\p{L}\p{N}\-_. ]+/gu, ' ')
    .trim()
    .replace(/\s+/g, '-') || 'document';

/** Télécharge une pièce jointe RÉELLE (le fichier d'origine). Sans fichier → rien. */
export function downloadAttachment(attachment: EventAttachment): void {
  const dataUrl = attachment.dataUrl;
  if (!dataUrl) return;
  try {
    const comma = dataUrl.indexOf(',');
    const base64 = dataUrl.slice(comma + 1);
    const mime = attachment.mimeType || 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    downloadBlob(new Blob([bytes], { type: mime }), attachment.fileName ?? safeName('document'));
  } catch {
    /* silencieux : on n'a rien à télécharger */
  }
}

/** Télécharge un document GÉNÉRÉ (HTML autonome) sous « <titre>.html ». */
export function downloadHtmlDocument(html: string, title: string): void {
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safeName(title)}.html`);
}
