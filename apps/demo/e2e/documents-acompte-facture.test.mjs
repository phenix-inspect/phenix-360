/**
 * RC1 — Acompte + Facture finale (sans formulaire d'ajout dans Documents).
 * ===========================================================================
 * L'ajout d'un document passe EXCLUSIVEMENT par « Nouvelle mission » ; l'onglet
 * Documents ne sert qu'à consulter/filtrer. On vérifie que :
 *  • l'acompte se valide depuis la check-list de préparation (« Marquer comme payé »),
 *    source unique de la règle « Acompte payé » ;
 *  • une facture ajoutée via Nouvelle mission rejoint la bibliothèque et se FILTRE
 *    (famille « Factures ») ;
 *  • la facture n'est JAMAIS bloquante au démarrage (toujours 3 obligatoires) ;
 *  • client-safe : interne invisible / partagé visible côté client.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';
import { phenixDevisPdf } from './pdf-fixtures.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const pdf = (name) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(`%PDF-1.4 ${name}`),
});
const FACTURE_PDF = pdf('facture-finale.pdf');
const FACTURE_SHARED_PDF = pdf('facture-partagee.pdf');

const acompteRow = () => page.locator('li').filter({ hasText: 'Acompte payé' }).first();

/** Ajoute un document via l'UNIQUE point d'entrée « Nouvelle mission ». */
const addViaMission = async (libelle, visibilityLabel, file) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('button', { name: /Ajouter un document/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Libellé du document').fill(libelle);
  await dlg.locator('input[type=file]').setInputFiles(file);
  await dlg.getByText(file.name).first().waitFor({ state: 'visible', timeout: 6000 });
  await dlg.locator('select').selectOption({ label: visibilityLabel });
  await dlg.getByRole('button', { name: 'Publier' }).click();
  await dlg.waitFor({ state: 'hidden', timeout: 6000 });
};

try {
  await openDemo(page);

  // Nouveau chantier (Jean Testeur) : l'acompte n'est PAS encore validé.
  await page.getByRole('button', { name: 'Gérer' }).click();
  await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
  await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles([
      { name: 'Devis.pdf', mimeType: 'application/pdf', buffer: phenixDevisPdf({}) },
    ]);
  await page.getByRole('button', { name: /Préparer mon chantier/ }).click();
  await page.getByRole('button', { name: /Entrer dans le chantier/ }).click();
  await page
    .getByRole('heading', { name: /Jean Testeur/ })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('tab', { name: /Préparation/ }).click();

  await assert('Départ : « Acompte payé » n’est pas validé', async () => {
    await acompteRow()
      .getByRole('button', { name: 'Marquer comme payé' })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('« Marquer comme payé » valide la check-list « Acompte payé »', async () => {
    await acompteRow().getByRole('button', { name: 'Marquer comme payé' }).click();
    await acompteRow()
      .getByRole('button', { name: 'Annuler' })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Ajouter une facture finale INTERNE via Nouvelle mission', async () => {
    await addViaMission('Facture finale interne', 'Interne', FACTURE_PDF);
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page.getByRole('tab', { name: 'Documents', exact: true }).click();
    await page
      .getByText('Facture finale interne')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Facture finale NON bloquante (toujours 3 éléments obligatoires)', async () => {
    await page.getByRole('tab', { name: 'Préparation', exact: true }).click();
    await page
      .getByText(/\/\s*3 éléments obligatoires validés/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    if ((await acompteRow().count()) === 0) throw new Error('checklist de partage introuvable');
  });

  // Rendre le dossier partageable (3 bloquants) pour ouvrir l'espace client.
  await assert('Dossier partageable après date officielle', async () => {
    await page.getByLabel('Date officielle de démarrage').fill('2026-10-05');
    await page
      .getByText('Prêt à partager au client')
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Publier une facture PARTAGÉE au client (via Nouvelle mission)', async () => {
    await addViaMission('Facture finale partagee', 'Client', FACTURE_SHARED_PDF);
  });

  await assert('Client-safe : la facture PARTAGÉE est visible côté client', async () => {
    await openClientTab(page, 'Documents');
    await page
      .locator('#section-documents')
      .getByText('Facture finale partagee', { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });
  });

  await assert('Client-safe : la facture INTERNE reste invisible côté client', async () => {
    if ((await page.getByText('Facture finale interne', { exact: false }).count()) > 0)
      throw new Error('la facture interne fuit dans l’espace client');
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
