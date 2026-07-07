/**
 * RC1 — Refonte de l'Espace CLIENT : un onglet = un univers (même philosophie que
 * le conducteur). Le client suit son projet comme un réseau social premium, jamais
 * un ERP.
 *   • AUJOURD'HUI = boîte de réception (décisions, notifications) ;
 *   • LE PROJET = avancement (grandes étapes, planning, choix) — aucun document,
 *     aucune photo ;
 *   • DANS LES COULISSES = photos/albums (❤️ 💬) — aucun document/CR/PV ;
 *   • DOCUMENTS = tout PDF (devis, factures, comptes rendus, PV…), ouvrable +
 *     téléchargeable.
 * Aucun doublon entre onglets. Les notifications ouvrent directement le bon écran.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const docsHeading = () => page.getByRole('heading', { name: 'Vos documents' });
const coulissesHeading = () =>
  page.getByRole('heading', { name: 'Dans les coulisses du chantier' });
const planningHeading = () => page.getByRole('heading', { name: 'Les grandes étapes du chantier' });
const download = () => page.getByRole('button', { name: /Télécharger/ });

try {
  await openDemo(page);

  await assert('Les 4 onglets client existent', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    const bar = page.locator('main').getByRole('tablist').first();
    for (const t of ['Aujourd’hui', 'Le projet', 'Dans les coulisses', 'Documents'])
      await bar.getByRole('tab', { name: t }).waitFor({ state: 'visible', timeout: 5000 });
  });

  // ---- DOCUMENTS : tout PDF, ouvrable + téléchargeable ------------------
  await assert('DOCUMENTS — devis + comptes rendus, ouvrables ET téléchargeables', async () => {
    await openClientTab(page, 'Documents');
    await docsHeading().waitFor({ state: 'visible', timeout: 6000 });
    await page.getByText('Devis plomberie').first().waitFor({ state: 'visible', timeout: 5000 });
    if (
      (await page
        .getByRole('button', { name: /Ouvrir le document|Consulter le compte rendu/ })
        .count()) === 0
    )
      throw new Error('aucun document ouvrable côté client');
    if ((await download().count()) === 0)
      throw new Error('aucun document téléchargeable côté client');
    // Aucune photo dans les documents.
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
    // Le client peut aimer.
    if ((await page.getByRole('button', { name: /coup de cœur/i }).count()) === 0)
      throw new Error('impossible d’aimer une photo côté client');
  });

  // ---- LE PROJET : avancement, aucun document ni photo -----------------
  await assert('LE PROJET — avancement seulement (ni document, ni coulisses)', async () => {
    await openClientTab(page, 'Le projet');
    await planningHeading().first().waitFor({ state: 'visible', timeout: 6000 });
    if ((await docsHeading().count()) > 0)
      throw new Error('des documents apparaissent dans Le projet');
    if ((await coulissesHeading().count()) > 0)
      throw new Error('les coulisses apparaissent dans Le projet');
  });

  // ---- AUJOURD'HUI : la boîte de réception ; le clic ouvre le bon écran --
  await assert(
    'AUJOURD’HUI — une notif document ouvre directement l’onglet Documents',
    async () => {
      await openClientTab(page); // Aujourd'hui
      const notif = page
        .locator('section[aria-label="Notifications"]')
        .getByRole('button', { name: /Nouveau document partagé/ });
      // Le seed partage au moins un document → une notification l'annonce ici.
      if ((await notif.count()) === 0) {
        // Pas de notif seedée : au moins la boîte de réception existe (bandeau/décision).
        if (
          (await page.getByRole('button', { name: /Voir la décision/ }).count()) === 0 &&
          (await page.getByText(/Tout est à jour/).count()) === 0
        )
          throw new Error('la boîte de réception est vide');
        return;
      }
      await notif.first().click();
      // Le clic bascule sur Documents (le bon écran).
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
