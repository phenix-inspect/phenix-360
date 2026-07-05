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

  await assert('Le chantier seedé est PRÊT À PARTAGER (3 éléments validés)', async () => {
    await page
      .getByText('Prêt à partager au client')
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await page
      .getByText('éléments obligatoires validés')
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    await page
      .getByText('Le chantier est prêt à être partagé au client.')
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Budget compact : prévisionnel · engagé · restant sur une ligne', async () => {
    await page
      .getByText('Prévisionnel', { exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    await page.getByText('Engagé', { exact: true }).waitFor({ state: 'visible', timeout: 4000 });
    await page.getByText('Restant', { exact: true }).waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('La check-list de partage montre les 3 éléments obligatoires', async () => {
    for (const b of ['Devis signé', 'Acompte payé', 'Date officielle de démarrage'])
      await page.getByText(b, { exact: true }).first().waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Budget sous l’engagé → ALERTE non bloquante (pas un blocage partage)', async () => {
    await setBudget(5000);
    await page
      .getByText(/budget dépassé/i)
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    // Le partage reste possible : un dépassement budget est une alerte, pas un bloquant client.
    await page.getByText('Prêt à partager au client').first().waitFor({ state: 'visible' });
    // L'alerte est TOUJOURS visible (aucun dépliage nécessaire).
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
