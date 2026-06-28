/**
 * PHÉNIX 360 — Identifiants & temps (modèle canonique)
 * ---------------------------------------------------------------------------
 * Identifiants typés (« branded ») : un `EventId` n'est pas assignable à un
 * `ProjectId`, même si tous deux sont des UUID. Empêche les confusions d'ID au
 * cœur de la colonne vertébrale. Construits par cast contrôlé depuis une source
 * de confiance (base de données, service d'auth).
 */
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type ProjectId = Brand<string, 'ProjectId'>;
export type ProjectMemberId = Brand<string, 'ProjectMemberId'>;
export type EventId = Brand<string, 'EventId'>;
export type AttachmentId = Brand<string, 'AttachmentId'>;
/** Identifiant de **saisie** : regroupe 1 compte_rendu + N photos (ADR-002 §7). */
export type CaptureId = Brand<string, 'CaptureId'>;
export type UserId = Brand<string, 'UserId'>;

/** Horodatage ISO 8601 (UTC). Stocké en `timestamptz`, transporté en chaîne. */
export type IsoDateTime = string;

export const projectId = (v: string): ProjectId => v as ProjectId;
export const projectMemberId = (v: string): ProjectMemberId => v as ProjectMemberId;
export const eventId = (v: string): EventId => v as EventId;
export const attachmentId = (v: string): AttachmentId => v as AttachmentId;
export const captureId = (v: string): CaptureId => v as CaptureId;
export const userId = (v: string): UserId => v as UserId;
