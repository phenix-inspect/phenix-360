/**
 * RC1 — Épure espace client : le badge du LOT en cours (« Gros œuvre »…) est une
 * information INTERNE conducteur. Côté client, on ne montre que le STATUT du
 * chantier ; le conducteur, lui, continue de voir le lot en cours.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2000 });
const { assert, summary } = harness();

// « Gros œuvre » EXACT = le badge/lot (le récit peut contenir « gros œuvre » en
// minuscule dans une phrase — non concerné par exact:true).
const lotBadge = () => page.getByText('Gros œuvre', { exact: true });

try {
  await openDemo(page);

  await assert('Espace client : le badge du LOT (« Gros œuvre ») est retiré', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page
      .getByRole('heading', { name: /Appartement Lyon 6e/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    if ((await lotBadge().count()) > 0)
      throw new Error('le badge du lot est encore visible côté client');
  });

  await assert('Espace client : le statut du chantier reste affiché', async () => {
    const statuses = ['Pas commencé', 'En cours', 'Pré-réception', 'Levée des réserves', 'Clôturé'];
    let found = false;
    for (const s of statuses)
      if ((await page.getByText(s, { exact: true }).count()) > 0) found = true;
    if (!found) throw new Error('aucun statut affiché côté client');
  });

  await assert('Conducteur : le lot en cours reste visible', async () => {
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await lotBadge().first().waitFor({ state: 'visible', timeout: 6000 });
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
