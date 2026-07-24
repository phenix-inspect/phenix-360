/**
 * CODE CHANTIER `AA-VV-NNN` — génération unique, définitive, annuelle (pur Node).
 * ===========================================================================
 * On bundle le core et on vérifie les invariants du code chantier :
 *   • format AA-VV-NNN ;
 *   • AA = année de création sur 2 chiffres ;
 *   • VV = 2 lettres dérivées de la ville (règle « 2 premières lettres ») ;
 *   • NNN = compteur ANNUEL et GLOBAL (toutes villes), qui repart à 001 par an ;
 *   • backfill déterministe + idempotent ;
 *   • le code est définitif (l'unicité tient même après ré-attribution).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = '/home/user/phenix-360/';
const pnpmDir = join(root, 'node_modules/.pnpm');
const esbuildPkg = readdirSync(pnpmDir).find((d) => /^esbuild@/.test(d));
const ESBUILD = join(pnpmDir, esbuildPkg, 'node_modules/esbuild/bin/esbuild');
const outFile = join(mkdtempSync(join(tmpdir(), 'code-')), 'core.mjs');
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
const {
  cityCode,
  cityFromAddress,
  generateProjectCode,
  nextProjectCodeSeq,
  ensureProjectCodes,
  hasValidProjectCode,
  PROJECT_CODE_RE,
} = await import(outFile);

let passed = 0;
const results = [];
const check = (label, fn) => {
  try {
    fn();
    passed++;
    results.push(true);
    console.log('  OK ', label);
  } catch (e) {
    results.push(false);
    console.log('  XX ', label, '--', e.message);
  }
};
const eq = (a, b, msg) => {
  if (a !== b) throw new Error(`${msg ?? ''} attendu « ${b} », obtenu « ${a} »`);
};

/* --- VV : code ville (2 premières lettres, accents retirés) --------------- */
check('cityCode — Lyon → LY', () => eq(cityCode('Lyon'), 'LY'));
check('cityCode — Paris → PA', () => eq(cityCode('Paris'), 'PA'));
check('cityCode — Nancy → NA', () => eq(cityCode('Nancy'), 'NA'));
check('cityCode — Metz → ME', () => eq(cityCode('Metz'), 'ME'));
check('cityCode — Écully → EC (accent retiré)', () => eq(cityCode('Écully'), 'EC'));
check('cityCode — vide → XX', () => eq(cityCode(''), 'XX'));
check('cityCode — sans lettre → XX', () => eq(cityCode('69006'), 'XX'));
check('cityCode — 1 lettre → complétée X', () => eq(cityCode('Y'), 'YX'));

/* --- Ville depuis l'adresse ---------------------------------------------- */
check('cityFromAddress — après le code postal', () =>
  eq(cityFromAddress('8 rue Vauban, 69006 Lyon'), 'Lyon'),
);
check('cityFromAddress — accent conservé', () =>
  eq(cityFromAddress('12 chemin des Cuers, 69130 Écully'), 'Écully'),
);
check('cityFromAddress — sans code postal → dernier segment', () =>
  eq(cityFromAddress('Chantier, Marseille'), 'Marseille'),
);
check('cityFromAddress — vide → vide', () => eq(cityFromAddress(''), ''));

/* --- Format global -------------------------------------------------------- */
const D26 = '2026-07-18T10:00:00.000Z';
check('génère un code au format AA-VV-NNN', () => {
  const c = generateProjectCode({
    address: '8 rue Vauban, 69006 Lyon',
    createdAt: D26,
    existingCodes: [],
  });
  if (!PROJECT_CODE_RE.test(c)) throw new Error(`format invalide : ${c}`);
  eq(c, '26-LY-001');
});

/* --- Compteur ANNUEL et GLOBAL (toutes villes) --------------------------- */
check('compteur global : 2e chantier = 002, quelle que soit la ville', () => {
  const c = generateProjectCode({
    address: 'X, 57000 Metz',
    createdAt: D26,
    existingCodes: ['26-LY-001'],
  });
  eq(c, '26-ME-002');
});
check('compteur global : 3e chantier (autre ville) = 003', () => {
  const c = generateProjectCode({
    address: 'X, 75001 Paris',
    createdAt: D26,
    existingCodes: ['26-LY-001', '26-ME-002'],
  });
  eq(c, '26-PA-003');
});
check('même ville deux fois → numéros différents (jamais de doublon)', () => {
  const c = generateProjectCode({
    address: 'X, 69006 Lyon',
    createdAt: D26,
    existingCodes: ['26-LY-001', '26-ME-002', '26-PA-003'],
  });
  eq(c, '26-LY-004');
});

/* --- Réinitialisation annuelle ------------------------------------------- */
check('le compteur repart à 001 chaque nouvelle année', () => {
  const c = generateProjectCode({
    address: 'X, 69006 Lyon',
    createdAt: '2027-01-03T09:00:00.000Z',
    existingCodes: ['26-LY-001', '26-ME-002', '26-PA-050'],
  });
  eq(c, '27-LY-001');
});
check('nextProjectCodeSeq ignore les codes malformés et les autres années', () => {
  eq(nextProjectCodeSeq(['26-LY-007', 'garbage', '25-PA-099', '26-XX-003'], '26'), 8);
});

/* --- Backfill déterministe + idempotent ---------------------------------- */
check('ensureProjectCodes attribue par ordre chronologique', () => {
  const projects = [
    { code: '', address: 'X, 75001 Paris', createdAt: '2026-03-02T00:00:00.000Z' },
    { code: '', address: 'X, 69006 Lyon', createdAt: '2026-01-05T00:00:00.000Z' },
    { code: '', address: 'X, 57000 Metz', createdAt: '2026-02-10T00:00:00.000Z' },
  ];
  const out = ensureProjectCodes(projects);
  eq(out[1].code, '26-LY-001', 'le plus ancien (Lyon) → 001');
  eq(out[2].code, '26-ME-002', 'ensuite Metz → 002');
  eq(out[0].code, '26-PA-003', 'puis Paris → 003');
});
check('ensureProjectCodes préserve les codes déjà valides (définitifs)', () => {
  const projects = [
    { code: '26-LY-001', address: 'X, 69006 Lyon', createdAt: '2026-01-05T00:00:00.000Z' },
    { code: '', address: 'X, 57000 Metz', createdAt: '2026-02-10T00:00:00.000Z' },
  ];
  const out = ensureProjectCodes(projects);
  eq(out[0].code, '26-LY-001', 'code existant inchangé');
  eq(out[1].code, '26-ME-002', 'le manquant prend le suivant');
});
check('ensureProjectCodes est idempotent', () => {
  const projects = [
    { code: '', address: 'X, 69006 Lyon', createdAt: '2026-01-05T00:00:00.000Z' },
    { code: '', address: 'X, 57000 Metz', createdAt: '2026-02-10T00:00:00.000Z' },
  ];
  const once = ensureProjectCodes(projects);
  const twice = ensureProjectCodes(once);
  eq(twice[0].code, once[0].code);
  eq(twice[1].code, once[1].code);
});

/* --- Validation ----------------------------------------------------------- */
check('hasValidProjectCode', () => {
  if (!hasValidProjectCode('26-LY-001')) throw new Error('devrait être valide');
  if (hasValidProjectCode('26-ly-001')) throw new Error('minuscules refusées');
  if (hasValidProjectCode('2026-LY-1')) throw new Error('format libre refusé');
  if (hasValidProjectCode('')) throw new Error('vide refusé');
  if (hasValidProjectCode(undefined)) throw new Error('undefined refusé');
});

console.log(`\n=== ${passed}/${results.length} PASS ===`);
process.exit(results.every(Boolean) ? 0 : 1);
