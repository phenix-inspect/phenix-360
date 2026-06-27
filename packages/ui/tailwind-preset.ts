/**
 * PHÉNIX 360 — Preset Tailwind du Design System
 * ---------------------------------------------------------------------------
 * Mappe les tokens (cf. src/tokens) sur le thème Tailwind. Les couleurs,
 * rayons, ombres et durées pointent vers des variables CSS (var(--…)) : le
 * théming reste pilotable à l'exécution depuis tokens.css. Les échelles
 * statiques (typo, espacement, z-index, breakpoints) sont injectées telles
 * quelles.
 *
 * Usage côté app (tailwind.config.ts) :
 *   import preset from '@phenix360/ui/tailwind-preset';
 *   export default { presets: [preset], content: ['./src/**\/*.{ts,tsx}'] };
 *
 * Et importer une seule fois, dans le point d'entrée :
 *   import '@phenix360/ui/fonts.css';
 *   import '@phenix360/ui/tokens.css';
 */
import type { Config } from 'tailwindcss';
import {
  colors,
  duration,
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  radius,
  screens,
  shadow,
  spacing,
  zIndex,
} from './src/tokens/tokens.js';

const preset: Omit<Config, 'content'> = {
  darkMode: 'class', // thème clair par défaut ; hook réservé, pas de dark V1
  theme: {
    screens,
    spacing,
    colors,
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    borderRadius: radius,
    boxShadow: shadow,
    transitionDuration: duration,
    zIndex,
    extend: {},
  },
  plugins: [],
};

export default preset;
