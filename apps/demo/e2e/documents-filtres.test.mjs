/**
 * RC1 — Documents : CONSULTATION uniquement + FILTRES par type.
 * ===========================================================================
 * Un onglet Documents = on consulte, on recherche, on ouvre, on télécharge — on ne
 * crée RIEN. On garantit que :
 *   • le formulaire d'ajout n'existe plus dans Documents (conducteur) ;
 *   • l'ajout fonctionne UNIQUEMENT via « Nouvelle mission » ;
 *   • les filtres par type fonctionnent côté Conducteur ;
 *   • les filtres par type fonctionnent côté Client (comportement identique) ;
 *   • le filtrage NE MODIFIE PAS les données (retour « Tous » = liste intacte) ;
 *   • zéro régression ; zéro erreur console.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const pdf = (name) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(`%PDF-1.4 ${name}`),
});
const FACTURE = 'Facture finale du chantier';
const AVENANT = 'Avenant plomberie signe';

const library = () => page.locator('ul.divide-y').last();
const filters = () => page.getByRole('tablist', { name: /Filtrer les documents/ });

/** Ajoute un document via l'UNIQUE point d'entrée « Nouvelle mission ». */
const addViaMission = async (libelle, visibilityLabel, file) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('button', { name: /Ajouter un document/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Libellé du document').fill(libelle);
  await dlg.locator('input[type=file]:not([capture])').setInputFiles(file);
  await dlg.getByText(file.name).first().waitFor({ state: 'visible', timeout: 6000 });
  await dlg.locator('select').selectOption({ label: visibilityLabel });
  await dlg.getByRole('button', { name: 'Publier' }).click();
  await dlg.waitFor({ state: 'hidden', timeout: 6000 });
};

const openDocuments = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await page
    .getByRole('heading', { name: /Bibliothèque du chantier/ })
    .waitFor({ state: 'visible', timeout: 6000 });
};

try {
  await openDemo(page);
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();

  await assert('CONDUCTEUR — l’onglet Documents n’a PLUS de formulaire d’ajout', async () => {
    await openDocuments();
    for (const gone of ['Ajouter le document', 'Libellé du document', 'prep-doc-file']) {
      if (
        (await page.getByLabel(gone).count()) +
          (await page.getByText(gone).count()) +
          (await page.locator(`[data-testid="${gone}"]`).count()) >
        0
      )
        throw new Error(`le formulaire d’ajout subsiste : « ${gone} »`);
    }
  });

  await assert('CONDUCTEUR — l’ajout ne fonctionne QUE via « Nouvelle mission »', async () => {
    await addViaMission(FACTURE, 'Client', pdf('facture.pdf'));
    await addViaMission(AVENANT, 'Client', pdf('avenant.pdf'));
    await openDocuments();
    await page.getByText(FACTURE).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(AVENANT).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  // Comptage de référence (données intactes attendues après filtrage).
  const totalConducteur = await library().locator('li').count();

  await assert('CONDUCTEUR — filtre « Factures » n’affiche que les factures', async () => {
    await filters()
      .getByRole('tab', { name: /^Factures/ })
      .click();
    await page.getByText(FACTURE).first().waitFor({ state: 'visible', timeout: 5000 });
    if ((await page.getByText(AVENANT).count()) > 0)
      throw new Error('l’avenant apparaît sous le filtre « Factures »');
    if ((await library().locator('li').count()) !== 1)
      throw new Error('le filtre « Factures » devrait isoler une seule ligne');
  });

  await assert('CONDUCTEUR — filtre « Avenants » n’affiche que les avenants', async () => {
    await filters()
      .getByRole('tab', { name: /^Avenants/ })
      .click();
    await page.getByText(AVENANT).first().waitFor({ state: 'visible', timeout: 5000 });
    if ((await page.getByText(FACTURE).count()) > 0)
      throw new Error('la facture apparaît sous le filtre « Avenants »');
  });

  await assert('CONDUCTEUR — le filtrage NE MODIFIE PAS les données', async () => {
    // Retour à « Tous » : la liste est strictement identique au départ.
    await filters().getByRole('tab', { name: /^Tous/ }).click();
    const back = await library().locator('li').count();
    if (back !== totalConducteur)
      throw new Error(`données altérées par le filtre : ${totalConducteur} → ${back}`);
    await page.getByText(FACTURE).first().waitFor({ state: 'visible', timeout: 4000 });
    await page.getByText(AVENANT).first().waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('CLIENT — le même filtre existe et isole les factures', async () => {
    await openClientTab(page, 'Documents');
    await page
      .getByRole('heading', { name: 'Vos documents' })
      .waitFor({ state: 'visible', timeout: 6000 });
    const clientFilters = page.getByRole('tablist', { name: /Filtrer les documents/ });
    await clientFilters.getByRole('tab', { name: /^Factures/ }).click();
    await page
      .locator('#section-documents')
      .getByText(FACTURE)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    if ((await page.locator('#section-documents').getByText(AVENANT).count()) > 0)
      throw new Error('l’avenant fuit sous le filtre client « Factures »');
  });

  await assert(
    'CLIENT — retour « Tous » restaure la liste complète (données intactes)',
    async () => {
      const clientFilters = page.getByRole('tablist', { name: /Filtrer les documents/ });
      await clientFilters.getByRole('tab', { name: /^Tous/ }).click();
      await page
        .locator('#section-documents')
        .getByText(FACTURE)
        .first()
        .waitFor({ state: 'visible', timeout: 4000 });
      await page
        .locator('#section-documents')
        .getByText(AVENANT)
        .first()
        .waitFor({ state: 'visible', timeout: 4000 });
      // Un document seedé demeure lui aussi (non-régression).
      await page
        .locator('#section-documents')
        .getByText('Plan de la salle de bain')
        .first()
        .waitFor({ state: 'visible', timeout: 4000 });
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
