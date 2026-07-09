/**
 * RC1 — retours terrain sur l'espace client :
 * artisan masqué, sélecteur de chantier en aperçu client, décision sans
 * « modification », sections Documents / Comptes rendus, récit renommé,
 * client-safe.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

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

  await assert('Espace client : l’onglet « Dans les coulisses » ouvre sa section', async () => {
    await openClientTab(page, 'Dans les coulisses');
    await page
      .getByRole('heading', { name: 'Dans les coulisses du chantier' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    if ((await page.getByText('Le Fil', { exact: true }).count()) > 0)
      throw new Error('« Le Fil » subsiste quelque part');
  });

  await assert(
    'Documents : un seul univers (comptes rendus INCLUS, plus de section séparée)',
    async () => {
      await openClientTab(page, 'Documents');
      await page
        .getByRole('heading', { name: 'Vos documents' })
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
      // Les comptes rendus ne sont plus une section À PART : ils vivent dans Documents.
      if ((await page.getByRole('heading', { name: 'Comptes rendus', exact: true }).count()) > 0)
        throw new Error('une section « Comptes rendus » séparée subsiste côté client');
    },
  );

  await assert(
    'Décision client : plus d’option « modification » (choisir / valider seulement)',
    async () => {
      await openClientTab(page); // Aujourd'hui = la décision à prendre
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

  await assert(
    'Aperçu client TEMPORAIRE : prévisualise sans toucher au chantier actif',
    async () => {
      const sel = page.getByLabel('Choisir le chantier à prévisualiser');
      await sel.waitFor({ state: 'visible', timeout: 5000 });
      const activeVal = await sel.inputValue();
      await sel.selectOption({ label: 'Maison Écully' });
      // L'aperçu cible bien Maison Écully (le nom vit dans la barre de contexte).
      const previewText = await sel.evaluate((el) => el.options[el.selectedIndex]?.text ?? '');
      if (!/Maison Écully/.test(previewText))
        throw new Error('l’aperçu ne cible pas Maison Écully');
      // Le chantier ACTIF n'a pas bougé : l'onglet Chantier montre toujours Lyon 6e.
      await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
      await page
        .getByRole('heading', { name: 'Appartement Lyon 6e' })
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
      // En rouvrant l'aperçu, il s'est réinitialisé sur le chantier actif (temporaire).
      await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
      const sel2 = page.getByLabel('Choisir le chantier à prévisualiser');
      await sel2.waitFor({ state: 'visible', timeout: 5000 });
      if ((await sel2.inputValue()) !== activeVal)
        throw new Error('l’aperçu n’a pas été réinitialisé en quittant');
    },
  );

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
