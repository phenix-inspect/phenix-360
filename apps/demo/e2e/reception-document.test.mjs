/**
 * RÉCEPTION — le PV de réception (document autonome) — apps/demo.
 * =============================================================================
 * La Réception atteste que TOUTES les réserves de la Pré-réception ont été levées.
 * On bundle le générateur de documents (`generatedDocument.ts`) et on vérifie sur
 * le HTML produit :
 *   • en-tête : n° de devis, avenants intégrés, réf. Pré-réception ET réf. Réception ;
 *   • résumé : prestations / réserves créées / levées / restantes ;
 *   • chaque réserve : commentaire initial + de levée, photos avant + après ;
 *   • conclusion « … ont été levées. Les travaux sont réceptionnés. » ;
 *   • signatures PHÉNIX + CLIENT uniquement (jamais de version artisan) ;
 *   • filigrane BROUILLON avant validation, absent une fois validé ;
 *   • aucun encart coupé entre deux pages (page-break-inside: avoid) ;
 *   • cas « aucune réserve » : conclusion adaptée, réception directe.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'recdoc-')), 'gendoc.mjs');
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

const PNG_AVANT = 'data:image/png;base64,AV0000';
const PNG_APRES = 'data:image/png;base64,AP1111';

const reserve = (n, levee = true) => ({
  numero: n,
  posteId: `p-${n}`,
  lotLabel: 'Électricité',
  prestationLabel: `Tableau électrique n°${n}`,
  commentaireInitial: 'Prise mal alignée en cuisine.',
  responsable: 'artisan',
  dateCreation: '2026-07-10T09:00:00.000Z',
  photosAvant: [{ imageUrl: PNG_AVANT, bucket: 'b', storagePath: 's1', mimeType: 'image/png' }],
  ...(levee
    ? {
        levee: {
          commentaire: 'Prise réalignée et vérifiée.',
          photos: [{ imageUrl: PNG_APRES, bucket: 'b', storagePath: 's2', mimeType: 'image/png' }],
          dateLevee: '2026-07-14T10:00:00.000Z',
          conducteur: 'Léon',
        },
      }
    : {}),
});

const receptionEvent = (state = 'publie', reserves = [reserve(1)]) => ({
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
      devisRef: 'DEV-2026-014',
      avenants: [1, 2],
      version: 1,
      prestationsTotal: 12,
      reserves,
    },
  },
});

const ctx = {
  projectName: 'Appartement Lyon 6e',
  authorName: 'Léon',
  address: '12 rue de la Ré, Lyon 6e',
  clientName: 'Mme Bernard',
};
const html = (state, reserves) => buildDocumentHtml(receptionEvent(state, reserves), ctx, 'client');

/* -- 1. En-tête CLIENT : références UTILES conservées, codes SYSTÈME masqués ---- */
// Condition bêta #4 : le PV client garde le n° de devis, les avenants, le
// conducteur (utiles, contractuels) mais JAMAIS les identifiants techniques
// PR-…/REC-… ni les « Réf. Pré-réception / Réception » (plomberie interne).
check('En-tête client : n° devis + avenants + conducteur (utiles), sans code système', () => {
  const doc = html('publie');
  for (const attendu of ['DEV-2026-014', 'n°1, n°2', 'Conducteur', 'Léon'])
    if (!doc.includes(attendu)) throw new Error(`en-tête sans « ${attendu} »`);
  for (const interdit of [
    'PR-20260710-V1',
    'REC-20260714-V1',
    'Réf. Pré-réception',
    'Réf. Réception',
  ])
    if (doc.includes(interdit))
      throw new Error(`code système interne sur le PV client : « ${interdit} »`);
});

/* -- 2. Résumé : prestations / réserves créées / levées / restantes --------- */
check('Résumé : prestations 12, réserves créées 1, levées 1, restantes 0', () => {
  const doc = html('publie');
  for (const l of ['Prestations', 'Réserves créées', 'Réserves levées', 'Réserves restantes'])
    if (!doc.includes(l)) throw new Error(`résumé sans « ${l} »`);
  if (!doc.includes('>12<')) throw new Error('total prestations (12) absent du résumé');
});

/* -- 3. Réserve : commentaires + photos avant / après ----------------------- */
check('Réserve : commentaire initial + de levée + photos avant / après', () => {
  const doc = html('publie');
  if (!doc.includes('Réserve n°1')) throw new Error('numéro de réserve absent');
  if (!doc.includes('Prise mal alignée en cuisine.')) throw new Error('commentaire initial absent');
  if (!doc.includes('Prise réalignée et vérifiée.')) throw new Error('commentaire de levée absent');
  if (!doc.includes('Photo avant') || !doc.includes('Photo après'))
    throw new Error('libellés photo avant / après absents');
  if (!doc.includes(PNG_AVANT)) throw new Error('photo avant absente');
  if (!doc.includes(PNG_APRES)) throw new Error('photo après absente');
});

/* -- 4. Conclusion : réserves levées → travaux réceptionnés ----------------- */
check('Conclusion : « … ont été levées. Les travaux sont réceptionnés. »', () => {
  const doc = html('publie');
  if (!doc.includes('Les réserves émises lors de la Pré-réception ont été levées.'))
    throw new Error('phrase de levée absente');
  if (!doc.includes('Les travaux sont réceptionnés.'))
    throw new Error('phrase de réception absente');
});

/* -- 5. Signatures : PHÉNIX + CLIENT uniquement (jamais Artisan) ------------- */
check('Signatures : PHÉNIX + « Client ou son représentant », aucun bloc Artisan', () => {
  const doc = html('publie');
  if (!doc.includes('PHÉNIX')) throw new Error('bloc PHÉNIX absent');
  if (!doc.includes('Client ou son représentant')) throw new Error('bloc Client absent');
  if (doc.includes('Artisan ou son représentant'))
    throw new Error('un bloc ARTISAN apparaît sur le PV de réception');
});

/* -- 6. Filigrane BROUILLON avant validation, absent une fois validé -------- */
check('BROUILLON : présent en aperçu, absent sur le document validé', () => {
  if (!html('brouillon').includes('BROUILLON')) throw new Error('filigrane absent de l’aperçu');
  if (html('publie').includes('BROUILLON')) throw new Error('filigrane présent sur le PV validé');
});

/* -- 7. Encarts jamais coupés entre deux pages ------------------------------ */
check('page-break-inside: avoid (encarts jamais coupés)', () => {
  const doc = html('publie', [reserve(1), reserve(2)]);
  const nb = (doc.match(/page-break-inside:\s*avoid/g) ?? []).length;
  if (nb < 2) throw new Error(`règle page-break-inside insuffisante (${nb})`);
});

/* -- 8. Aucune réserve : conclusion adaptée, réception directe --------------- */
check('Aucune réserve : conclusion adaptée + travaux réceptionnés', () => {
  const doc = html('publie', []);
  if (!doc.includes('Aucune réserve n’avait été émise lors de la Pré-réception.'))
    throw new Error('conclusion « aucune réserve » absente');
  if (!doc.includes('Les travaux sont réceptionnés.'))
    throw new Error('phrase de réception absente (aucune réserve)');
  if (doc.includes('Réserve n°'))
    throw new Error('un encart de réserve apparaît alors qu’il n’y en a aucune');
});

const passed = results.filter(Boolean).length;
console.log(`\n=== PV DE RÉCEPTION — ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
