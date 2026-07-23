/**
 * DOSSIER DE CHANTIER — un vrai PDF de synthèse (livrable / archive).
 * =============================================================================
 * On bundle le moteur (`pdfEngine.ts`) et on vérifie que `buildChantierDossierPdf`
 * produit un PDF RÉEL : signature « %PDF- », ouverture par pdfjs, contenu attendu
 * (couverture, synthèse, comptes rendus, choix, réserves, documents, coulisses),
 * et pagination sur un dossier volumineux.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'dossier-')), 'pdfEngine.mjs');
execFileSync(
  ESBUILD,
  [
    join(root, 'apps/demo/src/lib/pdfEngine.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${outFile}`,
    '--log-level=error',
  ],
  { cwd: root },
);
const { buildChantierDossierPdf } = await import(outFile);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const results = [];
const check = async (label, fn) => {
  try {
    await fn();
    results.push(true);
  } catch (e) {
    results.push(false);
    console.log('  XX ', label, '--', String(e?.message ?? e));
  }
};

const readPdf = async (bytes) => {
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (header !== '%PDF-') throw new Error(`signature binaire absente (« ${header} »)`);
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    text += ' ' + tc.items.map((it) => it.str).join(' ');
  }
  // Les titres de section sont rendus en CAPITALES : comparaison insensible à la casse.
  return { pages: pdf.numPages, text: text.replace(/\s+/g, ' ').toLowerCase() };
};
const has = (text, needle) => text.includes(needle.toLowerCase());

const baseInput = () => ({
  project: {
    name: 'Rénovation Martin — Lyon 6e',
    code: '26-LY-003',
    address: '48 rue Cuvie, Lyon',
    clientName: 'Mme Martin',
    statusLabel: 'En cours',
    stepLabel: 'Gros œuvre',
    createdAt: '2026-06-01T09:00:00.000Z',
  },
  generatedAt: '2026-07-23T09:00:00.000Z',
  synthese: { comptesRendus: 1, choix: 1, documents: 1, reservesOuvertes: 1 },
  comptesRendus: [
    {
      date: '2026-06-20T10:00:00.000Z',
      titre: 'Compte rendu de chantier',
      texte: 'Dalle coulée, séchage en cours.',
      photos: [{ imageUrl: 'data:img' }],
    },
  ],
  choix: [{ categorie: 'Carrelage', label: 'Salle de bain', statut: 'Validé', detail: 'Ardoise' }],
  reserves: [
    {
      numero: 1,
      libelle: 'Joint silicone à reprendre',
      ouverte: true,
      date: '2026-07-10T09:00:00.000Z',
    },
  ],
  documents: [
    {
      libelle: 'Attestation assurance',
      famille: 'Administratif',
      date: '2026-06-15T09:00:00.000Z',
    },
  ],
  album: [
    {
      titre: 'Cuisine installée',
      legende: '',
      date: '2026-06-25T10:00:00.000Z',
      photos: [{ imageUrl: 'data:img' }],
    },
  ],
});

/* -- 1. Vrai PDF + toutes les sections présentes --------------------------- */
await check('Dossier → vrai PDF (%PDF-) + couverture/synthèse/sections', async () => {
  const { pages, text } = await readPdf(buildChantierDossierPdf(baseInput()));
  if (pages < 1) throw new Error('aucune page');
  for (const must of [
    'Dossier de chantier',
    'Rénovation Martin',
    '26-LY-003',
    'Cuvie',
    'Mme Martin',
    'Synthèse',
    'Compte rendu de chantier',
    'Dalle coulée',
    'Carrelage',
    'Salle de bain',
    'Joint silicone à reprendre',
    'Attestation assurance',
    'Dans les coulisses',
    'Cuisine installée',
    'PHÉNIX 360',
  ])
    if (!has(text, must)) throw new Error(`le PDF omet « ${must} »`);
});

/* -- 2. Sections vides omises (pas de titre orphelin) ---------------------- */
await check('Sections vides omises (aucun compte rendu / réserve / document)', async () => {
  const input = baseInput();
  input.comptesRendus = [];
  input.reserves = [];
  input.documents = [];
  input.album = [];
  input.choix = [];
  const { text } = await readPdf(buildChantierDossierPdf(input));
  // Contenu DISTINCTIF de chaque section (les libellés de tuiles de synthèse
  // reprennent « Comptes rendus » etc. : on teste le contenu, pas le titre).
  for (const absent of [
    'Dalle coulée',
    'Salle de bain',
    'Joint silicone',
    'Attestation assurance',
    'Cuisine installée',
  ])
    if (has(text, absent)) throw new Error(`contenu de section vide « ${absent} » rendu à tort`);
  // La couverture et la synthèse restent toujours présentes.
  if (!has(text, 'Synthèse')) throw new Error('synthèse absente');
});

/* -- 3. Pagination : un dossier volumineux tient sur plusieurs pages ------- */
await check('Pagination : beaucoup de comptes rendus → plusieurs pages', async () => {
  const input = baseInput();
  input.comptesRendus = Array.from({ length: 40 }, (_, i) => ({
    date: '2026-06-20T10:00:00.000Z',
    titre: `Compte rendu ${i + 1}`,
    texte: 'Observation assez longue pour occuper de la place sur la page du dossier de chantier.',
    photos: [],
  }));
  const { pages } = await readPdf(buildChantierDossierPdf(input));
  if (pages < 2) throw new Error(`dossier volumineux non paginé (${pages} page)`);
});

const passed = results.filter(Boolean).length;
console.log(`\n=== DOSSIER DE CHANTIER — ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
