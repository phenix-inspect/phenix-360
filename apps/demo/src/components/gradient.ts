import type { CSSProperties } from 'react';

/**
 * Dégradés chauds DÉTERMINISTES pour les tuiles photo de la démo (en attendant
 * de vraies images). Palette curatée issue de la marque (or/encre) : jamais
 * d'aléatoire criard, toujours sobre et premium. Une même photo → toujours le
 * même rendu.
 *
 * Vit côté app (et non dans @phenix360/ui) car cela exige un `style` inline,
 * interdit dans les composants du design system (les tokens y font foi).
 */
const PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['#3d2e18', '#7a5a2c'], // or profond → or
  ['#1c1915', '#564f47'], // encre → encre claire
  ['#5c4423', '#997235'], // or sombre → or moyen
  ['#2a2620', '#7a5a2c'], // encre → or
  ['#3b362f', '#b5893c'], // encre chaude → or accent
  ['#7a5a2c', '#c99f45'], // or → or clair
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Renvoie un `style` de dégradé linéaire stable pour une graine donnée. */
export function warmGradient(seed: string): CSSProperties {
  const [from, to] = PALETTE[hash(seed) % PALETTE.length]!;
  const angle = 115 + (hash(`${seed}~`) % 50); // 115°–164°
  return { backgroundImage: `linear-gradient(${angle}deg, ${from}, ${to})` };
}
