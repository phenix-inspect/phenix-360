/**
 * Bureau de préparation : bloc « partage client » (3 bloquants validés →
 * « Prêt à partager »), budget (prévisionnel / engagé / restant), check-list
 * dérivée + manuelle, alertes NON bloquantes, client-safe. (Section
 * « Intervenants du chantier » retirée — contacts accessibles ailleurs.)
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
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
  await page.getByRole('tab', { name: /Préparation/ }).click();

  await assert('Le chantier seedé est PRÊT À PARTAGER (3 bloquants validés)', async () => {
    await page
      .getByText('Prêt à partager au client')
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await page.getByText('bloquants validés').first().waitFor({ state: 'visible', timeout: 4000 });
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

  await assert('Budget sous l’engagé → ALERTE non bloquante (pas un blocage partage)', async () => {
    await setBudget(5000);
    await page
      .getByText(/budget dépassé/i)
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    // Le partage reste possible : un dépassement budget est une alerte, pas un bloquant client.
    await page.getByText('Prêt à partager au client').first().waitFor({ state: 'visible' });
    // On ouvre le bloc pour voir l'alerte.
    await page.getByRole('button', { name: /Prêt à partager au client/ }).click();
    await page
      .getByText(/Budget engagé au-dessus du prévisionnel/i)
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    await setBudget(80000);
  });

  await assert('Check-list manuelle : ajouter un point', async () => {
    await page.getByLabel('Nouveau point de check-list').fill('Clés récupérées');
    await page.getByRole('button', { name: 'Ajouter le point' }).click();
    await page.getByText('Clés récupérées').waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('« Intervenants du chantier » a disparu de la Préparation', async () => {
    if ((await page.getByText('Intervenants du chantier').count()) > 0)
      throw new Error('la section Intervenants est encore présente');
  });

  await assert('Client-safe : la préparation ne fuit jamais côté client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(600);
    for (const secret of ['Check-list de lancement', 'Clés récupérées', 'Points bloquants']) {
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
