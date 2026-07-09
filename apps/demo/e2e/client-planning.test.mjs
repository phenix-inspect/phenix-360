/**
 * « Planning de votre projet » — les GRANDES ÉTAPES côté client.
 * ===========================================================================
 * Le client visualise les jalons de son projet (démarrage, pré-réception,
 * réception) dans son Espace, en lecture seule :
 *   • les étapes terminées sont cochées (« Terminé ») ;
 *   • l'étape en cours est mise en évidence (« En cours ») ;
 *   • les étapes futures restent grisées (« À venir ») ;
 *   • un rappel « Prochaine étape » figure dans « Aujourd'hui » ;
 *   • toute modification du conducteur (statut) met À JOUR le planning client.
 * Jamais de planning technique / tâches artisans / check-list interne.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const goClientAuj = async () => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await page
    .getByRole('tab', { name: /Aujourd/ })
    .last()
    .click();
  await page.waitForTimeout(200);
};
const planning = () => page.getByTestId('client-planning');
// Ligne d'un jalon = le <li> qui contient EXACTEMENT ce libellé (« Réception »
// n'attrape jamais « Pré-réception »).
const jalon = (label) =>
  planning()
    .locator('li')
    .filter({ has: page.getByText(label, { exact: true }) });

try {
  await openDemo(page);

  // ---- Le bloc planning et ses 3 jalons principaux existent -----------------
  await assert('« Planning de votre projet » est visible dans l’Espace client', async () => {
    await goClientAuj();
    await planning().waitFor({ state: 'visible', timeout: 6000 });
    await planning()
      .getByRole('heading', { name: 'Planning de votre projet' })
      .waitFor({ state: 'visible' });
  });

  await assert('Les trois jalons principaux sont affichés', async () => {
    for (const label of ['Démarrage', 'Pré-réception', 'Réception'])
      await planning()
        .getByText(label, { exact: true })
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
  });

  // ---- États : terminé (coché) · en cours (mis en évidence) · futur (grisé) --
  await assert('Une étape TERMINÉE est cochée (Démarrage → Terminé)', async () => {
    await jalon('Démarrage').getByText('Terminé').first().waitFor({ state: 'visible' });
  });

  await assert('L’étape EN COURS est mise en évidence (Pré-réception → En cours)', async () => {
    await jalon('Pré-réception').getByText('En cours').first().waitFor({ state: 'visible' });
  });

  await assert('Une étape FUTURE reste grisée (Réception → À venir)', async () => {
    await jalon('Réception').getByText('À venir').first().waitFor({ state: 'visible' });
  });

  // ---- Rappel de la prochaine étape dans « Aujourd'hui » --------------------
  await assert('« Aujourd’hui » rappelle la prochaine grande étape', async () => {
    await page
      .getByTestId('prochaine-etape')
      .getByText(/Prochaine étape.*Pré-réception/)
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  // ---- Synchronisation : une modif CONDUCTEUR met à jour le planning client --
  await assert(
    'Modif conducteur (statut → Levée des réserves) met à jour le planning client',
    async () => {
      await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
      const select = page.getByLabel('Statut du chantier');
      await select.waitFor({ state: 'visible', timeout: 6000 });
      await select.selectOption({ label: 'Levée des réserves' });
      await page.waitForTimeout(200);

      // Retour côté client : Pré-réception devient « Terminé », Réception « En cours ».
      await goClientAuj();
      await jalon('Pré-réception')
        .getByText('Terminé')
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      await jalon('Réception')
        .getByText('En cours')
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
    },
  );

  // ---- Client-safe : aucun détail technique / interne ne fuit --------------
  await assert('Aucun planning technique / interne dans le bloc client', async () => {
    const body = await planning().innerText();
    for (const secret of ['plomberie', 'peinture', 'électricité', 'artisan', 'check-list'])
      if (new RegExp(secret, 'i').test(body))
        throw new Error(`détail technique visible dans le planning client : « ${secret} »`);
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
