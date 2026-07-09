/**
 * RC1 — Suppression du bandeau « PHÉNIX surveille votre chantier ».
 * ===========================================================================
 * Depuis la refonte, ce second tableau de bord (radar) est un DOUBLON : les
 * alertes vivent dans « Aujourd'hui », le pilotage dans « Préparation », etc. On le
 * supprime SANS remplacement : le conducteur arrive directement sur les onglets du
 * chantier. Aucun parcours cassé, zéro régression, zéro erreur console.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const openChantier = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Appartement Lyon 6e' })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });
};

try {
  await openDemo(page);
  await openChantier();

  await assert('Le bandeau « PHÉNIX surveille votre chantier » n’existe plus', async () => {
    if ((await page.getByText('PHÉNIX surveille votre chantier').count()) > 0)
      throw new Error('le bandeau radar subsiste');
    if ((await page.locator('[data-testid="attention-panel"]').count()) > 0)
      throw new Error('le panneau radar (attention-panel) subsiste');
    if ((await page.getByText(/mérite votre attention aujourd/).count()) > 0)
      throw new Error('la baseline du radar subsiste');
  });

  await assert('On arrive DIRECTEMENT sur les onglets du chantier', async () => {
    for (const t of ['Suivi', 'Préparation', 'Documents', 'Dans les coulisses', 'Demandes client'])
      await page
        .getByRole('tab', { name: new RegExp(`^${t}`) })
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
    // Le Suivi (onglet par défaut) affiche bien son contenu.
    await page
      .getByRole('heading', { name: /Dernière activité|Journal du chantier/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Aucun parcours cassé : chaque onglet du chantier s’ouvre', async () => {
    await page.getByRole('tab', { name: /^Préparation/ }).click();
    await page
      .getByText(/Prêt à partager au client|Pas encore prêt/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });

    await page.getByRole('tab', { name: /^Documents/ }).click();
    await page
      .getByRole('heading', { name: /Bibliothèque du chantier/ })
      .waitFor({ state: 'visible', timeout: 6000 });

    await page.getByRole('tab', { name: /^Dans les coulisses/ }).click();
    await page
      .getByRole('heading', { name: 'Dans les coulisses du chantier' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });

    await page.getByRole('tab', { name: /^Demandes client/ }).click();
    await page
      .getByRole('tab', { name: /^Demandes client/, selected: true })
      .waitFor({ state: 'visible', timeout: 6000 });

    await page.getByRole('tab', { name: /^Suivi/ }).click();
    await page
      .getByRole('heading', { name: /Dernière activité|Journal du chantier/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Les alertes vivent dans « Aujourd’hui » (radar « à traiter »)', async () => {
    await page
      .getByRole('tab', { name: /Aujourd/ })
      .first()
      .click();
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 6000 });
    // Le compteur d'actions à traiter est bien ICI (et pas dans un radar chantier).
    await page
      .getByRole('button', { name: /Filtrer.*à traiter/i })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
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
