/**
 * MISSION G — ROBUSTESSE PHOTO : échec VISIBLE, jamais silencieux.
 * ===============================================================
 * Avant : ajouter une photo non-image (vidéo autorisée par le sélecteur mobile),
 * trop lourde ou illisible (HEIC iPhone) échouait EN SILENCE — le spinner
 * s'arrêtait, rien n'apparaissait, aucun message. Désormais `loadPhotos` valide
 * type + taille, ne jette jamais, et l'écran affiche un message clair. On teste
 * le pire cas : déposer un fichier NON-image dans le champ photo d'un compte rendu.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 390, height: 900 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const openCompteRendu = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('button', { name: /^Compte rendu de chantier/ }).click();
  await page.getByPlaceholder(/Décrivez ce point/).waitFor({ state: 'visible', timeout: 8000 });
};

try {
  await openDemo(page);
  await openCompteRendu();

  const fileInput = page.locator('input[type=file]:not([capture])').first();

  await assert('Fichier NON-image → message clair, aucune photo ajoutée', async () => {
    await fileInput.setInputFiles({
      name: 'document.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('ceci n’est pas une image'),
    });
    // Message d'erreur VISIBLE (role=alert), pas d'échec silencieux.
    await page
      .getByRole('alert')
      .filter({ hasText: /n’est pas une image|non ajoutée/i })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    // Aucune miniature ajoutée : le bouton reste sur « Photo » (0 photo).
    if ((await page.getByRole('button', { name: /Ajouter \(\d\/3\)/ }).count()) > 0)
      throw new Error('une photo a été ajoutée malgré le fichier non-image');
  });

  await assert('Une vraie image passe ensuite normalement (l’erreur n’est pas bloquante)', async () => {
    await fileInput.setInputFiles({
      name: 'vraie.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG, 'base64'),
    });
    // La photo est ajoutée : le compteur « Ajouter (1/3) » apparaît.
    await page
      .getByRole('button', { name: /Ajouter \(1\/3\)/ })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Zéro erreur console (aucune rejection non gérée)', async () => {
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
