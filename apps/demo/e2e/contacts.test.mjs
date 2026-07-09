/**
 * Communication & contacts — les contacts restent utilisables AILLEURS que dans
 * la Préparation (la section « Intervenants du chantier » a été retirée). Le
 * responsable d'une réserve EST un contact : on le joint en un geste depuis les
 * Réserves (Appeler / SMS / WhatsApp / Mail, deep-links natifs), message
 * pré-rempli, client-safe strict.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { guardDeepLinks: true });
const { assert, summary } = harness();

// Le bloc « Joindre {contact} » d'une réserve (ContactActions du responsable).
const joindre = page.locator('div.border-dashed').filter({ hasText: 'Élec Pro' }).first();

try {
  await openDemo(page);
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
  // Plus d'onglet « Réserves » : le responsable d'une réserve se joint depuis le
  // Suivi (la réserve y figure comme événement du Journal).
  await page.getByRole('tab', { name: 'Suivi', exact: true }).click();
  const voir = page.getByRole('button', { name: /Voir tout le journal/ });
  if (await voir.count()) await voir.first().click();

  await assert('Le responsable de la réserve seedée est joignable (contact vivant)', async () => {
    await joindre.waitFor({ state: 'visible', timeout: 6000 });
    await joindre
      .getByText(/Joindre/)
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Actions de communication présentes (Appeler / SMS / WhatsApp / Mail)', async () => {
    await joindre
      .getByRole('link', { name: 'Appeler' })
      .waitFor({ state: 'visible', timeout: 5000 });
    await joindre.getByRole('button', { name: 'SMS' }).waitFor({ state: 'visible', timeout: 4000 });
    await joindre
      .getByRole('button', { name: 'WhatsApp' })
      .waitFor({ state: 'visible', timeout: 4000 });
    await joindre
      .getByRole('button', { name: 'Mail' })
      .waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('« Appeler » est un deep-link tel: natif', async () => {
    const href = await joindre.getByRole('link', { name: 'Appeler' }).getAttribute('href');
    if (!href || !href.startsWith('tel:')) throw new Error('href tel: attendu, reçu : ' + href);
  });

  await assert('Composer SMS : message pré-rempli, deep-link sms:', async () => {
    await joindre.getByRole('button', { name: 'SMS' }).click();
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

  await assert('Client-safe : aucun contact ni communication ne fuit', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(600);
    for (const secret of [
      'Élec Pro',
      'Karim Bouaziz',
      'SARL Aqua',
      'Showroom Mobalpa',
      '06 33 21',
      'Joindre',
      'Réserve n°',
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
