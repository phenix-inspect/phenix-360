/**
 * PHÉNIX 360 — Pièce jointe d'événement
 * ---------------------------------------------------------------------------
 * Représentation canonique d'un fichier (photo ou document). Mécanique
 * « fichier » mutualisée entre `photo` et `document` (ADR-002 §3), séparée du
 * classement sémantique (légende, catégorie, pièce) qui vit dans le contenu.
 *
 * Stockage **S3-compatible** : `bucket` + `storagePath` (clé). Portabilité
 * ADR-004 §2.5 r4 — basculer vers MinIO / Scaleway sans changer le code.
 */
import type { AttachmentId, IsoDateTime } from './ids.js';

export const ATTACHMENT_KINDS = ['photo', 'document'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export interface EventAttachment {
  id: AttachmentId;
  kind: AttachmentKind;
  /** Bucket de stockage (S3-compatible). */
  bucket: string;
  /** Clé/chemin dans le bucket. */
  storagePath: string;
  mimeType: string;
  fileName?: string;
  sizeBytes?: number;
  /**
   * Aperçu affichable — data URL (base64) en V1 100 % locale ; en production,
   * dérivé de `bucket`/`storagePath` (URL signée). Photos comme documents.
   */
  dataUrl?: string;
  /** Dimensions image (photos) — vignettes sans téléchargement. */
  width?: number;
  height?: number;
  createdAt: IsoDateTime;
}
