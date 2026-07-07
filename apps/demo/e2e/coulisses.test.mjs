/**
 * RC1 — Renommage « Récit » → « Dans les coulisses » (vocabulaire premium).
 * ===========================================================================
 * Même comportement, autre nom : on vérifie que « Récit » n'apparaît PLUS dans
 * l'interface (conducteur, client, chat de Léon) et que « Dans les coulisses »
 * le remplace partout, sans casser la navigation.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const visibleText = () => page.evaluate(() => document.body.innerText);
const NO_RECIT = /récit/i;

try {
  await openDemo(page);

  await assert(
    'Conducteur : l’onglet s’appelle « Dans les coulisses » (plus « Récit »)',
    async () => {
      await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
      await page
        .getByRole('tab', { name: 'Dans les coulisses' })
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      if ((await page.getByRole('tab', { name: 'Récit' }).count()) > 0)
        throw new Error('l’onglet « Récit » existe encore côté conducteur');
    },
  );

  await assert('Conducteur : l’onglet ouvre bien la section (navigation intacte)', async () => {
    await page.getByRole('tab', { name: 'Dans les coulisses' }).first().click();
    await page
      .getByRole('heading', { name: 'Dans les coulisses du chantier' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    if (NO_RECIT.test(await visibleText()))
      throw new Error('« Récit » apparaît encore dans la vue conducteur');
  });

  await assert(
    'Client : onglet + section « Dans les coulisses », plus aucun « Récit »',
    async () => {
      await openClientTab(page, 'Dans les coulisses');
      await page
        .getByRole('heading', { name: 'Dans les coulisses du chantier' })
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      if (NO_RECIT.test(await visibleText()))
        throw new Error('« Récit » apparaît encore dans l’espace client');
    },
  );

  await assert('Léon (chat) parle de « coulisses », jamais de « récit »', async () => {
    await page.getByRole('button', { name: 'Ouvrir PHÉNIX' }).click();
    const draft = page.getByPlaceholder(/Écrivez à PHÉNIX/);
    await draft.fill('Où sont les photos du chantier ?');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await page.waitForTimeout(900);
    const dialog = page.getByRole('dialog', { name: /PHÉNIX, votre concierge/ });
    const txt = await dialog.evaluate((el) => el.innerText);
    if (NO_RECIT.test(txt)) throw new Error(`Léon dit encore « récit » : ${txt.slice(0, 120)}`);
    if (!/coulisses/i.test(txt))
      throw new Error('la réponse de Léon ne mentionne pas « coulisses »');
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
