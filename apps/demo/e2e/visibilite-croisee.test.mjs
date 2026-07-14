/**
 * CONDITION BÊTA #6 — MOTEUR DE VISIBILITÉ UNIQUE, ZÉRO FUITE CROISÉE.
 * ===================================================================
 * `isVisibleTo(event, audience)` est la SEULE règle de visibilité (client /
 * artisan / conducteur). On vérifie l'étanchéité dans les deux sens :
 *  • aucune donnée INTERNE n'est visible du client ni de l'artisan ;
 *  • aucun échange PRIVÉ client (demande / décision) n'est visible de l'artisan ;
 *  • le récit PARTAGÉ (comptes rendus / photos publiés) est bien vu du client ET
 *    de l'artisan ;
 *  • un BROUILLON ne fuit jamais.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'vis-')), 'core.mjs');
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
const { isVisibleTo, isVisibleToClient, isVisibleToArtisan } = await import(outFile);

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
const T = (v, msg) => {
  if (v !== true) throw new Error(msg);
};
const F = (v, msg) => {
  if (v !== false) throw new Error(msg);
};

let seq = 0;
const ev = (o) => ({
  id: `e${seq++}`,
  projectId: 'p1',
  actor: { userId: 'u1', role: 'conducteur' },
  createdAt: '2026-02-01T00:00:00.000Z',
  ...o,
});
const crClientPublie = ev({
  type: 'compte_rendu',
  visibility: 'client',
  state: 'publie',
  content: { texte: 'Avancement partagé' },
});
const crInterne = ev({
  type: 'compte_rendu',
  visibility: 'interne',
  state: 'publie',
  content: { texte: 'Note interne conducteur' },
});
const crBrouillon = ev({
  type: 'compte_rendu',
  visibility: 'client',
  state: 'brouillon',
  content: { texte: 'Pas encore publié' },
});
const photoClient = ev({
  type: 'photo',
  visibility: 'client',
  state: 'publie',
  content: { attachment: { id: 'a1' } },
});
const documentClient = ev({
  type: 'document',
  visibility: 'client',
  state: 'publie',
  content: { libelle: 'Devis', attachment: { id: 'a2' } },
});
const demandeClient = ev({
  type: 'demande',
  visibility: 'client',
  state: 'ouverte',
  content: { destinataire: 'client', question: 'Choix carrelage ?' },
});
const decisionClient = ev({
  type: 'decision',
  visibility: 'client',
  state: 'publie',
  content: { kind: 'envoyee' },
});

/* -- CONDUCTEUR voit tout ---------------------------------------------------- */
check('Conducteur (interne) voit TOUT', () => {
  for (const e of [crClientPublie, crInterne, crBrouillon, demandeClient])
    T(isVisibleTo(e, 'conducteur'), 'le conducteur doit tout voir');
});

/* -- INTERNE ne fuit NI au client NI à l'artisan ----------------------------- */
check('Interne : invisible au client ET à l’artisan', () => {
  F(isVisibleTo(crInterne, 'client'), 'note interne fuit au client');
  F(isVisibleTo(crInterne, 'artisan'), 'note interne fuit à l’artisan');
});

/* -- BROUILLON ne fuit jamais ------------------------------------------------ */
check('Brouillon : invisible au client ET à l’artisan', () => {
  F(isVisibleTo(crBrouillon, 'client'), 'brouillon fuit au client');
  F(isVisibleTo(crBrouillon, 'artisan'), 'brouillon fuit à l’artisan');
});

/* -- RÉCIT PARTAGÉ : client ET artisan --------------------------------------- */
check('Récit partagé (CR & photo publiés) : vu du client ET de l’artisan', () => {
  T(isVisibleTo(crClientPublie, 'client'), 'le client ne voit pas le CR partagé');
  T(isVisibleTo(crClientPublie, 'artisan'), 'l’artisan ne voit pas le CR partagé');
  T(isVisibleTo(photoClient, 'artisan'), 'l’artisan ne voit pas la photo partagée');
});

/* -- PRIVÉ CLIENT : jamais à l'artisan (fuite croisée client → artisan) ------- */
check('Privé client (demande / décision / document) : PAS visible de l’artisan', () => {
  F(isVisibleTo(demandeClient, 'artisan'), 'une demande client fuit à l’artisan');
  F(isVisibleTo(decisionClient, 'artisan'), 'une décision client fuit à l’artisan');
  // Le document client est un échange client ↔ équipe, pas le fil artisan.
  F(isVisibleTo(documentClient, 'artisan'), 'un document client fuit dans le fil artisan');
  // …mais le client, lui, les voit bien.
  T(isVisibleTo(demandeClient, 'client'), 'le client ne voit pas sa propre demande');
  T(isVisibleTo(documentClient, 'client'), 'le client ne voit pas son document');
});

/* -- Cohérence des alias : le moteur = les règles nommées -------------------- */
check('Le moteur unique délègue aux règles nommées (pas de logique dupliquée)', () => {
  for (const e of [crClientPublie, crInterne, demandeClient, documentClient]) {
    if (isVisibleTo(e, 'client') !== isVisibleToClient(e))
      throw new Error('isVisibleTo(client) diverge de isVisibleToClient');
    if (isVisibleTo(e, 'artisan') !== isVisibleToArtisan(e))
      throw new Error('isVisibleTo(artisan) diverge de isVisibleToArtisan');
  }
});

const passed = results.filter(Boolean).length;
console.log(`\n=== VISIBILITÉ CROISÉE — ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
