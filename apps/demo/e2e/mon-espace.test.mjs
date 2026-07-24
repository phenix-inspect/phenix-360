/**
 * « Mon espace » client + bandeau cookies (première connexion).
 * ===========================================================================
 * Le client gère son ACCÈS (code), ses INVITÉS et ses PRÉFÉRENCES sans quitter
 * l'UX premium. À la première connexion, un bandeau cookies simple s'affiche,
 * son consentement est stocké localement et il ne réapparaît plus.
 */
import { launch, session, harness, openDemo, URL } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const openClient = async () => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
};
const openMonEspace = async () => {
  await openClient();
  await page.getByRole('tab', { name: 'Mon espace' }).click();
  await page.getByRole('heading', { name: 'Accès au chantier' }).waitFor({ state: 'visible' });
};

/** Entrée « fraîche » SANS pré-accepter les cookies (pour tester le bandeau). */
const openFresh = async () => {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page
    .getByRole('button', { name: /Découvrir la démo/ })
    .click()
    .catch(() => {});
  await page.getByRole('heading', { name: /Bonjour Mickaël/ }).waitFor({ timeout: 15000 });
};

const banner = () => page.getByRole('dialog', { name: 'Cookies et confidentialité' });

try {
  // ======================= 1. BANDEAU COOKIES ============================
  await openFresh();
  await openClient();

  await assert('Première connexion : le bandeau cookies est visible', async () => {
    await banner().waitFor({ state: 'visible', timeout: 6000 });
    await banner()
      .getByText(/cookies nécessaires au bon fonctionnement/i)
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('« En savoir plus » détaille sans fermer le bandeau', async () => {
    await banner().getByRole('button', { name: 'En savoir plus' }).click();
    await banner()
      .getByText(/aucun cookie publicitaire/i)
      .waitFor({ state: 'visible', timeout: 5000 });
    if ((await banner().count()) === 0) throw new Error('le bandeau a disparu sans acceptation');
  });

  await assert('« Accepter » fait disparaître le bandeau', async () => {
    await banner().getByRole('button', { name: 'Accepter' }).click();
    await banner().waitFor({ state: 'detached', timeout: 5000 });
  });

  await assert('Le bandeau ne revient pas après rechargement', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await openClient();
    await page.waitForTimeout(400);
    if ((await banner().count()) > 0) throw new Error('le bandeau cookies est réapparu au reload');
  });

  await assert('« Mon espace » indique les cookies acceptés', async () => {
    await openMonEspace();
    await page
      .getByText(/Cookies nécessaires acceptés/i)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  // ======================= 2. ACCÈS / CODE ==============================
  // À partir d'ici, entrée standard (cookies déjà pré-acceptés par le harness).
  await openDemo(page);
  await openMonEspace();

  await assert('Le code d’accès est masqué par défaut', async () => {
    const code = await page.getByTestId('code-affiche').innerText();
    if (!/^•+$/.test(code.trim())) throw new Error(`le code n’est pas masqué : « ${code} »`);
  });

  await assert('Un code trop court est refusé', async () => {
    await page.getByRole('button', { name: /Modifier mon code/ }).click();
    const dlg = page.getByRole('dialog', { name: /Modifier mon code/ });
    await dlg.getByLabel('Nouveau code d’accès').fill('123');
    await dlg.getByLabel('Confirmer le code').fill('123');
    await dlg.getByRole('button', { name: /Enregistrer le code/ }).click();
    await dlg.getByText(/doit contenir au moins 6/i).waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Deux codes différents sont refusés', async () => {
    const dlg = page.getByRole('dialog', { name: /Modifier mon code/ });
    await dlg.getByLabel('Nouveau code d’accès').fill('secret123');
    await dlg.getByLabel('Confirmer le code').fill('secret999');
    await dlg.getByRole('button', { name: /Enregistrer le code/ }).click();
    await dlg.getByText(/ne correspondent pas/i).waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Modification du code → message de succès', async () => {
    const dlg = page.getByRole('dialog', { name: /Modifier mon code/ });
    await dlg.getByLabel('Nouveau code d’accès').fill('monNouveauCode2026');
    await dlg.getByLabel('Confirmer le code').fill('monNouveauCode2026');
    await dlg.getByRole('button', { name: /Enregistrer le code/ }).click();
    await dlg.waitFor({ state: 'detached', timeout: 5000 });
    await page
      .getByText(/code d’accès a été mis à jour/i)
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  // ======================= 3. INVITATIONS ===============================
  await assert('Inviter une personne → elle apparaît dans la liste', async () => {
    await page.getByLabel('Prénom').fill('Camille');
    await page.getByLabel('Nom', { exact: true }).fill('Martin');
    await page.getByLabel('Email').fill('camille@example.com');
    await page.getByLabel('Rôle').fill('Conjoint');
    await page.getByRole('button', { name: 'Inviter', exact: true }).click();
    const row = page.locator('li').filter({ hasText: 'camille@example.com' });
    await row.waitFor({ state: 'visible', timeout: 5000 });
    await row.getByText('Invité').first().waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Retirer l’accès → la personne disparaît', async () => {
    const row = page.locator('li').filter({ hasText: 'camille@example.com' });
    await row.getByRole('button', { name: /Retirer l.acc/ }).click();
    await row.waitFor({ state: 'detached', timeout: 5000 });
  });

  // ======================= 4. NOTIFICATIONS =============================
  await assert('Les préférences de notification se basculent sans crash', async () => {
    const photos = page.getByRole('switch', { name: 'Nouvelles photos' });
    const before = await photos.getAttribute('aria-checked');
    await photos.click();
    await page.waitForTimeout(150);
    const after = await photos.getAttribute('aria-checked');
    if (before === after) throw new Error('le toggle « Nouvelles photos » n’a pas changé d’état');
    // On rebascule un autre toggle pour vérifier la robustesse.
    await page.getByRole('switch', { name: 'Rappel avant réception' }).click();
    await page.waitForTimeout(150);
  });

  await assert('Sécurité : la mention de confidentialité est présente', async () => {
    await page.getByText(/Votre espace est privé/i).waitFor({ state: 'visible', timeout: 5000 });
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
