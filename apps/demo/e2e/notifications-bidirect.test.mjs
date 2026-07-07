/**
 * RC1 — Notifications BIDIRECTIONNELLES (retour terrain).
 * ===========================================================================
 * Chaque action importante d'un camp crée une notification pour l'AUTRE, dans son
 * écran d'accueil (jamais un nouvel écran) :
 *   • CONDUCTEUR → CLIENT : nouvelle publication (photo partagée), document partagé
 *     → apparaissent dans l'Espace client.
 *   • CLIENT → CONDUCTEUR : ❤️ (coup de cœur), décision validée
 *     → apparaissent dans « Aujourd'hui ».
 * Un clic ouvre l'élément concerné ET éteint la notification (accusé de lecture) :
 * elle disparaît. L'historique seedé ne notifie jamais (repère `notifBaseline`).
 * Client-safe strict. Zéro erreur console.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

// PNG 1×1 valide (photo du moment partagé).
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const DOC = {
  name: 'notice-client.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 notif'),
};
const DOC_LIBELLE = 'Notice de pose client';

const notifs = () => page.locator('section[aria-label="Notifications"]');
const notif = (re) => notifs().getByRole('button', { name: re });

const openCoulisses = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Dans les coulisses' }).first().click();
};
/** Ouvre le composer d'album via « Nouvelle mission → Publier dans les coulisses ». */
const openAlbumComposer = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('button', { name: /Publier dans les coulisses/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('heading', { name: 'Créer un moment' })
    .waitFor({ state: 'visible', timeout: 6000 });
};
const openAujourdhui = async () => {
  await page
    .getByRole('tab', { name: /Aujourd/ })
    .first()
    .click();
  await page
    .getByRole('heading', { name: /Bonjour Mickaël/ })
    .waitFor({ state: 'visible', timeout: 6000 });
};
const openClient = async () => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await page.waitForTimeout(400);
};

try {
  await openDemo(page);

  // ---------------------------------------------------------------------------
  // Baseline : seul le commentaire client SEEDÉ notifie le conducteur au départ
  // (mécanique d'accusé de lecture existante) ; côté client, rien encore.
  // ---------------------------------------------------------------------------
  await assert('CONDUCTEUR — au départ, une notification « commentaire » (seed)', async () => {
    await notif(/a commenté une publication/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  // ---------------------------------------------------------------------------
  // CONDUCTEUR → CLIENT (1) : publier une photo partagée.
  // ---------------------------------------------------------------------------
  await assert('CONDUCTEUR publie une photo partagée (via Nouvelle mission)', async () => {
    await openAlbumComposer();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type=file]').setInputFiles({
      name: 'chantier.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG, 'base64'),
    });
    await dialog.getByPlaceholder(/Décrivez ce moment/).fill('Avancement du séjour');
    // Publication coulisses = toujours partagée au client (plus de case à cocher).
    await dialog.getByRole('button', { name: /Créer le moment/ }).click();
    await dialog.waitFor({ state: 'detached', timeout: 8000 });
  });

  await assert('CLIENT — reçoit la notification « nouvelles photos (coulisses) »', async () => {
    await openClient();
    await notif(/Nouvelles photos ajoutées dans les coulisses/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  // ---------------------------------------------------------------------------
  // CONDUCTEUR → CLIENT (2) : partager un document.
  // ---------------------------------------------------------------------------
  await assert(
    'CONDUCTEUR partage un document (via Nouvelle mission, Visible client)',
    async () => {
      await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
      await page.getByRole('button', { name: /Nouvelle mission/ }).click();
      await page.getByRole('button', { name: /Ajouter un document/ }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByLabel('Libellé du document').fill(DOC_LIBELLE);
      await dlg.locator('input[type=file]').setInputFiles(DOC);
      await dlg
        .getByText(new RegExp(DOC.name))
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      await dlg.locator('select').selectOption({ label: 'Client' });
      await dlg.getByRole('button', { name: 'Publier' }).click();
      await dlg.waitFor({ state: 'hidden', timeout: 6000 });
      await page.getByRole('tab', { name: 'Documents', exact: true }).click();
      await page
        .locator('li')
        .filter({ hasText: DOC_LIBELLE })
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
    },
  );

  await assert('CLIENT — reçoit la notification « document partagé »', async () => {
    await openClient();
    await notif(new RegExp(`Nouveau document partagé : ${DOC_LIBELLE}`))
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  // ---------------------------------------------------------------------------
  // CLIC = ouverture + accusé de lecture : la notification disparaît.
  // ---------------------------------------------------------------------------
  await assert('CLIENT — clic sur la notification document → ouvre + disparaît', async () => {
    await notif(new RegExp(`Nouveau document partagé : ${DOC_LIBELLE}`))
      .first()
      .click();
    await page.waitForTimeout(400);
    // Le clic bascule sur l'onglet Documents, où le document partagé figure.
    await page
      .locator('#section-documents')
      .getByText(DOC_LIBELLE)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    // De retour dans Aujourd'hui : la notif document a disparu (consultée), la notif
    // photos demeure (non consultée).
    await openClientTab(page);
    if ((await notif(new RegExp(`Nouveau document partagé : ${DOC_LIBELLE}`)).count()) > 0)
      throw new Error('la notification document persiste après consultation');
    await notif(/Nouvelles photos ajoutées dans les coulisses/)
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
  });

  // ---------------------------------------------------------------------------
  // CLIENT → CONDUCTEUR (1) : coup de cœur (❤️).
  // ---------------------------------------------------------------------------
  await assert('CLIENT met un ❤️ sur une publication', async () => {
    await openClientTab(page, 'Dans les coulisses');
    const heart = page.getByRole('button', { name: /coup de cœur/i }).first();
    await heart.waitFor({ state: 'visible', timeout: 6000 });
    await heart.click();
    // On garantit l'état « aimé » avec un coup FRAIS (si le 1er était déjà aimé
    // depuis le seed, le premier clic l'a retiré → on le remet).
    if ((await heart.getAttribute('aria-pressed')) === 'false') await heart.click();
    if ((await heart.getAttribute('aria-pressed')) !== 'true')
      throw new Error('le ❤️ n’est pas actif');
  });

  await assert('CONDUCTEUR — reçoit la notification « a aimé une publication »', async () => {
    await openAujourdhui();
    await notif(/a aimé une publication/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  // ---------------------------------------------------------------------------
  // CLIENT → CONDUCTEUR (2) : valider une décision.
  // ---------------------------------------------------------------------------
  await assert('CLIENT valide une décision (choix d’ambiance)', async () => {
    await openClientTab(page); // Aujourd'hui = la décision à prendre
    await page.getByRole('button', { name: 'Voir la décision' }).click();
    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: /Valider mon choix/ }).click();
    // Le récap « Vos choix » vit dans « Le projet ».
    await page.getByRole('tab', { name: 'Le projet' }).click();
    await page.getByText('Vos choix').first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('CONDUCTEUR — reçoit la notification « décision validée »', async () => {
    await openAujourdhui();
    await notif(/Décision validée par le client/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  // ---------------------------------------------------------------------------
  // CLIC côté conducteur : ouvre le contenu + éteint la notification.
  // ---------------------------------------------------------------------------
  await assert(
    'CONDUCTEUR — clic sur ❤️ → ouvre le chantier + la notification disparaît',
    async () => {
      await notif(/a aimé une publication/)
        .first()
        .click();
      // Le clic a navigué vers le chantier (« Dans les coulisses »).
      await page
        .getByRole('tab', { name: 'Dans les coulisses' })
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      await openAujourdhui();
      if ((await notif(/a aimé une publication/).count()) > 0)
        throw new Error('la notification ❤️ persiste après consultation');
      // La décision, elle, n’a pas été consultée → toujours signalée.
      await notif(/Décision validée par le client/)
        .first()
        .waitFor({ state: 'visible', timeout: 4000 });
    },
  );

  // ---------------------------------------------------------------------------
  // Client-safe : aucune fuite interne dans l'espace client.
  // ---------------------------------------------------------------------------
  await assert('Client-safe : aucun élément interne ne fuit', async () => {
    await openClient();
    await page.waitForTimeout(300);
    for (const secret of [
      'a aimé une publication',
      'Décision validée par le client',
      'à traiter',
      'Réserve n°',
      'Pris en compte',
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
