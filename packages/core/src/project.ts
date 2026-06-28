/**
 * PHÉNIX 360 — Projet (chantier) & membres
 * ---------------------------------------------------------------------------
 * `Project` ≡ « chantier » (ADR-004 §4). Un projet = un journal d'événements
 * unique (ADR-001 §2). V1 : un client = un chantier.
 */
import type { IsoDateTime, ProjectId, ProjectMemberId, UserId } from './ids.js';
import type { Role } from './actor.js';

/**
 * Avancement = une **étape**, jamais un pourcentage (ADR-004 §4). L'avancement
 * courant du chantier dérive du dernier `compte_rendu` publié (ADR-002 §5).
 */
export const PROJECT_STEPS = ['gros_oeuvre', 'second_oeuvre', 'finitions', 'reception'] as const;
export type ProjectStep = (typeof PROJECT_STEPS)[number];

export const PROJECT_STEP_LABEL: Record<ProjectStep, string> = {
  gros_oeuvre: 'Gros œuvre',
  second_oeuvre: 'Second œuvre',
  finitions: 'Finitions',
  reception: 'Réception',
};

/** Ordre des étapes (pour situer l'avancement sans le quantifier). */
export const PROJECT_STEP_ORDER: Record<ProjectStep, number> = {
  gros_oeuvre: 0,
  second_oeuvre: 1,
  finitions: 2,
  reception: 3,
};

export interface Project {
  id: ProjectId;
  /** Nom du chantier. */
  name: string;
  /** Client propriétaire — V1 : un client = un chantier. */
  clientId: UserId | null;
  /** Cache dérivé du dernier compte_rendu publié (jamais saisi à la main). */
  currentStep: ProjectStep | null;
  createdAt: IsoDateTime;
}

/** Rôle d'appartenance à un projet (pilote l'accès / la RLS). */
export type ProjectRole = Role;

/** Qui a accès à un projet et avec quel rôle. */
export interface ProjectMember {
  id: ProjectMemberId;
  projectId: ProjectId;
  userId: UserId;
  role: ProjectRole;
  createdAt: IsoDateTime;
}
