/**
 * RC1 — commentaires client ↔ conducteur (retours terrain 7 & 8) :
 * un commentaire client est SIGNALÉ dans Aujourd'hui, ouvre droit sur le Récit,
 * le Moment concerné est marqué, le conducteur RÉPOND dans le fil contextuel, et
 * le signal se vide une fois la réponse postée.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2000 });
const { assert, summary } = harness();
const REPLY = 'Bien noté, je m’en occupe dès demain matin.';

try {
  await openDemo(page);

  await assert('Aujourd’hui SIGNALE un commentaire client (ne pas le perdre)', async () => {
    const card = page.getByRole('button', { name: /Appartement Lyon 6e/ });
    await card
      .getByText(/commentaire.*client/i)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert(
    'Le clic ouvre droit sur le Récit, Moment marqué « Nouveau commentaire »',
    async () => {
      await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
      await page
        .getByRole('heading', { name: 'Le récit du chantier' })
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      await page
        .getByText(/Nouveau commentaire du client/)
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
    },
  );

  await assert('Le conducteur RÉPOND dans le fil contextuel du Moment', async () => {
    const moment = page
      .locator('article')
      .filter({ hasText: 'Nouveau commentaire du client' })
      .first();
    const input = moment.getByPlaceholder('Écrire un petit mot…');
    await input.fill(REPLY);
    await input.press('Enter');
    // La réponse postée, le signal se vide (le badge disparaît) : on vérifie la
    // réponse au niveau page (le Moment n'est plus filtrable par le badge).
    await page.getByText(REPLY).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert(
    'La réponse VIDE le signal : plus de « Nouveau commentaire » sur ce Moment',
    async () => {
      await page.waitForTimeout(400);
      if ((await page.getByText(/Nouveau commentaire du client/).count()) > 0)
        throw new Error('le Moment est encore marqué en attente après réponse');
    },
  );

  await assert('Aujourd’hui : le signal a disparu après réponse', async () => {
    await page.getByRole('tab', { name: /Aujourd/ }).click();
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    const card = page.getByRole('button', { name: /Appartement Lyon 6e/ });
    if ((await card.getByText(/commentaire.*client/i).count()) > 0)
      throw new Error('le signal Aujourd’hui persiste après réponse');
  });

  await assert(
    'Client-safe : la réponse conducteur reste dans le récit partagé (pas de fuite interne)',
    async () => {
      await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
      await page.waitForTimeout(500);
      // La réponse est visible au client (récit partagé) — c'est voulu ; mais rien
      // d'interne ne fuit à côté.
      for (const secret of ['Réserve n°', 'Responsable :', 'Historique des échanges']) {
        if ((await page.getByText(secret, { exact: false }).count()) > 0)
          throw new Error(`fuite côté client : « ${secret} »`);
      }
    },
  );

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
