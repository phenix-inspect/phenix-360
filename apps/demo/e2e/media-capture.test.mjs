/**
 * ACQUISITION PHOTO — « Prendre une photo » OU « Choisir un fichier », PARTOUT.
 * ===========================================================================
 * Composant partagé `PhotoInput` : chaque endroit où l'on ajoute une photo/pièce
 * jointe rend DEUX entrées natives — une BIBLIOTHÈQUE (`input[type=file]` sans
 * `capture` → photothèque / Fichiers / iCloud / Drive) et un APPAREIL PHOTO
 * (`capture="environment"` → caméra directe). Sur téléphone/tablette (pointeur
 * grossier), une feuille de choix « Prendre une photo / Choisir une photo ou un
 * fichier » s'affiche ; sur ordinateur, le sélecteur s'ouvre directement.
 *
 * On vérifie : la double entrée native sur les surfaces clés ; la feuille de
 * choix qui s'ouvre et s'annule (tactile) ; l'ouverture directe sans feuille
 * (ordinateur) ; et l'acquisition réelle par CHACUNE des deux entrées.
 *
 * NB : on injecte les fichiers directement dans l'entrée native voulue
 * (`setInputFiles`) — ce que renvoie l'OS. On ne CLIQUE pas les boutons qui
 * ouvriraient le sélecteur natif (non simulable en headless).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { assert, summary } = harness();
const allErrors = [];

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photo = (i) => ({
  name: `p${i}.png`,
  mimeType: 'image/png',
  buffer: Buffer.from(PNG, 'base64'),
});

const attrs = (input) =>
  input.evaluate((el) => ({
    accept: el.getAttribute('accept'),
    capture: el.getAttribute('capture'),
    multiple: el.hasAttribute('multiple'),
  }));

const lib = (scope) => scope.locator('input[type=file]:not([capture])').first();
const cam = (scope) => scope.locator('input[type=file][capture="environment"]').first();

/** Les DEUX entrées natives sont présentes et bien formées. */
const expectDual = async (scope, { album, doc = false } = {}) => {
  const l = await attrs(lib(scope));
  if (!l.accept || !l.accept.includes('image/'))
    throw new Error(`bibliothèque : accept sans image (${l.accept})`);
  if (l.capture !== null) throw new Error('bibliothèque : ne doit PAS imposer capture');
  if (album && !l.multiple) throw new Error('bibliothèque : sélection multiple attendue (album)');
  if (doc && !l.accept.includes('pdf')) throw new Error(`document : accept sans PDF (${l.accept})`);
  const c = await attrs(cam(scope));
  if (!c.accept || !c.accept.includes('image/'))
    throw new Error(`appareil : accept sans image (${c.accept})`);
  if (c.capture !== 'environment')
    throw new Error(`appareil : capture « environment » attendu (${c.capture})`);
};

const newMission = async (page, label) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  if (label === 'coulisses')
    await page.getByRole('button', { name: /Publier dans les coulisses/ }).click();
  else await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
};

const coulissesDialog = (page) =>
  page.locator('[role=dialog]').filter({ has: page.getByRole('heading', { name: 'Créer un moment' }) });

try {
  /* ===================== TÉLÉPHONE (tactile) ============================= */
  const m = await session(browser, { width: 390, height: 844, hasTouch: true });
  const mp = m.page;
  await openDemo(mp);

  await assert('COULISSES — double entrée native (bibliothèque + appareil photo)', async () => {
    await newMission(mp, 'coulisses');
    const dialog = coulissesDialog(mp);
    await dialog.getByRole('heading', { name: 'Créer un moment' }).waitFor({ state: 'visible', timeout: 6000 });
    await expectDual(dialog, { album: true });
  });

  await assert('MOBILE — le déclencheur ouvre la feuille de choix, « Annuler » la referme', async () => {
    await coulissesDialog(mp).getByRole('button', { name: /Choisir des photos/ }).click();
    await mp.getByRole('button', { name: 'Prendre une photo' }).waitFor({ state: 'visible', timeout: 4000 });
    await mp.getByRole('button', { name: /Choisir une photo ou un fichier/ }).waitFor({ state: 'visible' });
    await mp.getByRole('button', { name: /^Annuler$/ }).click();
    await mp.getByRole('button', { name: 'Prendre une photo' }).waitFor({ state: 'detached', timeout: 4000 });
  });

  await assert('COULISSES — l’album s’ajoute via la bibliothèque (setInputFiles)', async () => {
    const dialog = coulissesDialog(mp);
    await lib(dialog).setInputFiles([photo(1), photo(2), photo(3)]);
    await dialog.getByText(/3 photos/).first().waitFor({ state: 'visible', timeout: 6000 });
    await dialog.getByPlaceholder(/Décrivez ce moment/).fill('Album mobile');
    await dialog.getByRole('button', { name: /Créer le moment/ }).click();
    await dialog.waitFor({ state: 'detached', timeout: 8000 });
  });

  await assert('COMPTE RENDU — double entrée + ajout via l’APPAREIL PHOTO (capture)', async () => {
    await newMission(mp, 'Compte rendu de chantier');
    await mp.getByPlaceholder(/Décrivez ce point/).waitFor({ state: 'visible', timeout: 8000 });
    await expectDual(mp, { album: true });
    await cam(mp).setInputFiles([photo(4), photo(5)]); // simule la caméra
    await mp.getByRole('button', { name: /Ajouter \(2\/3\)/ }).waitFor({ state: 'visible', timeout: 6000 });
    await mp.getByRole('button', { name: 'Fermer' }).click();
    await mp.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
  });

  await assert('RÉSERVE (levée) — double entrée native (photo de preuve, non-album)', async () => {
    await mp.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await mp.getByRole('tab', { name: 'Suivi', exact: true }).first().click();
    const voir = mp.getByRole('button', { name: /Voir tout le journal/ });
    if (await voir.count()) await voir.first().click();
    await mp.getByRole('button', { name: 'Lever la réserve' }).first().click();
    const dialog = mp.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 6000 });
    await expectDual(dialog, { album: false });
    await mp.keyboard.press('Escape');
  });

  await assert('DOCUMENT — double entrée native, PDF OU photo', async () => {
    await newMission(mp, 'Ajouter un document');
    const dialog = mp.getByRole('dialog');
    await dialog.locator('input[type=file]:not([capture])').first().waitFor({ state: 'attached', timeout: 6000 });
    await expectDual(dialog, { album: false, doc: true });
    await mp.keyboard.press('Escape');
  });

  allErrors.push(...m.consoleErrors);
  await m.ctx.close();

  /* ===================== ORDINATEUR (pointeur fin) ====================== */
  const d = await session(browser, { width: 1280, height: 800 });
  const dp = d.page;
  await assert('DESKTOP — pointeur fin (pas de feuille) + double entrée + ajout', async () => {
    await openDemo(dp);
    const coarse = await dp.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
    if (coarse) throw new Error('ordinateur détecté comme tactile (pointeur grossier)');
    await newMission(dp, 'coulisses');
    const dialog = coulissesDialog(dp);
    await dialog.getByRole('heading', { name: 'Créer un moment' }).waitFor({ state: 'visible', timeout: 6000 });
    await expectDual(dialog, { album: true });
    // La sélection multiple de fichiers fonctionne comme avant (pas de feuille).
    await lib(dialog).setInputFiles([photo(6), photo(7)]);
    await dialog.getByText(/2 photos/).first().waitFor({ state: 'visible', timeout: 6000 });
  });

  allErrors.push(...d.consoleErrors);

  await assert('Zéro erreur console', async () => {
    if (allErrors.length > 0) throw new Error(allErrors.slice(0, 5).join(' | '));
  });
} catch (e) {
  await assert('FATAL', async () => {
    throw e;
  });
} finally {
  const failed = summary(allErrors);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
