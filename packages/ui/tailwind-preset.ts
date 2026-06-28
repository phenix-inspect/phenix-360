/**
 * PHÉNIX 360 — Preset Tailwind du Design System
 * ---------------------------------------------------------------------------
 * Mappe les tokens (cf. src/tokens) sur le thème Tailwind. Couleurs, rayons,
 * ombres et durées pointent vers des variables CSS (var(--…)) : le théming
 * reste pilotable à l'exécution depuis tokens.css.
 *
 * Stratégie :
 *   • `theme.colors` est REMPLACÉ — seule la palette de marque (+ primitives
 *     transparent/current/inherit) existe. Impossible d'utiliser une couleur
 *     hors tokens (ex. `text-gray-500` n'existe pas) : les tokens font foi.
 *   • Les échelles (espacement, typo, rayons, ombres…) sont ÉTENDUES : on
 *     conserve la couverture complète des utilitaires Tailwind tout en
 *     surchargeant les clés homonymes avec nos valeurs de tokens.
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
import animate from 'tailwindcss-animate';
import {
  colors,
  duration,
  easing,
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
    // Remplacés : on verrouille la palette et les breakpoints sur les tokens.
    screens,
    colors,
    fontFamily,
    // Étendus : la couverture par défaut reste, nos tokens surchargent.
    extend: {
      spacing,
      fontSize,
      fontWeight,
      lineHeight,
      letterSpacing,
      borderRadius: radius,
      boxShadow: shadow,
      transitionDuration: duration,
      transitionTimingFunction: { out: easing.out, 'in-out': easing.inOut },
      zIndex,
    },
  },
  plugins: [animate],
};

export default preset;
