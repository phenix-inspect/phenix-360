/**
 * PRÉ-RÉCEPTION — les signataires du PV dépendent du destinataire (apps/demo).
 * =============================================================================
 * Bug documentaire : la version Artisan affichait « Client ou son représentant ».
 * On bundle le générateur de documents (`generatedDocument.ts`) et on vérifie sur
 * le HTML produit :
 *   • Version Client  → PHÉNIX + « Client ou son représentant », JAMAIS artisan ;
 *   • Version Artisan → PHÉNIX + « Artisan ou son représentant » (Entreprise / Lot
 *     / Nom du signataire), JAMAIS client ;
 *   • Artisan identifié → entreprise & lot PRÉREMPLIS (jamais inventés) ;
 *   • Filigrane BROUILLON avant validation, absent une fois validé ;
 *   • Aucun encart de signature coupé entre deux pages (page-break-inside: avoid).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const pnpmDir = join(root, 'node_modules/.pnpm');
const esbuildPkg = readdirSync(pnpmDir).find((d) => /^esbuild@/.test(d));
const ESBUILD = join(pnpmDir, esbuildPkg, 'node_modules/esbuild/bin/esbuild');
const outFile = join(mkdtempSync(join(tmpdir(), 'sign-')), 'gendoc.mjs');
execFileSync(
  ESBUILD,
  [
    join(root, 'apps/demo/src/lib/generatedDocument.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${outFile}`,
    '--log-level=error',
  ],
  { cwd: root },
);
const { buildDocumentHtml } = await import(outFile);

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

/** Un événement pré-réception minimal (state 'publie' = validé, 'brouillon' = aperçu). */
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
          lotLabel: 'Électricité',
          label: 'Tableau électrique',
          origin: { kind: 'initial' },
          statut: 'fait',
        },
      ],
    },
  },
});

const html = (audience, ctxExtra = {}) =>
  buildDocumentHtml(
    prereceptionEvent(ctxExtra.state ?? 'publie'),
    { projectName: 'Appartement Lyon 6e', authorName: 'Léon', ...ctxExtra },
    audience,
  );

/* -- 1. Version CLIENT : PHÉNIX + Client, jamais Artisan --------------------- */
check('Version Client : PHÉNIX + « Client ou son représentant », aucun bloc Artisan', () => {
  const doc = html('client');
  if (!doc.includes('PHÉNIX')) throw new Error('bloc PHÉNIX absent (client)');
  if (!doc.includes('Client ou son représentant')) throw new Error('bloc Client absent');
  if (doc.includes('Artisan ou son représentant'))
    throw new Error('le bloc ARTISAN apparaît sur la version client');
});

/* -- 2. Version ARTISAN : PHÉNIX + Artisan, jamais Client -------------------- */
check('Version Artisan : PHÉNIX + « Artisan ou son représentant », aucun bloc Client', () => {
  const doc = html('artisan');
  if (!doc.includes('PHÉNIX')) throw new Error('bloc PHÉNIX absent (artisan)');
  if (!doc.includes('Artisan ou son représentant')) throw new Error('bloc Artisan absent');
  if (doc.includes('Client ou son représentant'))
    throw new Error('le bloc CLIENT apparaît sur la version artisan');
  // Champs spécifiques de l'artisan.
  for (const champ of ['Entreprise', 'Lot', 'Nom du signataire'])
    if (!doc.includes(champ)) throw new Error(`champ artisan « ${champ} » absent`);
});

/* -- 3. Artisan IDENTIFIÉ : entreprise & lot préremplis (jamais inventés) ---- */
check('Artisan identifié : entreprise « Élec Pro » et lot « Électricité » préremplis', () => {
  const doc = html('artisan', { artisan: { entreprise: 'Élec Pro', lot: 'Électricité' } });
  if (!doc.includes('Élec Pro')) throw new Error('entreprise non préremplie');
  // Le lot prérempli apparaît dans le bloc signature (classe sign-prefill).
  if (!/sign-prefill[^>]*>Élec Pro/.test(doc)) throw new Error('entreprise hors bloc signature');
  if (!/sign-prefill[^>]*>Électricité/.test(doc)) throw new Error('lot non prérempli dans le bloc');
});
check('Artisan NON identifié : aucun nom inventé (champs vides à signer)', () => {
  const doc = html('artisan');
  // Pas de valeur préremplie factice : le bloc artisan a des lignes à remplir.
  if (/sign-prefill/.test(doc.split('Artisan ou son représentant')[1] ?? ''))
    throw new Error('une identité artisan a été inventée alors qu’aucune n’est fournie');
});

/* -- 4. Filigrane BROUILLON avant validation, absent une fois validé --------- */
check('BROUILLON : présent en aperçu (brouillon), absent sur le document validé', () => {
  if (!html('client', { state: 'brouillon' }).includes('BROUILLON'))
    throw new Error('filigrane BROUILLON absent de l’aperçu');
  if (html('client', { state: 'publie' }).includes('BROUILLON'))
    throw new Error('filigrane BROUILLON présent sur le document validé');
  if (!html('artisan', { state: 'brouillon' }).includes('BROUILLON'))
    throw new Error('filigrane BROUILLON absent de l’aperçu artisan');
});

/* -- 5. Encarts jamais coupés entre deux pages ------------------------------- */
check('Signatures : page-break-inside: avoid (encarts jamais coupés)', () => {
  const doc = html('artisan');
  // La section ET chaque encart portent la règle d'impression.
  const nb = (doc.match(/page-break-inside:\s*avoid/g) ?? []).length;
  if (nb < 2) throw new Error(`règle page-break-inside insuffisante (${nb})`);
});

/* -- 6. PHÉNIX présent dans les DEUX versions -------------------------------- */
check('Le bloc PHÉNIX est présent côté client ET côté artisan', () => {
  if (!html('client').includes('PHÉNIX') || !html('artisan').includes('PHÉNIX'))
    throw new Error('bloc PHÉNIX manquant dans une version');
});

const passed = results.filter(Boolean).length;
console.log(`\n=== SIGNATURES PRÉ-RÉCEPTION — ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
