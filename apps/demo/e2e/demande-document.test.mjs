/**
 * RC1 — Réponse à une demande de DOCUMENT (échange documentaire, pas une conversation).
 * ===========================================================================
 * Quand le conducteur demande un document au client, le client répond de TROIS
 * façons : un commentaire seul, un document seul, un document + commentaire. Le
 * document est l'élément principal : il s'enregistre automatiquement au projet et
 * apparaît dans « Documents » des DEUX côtés (consultable, téléchargeable), sans
 * jamais le retélécharger/réimporter. Le conducteur reçoit une notification dans
 * « Aujourd'hui » qui ouvre la demande concernée. Aucun nouveau concept : on enrichit
 * la réponse à une demande existante.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { ctx, page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PDF = {
  name: 'diagnostic.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 d'),
};
const IMG = { name: 'attestation.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') };

// Trois documents « à fournir » du chantier seedé (Lyon 6e, espace client ouvert).
const DPE = 'DPE';
const DIAG = 'Diagnostic amiante';
const ASSU = 'Attestation décennale';

const notifs = () => page.locator('section[aria-label="Notifications"]');
const demandeCard = (label) =>
  page
    .locator('li')
    .filter({ hasText: `transmettre : ${label}` })
    .first();

/** Le conducteur demande un document (checklist Documents → « Demander au client »). */
const askDoc = async (label) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await page
    .locator('li')
    .filter({ hasText: label })
    .first()
    .getByRole('button', { name: 'Demander au client' })
    .click();
};

const openConducteurAujourdhui = async () => {
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
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();

  await assert('CONDUCTEUR — trois demandes de document créées', async () => {
    await askDoc(DPE);
    await askDoc(DIAG);
    await askDoc(ASSU);
    // Chaque demande apparaît côté client (Aujourd'hui), dans « Documents demandés ».
    await openClientTab(page);
    await demandeCard(DPE).waitFor({ state: 'visible', timeout: 6000 });
    await demandeCard(DIAG).waitFor({ state: 'visible', timeout: 6000 });
    await demandeCard(ASSU).waitFor({ state: 'visible', timeout: 6000 });
  });

  // --- (1) commentaire SEUL --------------------------------------------------
  await assert('CLIENT — répond avec un COMMENTAIRE SEUL', async () => {
    const card = demandeCard(DPE);
    await card.getByRole('button', { name: /joindre un document/i }).click();
    await card.getByPlaceholder(/Ajouter un commentaire/).fill('Je vous l’envoie par courrier.');
    await card.getByRole('button', { name: 'Envoyer' }).click();
    // La demande traitée disparaît de la boîte de réception.
    await demandeCard(DPE).waitFor({ state: 'detached', timeout: 6000 });
  });

  // --- (2) document SEUL -----------------------------------------------------
  await assert('CLIENT — répond avec un DOCUMENT SEUL', async () => {
    const card = demandeCard(DIAG);
    await card.getByRole('button', { name: /joindre un document/i }).click();
    await card.locator('[data-testid="client-doc-file"]').setInputFiles(PDF);
    await card.getByRole('button', { name: new RegExp(PDF.name) }).waitFor({ timeout: 6000 });
    await card.getByRole('button', { name: 'Envoyer' }).click();
    await demandeCard(DIAG).waitFor({ state: 'detached', timeout: 6000 });
  });

  // --- (3) document + commentaire -------------------------------------------
  await assert('CLIENT — répond avec un DOCUMENT + COMMENTAIRE', async () => {
    const card = demandeCard(ASSU);
    await card.getByRole('button', { name: /joindre un document/i }).click();
    await card.locator('[data-testid="client-doc-file"]').setInputFiles(IMG);
    await card.getByRole('button', { name: new RegExp(IMG.name) }).waitFor({ timeout: 6000 });
    await card.getByPlaceholder(/Ajouter un commentaire/).fill('Assurance à jour jusqu’en 2027.');
    await card.getByRole('button', { name: 'Envoyer' }).click();
    await demandeCard(ASSU).waitFor({ state: 'detached', timeout: 6000 });
  });

  // --- CÔTÉ CLIENT : les documents envoyés sont dans « Documents » -----------
  await assert('CLIENT — retrouve ses documents envoyés (ouvrir + télécharger)', async () => {
    await openClientTab(page, 'Documents');
    for (const label of [DIAG, ASSU]) {
      const rowDoc = page.locator('#section-documents li').filter({ hasText: label }).first();
      await rowDoc.waitFor({ state: 'visible', timeout: 6000 });
      await rowDoc
        .getByRole('button', { name: 'Ouvrir le document' })
        .waitFor({ state: 'visible' });
      await rowDoc
        .getByRole('button', { name: new RegExp(`Télécharger : ${label}`) })
        .waitFor({ state: 'visible' });
    }
    // Le commentaire SEUL n'a créé AUCUN document (échange documentaire only).
    if ((await page.locator('#section-documents li').filter({ hasText: DPE }).count()) > 0)
      throw new Error('un document a été créé pour une réponse « commentaire seul »');
  });

  await assert('CLIENT — un document envoyé s’OUVRE réellement (blob)', async () => {
    const rowDoc = page.locator('#section-documents li').filter({ hasText: DIAG }).first();
    const pagePromise = ctx.waitForEvent('page', { timeout: 6000 });
    await rowDoc.getByRole('button', { name: 'Ouvrir le document' }).click();
    const tab = await pagePromise;
    if (!tab.url().startsWith('blob:')) throw new Error(`ouverture invalide (url=${tab.url()})`);
    await tab.close();
  });

  // --- CÔTÉ CONDUCTEUR : notifications dans « Aujourd'hui » ------------------
  await assert('CONDUCTEUR — notifications de réponse dans « Aujourd’hui »', async () => {
    await openConducteurAujourdhui();
    // Document envoyé → « a envoyé : … » ; commentaire seul → « a répondu … ».
    await notifs()
      .getByRole('button', { name: new RegExp(`a envoyé : ${DIAG}`) })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await notifs()
      .getByRole('button', { name: new RegExp(`a envoyé : ${ASSU}`) })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await notifs()
      .getByRole('button', { name: /a répondu à votre demande de document/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert(
    'CONDUCTEUR — la notification ouvre « Documents » sur le document reçu',
    async () => {
      await notifs()
        .getByRole('button', { name: new RegExp(`a envoyé : ${DIAG}`) })
        .first()
        .click();
      // On atterrit sur l'onglet Documents du chantier concerné, document présent.
      await page
        .getByRole('tab', { name: 'Documents', selected: true })
        .waitFor({ state: 'visible', timeout: 6000 });
      await page.getByText(DIAG).first().waitFor({ state: 'visible', timeout: 6000 });
    },
  );

  await assert('CONDUCTEUR — le document reçu est consultable dans « Documents »', async () => {
    // La bibliothèque porte le document reçu (la ligne de checklist, elle, n'a pas
    // de bouton d'ouverture) : on cible la ligne QUI a « Ouvrir le document ».
    const rowDoc = page
      .locator('li')
      .filter({ hasText: DIAG })
      .filter({ has: page.getByRole('button', { name: 'Ouvrir le document' }) })
      .first();
    await rowDoc.getByRole('button', { name: 'Ouvrir le document' }).waitFor({ state: 'visible' });
    await rowDoc
      .getByRole('button', { name: new RegExp(`Télécharger : ${DIAG}`) })
      .waitFor({ state: 'visible' });
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
