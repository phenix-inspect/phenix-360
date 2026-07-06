/**
 * RC1 — L'assistant IA a le VISAGE de Léon (plus de casque de chantier).
 * ===========================================================================
 * Le bouton flottant ET la fenêtre de chat utilisent EXACTEMENT le même avatar
 * (l'image de Léon), pour que le conducteur comme le client comprennent tout de
 * suite qu'ils parlent à Léon, l'assistant PHÉNIX. On vérifie que l'image se
 * charge réellement (pas le repli) et que bouton + chat partagent le même `src`.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 1400 });
const { assert, summary } = harness();

const openBtn = () => page.getByRole('button', { name: 'Ouvrir PHÉNIX' });
const naturalWidth = (loc) => loc.evaluate((el) => el.naturalWidth);

let buttonSrc = null;

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await openBtn().waitFor({ state: 'visible', timeout: 8000 });

  await assert('Le bouton flottant affiche l’avatar de Léon (image chargée)', async () => {
    const img = openBtn().locator('img');
    await img.waitFor({ state: 'visible', timeout: 5000 });
    const alt = (await img.getAttribute('alt')) ?? '';
    if (!/Léon|PHÉNIX/i.test(alt)) throw new Error(`alt inattendu : « ${alt} »`);
    if ((await naturalWidth(img)) === 0)
      throw new Error('image non chargée → le repli (casque) s’afficherait');
    buttonSrc = await img.getAttribute('src');
    if (!buttonSrc || !/leon\.png$/.test(buttonSrc))
      throw new Error(`src inattendu : ${buttonSrc}`);
  });

  await assert('La fenêtre de chat utilise EXACTEMENT le même avatar', async () => {
    await openBtn().click();
    const headerImg = page
      .getByRole('dialog', { name: /PHÉNIX, votre concierge/ })
      .locator('header img');
    await headerImg.waitFor({ state: 'visible', timeout: 5000 });
    if ((await naturalWidth(headerImg)) === 0) throw new Error('avatar du chat non chargé');
    const headerSrc = await headerImg.getAttribute('src');
    if (headerSrc !== buttonSrc)
      throw new Error(`avatars différents — bouton=${buttonSrc} chat=${headerSrc}`);
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
