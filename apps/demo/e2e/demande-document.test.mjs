/**
 * RC1 — Demander un document au client depuis « Nouvelle mission ».
 * ===========================================================================
 * Tout ce que le conducteur demande au client passe par « Nouvelle mission →
 * Demander au client », où il choisit le TYPE : décision, document ou question.
 * Pour un DOCUMENT : libellé + type + message optionnel + échéance optionnelle,
 * visible client automatiquement. Le client répond de trois façons (commentaire
 * seul / fichier seul / fichier + commentaire). Le document reçu est enregistré au
 * projet et apparaît dans « Documents » des DEUX côtés (ouvrable, téléchargeable) ;
 * la demande passe en « Reçu » et le conducteur est notifié dans « Aujourd'hui ».
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { ctx, page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PDF = { name: 'diag.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 d') };
const IMG = { name: 'rib.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') };

const L_COMMENT = 'Justificatif de virement'; // réponse : commentaire seul
const L_DOC = 'Diagnostic plomb'; // réponse : fichier seul
const L_BOTH = 'RIB du client'; // réponse : fichier + commentaire
const INTERNE = 'Contrat sous-traitant'; // document interne seedé (jamais client)

const notifs = () => page.locator('section[aria-label="Notifications"]');
const demandeCard = (label) =>
  page
    .locator('li')
    .filter({ hasText: `transmettre : ${label}` })
    .first();
const demandesSection = () =>
  page.locator('div').filter({ hasText: 'Documents demandés au client' }).last();

/** « Nouvelle mission → Demander au client → Demander un document ». */
const askDoc = async (libelle, typeLabel) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('button', { name: /Demander au client/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: /Demander un document/ }).click();
  await dlg.getByLabel('Document demandé').fill(libelle);
  await dlg.getByLabel('Type de document').selectOption({ label: typeLabel });
  await dlg.getByRole('button', { name: /Envoyer la demande de document/ }).click();
  await dlg.waitFor({ state: 'hidden', timeout: 6000 });
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

const openConducteurDocuments = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
};

try {
  await openDemo(page);
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();

  await assert('« Demander au client » existe dans « Nouvelle mission »', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('button', { name: /Demander au client/ }).click();
    // Les trois types sont proposés (décision / document / question).
    await dlg.getByRole('button', { name: /Demander une décision/ }).waitFor({ state: 'visible' });
    await dlg.getByRole('button', { name: /Demander un document/ }).waitFor({ state: 'visible' });
    await dlg
      .getByRole('button', { name: /Poser une question simple/ })
      .waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  });

  await assert('On crée trois demandes de document (via Nouvelle mission)', async () => {
    await askDoc(L_COMMENT, 'Justificatif d’acompte');
    await askDoc(L_DOC, 'Diagnostic');
    await askDoc(L_BOTH, 'RIB');
    // Le conducteur les suit dans « Documents demandés au client » (En attente).
    await openConducteurDocuments();
    const sec = demandesSection();
    for (const l of [L_COMMENT, L_DOC, L_BOTH]) {
      await sec
        .locator('li')
        .filter({ hasText: l })
        .first()
        .getByText('En attente')
        .waitFor({ state: 'visible', timeout: 6000 });
    }
  });

  await assert('CLIENT — les trois demandes apparaissent dans « Aujourd’hui »', async () => {
    await openClientTab(page);
    await demandeCard(L_COMMENT).waitFor({ state: 'visible', timeout: 6000 });
    await demandeCard(L_DOC).waitFor({ state: 'visible', timeout: 6000 });
    await demandeCard(L_BOTH).waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('CLIENT — répond avec un COMMENTAIRE SEUL', async () => {
    const card = demandeCard(L_COMMENT);
    await card.getByRole('button', { name: /joindre un document/i }).click();
    await card.getByPlaceholder(/Ajouter un commentaire/).fill('Virement effectué ce matin.');
    await card.getByRole('button', { name: 'Envoyer' }).click();
    await demandeCard(L_COMMENT).waitFor({ state: 'detached', timeout: 6000 });
  });

  await assert('CLIENT — répond avec un FICHIER SEUL', async () => {
    const card = demandeCard(L_DOC);
    await card.getByRole('button', { name: /joindre un document/i }).click();
    await card.locator('[data-testid="client-doc-file"]').setInputFiles(PDF);
    await card.getByRole('button', { name: new RegExp(PDF.name) }).waitFor({ timeout: 6000 });
    await card.getByRole('button', { name: 'Envoyer' }).click();
    await demandeCard(L_DOC).waitFor({ state: 'detached', timeout: 6000 });
  });

  await assert('CLIENT — répond avec un FICHIER + COMMENTAIRE', async () => {
    const card = demandeCard(L_BOTH);
    await card.getByRole('button', { name: /joindre un document/i }).click();
    await card.locator('[data-testid="client-doc-file"]').setInputFiles(IMG);
    await card.getByRole('button', { name: new RegExp(IMG.name) }).waitFor({ timeout: 6000 });
    await card.getByPlaceholder(/Ajouter un commentaire/).fill('Voici mon RIB.');
    await card.getByRole('button', { name: 'Envoyer' }).click();
    await demandeCard(L_BOTH).waitFor({ state: 'detached', timeout: 6000 });
  });

  await assert(
    'CLIENT — retrouve ses documents dans « Documents » (ouvrir + télécharger)',
    async () => {
      await openClientTab(page, 'Documents');
      for (const label of [L_DOC, L_BOTH]) {
        const rowDoc = page.locator('#section-documents li').filter({ hasText: label }).first();
        await rowDoc.waitFor({ state: 'visible', timeout: 6000 });
        await rowDoc
          .getByRole('button', { name: 'Ouvrir le document' })
          .waitFor({ state: 'visible' });
        await rowDoc
          .getByRole('button', { name: new RegExp(`Télécharger : ${label}`) })
          .waitFor({ state: 'visible' });
      }
      // Le commentaire SEUL n'a créé AUCUN document.
      if ((await page.locator('#section-documents li').filter({ hasText: L_COMMENT }).count()) > 0)
        throw new Error('un document a été créé pour une réponse « commentaire seul »');
      // Client-safe : le document interne seedé ne fuit jamais.
      if ((await page.getByText(INTERNE, { exact: false }).count()) > 0)
        throw new Error('un document interne fuit dans l’espace client');
    },
  );

  await assert('CLIENT — un document envoyé s’OUVRE réellement (blob)', async () => {
    const rowDoc = page.locator('#section-documents li').filter({ hasText: L_DOC }).first();
    const pagePromise = ctx.waitForEvent('page', { timeout: 6000 });
    await rowDoc.getByRole('button', { name: 'Ouvrir le document' }).click();
    const tab = await pagePromise;
    if (!tab.url().startsWith('blob:')) throw new Error(`ouverture invalide (url=${tab.url()})`);
    await tab.close();
  });

  await assert('CONDUCTEUR — notifications de réponse dans « Aujourd’hui »', async () => {
    await openConducteurAujourdhui();
    await notifs()
      .getByRole('button', { name: new RegExp(`a envoyé : ${L_DOC}`) })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await notifs()
      .getByRole('button', { name: new RegExp(`a envoyé : ${L_BOTH}`) })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await notifs()
      .getByRole('button', { name: /a répondu à votre demande de document/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('CONDUCTEUR — la demande passe en « Reçu » + document consultable', async () => {
    await openConducteurDocuments();
    const sec = demandesSection();
    // Fichier fourni → « Reçu » ; commentaire seul → « Répondu ».
    await sec
      .locator('li')
      .filter({ hasText: L_DOC })
      .first()
      .getByText('Reçu')
      .waitFor({ state: 'visible', timeout: 6000 });
    await sec
      .locator('li')
      .filter({ hasText: L_COMMENT })
      .first()
      .getByText('Répondu')
      .waitFor({ state: 'visible', timeout: 6000 });
    // Le document reçu est ouvrable + téléchargeable côté conducteur.
    const row = sec.locator('li').filter({ hasText: L_DOC }).first();
    await row.getByRole('button', { name: 'Ouvrir le document' }).waitFor({ state: 'visible' });
    await row
      .getByRole('button', { name: new RegExp(`Télécharger : ${L_DOC}`) })
      .waitFor({ state: 'visible' });
  });

  await assert('CONDUCTEUR — le clic notification ouvre « Documents »', async () => {
    await openConducteurAujourdhui();
    await notifs()
      .getByRole('button', { name: new RegExp(`a envoyé : ${L_DOC}`) })
      .first()
      .click();
    await page
      .getByRole('tab', { name: 'Documents', selected: true })
      .waitFor({ state: 'visible', timeout: 6000 });
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
