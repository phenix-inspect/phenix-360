/**
 * RC1 — Bascule rapide entre chantiers (retour terrain).
 * Dans la vue Chantier, le nom du chantier ancré devient un SÉLECTEUR : on change
 * de chantier sans repasser par Aujourd'hui, on reste en vue Chantier, et l'onglet
 * courant est conservé — sauf la Préparation sans dossier, qui retombe sur Suivi.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 1800 });
const { assert, summary } = harness();

const selector = () => page.getByLabel('Changer de chantier');
const RESERVE_LYON = /Cette prise peut-elle être déplacée/;
const RESERVE_ECULLY = /Joint de carrelage à reprendre/;

try {
  await openDemo(page);

  await assert('Entrer dans la vue Chantier ouvre un vrai sélecteur de chantier', async () => {
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await selector().waitFor({ state: 'visible', timeout: 6000 });
    // Le chantier actif par défaut est bien sélectionné.
    if ((await selector().inputValue()) === '') throw new Error('aucun chantier sélectionné');
  });

  await assert(
    'On se place sur un onglet non par défaut (Réserves) du chantier actif',
    async () => {
      await page.getByRole('tab', { name: /Réserves/ }).click();
      await page.getByText(RESERVE_LYON).first().waitFor({ state: 'visible', timeout: 5000 });
    },
  );

  await assert(
    'Changer de chantier CONSERVE l’onglet (Réserves) et CHANGE les données',
    async () => {
      await selector().selectOption({ label: 'Maison Écully' });
      // On reste en vue Chantier, onglet Réserves toujours sélectionné.
      await page
        .getByRole('tab', { name: /Réserves/, selected: true })
        .waitFor({ state: 'visible', timeout: 6000 });
      // Les données affichées sont celles du NOUVEAU chantier.
      await page.getByText(RESERVE_ECULLY).first().waitFor({ state: 'visible', timeout: 5000 });
      if ((await page.getByText(RESERVE_LYON).count()) > 0)
        throw new Error('les réserves de l’ancien chantier sont encore affichées');
    },
  );

  await assert('Préparation sans dossier → retombe sur Suivi au changement', async () => {
    // Retour sur un chantier AVEC dossier, onglet Préparation.
    await selector().selectOption({ label: 'Appartement Lyon 6e' });
    await page.getByRole('tab', { name: 'Préparation' }).click();
    await page
      .getByRole('tab', { name: 'Préparation', selected: true })
      .waitFor({ state: 'visible', timeout: 5000 });
    // Bascule vers un chantier SANS dossier → l'onglet retombe sur Suivi.
    await selector().selectOption({ label: 'Duplex Croix-Rousse' });
    await page
      .getByRole('tab', { name: 'Suivi', selected: true })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Non-régression Aujourd’hui', async () => {
    await page.getByRole('tab', { name: /Aujourd/ }).click();
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Non-régression Espace client (chantier actif = Croix-Rousse)', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page
      .getByRole('heading', { name: /Duplex Croix-Rousse/ })
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
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
