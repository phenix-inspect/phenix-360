/**
 * PHÉNIX 360 — Acteurs & rôles
 * ---------------------------------------------------------------------------
 * Qui agit dans le journal. Règle non négociable (ADR-001 §3) : **l'IA n'est
 * jamais auteur** — elle rédige/propose, l'humain valide et signe. Un acteur
 * d'événement est donc toujours un humain.
 */
import type { UserId } from './ids.js';

/** Rôles V1 (ADR-002 §2.1). `sous_traitant` = l'artisan intervenant (Mode Artisan). */
export const ROLES = ['compagnon', 'equipe', 'sous_traitant', 'client'] as const;
export type Role = (typeof ROLES)[number];

/** Rôle de l'auteur d'un événement. */
export type ActorRole = Role;

export const ROLE_LABEL: Record<Role, string> = {
  compagnon: 'Compagnon',
  equipe: 'Équipe',
  sous_traitant: 'Artisan',
  client: 'Client',
};

/** Auteur d'un événement — toujours un humain. */
export interface EventActor {
  userId: UserId;
  role: ActorRole;
  /** Nom dénormalisé pour l'affichage (la « réponse signée » côté client). */
  displayName?: string;
}
