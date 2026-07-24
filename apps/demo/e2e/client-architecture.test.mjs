/**
 * Refonte de l'Espace CLIENT — 5 onglets, un onglet = une question :
 *   • AUJOURD'HUI = tableau d'actions (notifications d'abord, puis ce qui attend
 *     une action) ; si rien → « Vous n'avez rien à faire » ;
 *   • VOS DEMANDES = historique des échanges avec PHÉNIX (via Léon) ;
 *   • VOS CHOIX = historique des décisions demandées ;
 *   • DOCUMENTS = tout PDF, ouvrable + téléchargeable ;
 *   • DANS LES COULISSES = photos/albums (❤️ 💬).
 * Aucun doublon entre onglets. Les notifications ouvrent directement le bon écran.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const docsHeading = () => page.getByRole('heading', { name: 'Vos documents' });
const coulissesHeading = () =>
  page.getByRole('heading', { name: 'Dans les coulisses du chantier' });
const choixHeading = () => page.getByRole('heading', { name: 'Vos choix', exact: true });
const download = () => page.getByRole('button', { name: /Télécharger/ });

try {
  await openDemo(page);

  await assert('Les 6 onglets client existent', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    const bar = page.locator('main').getByRole('tablist').first();
    for (const t of [
      'Aujourd’hui',
      'Vos demandes',
      'Vos choix',
      'Documents',
      'Dans les coulisses',
      'Mon espace',
    ])
      await bar.getByRole('tab', { name: t }).waitFor({ state: 'visible', timeout: 5000 });
    // Plus d'onglet « Le projet ».
    if ((await bar.getByRole('tab', { name: 'Le projet' }).count()) > 0)
      throw new Error('l’onglet « Le projet » ne devrait plus exister');
  });

  // ---- DOCUMENTS : tout PDF, ouvrable + téléchargeable ------------------
  await assert('DOCUMENTS — devis + comptes rendus, ouvrables ET téléchargeables', async () => {
    await openClientTab(page, 'Documents');
    await docsHeading().waitFor({ state: 'visible', timeout: 6000 });
    await page.getByText('Devis plomberie').first().waitFor({ state: 'visible', timeout: 5000 });
    if (
      (await page.getByRole('button', { name: /Ouvrir le document|Prévisualiser/ }).count()) === 0
    )
      throw new Error('aucun document ouvrable côté client');
    if ((await download().count()) === 0)
      throw new Error('aucun document téléchargeable côté client');
    if ((await coulissesHeading().count()) > 0)
      throw new Error('les coulisses (photos) apparaissent dans Documents');
  });

  // ---- DANS LES COULISSES : photos seulement ---------------------------
  await assert('COULISSES — photos seulement (aucun document / téléchargement)', async () => {
    await openClientTab(page, 'Dans les coulisses');
    await coulissesHeading().first().waitFor({ state: 'visible', timeout: 6000 });
    if ((await docsHeading().count()) > 0)
      throw new Error('la bibliothèque documents apparaît dans les coulisses');
    if ((await download().count()) > 0)
      throw new Error('un document téléchargeable traîne dans les coulisses');
    if ((await page.getByRole('button', { name: /coup de cœur/i }).count()) === 0)
      throw new Error('impossible d’aimer une photo côté client');
  });

  // ---- VOS CHOIX : les décisions, aucun document ni photo --------------
  await assert('VOS CHOIX — décisions seulement (ni document, ni coulisses)', async () => {
    await openClientTab(page, 'Vos choix');
    await choixHeading().first().waitFor({ state: 'visible', timeout: 6000 });
    if ((await docsHeading().count()) > 0)
      throw new Error('des documents apparaissent dans Vos choix');
    if ((await coulissesHeading().count()) > 0)
      throw new Error('les coulisses apparaissent dans Vos choix');
  });

  // ---- AUJOURD'HUI : boîte d'actions ; le clic ouvre le bon écran -------
  await assert(
    'AUJOURD’HUI — une notif document ouvre directement l’onglet Documents',
    async () => {
      await openClientTab(page); // Aujourd'hui
      const notif = page
        .locator('section[aria-label="Notifications"]')
        .getByRole('button', { name: /Nouveau document partagé/ });
      if ((await notif.count()) === 0) {
        // Pas de notif seedée : au moins une action ou l'état vide est présent.
        if (
          (await page.getByRole('button', { name: /Voir la décision/ }).count()) === 0 &&
          (await page.getByText(/Vous n’avez rien à faire|Tout est à jour/).count()) === 0
        )
          throw new Error('la boîte d’actions est vide');
        return;
      }
      await notif.first().click();
      await docsHeading().waitFor({ state: 'visible', timeout: 6000 });
    },
  );

  await assert('Client-safe : rien d’interne ne fuit', async () => {
    for (const secret of ['Réserve n°', 'à traiter', 'Moment interne', 'Responsable :'])
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
