/**
 * RC1 — Récit plus DENSE (retour terrain).
 * La couverture d'un Moment est ≈ 33 % plus courte (ratio 6/5 au lieu de 4/5)
 * pour voir davantage de moments sans scroller, SANS écraser l'image (recadrage
 * object-cover) : coins arrondis conservés, plein écran inchangé. Vérifié desktop
 * et mobile, sur un album multi-photos.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2000 });
const { assert, summary } = harness();

const cover = () => page.getByRole('button', { name: /Agrandir la photo|Ouvrir l’album/ }).first();
const coverRatio = async () => {
  const box = await cover().boundingBox();
  return box.height / box.width; // 6/5 → ≈ 0.833 ; l'ancien 4/5 valait 1.25
};

async function openRecit() {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Récit' }).click();
  await cover().waitFor({ state: 'visible', timeout: 6000 });
}

try {
  await openDemo(page);
  await openRecit();

  await assert('Desktop — la couverture est nettement plus courte (≈ 6/5)', async () => {
    await page.setViewportSize({ width: 1280, height: 2000 });
    const r = await coverRatio();
    if (!(r > 0.78 && r < 0.9))
      throw new Error(`ratio hauteur/largeur hors cible 6/5 : ${r.toFixed(3)}`);
  });

  await assert('Mobile — même ratio (indépendant de la largeur, pas d’écrasement)', async () => {
    await page.setViewportSize({ width: 390, height: 2000 });
    const r = await coverRatio();
    if (!(r > 0.78 && r < 0.9)) throw new Error(`ratio mobile hors cible : ${r.toFixed(3)}`);
  });

  await assert('Album multi-photos — badge conservé + même cadre dense', async () => {
    await page.setViewportSize({ width: 1280, height: 2000 });
    const album = page.locator('article').filter({ hasText: 'Dalle coulée' }).first();
    await album.getByText('3 photos').first().waitFor({ state: 'visible', timeout: 5000 });
    const box = await album
      .getByRole('button', { name: /Ouvrir l’album/ })
      .first()
      .boundingBox();
    const r = box.height / box.width;
    if (!(r > 0.78 && r < 0.9)) throw new Error(`ratio album hors cible : ${r.toFixed(3)}`);
  });

  await assert('Le clic ouvre toujours le plein écran (inchangé)', async () => {
    await cover().click();
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: 'Fermer' }).first().click();
    await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5000 });
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
