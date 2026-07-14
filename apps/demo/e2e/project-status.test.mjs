/**
 * CONDITION BÊTA #5 — STATUT RÉEL DU CHANTIER, SOURCE DE VÉRITÉ UNIQUE.
 * ====================================================================
 * `deriveProjectStatus` réconcilie le statut MANUEL et les FAITS (le Journal) et
 * INTERDIT les états impossibles :
 *  • réception validée ⇒ « Clôturé » (jamais « En cours ») ;
 *  • « Clôturé » manuel sans réception validée ⇒ redescendu au fait justifié
 *    (donc jamais « Clôturé avec réserves ouvertes ») ;
 *  • une pré-réception BROUILLON n'est pas une étape franchie ;
 *  • une pré-réception validée fait passer au moins en « Pré-réception ».
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const pnpmDir = join(root, 'node_modules/.pnpm');
const esbuildPkg = readdirSync(pnpmDir).find((d) => /^esbuild@/.test(d));
const ESBUILD = join(pnpmDir, esbuildPkg, 'node_modules/esbuild/bin/esbuild');
const outFile = join(mkdtempSync(join(tmpdir(), 'status-')), 'core.mjs');
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
const { deriveProjectStatus, isProjectStatusLocked } = await import(outFile);

const results = [];
const check = (label, fn) => {
  try {
    fn();
    results.push(true);
  } catch (e) {
    results.push(false);
    console.log('  XX ', label, '--', String(e?.message ?? e));
  }
};
const eq = (a, b, msg) => {
  if (a !== b) throw new Error(`${msg}: attendu « ${b} », obtenu « ${a} »`);
};

const project = (status) => ({
  id: 'p1',
  name: 'Test',
  clientId: 'c1',
  status,
  currentStep: null,
  createdAt: '2026-01-01T00:00:00.000Z',
});
let seq = 0;
const cr = (content, state = 'publie') => ({
  id: `e${seq++}`,
  projectId: 'p1',
  type: 'compte_rendu',
  actor: { userId: 'u1', role: 'conducteur' },
  visibility: 'client',
  state,
  createdAt: '2026-02-01T00:00:00.000Z',
  content,
});
const prereceptionEv = (state = 'publie') => cr({ texte: '', prereception: { version: 1 } }, state);
const receptionEv = (state = 'publie') => cr({ texte: '', reception: { version: 1 } }, state);

/* 1. Réception validée ⇒ Clôturé, même si le manuel dit « En cours ». */
check('Réception validée + manuel « en_cours » ⇒ cloture', () => {
  eq(
    deriveProjectStatus(project('en_cours'), [receptionEv()]),
    'cloture',
    'réception force cloture',
  );
  if (!isProjectStatusLocked([receptionEv()]))
    throw new Error('statut non verrouillé après réception');
});

/* 2. « Clôturé » manuel SANS réception ⇒ jamais cloture (état impossible). */
check('Manuel « cloture » sans réception ⇒ redescend (jamais cloturé sans fait)', () => {
  eq(
    deriveProjectStatus(project('cloture'), []),
    'en_cours',
    'cloture manuel sans fait → en_cours',
  );
  if (isProjectStatusLocked([])) throw new Error('verrou sans réception');
});

/* 3. « Clôturé » manuel avec pré-réception validée ⇒ levée des réserves (pas cloture). */
check('Manuel « cloture » + pré-réception validée ⇒ levee_reserves', () => {
  eq(
    deriveProjectStatus(project('cloture'), [prereceptionEv()]),
    'levee_reserves',
    'cloture manuel + pré-réception → levee_reserves',
  );
});

/* 4. Pré-réception BROUILLON ⇒ pas une étape franchie. */
check('Pré-réception brouillon ⇒ le manuel « en_cours » reste en_cours', () => {
  eq(
    deriveProjectStatus(project('en_cours'), [prereceptionEv('brouillon')]),
    'en_cours',
    'un brouillon ne franchit pas d’étape',
  );
});

/* 5. Pré-réception validée relève le plancher à « pré-réception ». */
check('Pré-réception validée + manuel « en_cours » ⇒ pre_reception (plancher)', () => {
  eq(
    deriveProjectStatus(project('en_cours'), [prereceptionEv()]),
    'pre_reception',
    'pré-réception validée relève le plancher',
  );
});

/* 6. Sans aucun fait, le statut manuel cohérent est respecté. */
check('Sans fait, le manuel cohérent est respecté', () => {
  eq(deriveProjectStatus(project('en_cours'), []), 'en_cours', 'manuel respecté');
  eq(deriveProjectStatus(project('pas_commence'), []), 'pas_commence', 'manuel respecté');
});

const passed = results.filter(Boolean).length;
console.log(`\n=== STATUT CHANTIER (dérivation) — ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
