import type { ProjectStatus } from '@phenix360/core';

/**
 * Couleur du badge de statut chantier (au coup d'œil). Chaque statut a sa
 * teinte, sur la palette de marque (rôles) : neutre → info → or → warning →
 * succès, du plus « pas commencé » au plus « clôturé ».
 */
export const PROJECT_STATUS_BADGE: Record<
  ProjectStatus,
  'neutral' | 'info' | 'gold' | 'warning' | 'success'
> = {
  pas_commence: 'neutral',
  en_cours: 'info',
  pre_reception: 'gold',
  levee_reserves: 'warning',
  cloture: 'success',
};

/** Libellé COURT (pluriel) pour la barre de filtres d'« Aujourd'hui ». */
export const PROJECT_STATUS_SHORT: Record<ProjectStatus, string> = {
  pas_commence: 'Pas commencés',
  en_cours: 'En cours',
  pre_reception: 'Pré-réception',
  levee_reserves: 'Réserves',
  cloture: 'Clôturés',
};
