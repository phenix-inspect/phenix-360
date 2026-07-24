/**
 * RÉCEPTION — cœur métier (packages/core/src/reception.ts).
 * =============================================================================
 * On bundle le module pur et on vérifie les règles : extraction des réserves d'une
 * Pré-réception (jamais de prestation recréée), levée complète (commentaire + 1 à 3
 * photos), blocage tant qu'une réserve reste ouverte, synthèse, références.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'reccore-')), 'reception.mjs');
execFileSync(
  ESBUILD,
  [
    join(root, 'packages/core/src/reception.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${outFile}`,
    '--log-level=error',
  ],
  { cwd: root },
);
const rec = await import(outFile);

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
  if (a !== b) throw new Error(`${msg} : attendu ${b}, obtenu ${a}`);
};

const ph = (n) => ({
  imageUrl: `data:x${n}`,
  bucket: 'b',
  storagePath: `s${n}`,
  mimeType: 'image/png',
});
const prestation = (id, statut, reserve) => ({
  posteId: id,
  lotLabel: 'Lot',
  label: `Prestation ${id}`,
  origin: { kind: 'initial' },
  statut,
  ...(reserve ? { reserve } : {}),
});

/* -- 1. Extraction : seules les prestations « réserve » deviennent des réserves -- */
check('reservesDePrereception : n’extrait que les réserves, numérotées', () => {
  const data = {
    presents: [],
    commentaireGeneral: '',
    prestations: [
      prestation('a', 'fait'),
      prestation('b', 'reserve', { photos: [ph(1)], commentaire: 'R1', responsable: 'artisan' }),
      prestation('c', 'non_fait', undefined),
      prestation('d', 'reserve', { photos: [], commentaire: 'R2', responsable: 'phenix' }),
    ],
  };
  const rs = rec.reservesDePrereception(data, '2026-07-10T00:00:00.000Z');
  eq(rs.length, 2, 'nombre de réserves extraites');
  eq(rs[0].numero, 1, 'numéro 1');
  eq(rs[1].numero, 2, 'numéro 2');
  eq(rs[0].posteId, 'b', 'posteId conservé');
  eq(rs[0].commentaireInitial, 'R1', 'commentaire initial repris');
  eq(rs[0].photosAvant.length, 1, 'photos avant reprises');
  eq(rs[0].dateCreation, '2026-07-10T00:00:00.000Z', 'date de création');
});

/* -- 2. Levée complète : commentaire + 1 à 3 photos ------------------------- */
check('leveeComplete : commentaire non vide + 1 à 3 photos', () => {
  eq(rec.leveeComplete(undefined), false, 'absente');
  eq(rec.leveeComplete({ commentaire: '', photos: [ph(1)] }), false, 'commentaire vide');
  eq(rec.leveeComplete({ commentaire: 'ok', photos: [] }), false, 'zéro photo');
  eq(rec.leveeComplete({ commentaire: 'ok', photos: [ph(1)] }), true, '1 photo');
  eq(rec.leveeComplete({ commentaire: 'ok', photos: [ph(1), ph(2), ph(3)] }), true, '3 photos');
  eq(
    rec.leveeComplete({ commentaire: 'ok', photos: [ph(1), ph(2), ph(3), ph(4)] }),
    false,
    '4 photos (au-delà du max)',
  );
});

/* -- 3. Blocage : une seule réserve ouverte empêche la validation ----------- */
check('receptionComplete : bloquée tant qu’une réserve reste ouverte', () => {
  const levee = { commentaire: 'ok', photos: [ph(1)] };
  const r = (id, l) => ({
    numero: 1,
    posteId: id,
    lotLabel: 'L',
    prestationLabel: 'P',
    commentaireInitial: 'c',
    responsable: 'artisan',
    dateCreation: 'd',
    photosAvant: [],
    ...(l ? { levee: l } : {}),
  });
  eq(rec.receptionComplete([]), true, 'aucune réserve → validable');
  eq(rec.receptionComplete([r('a', levee)]), true, 'une réserve levée → validable');
  eq(rec.receptionComplete([r('a', levee), r('b')]), false, 'une réserve ouverte → bloquée');
  eq(rec.reservesRestantes([r('a', levee), r('b')]), 1, 'restantes');
  eq(rec.reservesLevees([r('a', levee), r('b')]), 1, 'levées');
});

/* -- 4. Synthèse ------------------------------------------------------------ */
check('receptionSynthese : compte prestations / créées / levées / restantes', () => {
  const levee = { commentaire: 'ok', photos: [ph(1)] };
  const r = (id, l) => ({
    numero: 1,
    posteId: id,
    lotLabel: 'L',
    prestationLabel: 'P',
    commentaireInitial: 'c',
    responsable: 'artisan',
    dateCreation: 'd',
    photosAvant: [],
    ...(l ? { levee: l } : {}),
  });
  const s = rec.receptionSynthese({
    prereceptionEventId: 'e',
    prereceptionRef: 'PR',
    avenants: [],
    prestationsTotal: 10,
    reserves: [r('a', levee), r('b')],
  });
  eq(s.prestationsTotal, 10, 'prestations');
  eq(s.reservesCreees, 2, 'créées');
  eq(s.reservesLevees, 1, 'levées');
  eq(s.reservesRestantes, 1, 'restantes');
});

/* -- 5. Références & titres -------------------------------------------------- */
check('receptionReference / receptionDocTitle : format stable et versionné', () => {
  eq(rec.receptionReference('2026-07-14T10:00:00.000Z', 1), 'REC-20260714-V1', 'référence V1');
  eq(rec.receptionReference('2026-07-14T10:00:00.000Z', 2), 'REC-20260714-V2', 'référence V2');
  eq(rec.receptionDocTitle(1), 'Réception', 'titre V1');
  eq(rec.receptionDocTitle(3), 'Réception V3', 'titre V3');
});

const passed = results.filter(Boolean).length;
console.log(`\n=== RÉCEPTION (cœur) — ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
