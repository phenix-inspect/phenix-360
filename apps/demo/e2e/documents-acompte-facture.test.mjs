/**
 * RC1 — Catégories documents : Acompte + Facture finale.
 * ===========================================================================
 * Sans nouvel écran ni concept : deux catégories de documents en plus.
 *  • déposer un document de type « Acompte » ou « Facture finale » ;
 *  • un document classé « Acompte » (peu importe son libellé) valide la
 *    checklist « Acompte reçu » (source unique de la règle) ;
 *  • la facture finale n'est PAS bloquante au démarrage (toujours 3 obligatoires) ;
 *  • client-safe inchangé : interne → invisible côté client ; partagé → visible.
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { phenixDevisPdf } from './pdf-fixtures.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const pdf = (name) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(`%PDF-1.4 ${name}`),
});
const ACOMPTE_PDF = pdf('preuve-acompte.pdf');
const FACTURE_PDF = pdf('facture-finale.pdf');
const FACTURE_SHARED_PDF = pdf('facture-partagee.pdf');

const acompteRow = () => page.locator('li').filter({ hasText: 'Acompte payé' }).first();

/** Dépose un document de préparation (libellé + catégorie + fichier réel). */
const addPrepDoc = async (libelle, typeLabel, file) => {
  await page.getByRole('heading', { name: /^Documents/ }).scrollIntoViewIfNeeded();
  await page.getByLabel('Libellé du document').fill(libelle);
  await page.getByLabel('Type de document').selectOption({ label: typeLabel });
  await page.setInputFiles('[data-testid="prep-doc-file"]', file);
  // Attendre que le fichier soit lu (le bouton « Joindre » affiche son nom).
  await page.getByRole('button', { name: new RegExp(file.name) }).waitFor({ timeout: 6000 });
  await page.getByRole('button', { name: /Ajouter le document/ }).click();
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

  await assert('Départ : « Acompte reçu » n’est pas validé', async () => {
    await acompteRow()
      .getByRole('button', { name: 'Marquer comme payé' })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Ajouter un document de type « Acompte » (fichier réel)', async () => {
    // Libellé SANS le mot « acompte » : c'est la CATÉGORIE qui doit compter.
    await addPrepDoc('Preuve de versement 30%', 'Acompte', ACOMPTE_PDF);
    const row = page.locator('li').filter({ hasText: 'Preuve de versement 30%' }).first();
    await row.getByText('Acompte', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });
    await row.getByText('Fourni').waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('La checklist « Acompte reçu » passe validée (via la catégorie)', async () => {
    await acompteRow()
      .getByRole('button', { name: 'Annuler' })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Ajouter un document de type « Facture finale » → documents internes', async () => {
    await addPrepDoc('Facture finale interne', 'Facture finale', FACTURE_PDF);
    const row = page.locator('li').filter({ hasText: 'Facture finale interne' }).first();
    await row
      .getByText('Facture finale', { exact: true })
      .waitFor({ state: 'visible', timeout: 5000 });
    await row.getByText('Fourni').waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Facture finale NON bloquante (toujours 3 éléments obligatoires)', async () => {
    // La facture n'entre jamais dans les bloquants de partage (devis/acompte/date).
    await page
      .getByText(/\/\s*3 éléments obligatoires validés/)
      .first()
      .waitFor({
        state: 'visible',
        timeout: 5000,
      });
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

  // Partager UN document au client (chemin existant : composer « Ajouter un document »).
  await assert('Publier une facture PARTAGÉE au client', async () => {
    await page.getByRole('tab', { name: 'Suivi', exact: true }).click();
    await page.getByRole('button', { name: 'Ajouter un document' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Libellé du document').fill('Facture finale partagee');
    await dlg.locator('input[type=file]').setInputFiles(FACTURE_SHARED_PDF);
    await dlg.getByText('facture-partagee.pdf').waitFor({ state: 'visible', timeout: 6000 });
    // Visibilité « Client » par défaut — on publie.
    await dlg.getByRole('button', { name: 'Publier' }).click();
    await dlg.waitFor({ state: 'hidden', timeout: 6000 });
  });

  await assert('Client-safe : la facture PARTAGÉE est visible côté client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
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

  await assert(
    'Non-régression : les deux documents restent dans les documents internes',
    async () => {
      await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
      await page.getByRole('tab', { name: /Préparation/ }).click();
      await page
        .getByText('Preuve de versement 30%')
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
      await page
        .getByText('Facture finale interne')
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
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
