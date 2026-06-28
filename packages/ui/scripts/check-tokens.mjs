#!/usr/bin/env node
/**
 * Garde-fou Design System — « les tokens font foi » (cf. CONVENTIONS.md).
 * ---------------------------------------------------------------------------
 * Échoue (exit 1) si un composant embarque en dur une couleur, une ombre, un
 * rayon ou un espacement premium au lieu de passer par les tokens / classes
 * sémantiques. Ne scanne que src/components/** (les tokens en sont exclus).
 *
 * Volontairement sans dépendance : exécutable en CI via `turbo run lint`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS_DIR = join(ROOT, 'src', 'components');

/** Préfixes d'utilitaires Tailwind « premium » qui ne doivent jamais être
 *  fournis en valeur arbitraire (`…-[…]`). */
const COLORISH =
  'bg|text|border|ring|ring-offset|fill|stroke|shadow|rounded|from|via|to|outline|decoration|divide|caret|accent';
const SIZISH =
  'p|m|gap|space|w|h|min-w|min-h|max-w|max-h|size|inset|top|right|bottom|left|basis|translate';

const RULES = [
  { label: 'couleur hex en dur', re: /#[0-9a-fA-F]{3,8}\b/ },
  { label: 'couleur rgb/rgba en dur', re: /\brgba?\(/ },
  { label: 'couleur hsl/hsla en dur', re: /\bhsla?\(/ },
  {
    label: 'valeur arbitraire (couleur/ombre/rayon)',
    re: new RegExp(`(?:^|[\\s"'\`:])(?:${COLORISH})-\\[`),
  },
  {
    label: 'espacement/dimension arbitraire',
    re: new RegExp(`(?:^|[\\s"'\`:])-?(?:${SIZISH})[trblxy]?-\\[`),
  },
  { label: 'style inline (préférer les tokens)', re: /style=\{\{/ },
];

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

let files = [];
try {
  files = walk(COMPONENTS_DIR);
} catch {
  console.log('✓ Aucun composant à vérifier pour l’instant.');
  process.exit(0);
}

let violations = 0;
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, ''); // ignorer les commentaires de fin de ligne
    for (const rule of RULES) {
      if (rule.re.test(code)) {
        console.error(`✗ ${relative(ROOT, file)}:${i + 1}  — ${rule.label}\n    ${line.trim()}`);
        violations++;
      }
    }
  });
}

if (violations > 0) {
  console.error(
    `\n${violations} violation(s). Un composant doit passer par les tokens / classes sémantiques (cf. packages/ui/CONVENTIONS.md).`,
  );
  process.exit(1);
}
console.log(`✓ Tokens respectés — ${files.length} fichier(s) de composants vérifié(s).`);
