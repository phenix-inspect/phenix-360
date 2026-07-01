/**
 * PHÉNIX 360 — @phenix360/core
 * ===========================================================================
 * Modèle CANONIQUE du produit. C'est ici que vit la colonne vertébrale
 * (l'événement) ; le schéma Supabase en découle, jamais l'inverse.
 *
 * Le journal d'événements alimente les quatre surfaces :
 *   • l'interface PHÉNIX (boucle terrain)        • l'assistant IA
 *   • l'espace client (récit + décisions)        • le bandeau décision client
 */
export * from './ids.js';
export * from './actor.js';
export * from './project.js';
export * from './attachment.js';
export * from './event.js';
export * from './decision.js';
export * from './views.js';
export * from './next-action.js';
export * from './phenix.js';
export * from './calendar.js';
export * from './devis.js';
export * from './prepare.js';
export * from './fil.js';
export * from './mission.js';
export * from './data/index.js';
