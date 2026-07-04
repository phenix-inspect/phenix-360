/**
 * RC1 — retours terrain sur l'espace client :
 * artisan masqué, sélecteur de chantier en aperçu client, décision sans
 * « modification », sections Documents / Comptes rendus, récit renommé,
 * client-safe.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser);
const { assert, summary } = harness();

try {
  await openDemo(page);

  await assert('Artisan masqué : aucun accès « Artisan » dans le sélecteur de vue', async () => {
    if ((await page.getByRole('tab', { name: 'Artisan', exact: true }).count()) > 0)
      throw new Error('l’onglet Artisan est encore visible');
    await page
      .getByRole('tab', { name: 'Espace client', exact: true })
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Espace client : le récit est renommé « Le récit du chantier »', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Le récit du chantier' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    if ((await page.getByText('Le Fil', { exact: true }).count()) > 0)
      throw new Error('« Le Fil » subsiste quelque part');
  });

  await assert('Sections client claires : Documents ET Comptes rendus séparés', async () => {
    await page
      .getByRole('heading', { name: 'Documents', exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    await page
      .getByRole('heading', { name: 'Comptes rendus', exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    if ((await page.getByText('Comptes rendus & documents').count()) > 0)
      throw new Error('l’ancienne section fusionnée subsiste');
  });

  await assert(
    'Décision client : plus d’option « modification » (choisir / valider seulement)',
    async () => {
      const voir = page.getByRole('button', { name: /Voir la décision/ });
      if ((await voir.count()) > 0) {
        await voir.first().click();
        await page
          .getByRole('button', { name: /Valider mon choix|Valider le choix proposé/ })
          .first()
          .waitFor({ state: 'visible', timeout: 4000 });
      }
      for (const phrase of ['Je souhaite une modification', 'Demander une modification']) {
        if ((await page.getByText(phrase, { exact: false }).count()) > 0)
          throw new Error(`option retirée toujours présente : « ${phrase} »`);
      }
    },
  );

  await assert('Aperçu client par chantier : le sélecteur change de chantier', async () => {
    const sel = page.getByLabel('Choisir le chantier à prévisualiser');
    await sel.waitFor({ state: 'visible', timeout: 5000 });
    await sel.selectOption({ label: 'Maison Écully' });
    await page
      .getByRole('heading', { name: 'Maison Écully' })
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    // Retour sur Lyon 6e pour la suite.
    await sel.selectOption({ label: 'Appartement Lyon 6e' });
    await page
      .getByRole('heading', { name: 'Appartement Lyon 6e' })
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Client-safe : rien d’interne ne fuit dans l’espace client', async () => {
    await page.waitForTimeout(400);
    for (const secret of [
      'Réserve n°',
      'Responsable :',
      'Karim Bouaziz',
      'Historique des échanges',
    ]) {
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
