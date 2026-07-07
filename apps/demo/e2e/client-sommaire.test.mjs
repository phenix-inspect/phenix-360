/**
 * RC1 — Navigation de l'Espace client par ONGLETS (un onglet = un univers).
 * Le sommaire de puces est remplacé par 4 onglets clairs : Aujourd'hui (boîte de
 * réception), Le projet (avancement), Dans les coulisses (photos), Documents.
 * Chaque onglet ouvre SON univers, sans mélange. Client-safe préservé.
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
    'Les 4 onglets client existent (Aujourd’hui · Le projet · Coulisses · Documents)',
    async () => {
      const bar = clientTabsBar();
      for (const t of ['Aujourd’hui', 'Le projet', 'Dans les coulisses', 'Documents'])
        await bar.getByRole('tab', { name: t }).waitFor({ state: 'visible', timeout: 5000 });
    },
  );

  await assert('« Le projet » ouvre le planning (grandes étapes)', async () => {
    await openClientTab(page, 'Le projet');
    await page
      .getByRole('heading', { name: 'Les grandes étapes du chantier' })
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

  await assert('« Aujourd’hui » est la boîte de réception (décision / bandeau)', async () => {
    await openClientTab(page); // Aujourd'hui
    // Le seed porte une décision à prendre → « Voir la décision » (ou un bandeau).
    const hasBanner =
      (await page.getByRole('button', { name: /Voir la décision/ }).count()) > 0 ||
      (await page.locator('section[aria-label="Notifications"]').count()) > 0 ||
      (await page.getByText(/Tout est à jour/).count()) > 0;
    if (!hasBanner) throw new Error('la boîte de réception ne montre rien');
  });

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
