/**
 * OBAT KNOWLEDGE BASE — la grammaire documentée est-elle DÉMONTRÉE par le corpus ?
 * =============================================================================
 * Pur Node : on bundle le point d'entrée OBAT + la base de connaissance, puis on
 * vérifie que CHAQUE variante structurelle déclarée dans `OBAT_VARIANTES` est
 * exhibée par au moins un devis OBAT réel du corpus. Principe : on ne documente
 * pas une règle qu'on ne sait pas montrer. La base est ainsi TESTÉE + VERSIONNÉE ;
 * chaque nouvelle règle découverte devra être adossée à un devis du corpus.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORPUS } from './corpus/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const pnpmDir = join(root, 'node_modules/.pnpm');
const esbuildPkg = readdirSync(pnpmDir).find((d) => /^esbuild@/.test(d));
if (!esbuildPkg) throw new Error('esbuild introuvable dans node_modules/.pnpm');
const ESBUILD = join(pnpmDir, esbuildPkg, 'node_modules/esbuild/bin/esbuild');
const outFile = join(mkdtempSync(join(tmpdir(), 'obat-kb-')), 'kb.mjs');
execFileSync(
  ESBUILD,
  [
    join(root, 'packages/core/src/index.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${outFile}`,
    '--log-level=error',
  ],
  { cwd: root },
);
const { analyserDevis, OBAT_VARIANTES, OBAT_KB_VERSION } = await import(outFile);

const results = [];
const check = (label, fn) => {
  try {
    fn();
    results.push(true);
    console.log('  OK ', label);
  } catch (e) {
    results.push(false);
    console.log('  XX ', label, '--', String(e?.message ?? e));
  }
};

// Analyse tous les devis OBAT du corpus (dispatcher réel).
const analyses = CORPUS.filter((e) => e.truth.logiciel === 'obat').map((e) => {
  const geom = JSON.parse(readFileSync(join(here, 'corpus', e.geomPath), 'utf8'));
  return { id: e.id, analyse: analyserDevis(geom) };
});

check(`Base de connaissance versionnée (v${OBAT_KB_VERSION})`, () => {
  if (!(OBAT_KB_VERSION >= 1)) throw new Error('version manquante');
  if (!Array.isArray(OBAT_VARIANTES) || OBAT_VARIANTES.length < 5)
    throw new Error('grammaire vide ou trop pauvre');
});

console.log(`\nGrammaire OBAT v${OBAT_KB_VERSION} — ${OBAT_VARIANTES.length} variantes · corpus ${analyses.length} devis\n`);

// Chaque variante documentée DOIT être démontrée par au moins un devis réel.
for (const v of OBAT_VARIANTES) {
  check(`Variante « ${v.id} » démontrée par le corpus`, () => {
    const preuves = analyses.filter((a) => v.demontreePar(a.analyse)).map((a) => a.id);
    if (preuves.length === 0)
      throw new Error(`aucun devis ne démontre « ${v.id} » — règle non adossée au corpus`);
    console.log(`       ↳ ${v.id}: ${preuves.join(', ')}`);
  });
}

// Cohérence : toute variante a une description + une logique métier renseignées.
check('Chaque variante est documentée (description + logique métier)', () => {
  for (const v of OBAT_VARIANTES) {
    if (!v.description || v.description.length < 10) throw new Error(`description faible: ${v.id}`);
    if (!v.logiqueMetier || v.logiqueMetier.length < 10)
      throw new Error(`logique métier absente: ${v.id}`);
    if (v.nature !== 'constant' && v.nature !== 'variable')
      throw new Error(`nature invalide: ${v.id}`);
  }
});

const passed = results.filter(Boolean).length;
console.log(`\n=== ${passed}/${results.length} PASS (OBAT knowledge base) ===`);
process.exit(passed === results.length ? 0 : 1);
