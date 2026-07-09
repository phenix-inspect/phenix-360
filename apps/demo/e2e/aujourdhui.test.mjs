/**
 * RC1 — « Aujourd'hui » : trois compteurs, lus en cinq secondes. « À traiter »
 * regroupe tout le travail conducteur (décisions, choix validés, actions,
 * réponses) ; Réserves et Livraisons gardent leur compteur. Cliquer un compteur
 * FILTRE la journée sur les seuls chantiers concernés, avec les éléments précis
 * visibles ; « Tout afficher » restaure ; cliquer un élément OUVRE le bon
 * chantier au bon onglet (pas une simple animation).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const DECISION_LYON = /Quel carrelage/;
const DECISION_ECULLY = /rampe d’escalier|rampe d'escalier/;
const RESERVE_LYON = /Cette prise peut-elle être déplacée/;

const aTraiter = () => page.getByRole('button', { name: /Filtrer.*à traiter/i });
const reserves = () => page.getByRole('button', { name: /Filtrer.*réserves à lever/i });
const livraisons = () => page.getByRole('button', { name: /Filtrer.*livraisons à contrôler/i });

try {
  await openDemo(page);

  await assert('Le compteur « à traiter » FILTRE la journée', async () => {
    await aTraiter().click();
    await page
      .getByRole('heading', { name: /À traiter aujourd/i })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('La vue filtrée montre les tâches précises (décisions préfixées)', async () => {
    // « À traiter » agrège plusieurs natures : les décisions sont préfixées.
    await page
      .getByText(/Décision client ·/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(DECISION_LYON).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(DECISION_ECULLY).first().waitFor({ state: 'visible', timeout: 5000 });
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

  await assert('« Livraisons » n’ouvre que les chantiers concernés (Lyon seul)', async () => {
    await livraisons().click();
    await page
      .getByRole('heading', { name: 'Livraisons à contrôler' })
      .waitFor({ state: 'visible', timeout: 6000 });
    if ((await page.getByText('Duplex Croix-Rousse').count()) > 0)
      throw new Error('un chantier sans livraison est resté visible dans le filtre');
    if ((await page.getByText('Maison Écully').count()) > 0)
      throw new Error('un chantier sans livraison est resté visible dans le filtre');
  });

  await assert('Le compteur « réserves à lever » ouvre son propre filtre', async () => {
    await page.getByRole('button', { name: /Tout afficher/ }).click();
    await reserves().click();
    await page
      .getByRole('heading', { name: 'Réserves à lever' })
      .waitFor({ state: 'visible', timeout: 6000 });
    await page.getByText(RESERVE_LYON).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Cliquer une réserve OUVRE le chantier au Suivi (plus d’onglet Réserves)', async () => {
    await page.getByText(RESERVE_LYON).first().click();
    // Plus de page dédiée : la réserve se lit dans le Suivi (historique).
    await page
      .getByRole('tab', { name: 'Suivi', exact: true, selected: true })
      .waitFor({ state: 'visible', timeout: 6000 });
    const voir = page.getByRole('button', { name: /Voir tout le journal/ });
    if (await voir.count()) await voir.first().click();
    await page.getByText(RESERVE_LYON).first().waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Retour « Aujourd’hui » : cliquer une décision ouvre l’onglet Suivi', async () => {
    await page
      .getByRole('tab', { name: /Aujourd/ })
      .first()
      .click();
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    await aTraiter().click();
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
