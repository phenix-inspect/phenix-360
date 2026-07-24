/**
 * « Mon espace » — les préférences de notification agissent vraiment.
 * ===========================================================================
 * Régression : les toggles de « Préférences de notification » n'avaient aucun
 * effet (clientNotifications ne les consultait pas). On vérifie ici que
 * DÉSACTIVER une catégorie fait disparaître la notification correspondante
 * d'« Aujourd'hui », et que la RÉACTIVER la ramène.
 *
 * Cas testé : une « Demande de choix » du conducteur → notification client
 * « Un choix vous attend » (catégorie « Décision attendue »).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const TITRE = 'Choix des poignées de porte';

const goClient = async (sub) => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  const isAuj = /Aujourd/.test(sub);
  await page
    .getByRole('tab', { name: isAuj ? /Aujourd/ : sub })
    [isAuj ? 'last' : 'first']()
    .click();
  await page.waitForTimeout(250);
};
const notif = () => page.getByText(new RegExp(`Un choix vous attend.*${TITRE}`));
const toggleDecision = () => page.getByRole('switch', { name: 'Décision attendue' });

try {
  await openDemo(page);

  // ---- Le conducteur crée une demande de choix (in-session → notifie) -------
  await assert('Le conducteur crée une demande de choix', async () => {
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page
      .getByRole('button', { name: /Demander au client/ })
      .first()
      .click();
    await page.getByText('Demander une décision').click();
    const dlg = page.getByRole('dialog');
    await dlg.getByPlaceholder('Ex. Choix du carrelage de la salle de bain').fill(TITRE);
    await dlg.getByPlaceholder('Titre du choix A').fill('Poignées noires');
    await dlg.getByRole('button', { name: /Envoyer au client/ }).click();
    await dlg.waitFor({ state: 'detached', timeout: 6000 });
  });

  await assert('La notification « Un choix vous attend » est visible', async () => {
    await goClient('Aujourd’hui');
    await notif().first().waitFor({ state: 'visible', timeout: 6000 });
  });

  // ---- Désactiver « Décision attendue » → la notification disparaît ---------
  await assert('Désactiver « Décision attendue » retire la notification', async () => {
    await goClient('Mon espace');
    if ((await toggleDecision().getAttribute('aria-checked')) === 'true')
      await toggleDecision().click();
    await page.waitForTimeout(150);
    await goClient('Aujourd’hui');
    await page.waitForTimeout(250);
    if ((await notif().count()) > 0)
      throw new Error('la notification persiste alors que la catégorie est désactivée');
  });

  // ---- La réactiver → la notification revient -------------------------------
  await assert('Réactiver « Décision attendue » ramène la notification', async () => {
    await goClient('Mon espace');
    if ((await toggleDecision().getAttribute('aria-checked')) === 'false')
      await toggleDecision().click();
    await page.waitForTimeout(150);
    await goClient('Aujourd’hui');
    await notif().first().waitFor({ state: 'visible', timeout: 6000 });
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
