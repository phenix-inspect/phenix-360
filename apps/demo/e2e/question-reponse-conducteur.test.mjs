/**
 * RÉPONSE DU CLIENT À UNE QUESTION → NOTIFICATION CONDUCTEUR (retour terrain).
 * ===========================================================================
 * Le conducteur pose une question au client (« Demander au client → Poser une
 * question »). Quand le client répond, sa réponse passait la demande à « traitee »
 * mais N'ALERTAIT PAS le conducteur : elle dormait au Suivi. Régression métier —
 * le conducteur ne « voit » jamais qu'on lui a répondu. Ce test verrouille le
 * signal manquant : la réponse à une question apparaît dans « Aujourd'hui »
 * (comme la réponse à une demande de document ou la validation d'un choix), ouvre
 * le Suivi au bon endroit et s'éteint à la lecture (accusé).
 *
 * Le chantier de démo contient une question ouverte du conducteur au client
 * (« Quel carrelage… »). Client-safe : le signal ne fuit jamais côté client.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 1800 });
const { assert, summary } = harness();

const notifs = () => page.locator('section[aria-label="Notifications"]');
const notif = (re) => notifs().getByRole('button', { name: re });
const REPONSE = 'On préfère l’ambiance zellige, merci.';

const openAujourdhui = async () => {
  await page
    .getByRole('tab', { name: /Aujourd/ })
    .first()
    .click();
  await page
    .getByRole('heading', { name: /Bonjour Mickaël/ })
    .waitFor({ state: 'visible', timeout: 6000 });
};

try {
  await openDemo(page);

  await assert('CONDUCTEUR — au départ, aucune notification « a répondu »', async () => {
    if ((await notif(/a répondu à votre question/).count()) > 0)
      throw new Error('la notification existe déjà alors que le client n’a pas répondu');
  });

  await assert('CLIENT — répond à la question du conducteur', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page
      .getByText(/Quel carrelage/i)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await page
      .getByRole('button', { name: /^Répondre$/ })
      .first()
      .click();
    await page.getByPlaceholder(/Votre décision/).fill(REPONSE);
    await page.getByRole('button', { name: /Valider ma décision/ }).click();
    // Accusé côté client : la réponse est bien enregistrée + transmise.
    await page
      .getByRole('status')
      .filter({ hasText: /C.est noté/i })
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('CONDUCTEUR — reçoit la notification « a répondu à votre question »', async () => {
    await openAujourdhui();
    await notif(/a répondu à votre question/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert(
    'Le clic ouvre le Suivi (question → réponse) ET éteint la notification',
    async () => {
      await notif(/a répondu à votre question/)
        .first()
        .click();
      await page
        .getByRole('tab', { name: 'Suivi', selected: true })
        .waitFor({ state: 'visible', timeout: 6000 });
      // La trace officielle : la question ET la réponse du client.
      await page
        .getByText(/Quel carrelage/i)
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
      await page
        .getByText(new RegExp(REPONSE.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
      // De retour sur Aujourd'hui : la notification a disparu (accusé de lecture).
      await openAujourdhui();
      if ((await notif(/a répondu à votre question/).count()) > 0)
        throw new Error('la notification n’a pas été éteinte après lecture');
    },
  );

  await assert('Client-safe : le signal conducteur ne fuit pas côté client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(300);
    if ((await page.getByText(/a répondu à votre question/i).count()) > 0)
      throw new Error('fuite côté client : « a répondu à votre question »');
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
