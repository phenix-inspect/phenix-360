/**
 * ACCUSÉ DE RÉCEPTION CLIENT — un geste n'est JAMAIS suivi de silence.
 * ===========================================================================
 * Quand un client (qui paie 50 000 €) valide un choix, répond à une question ou
 * envoie un document, la carte disparaissait sans un mot — un « ai-je bien
 * validé ? » anxiogène. Désormais un accusé calme et chaleureux confirme que
 * c'est enregistré ET transmis à un humain (le conducteur). Ce test verrouille
 * le cas « réponse à une question » (le chantier de démo en contient une).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 1400 });
const { assert, summary } = harness();

try {
  await openDemo(page);

  await assert('Aperçu client → une question est en attente', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page
      .getByText(/Quel carrelage/i)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Le client répond à la question', async () => {
    await page
      .getByRole('button', { name: /^Répondre$/ })
      .first()
      .click();
    await page.getByPlaceholder(/Votre décision/).fill('On préfère l’ambiance zellige, merci.');
    await page.getByRole('button', { name: /Valider ma décision/ }).click();
  });

  await assert('Un accusé rassurant confirme la réponse (jamais de silence)', async () => {
    const accuse = page.getByRole('status').filter({ hasText: /C.est noté/i });
    await accuse.waitFor({ state: 'visible', timeout: 5000 });
    // « transmise à votre conducteur » — la réassurance qu'un humain a la main.
    await accuse
      .getByText(/transmise à votre conducteur/i)
      .first()
      .waitFor({ state: 'visible', timeout: 3000 });
  });

  await assert('L’accusé se referme (bouton dédié)', async () => {
    await page.getByRole('button', { name: /Fermer ce message/i }).click();
    if (
      (await page
        .getByRole('status')
        .filter({ hasText: /C.est noté/i })
        .count()) > 0
    )
      throw new Error('l’accusé n’a pas été fermé');
  });

  await assert('Zéro erreur console', async () => {
    if (consoleErrors.length > 0) throw new Error(consoleErrors.slice(0, 4).join(' | '));
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
