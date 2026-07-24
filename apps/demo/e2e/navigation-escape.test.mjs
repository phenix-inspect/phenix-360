/**
 * RC1 — Échappatoire universel : le logo PHÉNIX ramène TOUJOURS à « Aujourd'hui ».
 *  • depuis un chantier → retour direct ;
 *  • pendant une création de chantier NON validée → confirmation
 *    (« Quitter la création du chantier ? Les données non enregistrées seront
 *    perdues. ») ; on peut continuer ou quitter. On n'est jamais bloqué.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const logo = () => page.getByRole('button', { name: /Revenir à l'accueil/ });
const heading = (re) => page.getByRole('heading', { name: re });

try {
  await openDemo(page);

  await assert('Depuis un chantier, le logo revient directement à Aujourd’hui', async () => {
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await heading(/Appartement Lyon 6e/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await logo().click();
    await heading(/Bonjour Mickaël/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Pendant une création non validée, le logo DEMANDE confirmation', async () => {
    await page.getByRole('button', { name: 'Gérer' }).click();
    await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
    await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
    await page.getByLabel('Nom du chantier').fill('Brouillon en cours');
    await logo().click();
    await heading(/Quitter la création du chantier/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('« Continuer la création » garde le brouillon', async () => {
    await page.getByRole('button', { name: /Continuer la création/ }).click();
    await page
      .getByRole('heading', { name: 'Nouveau chantier' })
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('« Quitter sans enregistrer » ramène à Aujourd’hui', async () => {
    await logo().click();
    await heading(/Quitter la création du chantier/).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /Quitter sans enregistrer/ }).click();
    await heading(/Bonjour Mickaël/).waitFor({ state: 'visible', timeout: 5000 });
    // Le brouillon n'a pas créé de chantier (toujours 3).
    await heading(/Mes chantiers \(3\)/).waitFor({ state: 'visible', timeout: 5000 });
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
