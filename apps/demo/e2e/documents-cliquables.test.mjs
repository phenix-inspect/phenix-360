/**
 * RC1 — Aucun document « mort » : tout ce qui apparaît dans une liste s'OUVRE.
 * ===========================================================================
 * Bug UX : dans « Documents », les documents s'affichaient sans être ouvrables au
 * clic. Règle : si un document apparaît dans une liste, alors on l'ouvre d'un clic
 * sur son titre (fichier PDF / image → aperçu natif ; document généré par PHÉNIX →
 * page HTML). Vrai côté conducteur (bibliothèque) ET côté client. Le téléchargement
 * reste possible. Zéro régression, zéro erreur console.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { ctx, page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const openConducteurDocuments = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await page
    .getByRole('heading', { name: /Bibliothèque du chantier/ })
    .waitFor({ state: 'visible', timeout: 6000 });
};
const library = () => page.locator('ul.divide-y').last();

/** Clique le TITRE d'une ligne (bouton « Ouvrir : … ») et vérifie l'ouverture blob. */
const expectTitleOpens = async (row) => {
  const opener = row.getByRole('button', { name: /^Ouvrir : / });
  await opener.first().waitFor({ state: 'visible', timeout: 5000 });
  const pagePromise = ctx.waitForEvent('page', { timeout: 6000 });
  await opener.first().click();
  const tab = await pagePromise;
  if (!tab.url().startsWith('blob:')) throw new Error(`ouverture invalide (url=${tab.url()})`);
  await tab.close();
};

try {
  await openDemo(page);

  await assert(
    'CONDUCTEUR — CHAQUE ligne de la bibliothèque s’ouvre au clic du titre',
    async () => {
      await openConducteurDocuments();
      const rows = await library().locator('li').count();
      if (rows === 0) throw new Error('bibliothèque vide');
      for (let i = 0; i < rows; i++) {
        // Chaque ligne DOIT porter un titre cliquable (aucun document mort).
        const row = library().locator('li').nth(i);
        if ((await row.getByRole('button', { name: /^Ouvrir : / }).count()) === 0)
          throw new Error(`ligne ${i} : document affiché mais non cliquable`);
        await expectTitleOpens(row);
      }
    },
  );

  await assert('CONDUCTEUR — un document GÉNÉRÉ (compte rendu) s’ouvre', async () => {
    const cr = library().locator('li').filter({ hasText: 'Compte rendu' }).first();
    await expectTitleOpens(cr);
  });

  await assert('CONDUCTEUR — une IMAGE (Plan) s’ouvre', async () => {
    const img = library().locator('li').filter({ hasText: 'Plan de la salle de bain' }).first();
    await expectTitleOpens(img);
  });

  await assert('CONDUCTEUR — le téléchargement reste possible', async () => {
    const row = library().locator('li').filter({ hasText: 'Plan de la salle de bain' }).first();
    const dl = page.waitForEvent('download', { timeout: 6000 });
    await row.getByRole('button', { name: /Télécharger : / }).click();
    const file = await dl;
    if (!(await file.suggestedFilename())) throw new Error('téléchargement sans nom de fichier');
  });

  await assert('CLIENT — chaque document visible s’ouvre au clic du titre', async () => {
    await openClientTab(page, 'Documents');
    await page
      .getByRole('heading', { name: 'Vos documents' })
      .waitFor({ state: 'visible', timeout: 6000 });
    const rows = await page.locator('#section-documents li').count();
    if (rows === 0) throw new Error('espace client : aucun document');
    for (let i = 0; i < rows; i++) {
      const row = page.locator('#section-documents li').nth(i);
      if ((await row.getByRole('button', { name: /^Ouvrir : / }).count()) === 0)
        throw new Error(`client, ligne ${i} : document affiché mais non cliquable`);
      await expectTitleOpens(row);
    }
  });

  await assert('CLIENT — le téléchargement reste possible', async () => {
    const row = page
      .locator('#section-documents li')
      .filter({ hasText: 'Plan de la salle de bain' })
      .first();
    const dl = page.waitForEvent('download', { timeout: 6000 });
    await row.getByRole('button', { name: /Télécharger : / }).click();
    const file = await dl;
    if (!(await file.suggestedFilename())) throw new Error('téléchargement sans nom de fichier');
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
