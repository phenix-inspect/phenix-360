/**
 * RC1 — Partage des documents vers l'espace client.
 * ===========================================================================
 * Le conducteur décide, à l'ajout d'un document, s'il est INTERNE (défaut,
 * anti-fuite) ou VISIBLE CLIENT — et peut changer d'avis ensuite. Côté client,
 * seuls les documents « Visible client » apparaissent (ouvrables) ; les internes
 * ne fuient JAMAIS. On réutilise la visibilité d'événement existante ; aucun
 * nouveau module. Export/import conserve fichier + visibilité.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';
import { readFileSync } from 'node:fs';

const browser = await launch();
const { ctx, page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const pdf = (name) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(`%PDF-1.4 ${name}`),
});
const INTERNE_PDF = pdf('doc-interne.pdf');
const CLIENT_PDF = pdf('doc-client.pdf');

const row = (label) => page.locator('li').filter({ hasText: label }).first();
const clientDocs = () => page.locator('#section-documents');
// Côté client, les documents sont une LISTE (<li>) dans l'onglet Documents.
const clientCard = (label) => clientDocs().locator('li').filter({ hasText: label }).first();

const openDocuments = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
};

/**
 * Ajoute un document via l'UNIQUE point d'entrée « Nouvelle mission → Ajouter un
 * document » (libellé + visibilité + fichier) ; il rejoint la bibliothèque.
 */
const addDoc = async (libelle, visibilityLabel, file) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('button', { name: /Ajouter un document/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Libellé du document').fill(libelle);
  await dlg.locator('input[type=file]').setInputFiles(file);
  await dlg.getByText(file.name).first().waitFor({ state: 'visible', timeout: 6000 });
  await dlg.locator('select').selectOption({ label: visibilityLabel });
  await dlg.getByRole('button', { name: 'Publier' }).click();
  await dlg.waitFor({ state: 'hidden', timeout: 6000 });
  await openDocuments();
  await row(libelle).waitFor({ state: 'visible', timeout: 5000 });
};
const openClientDocs = async () => {
  await openClientTab(page, 'Documents');
  await page
    .getByRole('heading', { name: 'Vos documents' })
    .waitFor({ state: 'visible', timeout: 8000 });
};

/** Recherche récursive de l'événement `document` d'un libellé dans un état exporté. */
const findEvent = (obj, libelle) => {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.content && obj.content.libelle === libelle) return obj;
  for (const v of Object.values(obj)) {
    const f = findEvent(v, libelle);
    if (f) return f;
  }
  return null;
};

try {
  await openDemo(page);
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();

  await assert('Ajout d’un document INTERNE', async () => {
    await addDoc('Partage-interne', 'Interne', INTERNE_PDF);
    await row('Partage-interne')
      .getByRole('button', { name: /Partager au client/ })
      .waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Ajout d’un document VISIBLE CLIENT', async () => {
    await addDoc('Partage-client', 'Client', CLIENT_PDF);
    await row('Partage-client')
      .getByRole('button', { name: /Rendre interne/ })
      .waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Côté client : seul le document partagé apparaît', async () => {
    await openClientDocs();
    await clientCard('Partage-client').waitFor({ state: 'visible', timeout: 6000 });
    if ((await page.getByText('Partage-interne', { exact: false }).count()) > 0)
      throw new Error('un document interne fuit côté client');
  });

  await assert('Côté client : le document partagé s’OUVRE réellement', async () => {
    const pagePromise = ctx.waitForEvent('page', { timeout: 6000 });
    await clientCard('Partage-client').getByRole('button', { name: 'Ouvrir le document' }).click();
    const tab = await pagePromise;
    if (!tab.url().startsWith('blob:')) throw new Error(`ouverture invalide (url=${tab.url()})`);
    await tab.close();
  });

  await assert('Changer un INTERNE → VISIBLE CLIENT met à jour l’espace client', async () => {
    await openDocuments();
    await row('Partage-interne')
      .getByRole('button', { name: /Partager au client/ })
      .click();
    await openClientDocs();
    await clientCard('Partage-interne').waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Changer un VISIBLE CLIENT → INTERNE le retire de l’espace client', async () => {
    await openDocuments();
    await row('Partage-client')
      .getByRole('button', { name: /Rendre interne/ })
      .click();
    await openClientDocs();
    await page.waitForTimeout(400);
    if ((await page.getByText('Partage-client', { exact: false }).count()) > 0)
      throw new Error('un document repassé interne reste visible côté client');
    // L'autre (repassé client) reste bien visible.
    await clientCard('Partage-interne').waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Non-régression : un document client seedé reste visible', async () => {
    await clientCard('Plan de la salle de bain').waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Export/import CONSERVE fichier + visibilité', async () => {
    await page.getByRole('button', { name: 'Gérer' }).click();
    const dl = page.waitForEvent('download', { timeout: 6000 });
    await page.getByRole('button', { name: /Exporter mes données/ }).click();
    const content = readFileSync(await (await dl).path(), 'utf8');
    const ev = findEvent(JSON.parse(content), 'Partage-interne');
    if (!ev) throw new Error('document introuvable dans l’export');
    if (ev.visibility !== 'client') throw new Error('la visibilité (client) n’est pas exportée');
    if (!ev.content.attachment) throw new Error('le fichier n’est pas exporté');

    // Round-trip : réimport → le document partagé reste visible côté client.
    await page.getByRole('button', { name: /Importer une sauvegarde/ }).click();
    await page
      .getByRole('dialog')
      .locator('input[type=file]')
      .setInputFiles([
        { name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(content) },
      ]);
    await page.getByRole('button', { name: /Remplacer mes données/ }).click();
    await page
      .getByRole('dialog')
      .waitFor({ state: 'detached', timeout: 6000 })
      .catch(() => {});
    await openClientDocs();
    await clientCard('Partage-interne').waitFor({ state: 'visible', timeout: 6000 });
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
