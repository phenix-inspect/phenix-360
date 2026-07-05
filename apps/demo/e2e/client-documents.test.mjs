/**
 * RC1 — Ouverture des documents côté client (bug de rendu/lien).
 * Un document AVEC fichier s'ouvre réellement (nouvel onglet, via blob) : titre
 * cliquable + bouton « Ouvrir le document ». Un document SANS fichier n'affiche
 * pas de faux lien (« Document disponible prochainement »). Client-safe strict :
 * un document interne n'apparaît jamais côté client.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { ctx, page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const OUVRABLE = 'Plan de la salle de bain'; // seed : document client AVEC dataUrl
const SANS_FICHIER = 'Devis plomberie'; // seed : document client SANS dataUrl
const INTERNE = 'Contrat sous-traitant'; // seed : document interne (jamais client)

const docs = () => page.locator('#section-documents');
const cardWith = (text) => docs().locator('article').filter({ hasText: text }).first();

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await docs()
    .getByRole('heading', { name: 'Documents' })
    .waitFor({ state: 'visible', timeout: 6000 });

  await assert('Les documents client sont visibles', async () => {
    await cardWith(OUVRABLE).waitFor({ state: 'visible', timeout: 5000 });
    await cardWith(SANS_FICHIER).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert(
    'Document SANS fichier → pas de faux lien, mais « disponible prochainement »',
    async () => {
      const card = cardWith(SANS_FICHIER);
      await card
        .getByText('Document disponible prochainement')
        .waitFor({ state: 'visible', timeout: 5000 });
      if ((await card.getByRole('button', { name: 'Ouvrir le document' }).count()) > 0)
        throw new Error('un faux lien « Ouvrir » est affiché sur un document sans fichier');
    },
  );

  await assert(
    'Document AVEC fichier → titre cliquable + bouton « Ouvrir le document »',
    async () => {
      const card = cardWith(OUVRABLE);
      await card.getByRole('button', { name: new RegExp(OUVRABLE) }).waitFor({ state: 'visible' });
      await card.getByRole('button', { name: 'Ouvrir le document' }).waitFor({ state: 'visible' });
    },
  );

  await assert('Le clic OUVRE réellement le fichier (nouvel onglet)', async () => {
    const card = cardWith(OUVRABLE);
    const pagePromise = ctx.waitForEvent('page', { timeout: 6000 });
    await card.getByRole('button', { name: 'Ouvrir le document' }).click();
    const tab = await pagePromise;
    if (!tab.url().startsWith('blob:'))
      throw new Error(`le document ne s'ouvre pas en aperçu (url=${tab.url()})`);
    await tab.close();
  });

  await assert('Le TITRE ouvre aussi le fichier', async () => {
    const card = cardWith(OUVRABLE);
    const pagePromise = ctx.waitForEvent('page', { timeout: 6000 });
    await card.getByRole('button', { name: new RegExp(OUVRABLE) }).click();
    const tab = await pagePromise;
    if (!tab.url().startsWith('blob:')) throw new Error('le titre n’ouvre pas le fichier');
    await tab.close();
  });

  await assert('Client-safe : le document INTERNE n’apparaît jamais côté client', async () => {
    if ((await page.getByText(INTERNE, { exact: false }).count()) > 0)
      throw new Error('un document interne fuit dans l’espace client');
  });

  await assert(
    'Non-régression conducteur : il voit bien le document interne (Suivi / Journal)',
    async () => {
      await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
      await page.getByRole('tab', { name: 'Suivi', exact: true }).click();
      await page
        .getByText(INTERNE, { exact: false })
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
    },
  );

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
