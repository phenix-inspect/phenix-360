/**
 * PHÉNIX 360 — Design System (@phenix360/ui)
 * ---------------------------------------------------------------------------
 * Tokens (source de vérité), fontes, utilitaire `cn`, et primitives shadcn/ui
 * re-skinnées (thème clair, noir & or, sobre). Règle absolue : aucun composant
 * n'embarque de valeur premium en dur — cf. CONVENTIONS.md.
 *
 * Feuilles de style (à importer une fois dans le point d'entrée de l'app) :
 *   import '@phenix360/ui/fonts.css';
 *   import '@phenix360/ui/tokens.css';
 */
export * from './tokens/index.js';
export * from './lib/cn.js';
export * from './brand/brand.js';
export * from './components/index.js';
