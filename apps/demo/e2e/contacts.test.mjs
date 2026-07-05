/**
 * EPIC Communication & Contacts. Carnet du chantier, actions de communication
 * (deep-links natifs), journalisation tracée par contact, annuaire global
 * (recherche + filtre + création liée), client-safe strict.
 */
import { launch, session, harness, openDemo, contactCard } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { guardDeepLinks: true });
const { assert, summary } = harness();
const card = (name) => contactCard(page, name);

try {
  await openDemo(page);
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
  await page.getByRole('tab', { name: 'Préparation' }).click();

  await assert('Carnet du chantier : contacts seedés présents', async () => {
    await page.getByRole('heading', { name: 'Intervenants du chantier' }).scrollIntoViewIfNeeded();
    for (const n of ['Mme Martin', 'Karim Bouaziz', 'Showroom Mobalpa']) {
      await page
        .getByText(n, { exact: false })
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
    }
  });

  await assert('Actions de communication présentes (Appeler / SMS / WhatsApp / Mail)', async () => {
    const c = card('Karim Bouaziz');
    await c.getByRole('link', { name: 'Appeler' }).waitFor({ state: 'visible', timeout: 5000 });
    await c.getByRole('button', { name: 'SMS' }).waitFor({ state: 'visible', timeout: 4000 });
    await c.getByRole('button', { name: 'WhatsApp' }).waitFor({ state: 'visible', timeout: 4000 });
    await c.getByRole('button', { name: 'Mail' }).waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Appeler TRACE la communication (historique du contact)', async () => {
    await card('Karim Bouaziz')
      .getByRole('link', { name: 'Appeler' })
      .click({ noWaitAfter: true })
      .catch(() => {});
    await page.waitForTimeout(400);
    const c = card('Karim Bouaziz');
    await c.getByRole('button', { name: /Historique des échanges/ }).click();
    await c.getByText(/Appel · Karim Bouaziz/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Composer SMS : message pré-rempli, deep-link sms:', async () => {
    const c = card('Mme Martin');
    await c.getByRole('button', { name: 'SMS' }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('combobox', { name: 'Modèle de message' })
      .waitFor({ state: 'visible', timeout: 4000 });
    const open = dialog.getByRole('link', { name: /Ouvrir SMS/ });
    const href = await open.getAttribute('href');
    if (!href || !href.startsWith('sms:')) throw new Error('href SMS attendu, reçu : ' + href);
    await open.click({ noWaitAfter: true }).catch(() => {});
    await dialog.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});
  });

  await assert('Carnet : LIER un contact global (non rattaché) au chantier', async () => {
    // Les contacts restent accessibles DANS le chantier : « Lier un contact »
    // permet de rattacher un contact global (ex. « Cabinet Vitruve ») au chantier.
    await page.getByRole('button', { name: /Lier un contact/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByText('Cabinet Vitruve')
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    await dialog
      .locator('li', { hasText: 'Cabinet Vitruve' })
      .getByRole('button', { name: /Lier/ })
      .click();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});
    await page.getByRole('heading', { name: 'Intervenants du chantier' }).scrollIntoViewIfNeeded();
    await page.getByText('Cabinet Vitruve').first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Carnet : CRÉER un contact dans le chantier → visible au Carnet', async () => {
    await page.getByRole('button', { name: /Nouveau contact/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom du contact').fill('Éric Peinture');
    await dialog.getByLabel('Rôle du contact').selectOption('artisan');
    await dialog.getByPlaceholder('06 12 34 56 78').fill('06 99 88 77 66');
    await dialog.getByRole('button', { name: /Créer le contact/ }).click();
    await card('Éric Peinture').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('heading', { name: 'Intervenants du chantier' }).scrollIntoViewIfNeeded();
    await page.getByText('Éric Peinture').first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Client-safe : aucun contact ni communication ne fuit', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(600);
    for (const secret of [
      'Karim Bouaziz',
      'SARL Aqua',
      'Showroom Mobalpa',
      'Éric Peinture',
      '06 45 12',
      'Appel ·',
      'Historique des échanges',
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
