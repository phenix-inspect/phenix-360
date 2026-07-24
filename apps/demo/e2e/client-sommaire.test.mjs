/**
 * Navigation de l'Espace client par ONGLETS (un onglet = une question). Cinq
 * onglets clairs : Aujourd'hui (mes actions), Vos demandes (échanges PHÉNIX),
 * Vos choix (décisions), Documents, Dans les coulisses (photos). Chaque onglet
 * ouvre SON univers, sans mélange. Client-safe préservé.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 1600 });
const { assert, summary } = harness();

const clientTabsBar = () => page.locator('main').getByRole('tablist').first();

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();

  await assert(
    'Les 5 onglets client existent (Aujourd’hui · Vos demandes · Vos choix · Documents · Coulisses)',
    async () => {
      const bar = clientTabsBar();
      for (const t of [
        'Aujourd’hui',
        'Vos demandes',
        'Vos choix',
        'Documents',
        'Dans les coulisses',
      ])
        await bar.getByRole('tab', { name: t }).waitFor({ state: 'visible', timeout: 5000 });
    },
  );

  await assert('« Vos demandes » ouvre l’historique des échanges PHÉNIX', async () => {
    await openClientTab(page, 'Vos demandes');
    await page
      .getByRole('heading', { name: 'Vos demandes', exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('« Vos choix » ouvre l’historique des décisions', async () => {
    await openClientTab(page, 'Vos choix');
    await page
      .getByRole('heading', { name: 'Vos choix', exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('« Dans les coulisses » ouvre les photos', async () => {
    await openClientTab(page, 'Dans les coulisses');
    await page
      .getByRole('heading', { name: 'Dans les coulisses du chantier' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('« Documents » ouvre la bibliothèque du client', async () => {
    await openClientTab(page, 'Documents');
    await page
      .getByRole('heading', { name: 'Vos documents' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert(
    '« Aujourd’hui » est un tableau d’ACTIONS (décision / notifs / rien à faire)',
    async () => {
      await openClientTab(page); // Aujourd'hui
      const hasSomething =
        (await page.getByRole('button', { name: /Voir la décision/ }).count()) > 0 ||
        (await page.locator('section[aria-label="Notifications"]').count()) > 0 ||
        (await page.getByText(/Vous n’avez rien à faire|Tout est à jour/).count()) > 0;
      if (!hasSomething) throw new Error('le tableau d’actions ne montre rien');
    },
  );

  await assert('Client-safe : rien d’interne ne fuit', async () => {
    for (const secret of ['Réserve n°', 'Moment interne', 'à traiter'])
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
