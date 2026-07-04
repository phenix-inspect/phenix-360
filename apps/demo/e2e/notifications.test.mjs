/**
 * RC1 — Notifications contextuelles ACTIONNABLES (retour terrain).
 * Une notification porte une CIBLE précise : le clic navigue droit au Moment
 * concerné, l'ouvre, met en évidence, pose le curseur dans la réponse, et la
 * CONSULTATION suffit à l'éteindre (accusé de lecture par rôle — conducteur et
 * client ont chacun le leur). Plusieurs en attente → compteur juste, on ouvre la
 * plus récente. Client-safe strict.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const CLIENT_MSG = 'Superbe, hâte de voir la suite !'; // message client seedé (Dalle coulée)
const REPLY_DALLE = 'Bien noté, je m’en occupe dès demain matin.';
const REPLY_MUR = 'Le mur porteur est posé, tout est conforme.';
const PLACEHOLDER = 'Écrire un petit mot…';

const badgeConducteur = () => page.getByText(/Nouveau commentaire du client/);
const badgeClient = () => page.getByText('Nouveau message de votre équipe');

try {
  await openDemo(page);

  await assert('CONDUCTEUR — Aujourd’hui signale un commentaire client', async () => {
    const card = page.getByRole('button', { name: /Appartement Lyon 6e/ });
    await card
      .getByText(/commentaire.*client/i)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Le clic ouvre le Récit AU MOMENT concerné (pas tout le récit)', async () => {
    await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
    await page
      .getByRole('heading', { name: 'Le récit du chantier' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    // Le Moment concerné (« Dalle coulée ») et son commentaire client sont là.
    await page.getByText(CLIENT_MSG).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Le champ de réponse est prêt à écrire (curseur posé)', async () => {
    await page.waitForTimeout(300);
    const ph = await page.evaluate(
      () => document.activeElement && document.activeElement.getAttribute('placeholder'),
    );
    if (ph !== PLACEHOLDER) throw new Error(`champ de réponse non focalisé (actif: ${ph})`);
  });

  await assert('CONSULTATION = LU : le signal du Moment s’éteint sans répondre', async () => {
    // La seule consultation (clic notification) a marqué le Moment lu.
    if ((await badgeConducteur().count()) > 0)
      throw new Error('le Moment reste marqué « nouveau » après simple consultation');
  });

  await assert('Le conducteur répond dans le fil contextuel du Moment', async () => {
    const moment = page.locator('article').filter({ hasText: 'Dalle coulée' }).first();
    const input = moment.getByPlaceholder(PLACEHOLDER);
    await input.fill(REPLY_DALLE);
    await input.press('Enter');
    await page.getByText(REPLY_DALLE).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Le conducteur laisse AUSSI un mot sur un second Moment partagé', async () => {
    const moment = page.locator('article').filter({ hasText: 'Ouverture du mur porteur' }).first();
    const input = moment.getByPlaceholder(PLACEHOLDER);
    await input.fill(REPLY_MUR);
    await input.press('Enter');
    await page.getByText(REPLY_MUR).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert(
    'Aujourd’hui : plus de signal « commentaire client » (consulté + répondu)',
    async () => {
      await page.getByRole('tab', { name: /Aujourd/ }).click();
      await page
        .getByRole('heading', { name: /Bonjour Mickaël/ })
        .waitFor({ state: 'visible', timeout: 5000 });
      const card = page.getByRole('button', { name: /Appartement Lyon 6e/ });
      if ((await card.getByText(/commentaire.*client/i).count()) > 0)
        throw new Error('le signal Aujourd’hui persiste');
    },
  );

  await assert('CLIENT — deux messages d’équipe → compteur juste (2)', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page
      .getByText(/Votre équipe vous a laissé 2 messages/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    const n = await badgeClient().count();
    if (n !== 2) throw new Error(`attendu 2 Moments signalés, vu ${n}`);
  });

  await assert('Clic notification client → ouvre la PLUS RÉCENTE + la marque lue', async () => {
    await page.getByRole('button', { name: /Votre équipe vous a laissé/ }).click();
    // La plus récente (le mur porteur) est consultée → compteur retombe à 1.
    await page
      .getByText(/Votre équipe vous a laissé 1 message/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    const n = await badgeClient().count();
    if (n !== 1) throw new Error(`attendu 1 Moment encore signalé, vu ${n}`);
    // Celui qui reste est le plus ancien (la dalle), pas le mur.
    const restant = page.locator('article').filter({ has: badgeClient() }).first();
    if ((await restant.filter({ hasText: 'Ouverture du mur porteur' }).count()) > 0)
      throw new Error('la notification n’a pas ouvert la plus récente');
  });

  await assert('Client-safe : aucun élément interne ne fuit', async () => {
    await page.waitForTimeout(300);
    for (const secret of [
      'Réserve n°',
      'Responsable :',
      'Historique des échanges',
      'Moment interne',
    ])
      if ((await page.getByText(secret, { exact: false }).count()) > 0)
        throw new Error(`fuite côté client : « ${secret} »`);
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
