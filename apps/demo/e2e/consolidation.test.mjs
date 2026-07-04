/**
 * Consolidation 1 — Contacts base unique. Réserve.responsable, Commande.
 * fournisseur et l'identité client référencent l'annuaire (plus de texte libre) ;
 * les intervenants du chantier sont des Contacts. Client-safe préservé.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { guardDeepLinks: true });
const { assert, summary } = harness();

try {
  await openDemo(page);
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();

  await assert(
    'Intervenants = Carnet unique : artisans/fournisseurs sont des Contacts',
    async () => {
      await page.getByRole('tab', { name: 'Préparation' }).click();
      await page
        .getByRole('heading', { name: 'Intervenants du chantier' })
        .scrollIntoViewIfNeeded();
      if ((await page.getByLabel(/Nom — Artisans/).count()) > 0)
        throw new Error('champ intervenant texte encore présent');
      for (const n of ['Karim Bouaziz', 'Élec Pro', 'Carrelage Lyonnais', 'Showroom Mobalpa']) {
        await page
          .getByText(n, { exact: false })
          .first()
          .waitFor({ state: 'visible', timeout: 5000 });
      }
    },
  );

  await assert('Réserve : le responsable est un CONTACT (lien réel, pas du texte)', async () => {
    await page.getByRole('tab', { name: /^Réserves/ }).click();
    await page
      .getByRole('heading', { name: 'Réserves du chantier' })
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /Nouvelle réserve/ }).click();
    await page.getByLabel('Description de la réserve').fill('Reprise étanchéité douche');
    const sel = page.getByLabel('Responsable', { exact: true });
    const optVal = await sel.locator('option', { hasText: 'Karim Bouaziz' }).getAttribute('value');
    await sel.selectOption(optVal);
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.getByText('Responsable :').first().waitFor({ state: 'visible', timeout: 5000 });
    await page
      .getByText(/Joindre .*Karim Bouaziz/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Réserve seedée : responsable relié à Élec Pro (join direct)', async () => {
    await page
      .getByText(/Joindre .*Élec Pro/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Commande : le fournisseur est un CONTACT (sélecteur, pas du texte)', async () => {
    await page.getByRole('tab', { name: 'Préparation' }).click();
    await page.getByRole('heading', { name: 'Commandes' }).scrollIntoViewIfNeeded();
    const orderCard = page
      .locator('.space-y-2.rounded-lg')
      .filter({ hasText: 'Carrelage salle de bain' })
      .first();
    await orderCard.getByRole('button', { name: /Détails/ }).click();
    const dialog = page.getByRole('dialog');
    const sel = dialog.getByLabel('Fournisseur', { exact: true });
    const optVal = await sel.locator('option', { hasText: 'Mobalpa' }).getAttribute('value');
    await sel.selectOption(optVal);
    await dialog.getByRole('button', { name: /Enregistrer la commande/ }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await page
      .getByText('Showroom Mobalpa Lyon')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Client : identité éditée une seule fois, sur son Contact', async () => {
    await page
      .getByRole('heading', { name: 'Coordonnées & accès client' })
      .scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Modifier le client' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom du contact').fill('Mme Martin-Durand');
    await dialog.getByRole('button', { name: /Enregistrer/ }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.getByText('Mme Martin-Durand').first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Client-safe : contacts/responsable/fournisseur ne fuient pas', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(500);
    for (const secret of [
      'Karim Bouaziz',
      'Élec Pro',
      'Showroom Mobalpa',
      'Responsable :',
      'Reprise étanchéité',
    ]) {
      if ((await page.getByText(secret, { exact: false }).count()) > 0)
        throw new Error(`fuite côté client : « ${secret} »`);
    }
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
