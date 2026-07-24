/**
 * OUTIL — fabrique une fixture de GÉOMÉTRIE anonymisée depuis un devis PDF réel,
 * pour l'ajouter au corpus de qualification.
 *
 *   node apps/demo/e2e/corpus/build-fixture.mjs <devis.pdf> <id> [anonymisation.json]
 *
 * - Extrait la géométrie EXACTEMENT comme l'application (`extractPdfGeometry`) :
 *   un mot = { x, y, w, str }, page par page.
 * - Applique une ANONYMISATION (fichier JSON optionnel : { "MotÀMasquer": "Remplacement", … }).
 *   ⚠ Vérifiez toujours qu'aucune donnée personnelle ne subsiste (nom, adresse,
 *   téléphone, e-mail, SIRET, n° de devis).
 * - Écrit `apps/demo/e2e/fixtures/corpus/<id>.geom.json`.
 * - Imprime le TEXTE reconstruit page par page → sert à établir la VÉRITÉ ATTENDUE
 *   à la main (à recopier dans `corpus/index.mjs`).
 *
 * Aucune dépendance réseau : pdf.js s'exécute en local.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [pdfPath, id, anonPath] = process.argv.slice(2);
if (!pdfPath || !id) {
  console.error('usage: build-fixture.mjs <devis.pdf> <id> [anonymisation.json]');
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const pdfjsPath = join(
  root,
  'node_modules/.pnpm/pdfjs-dist@4.10.38/node_modules/pdfjs-dist/legacy/build/pdf.mjs',
);
const pdfjs = await import(pdfjsPath);

const repl = anonPath ? Object.entries(JSON.parse(readFileSync(anonPath, 'utf8'))) : [];
const anon = (s) => repl.reduce((a, [from, to]) => a.split(from).join(to), s);

const doc = await pdfjs.getDocument({
  data: new Uint8Array(readFileSync(pdfPath)),
  disableFontFace: true,
  useSystemFonts: false,
}).promise;

const pages = [];
for (let p = 1; p <= doc.numPages; p += 1) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const tokens = [];
  let line = '';
  let lastY = null;
  for (const it of content.items) {
    if (typeof it.str !== 'string' || !it.str.trim()) continue;
    const x = Math.round(it.transform[4]);
    const y = Math.round(it.transform[5]);
    tokens.push({ x, y, w: Math.round(it.width), str: anon(it.str) });
    if (lastY !== null && Math.abs(y - lastY) > 3) {
      console.log(line);
      line = '';
    }
    line += (line ? ' ' : '') + anon(it.str);
    lastY = y;
  }
  if (line) console.log(line);
  console.log(`----- fin page ${p} -----`);
  pages.push({ page: p, width: Math.round(vp.width), height: Math.round(vp.height), tokens });
}

const outDir = join(here, '../fixtures/corpus');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${id}.geom.json`);
writeFileSync(out, JSON.stringify(pages));
const nbTokens = pages.reduce((a, p) => a + p.tokens.length, 0);
console.log(`\n✅ écrit ${out} — ${pages.length} page(s), ${nbTokens} mots.`);
console.log('→ Établir la vérité attendue à la main, puis ajouter une entrée dans corpus/index.mjs.');
console.log('→ VÉRIFIER qu’aucune donnée personnelle ne subsiste dans la fixture.');
