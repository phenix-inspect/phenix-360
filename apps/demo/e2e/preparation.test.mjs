/**
 * Bureau de préparation : verdict « prêt à démarrer », budget (prévisionnel /
 * engagé / restant), check-list dérivée + manuelle, intervenants = Carnet
 * (Contacts), client-safe.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 1700 });
const { assert, summary } = harness();

async function setBudget(v) {
  await page.getByText('Modifier', { exact: true }).click();
  await page.getByLabel('Budget prévisionnel').fill(String(v));
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(300);
}

try {
  await openDemo(page);

  await assert('Ouvrir le bureau de préparation (verdict + budget + check-list)', async () => {
    await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
    await page.getByRole('tab', { name: /Préparation/ }).click();
    await page
      .getByText(/Presque prêt|Prêt à démarrer|Pas encore prêt/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText('points prêts').waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Budget : prévisionnel · engagé · restant', async () => {
    await page
      .getByText('Prévisionnel', { exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    await page.getByText('Engagé', { exact: true }).waitFor({ state: 'visible', timeout: 4000 });
    await page.getByText('Restant', { exact: true }).waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Check-list de lancement dérivée (devis signé au vert)', async () => {
    await page.getByText('Check-list de lancement').waitFor({ state: 'visible', timeout: 4000 });
    await page.getByText('Devis signé').first().waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Éditer le budget sous l’engagé → dépassé + « Pas encore prêt »', async () => {
    await setBudget(5000);
    await page
      .getByText(/budget dépassé/i)
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    await page.getByText('Pas encore prêt').waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Relever le budget → le blocage disparaît', async () => {
    await setBudget(80000);
    await page
      .getByText('Pas encore prêt')
      .waitFor({ state: 'hidden', timeout: 4000 })
      .catch(() => {});
    if ((await page.getByText('Pas encore prêt').count()) > 0)
      throw new Error('verdict toujours bloqué');
  });

  await assert('Check-list manuelle : ajouter un point', async () => {
    await page.getByLabel('Nouveau point de check-list').fill('Clés récupérées');
    await page.getByRole('button', { name: 'Ajouter le point' }).click();
    await page.getByText('Clés récupérées').waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Intervenants = Carnet unique : ajouter un artisan (Contact)', async () => {
    await page.getByRole('heading', { name: 'Intervenants du chantier' }).scrollIntoViewIfNeeded();
    await page
      .getByRole('button', { name: /Nouveau contact/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom du contact').fill('Menuiserie Bois');
    await dialog.getByRole('button', { name: /Créer le contact/ }).click();
    await page.getByText('Menuiserie Bois').first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Client-safe : la préparation ne fuit jamais côté client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(600);
    for (const secret of ['Check-list de lancement', 'SARL Aqua', 'Menuiserie Bois']) {
      if ((await page.getByText(secret, { exact: false }).count()) > 0)
        throw new Error(`fuite côté client : « ${secret} »`);
    }
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
