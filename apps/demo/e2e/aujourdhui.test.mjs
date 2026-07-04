/**
 * RC1 — « Aujourd'hui » : les compteurs sont de VRAIS raccourcis de travail.
 * Cliquer un compteur FILTRE la journée sur les seuls chantiers concernés, avec
 * les éléments précis visibles ; « Tout afficher » restaure ; cliquer un élément
 * OUVRE le bon chantier au bon onglet (pas une simple animation).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

// Faits seedés (seed.ts) : deux chantiers ont une décision client, un seul n'en
// a pas — le filtre doit les distinguer.
const DECISION_LYON = /Quel carrelage/;
const DECISION_ECULLY = /rampe d’escalier|rampe d'escalier/;
const RESERVE_LYON = /Cette prise peut-elle être déplacée/;

try {
  await openDemo(page);

  await assert('Le compteur « décisions clients » FILTRE la journée', async () => {
    await page.getByRole('button', { name: /Filtrer.*décisions clients/i }).click();
    await page
      .getByRole('heading', { name: 'Décisions client à traiter' })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('La vue filtrée montre les DÉCISIONS précises, chantier par chantier', async () => {
    await page.getByText(DECISION_LYON).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(DECISION_ECULLY).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Seuls les chantiers concernés apparaissent (Croix-Rousse exclu)', async () => {
    if ((await page.getByText('Duplex Croix-Rousse').count()) > 0)
      throw new Error('un chantier sans décision est resté visible dans le filtre');
  });

  await assert('« Tout afficher » restaure la liste complète des chantiers', async () => {
    await page.getByRole('button', { name: /Tout afficher/ }).click();
    await page
      .getByRole('heading', { name: /Mes chantiers \(3\)/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    await page
      .getByText('Duplex Croix-Rousse')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Un compteur à zéro n’est pas cliquable (pas un faux raccourci)', async () => {
    // « actions à suivre » = 0 dans le seed → rendu en <div>, pas un bouton.
    const asButton = await page.getByRole('button', { name: /Filtrer.*actions à suivre/i }).count();
    if (asButton > 0) throw new Error('un compteur à zéro est cliquable');
  });

  await assert('Le compteur « réserves à lever » ouvre son propre filtre', async () => {
    await page.getByRole('button', { name: /Filtrer.*réserves à lever/i }).click();
    await page
      .getByRole('heading', { name: 'Réserves à lever' })
      .waitFor({ state: 'visible', timeout: 6000 });
    await page.getByText(RESERVE_LYON).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Cliquer une réserve OUVRE le chantier au bon onglet (Réserves)', async () => {
    await page.getByText(RESERVE_LYON).first().click();
    // On atterrit sur le chantier, onglet « Réserves » sélectionné (pas une anim).
    await page
      .getByRole('tab', { name: /Réserves/, selected: true })
      .waitFor({ state: 'visible', timeout: 6000 });
    await page.getByText(RESERVE_LYON).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Retour « Aujourd’hui » : cliquer une décision ouvre l’onglet Suivi', async () => {
    await page.getByRole('tab', { name: /Aujourd/ }).click();
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /Filtrer.*décisions clients/i }).click();
    await page.getByText(DECISION_LYON).first().click();
    await page
      .getByRole('tab', { name: 'Suivi', selected: true })
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
