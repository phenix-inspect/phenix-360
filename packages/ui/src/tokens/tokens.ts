/**
 * PHÉNIX 360 — Design tokens (accès programmatique + alimentation Tailwind)
 * ---------------------------------------------------------------------------
 * Pendant TypeScript de `tokens.css`. Deux natures de tokens :
 *
 *  • Tokens THÉMABLES (couleurs, rayons, ombres, durées, fontes) : la source de
 *    vérité est `tokens.css` (variables CSS, modifiables à l'exécution). Ici on
 *    ne référence QUE les noms de variables via `var(--…)` — aucun littéral hex
 *    dupliqué, donc aucune dérive possible.
 *
 *  • Échelles STATIQUES (typo, espacement, z-index, breakpoints) : pas besoin de
 *    théming runtime ; elles vivent ici et alimentent directement le preset
 *    Tailwind.
 *
 * Le preset Tailwind (`tailwind-preset.ts`) consomme ce module.
 */

/** Référence une variable CSS définie dans tokens.css. */
const cssVar = (name: string): string => `var(--${name})`;

/* ------------------------------------------------------------------------- *
 * COULEURS — rôles sémantiques (→ primitives shadcn re-skinnées)
 * ------------------------------------------------------------------------- */
export const colors = {
  background: cssVar('background'),
  foreground: cssVar('foreground'),
  surface: { DEFAULT: cssVar('surface'), foreground: cssVar('surface-foreground') },
  card: { DEFAULT: cssVar('card'), foreground: cssVar('card-foreground') },
  popover: { DEFAULT: cssVar('popover'), foreground: cssVar('popover-foreground') },
  primary: { DEFAULT: cssVar('primary'), foreground: cssVar('primary-foreground') },
  secondary: { DEFAULT: cssVar('secondary'), foreground: cssVar('secondary-foreground') },
  muted: { DEFAULT: cssVar('muted'), foreground: cssVar('muted-foreground') },
  accent: { DEFAULT: cssVar('accent'), foreground: cssVar('accent-foreground') },
  destructive: { DEFAULT: cssVar('destructive'), foreground: cssVar('destructive-foreground') },
  success: { DEFAULT: cssVar('success'), foreground: cssVar('success-fg') },
  warning: { DEFAULT: cssVar('warning'), foreground: cssVar('warning-fg') },
  info: { DEFAULT: cssVar('info'), foreground: cssVar('info-fg') },
  border: cssVar('border'),
  input: cssVar('input'),
  ring: cssVar('ring'),
  /* Échelles brutes — l'accès direct reste possible quand un rôle ne suffit pas. */
  gold: scale('gold'),
  ink: scale('ink'),
  paper: {
    0: cssVar('paper-0'),
    50: cssVar('paper-50'),
    100: cssVar('paper-100'),
    200: cssVar('paper-200'),
    300: cssVar('paper-300'),
  },
} as const;

/** Construit une échelle 50→900 référençant les variables CSS correspondantes. */
function scale(name: string): Record<number, string> {
  return {
    50: cssVar(`${name}-50`),
    100: cssVar(`${name}-100`),
    200: cssVar(`${name}-200`),
    300: cssVar(`${name}-300`),
    400: cssVar(`${name}-400`),
    500: cssVar(`${name}-500`),
    600: cssVar(`${name}-600`),
    700: cssVar(`${name}-700`),
    800: cssVar(`${name}-800`),
    900: cssVar(`${name}-900`),
  };
}

/* ------------------------------------------------------------------------- *
 * TYPOGRAPHIE
 * ------------------------------------------------------------------------- */
export const fontFamily = {
  serif: cssVar('font-serif'), // Newsreader — éditorial, émotion (client)
  sans: cssVar('font-sans'), // Hanken Grotesk — UI, densité (compagnon)
  mono: cssVar('font-mono'), // JetBrains Mono — donnée technique
} as const;

/** Échelle de tailles (rem). Mobile-first ; les tailles d'affichage servent
 *  aux titres éditoriaux de l'univers client. */
export const fontSize = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
  '6xl': '3.75rem',
} as const;

export const fontWeight = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  tight: '1.15', // titres
  snug: '1.3',
  normal: '1.5', // corps UI
  relaxed: '1.65', // lecture longue, contemplative (client)
} as const;

export const letterSpacing = {
  tight: '-0.02em',
  normal: '0em',
  wide: '0.04em', // labels, petites capitales
} as const;

/* ------------------------------------------------------------------------- *
 * ESPACEMENT — pas de 4px (mobile-first, rythme régulier)
 * ------------------------------------------------------------------------- */
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  32: '8rem',
} as const;

/* ------------------------------------------------------------------------- *
 * RAYONS / OMBRES / MOUVEMENT — référencent tokens.css
 * ------------------------------------------------------------------------- */
export const radius = {
  sm: cssVar('radius-sm'),
  md: cssVar('radius-md'),
  lg: cssVar('radius-lg'),
  xl: cssVar('radius-xl'),
  '2xl': cssVar('radius-2xl'),
  full: cssVar('radius-full'),
} as const;

export const shadow = {
  xs: cssVar('shadow-xs'),
  sm: cssVar('shadow-sm'),
  md: cssVar('shadow-md'),
  lg: cssVar('shadow-lg'),
  xl: cssVar('shadow-xl'),
  gold: cssVar('shadow-gold'),
} as const;

export const duration = {
  fast: cssVar('duration-fast'),
  base: cssVar('duration-base'),
  slow: cssVar('duration-slow'),
  slower: cssVar('duration-slower'),
} as const;

export const easing = {
  out: cssVar('ease-out'),
  inOut: cssVar('ease-in-out'),
} as const;

/* ------------------------------------------------------------------------- *
 * Z-INDEX / BREAKPOINTS
 * ------------------------------------------------------------------------- */
export const zIndex = {
  base: '0',
  dropdown: '1000',
  sticky: '1100',
  overlay: '1300',
  modal: '1400',
  toast: '1600',
} as const;

/** Mobile-first : valeurs min-width. */
export const screens = {
  sm: '480px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

/** Bundle complet des tokens — pratique pour l'accès programmatique. */
export const tokens = {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  spacing,
  radius,
  shadow,
  duration,
  easing,
  zIndex,
  screens,
} as const;

export type Tokens = typeof tokens;
