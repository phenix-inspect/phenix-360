/**
 * « Dans les coulisses » — album & viewer photo (retour terrain).
 * =============================================================================
 * Quatre améliorations, un seul album de vraies photos :
 *   1. la carte d'un album (≥ 2 photos) montre une MOSAÏQUE d'aperçu ;
 *   2. le viewer montre la photo ENTIÈRE (object-contain, jamais recadrée) ;
 *   3. une PELLICULE de miniatures permet de sauter à une photo (+ compteur) ;
 *   4. le viewer se ZOOME (bouton), flèches masquées pendant le zoom ;
 *   5. dans la Bibliothèque, une vignette s'ouvre d'un clic dans le viewer.
 * Photos réelles requises (le zoom / la photo entière sont conditionnés à une
 * vraie image ; le seed n'a que des tuiles dégradées).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photo = (i) => ({
  name: `viewer-${i}.png`,
  mimeType: 'image/png',
  buffer: Buffer.from(PNG, 'base64'),
});
const THREE = [photo(1), photo(2), photo(3)];
const ALBUM = 'Album viewer — trois photos';

const openCoulisses = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Dans les coulisses' }).first().click();
  await page
    .getByRole('heading', { name: 'Dans les coulisses du chantier' })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });
};

try {
  await openDemo(page);

  // ---- On publie un album de 3 vraies photos ------------------------------
  await assert('Publier un album de 3 photos (via Nouvelle mission)', async () => {
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByRole('button', { name: /Publier dans les coulisses/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('heading', { name: 'Créer un moment' }).waitFor({ state: 'visible' });
    await dlg.locator('input[type=file]').setInputFiles(THREE);
    await dlg.getByPlaceholder(/Décrivez ce moment/).fill(ALBUM);
    await dlg.getByRole('button', { name: /Créer le moment/ }).click();
    await dlg.waitFor({ state: 'detached', timeout: 8000 });
  });

  // ---- 1. La carte montre une MOSAÏQUE (plusieurs images) -----------------
  await assert('Carte album : aperçu multi-photos (mosaïque ≥ 2 images)', async () => {
    await openCoulisses();
    const cover = page
      .locator('article')
      .filter({ hasText: ALBUM })
      .first()
      .getByRole('button', { name: /Ouvrir l’album/ });
    await cover.waitFor({ state: 'visible', timeout: 6000 });
    const imgs = await cover.locator('img').count();
    if (imgs < 2) throw new Error(`mosaïque attendue (≥ 2 images), vu ${imgs}`);
  });

  // ---- 2 + 3 + 4 : ouverture du viewer, photo entière, pellicule, zoom ----
  await assert('Viewer : photo ENTIÈRE (object-contain)', async () => {
    await page
      .locator('article')
      .filter({ hasText: ALBUM })
      .first()
      .getByRole('button', { name: /Ouvrir l’album/ })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    const cls = await dialog.locator('img').first().getAttribute('class');
    if (!cls || !cls.includes('object-contain'))
      throw new Error('la photo du viewer n’est pas en object-contain (recadrage)');
  });

  await assert('Viewer : pellicule de miniatures + saut de photo (compteur)', async () => {
    const dialog = page.getByRole('dialog');
    await dialog
      .getByText(/1\s*\/\s*3/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    await dialog.getByRole('button', { name: 'Aller à la photo 3' }).click();
    await dialog
      .getByText(/3\s*\/\s*3/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Viewer : zoom (bouton) + flèches masquées pendant le zoom', async () => {
    const dialog = page.getByRole('dialog');
    // On revient sur une photo du milieu pour disposer des deux flèches.
    await dialog.getByRole('button', { name: 'Aller à la photo 2' }).click();
    const before = await dialog
      .getByRole('button', { name: /Photo (précédente|suivante)/ })
      .count();
    if (before === 0) throw new Error('flèches de navigation absentes avant zoom');
    const zoomBtn = dialog.getByRole('button', { name: 'Zoomer' });
    await zoomBtn.click();
    const dezoom = dialog.getByRole('button', { name: 'Dézoomer' });
    if ((await dezoom.getAttribute('aria-pressed')) !== 'true')
      throw new Error('le zoom n’est pas actif (aria-pressed)');
    if ((await dialog.getByRole('button', { name: /Photo (précédente|suivante)/ }).count()) !== 0)
      throw new Error('les flèches devraient être masquées pendant le zoom');
    await dezoom.click();
    await dialog.getByRole('button', { name: 'Fermer' }).first().click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  });

  // ---- 5. Bibliothèque : une vignette s'ouvre dans le viewer --------------
  await assert('Bibliothèque : la vignette ouvre le viewer d’un clic', async () => {
    await openCoulisses();
    await page.getByRole('tab', { name: 'Bibliothèque' }).first().click();
    const tuile = page.getByRole('button', { name: /^Ouvrir la photo/ }).first();
    await tuile.waitFor({ state: 'visible', timeout: 6000 });
    await tuile.click();
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
