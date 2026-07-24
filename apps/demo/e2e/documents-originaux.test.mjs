/**
 * BUG CRITIQUE — Ouvrir un document rend TOUJOURS le fichier d'origine.
 * ===========================================================================
 * Règle produit : deux catégories, jamais confondues.
 *   • Document IMPORTÉ (PDF / image déposé) → « Ouvrir » rend le FICHIER
 *     D'ORIGINE — jamais une page HTML de remplacement (« Ce document a été
 *     enregistré… »). Fichier manquant → message clair, jamais une fausse page.
 *   • Document GÉNÉRÉ par PHÉNIX (compte rendu, PV…) → page HTML autonome.
 *
 * On vérifie la NATURE réelle du contenu ouvert : on intercepte
 * `URL.createObjectURL` et on lit le type MIME du Blob ouvert (application/pdf,
 * image/*, ou text/html). Un import n'ouvre JAMAIS text/html.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';
import { textPdf } from './pdf-fixtures.mjs';

const browser = await launch();
const { ctx, page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

// Intercepte les Blob ouverts pour connaître leur type MIME réel.
await page.addInitScript(() => {
  window.__phxBlobTypes = [];
  const orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (obj) => {
    try {
      if (obj && typeof obj.type === 'string') window.__phxBlobTypes.push(obj.type);
    } catch {
      /* ignore */
    }
    return orig(obj);
  };
});

const PDF = textPdf(['PHENIX 360', 'Devis signe — lot sanitaire', 'Document original importe.']);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const clearBlobs = () => page.evaluate(() => (window.__phxBlobTypes = []));
const lastBlobType = () => page.evaluate(() => window.__phxBlobTypes?.at(-1) ?? null);

/** Clique une cible qui ouvre un onglet et renvoie le type MIME du Blob ouvert. */
const openAndType = async (locator) => {
  await clearBlobs();
  const pagePromise = ctx.waitForEvent('page', { timeout: 6000 }).catch(() => null);
  await locator.click();
  const tab = await pagePromise;
  if (tab) {
    if (!tab.url().startsWith('blob:')) throw new Error(`ouverture invalide (url=${tab.url()})`);
    await tab.close().catch(() => {});
  }
  return lastBlobType();
};

const openChantierDocuments = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await page
    .getByRole('heading', { name: /Bibliothèque du chantier/ })
    .waitFor({ state: 'visible', timeout: 6000 });
};

/** Importe un document via « Nouvelle mission → Ajouter un document ». */
const importDocument = async (libelle, file) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page
    .getByRole('button', { name: /Ajouter un document/ })
    .first()
    .click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Libellé du document').fill(libelle);
  await dlg.locator('input[type=file]:not([capture])').setInputFiles(file);
  await dlg.getByText(file.name).waitFor({ state: 'visible', timeout: 6000 });
  await dlg.getByRole('button', { name: 'Publier' }).click();
  await dlg.waitFor({ state: 'detached', timeout: 6000 });
};

const libraryRow = (text) =>
  page.locator('ul.divide-y').last().locator('li').filter({ hasText: text }).first();

try {
  await openDemo(page);

  // ---- 1. IMPORT PDF → le PDF original s'ouvre (jamais du HTML) -----------
  await assert('Importer un PDF → « Ouvrir » rend le PDF original', async () => {
    await importDocument('Devis importé PDF', {
      name: 'devis-importe.pdf',
      mimeType: 'application/pdf',
      buffer: PDF,
    });
    await openChantierDocuments();
    const row = libraryRow('Devis importé PDF');
    const type = await openAndType(row.getByRole('button', { name: /^Ouvrir : / }));
    if (type !== 'application/pdf')
      throw new Error(`type ouvert = ${type} (attendu application/pdf, jamais text/html)`);
  });

  // ---- 2. IMPORT IMAGE → l'image originale s'ouvre -----------------------
  await assert('Importer une image → « Ouvrir » rend l’image (jamais du HTML)', async () => {
    await importDocument('Photo importée', {
      name: 'photo-importee.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await openChantierDocuments();
    const row = libraryRow('Photo importée');
    const type = await openAndType(row.getByRole('button', { name: /^Ouvrir : / }));
    if (!/^image\//.test(String(type)))
      throw new Error(`type ouvert = ${type} (attendu image/*, jamais text/html)`);
  });

  // ---- 3. DOCUMENT GÉNÉRÉ par PHÉNIX → page HTML (légitime) ---------------
  await assert('Un COMPTE RENDU généré → page HTML autonome (légitime)', async () => {
    await openChantierDocuments();
    const row = libraryRow('Compte rendu');
    const type = await openAndType(row.getByRole('button', { name: /^Ouvrir : / }));
    if (!/^text\/html/.test(String(type)))
      throw new Error(`un document généré devrait être text/html (obtenu ${type})`);
  });

  // ---- 4. RÉGRESSION du bug : le DEVIS seedé (importé) rend le fichier ----
  await assert('CLIENT — le devis seedé s’ouvre en FICHIER, pas en page générée', async () => {
    await openClientTab(page, 'Documents');
    const row = page
      .locator('#section-documents li')
      .filter({ hasText: 'Devis plomberie' })
      .first();
    await row.waitFor({ state: 'visible', timeout: 6000 });
    const type = await openAndType(row.getByRole('button', { name: 'Ouvrir le document' }));
    if (type === 'text/html;charset=utf-8')
      throw new Error('le devis importé rend encore une page HTML générée (bug non corrigé)');
    if (type !== 'application/pdf') throw new Error(`type ouvert inattendu : ${type}`);
  });

  await assert('Zéro erreur console', async () => {
    if (consoleErrors.length > 0) throw new Error(consoleErrors.slice(0, 5).join(' | '));
  });
} catch (e) {
  await assert('FATAL', async () => {
    throw e;
  });
} finally {
  const failed = summary(consoleErrors);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
