/**
 * MOTEUR PDF UNIQUE — les documents générés sont de VRAIS PDF.
 * =============================================================================
 * On bundle le moteur (`pdfEngine.ts`) et, pour chaque type de document généré,
 * on vérifie que la sortie est un PDF RÉEL — pas seulement qu'un octet sort :
 *   • signature binaire « %PDF- » en tête ;
 *   • ouverture correcte par un lecteur PDF (pdfjs-dist) ;
 *   • contenu attendu réellement présent (titres, devis, réserves, signatures,
 *     conclusion, filigrane BROUILLON) extrait du PDF, pas du HTML.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'pdf-')), 'pdfEngine.mjs');
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
const { buildDocumentPdf } = await import(outFile);
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

/** Vrai PDF ? En-tête « %PDF- » + parsable + texte de toutes les pages. */
const readPdf = async (bytes) => {
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (header !== '%PDF-') throw new Error(`signature binaire absente (« ${header} »)`);
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    text += ' ' + tc.items.map((it) => it.str).join(' ');
  }
  return { pages: pdf.numPages, text };
};

const ctx = {
  projectName: 'Appartement Lyon 6e',
  authorName: 'Léon',
  address: '12 rue de la Ré, Lyon 6e',
  clientName: 'Mme Bernard',
};

/* -------------------------- Fabriques d'événements ------------------------ */
const photo = (u) => ({ imageUrl: u, bucket: 'b', storagePath: u, mimeType: 'image/png' });

const receptionEvent = (state = 'publie') => ({
  id: 'rec1',
  projectId: 'p1',
  type: 'compte_rendu',
  actor: { userId: 'u1', role: 'conducteur' },
  visibility: 'client',
  state,
  captureId: null,
  createdAt: '2026-07-14T10:00:00.000Z',
  publishedBy: state === 'publie' ? 'u1' : null,
  publishedAt: state === 'publie' ? '2026-07-14T10:00:00.000Z' : null,
  content: {
    texte: '',
    missionKind: 'reception',
    docTitre: 'Réception',
    reception: {
      prereceptionEventId: 'pr1',
      prereceptionRef: 'PR-20260710-V1',
      devisRef: 'DEV-2024-0188',
      avenants: [1, 2],
      version: 1,
      prestationsTotal: 12,
      reserves: [
        {
          numero: 1,
          posteId: 'p-1',
          lotLabel: 'Plomberie',
          prestationLabel: 'WC suspendu',
          commentaireInitial: 'Joint silicone a reprendre.',
          responsable: 'artisan',
          dateCreation: '2026-07-10T09:00:00.000Z',
          photosAvant: [],
          levee: { commentaire: 'Joint refait proprement.', photos: [], conducteur: 'Léon' },
        },
      ],
    },
  },
});

const prereceptionEvent = (state = 'publie') => ({
  id: 'e1',
  projectId: 'p1',
  type: 'compte_rendu',
  actor: { userId: 'u1', role: 'conducteur' },
  visibility: 'client',
  state,
  captureId: null,
  createdAt: '2026-07-14T10:00:00.000Z',
  publishedBy: state === 'publie' ? 'u1' : null,
  publishedAt: state === 'publie' ? '2026-07-14T10:00:00.000Z' : null,
  content: {
    texte: '',
    missionKind: 'prereception',
    docTitre: 'Pré-réception',
    prereception: {
      presents: [],
      commentaireGeneral: 'Pré-réception conforme.',
      version: 1,
      prestations: [
        {
          posteId: 'p-1',
          lotLabel: 'Plomberie',
          label: 'WC suspendu',
          origin: { kind: 'initial' },
          statut: 'reserve',
          reserve: {
            photos: [],
            commentaire: 'Joint a reprendre autour du receveur.',
            responsable: 'artisan',
            dateReprise: '2026-08-01',
          },
        },
      ],
    },
  },
});

const crPointsEvent = () => ({
  id: 'cr1',
  projectId: 'p1',
  type: 'compte_rendu',
  actor: { userId: 'u1', role: 'conducteur' },
  visibility: 'client',
  state: 'publie',
  captureId: null,
  createdAt: '2026-07-14T10:00:00.000Z',
  publishedBy: 'u1',
  publishedAt: '2026-07-14T10:00:00.000Z',
  content: {
    texte: '',
    missionKind: 'compte_rendu',
    docTitre: 'Compte rendu de chantier',
    points: [
      { photos: [photo('data:img')], comment: 'Carrelage terminé au séjour.', diffusion: 'client' },
    ],
  },
});

/* -- 1. Réception : vrai PDF, contenu réel ---------------------------------- */
await check('Réception → vrai PDF (%PDF-) + contenu (devis, conclusion, signatures)', async () => {
  const { pages, text } = await readPdf(buildDocumentPdf(receptionEvent('publie'), ctx, 'client'));
  if (pages < 1) throw new Error('aucune page');
  for (const must of [
    'Réception',
    'DEV-2024-0188',
    'Joint refait proprement.',
    'Les travaux sont réceptionnés.',
    'PHÉNIX',
  ])
    if (!text.includes(must)) throw new Error(`le PDF omet « ${must} »`);
  if (!/client ou son repr/i.test(text)) throw new Error('bloc de signature Client absent');
  if (/artisan ou son repr/i.test(text)) throw new Error('bloc ARTISAN sur le PV de réception');
});

/* -- 2. Filigrane BROUILLON avant validation, absent après ------------------ */
await check('BROUILLON : présent en brouillon, absent une fois validé (PDF)', async () => {
  const draft = await readPdf(buildDocumentPdf(receptionEvent('brouillon'), ctx, 'client'));
  if (!draft.text.includes('BROUILLON')) throw new Error('filigrane absent du brouillon');
  const publie = await readPdf(buildDocumentPdf(receptionEvent('publie'), ctx, 'client'));
  if (publie.text.includes('BROUILLON')) throw new Error('filigrane présent sur le validé');
});

/* -- 3. Pré-réception Client : PDF, signataires client ---------------------- */
await check('Pré-réception Client → PDF + « Client ou son représentant »', async () => {
  const { text } = await readPdf(buildDocumentPdf(prereceptionEvent('publie'), ctx, 'client'));
  for (const must of ['Pré-réception', 'Joint a reprendre autour du receveur.'])
    if (!text.includes(must)) throw new Error(`le PDF client omet « ${must} »`);
  if (!/client ou son repr/i.test(text)) throw new Error('bloc de signature Client absent');
  if (/artisan ou son repr/i.test(text)) throw new Error('bloc ARTISAN sur la version client');
  // Étanchéité : le client ne voit pas le responsable interne.
  if (text.includes('Responsable')) throw new Error('fuite interne (Responsable) côté client');
});

/* -- 4. Pré-réception Artisan : PDF, signataires artisan + interne ---------- */
await check('Pré-réception Artisan → PDF + « Artisan ou son représentant » + interne', async () => {
  const { text } = await readPdf(buildDocumentPdf(prereceptionEvent('publie'), ctx, 'artisan'));
  if (!/artisan ou son repr/i.test(text)) throw new Error('bloc de signature Artisan absent');
  if (!text.includes('Responsable')) throw new Error('le PDF artisan omet « Responsable »');
  if (/client ou son repr/i.test(text)) throw new Error('bloc CLIENT sur la version artisan');
});

/* -- 5. Compte rendu à points : PDF ---------------------------------------- */
await check('Compte rendu (points) → PDF + commentaire du point', async () => {
  const { text } = await readPdf(buildDocumentPdf(crPointsEvent(), ctx, 'client'));
  if (!text.includes('Carrelage terminé au séjour.'))
    throw new Error('commentaire du point absent');
});

/* -- 6. Pagination : un document volumineux tient sur plusieurs pages ------- */
await check('Pagination : beaucoup de réserves → plusieurs pages, encarts entiers', async () => {
  const ev = receptionEvent('publie');
  ev.content.reception.reserves = Array.from({ length: 12 }, (_, i) => ({
    numero: i + 1,
    posteId: `p-${i}`,
    lotLabel: 'Lot',
    prestationLabel: `Prestation ${i + 1}`,
    commentaireInitial: 'Commentaire initial de la réserve, assez long pour occuper de la place.',
    responsable: 'artisan',
    dateCreation: '2026-07-10T09:00:00.000Z',
    photosAvant: [],
    levee: { commentaire: 'Reprise effectuée et contrôlée sur place.', photos: [] },
  }));
  const { pages } = await readPdf(buildDocumentPdf(ev, ctx, 'client'));
  if (pages < 2) throw new Error(`document volumineux non paginé (${pages} page)`);
});

const passed = results.filter(Boolean).length;
console.log(`\n=== MOTEUR PDF — ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
