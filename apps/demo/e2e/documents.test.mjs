/**
 * RC1 — Documents = bibliothèque de CONSULTATION. Un document s'ajoute UNIQUEMENT
 * via « Nouvelle mission → Ajouter un document » (plus aucun formulaire dans
 * l'onglet Documents) ; il rejoint la bibliothèque ET le Journal (base unique).
 * Client-safe : un document interne ne fuit pas côté client.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const PDF = {
  name: 'attestation-tva.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 test tva'),
};
const DOC = 'Attestation TVA réduite';

const browser = await launch();
const { page, consoleErrors } = await session(browser);
const { assert, summary } = harness();

/** Ajoute un document via l'UNIQUE point d'entrée : « Nouvelle mission ». */
const addViaMission = async (libelle, visibilityLabel) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('button', { name: /Ajouter un document/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Libellé du document').fill(libelle);
  await dlg.locator('input[type=file]:not([capture])').setInputFiles(PDF);
  await dlg.getByText(PDF.name).first().waitFor({ state: 'visible', timeout: 6000 });
  await dlg.locator('select').selectOption({ label: visibilityLabel });
  await dlg.getByRole('button', { name: 'Publier' }).click();
  await dlg.waitFor({ state: 'hidden', timeout: 6000 });
};

try {
  await openDemo(page);
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();

  await assert('L’onglet Documents n’a PLUS de formulaire d’ajout', async () => {
    await page.getByRole('tab', { name: 'Documents', exact: true }).click();
    await page.getByRole('heading', { name: /Bibliothèque du chantier/ }).waitFor({
      state: 'visible',
      timeout: 6000,
    });
    for (const gone of ['Ajouter le document', 'Libellé du document']) {
      if ((await page.getByLabel(gone).count()) + (await page.getByText(gone).count()) > 0)
        throw new Error(`le formulaire d’ajout subsiste : « ${gone} »`);
    }
  });

  await assert('Ajouter un document via « Nouvelle mission » (interne)', async () => {
    await addViaMission(DOC, 'Interne');
    await page.getByRole('tab', { name: 'Documents', exact: true }).click();
    await page.getByRole('heading', { name: /Bibliothèque du chantier/ }).scrollIntoViewIfNeeded();
    await page.getByText(DOC).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Le document est CONSULTABLE (ouvrir + télécharger)', async () => {
    const row = page.locator('li').filter({ hasText: DOC }).first();
    await row.getByRole('button', { name: 'Ouvrir le document' }).waitFor({ state: 'visible' });
    await row
      .getByRole('button', { name: new RegExp(`Télécharger : ${DOC}`) })
      .waitFor({ state: 'visible' });
  });

  await assert('Base UNIQUE : le document remonte au Journal (Suivi)', async () => {
    await page.getByRole('tab', { name: 'Suivi', exact: true }).click();
    await page
      .getByRole('button', { name: /Voir tout le journal/ })
      .click()
      .catch(() => {});
    await page.getByText(DOC).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Client-safe : un document interne ne fuit pas côté client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(600);
    if ((await page.getByText(DOC, { exact: false }).count()) > 0)
      throw new Error('fuite du document interne côté client');
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
