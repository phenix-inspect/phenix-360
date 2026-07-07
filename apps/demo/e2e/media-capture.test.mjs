/**
 * RC1 — Acquisition des photos : capacités NATIVES du téléphone, partout pareil.
 * ===========================================================================
 * Chaque endroit où l'on ajoute une photo utilise le sélecteur NATIF : sur mobile,
 * `accept="image/*"` SANS `capture` laisse l'OS proposer appareil photo / galerie /
 * fichiers (Drive · Fichiers · iCloud) — on ne réinvente rien. Sur ordinateur, même
 * attribut → sélection d'un ou plusieurs fichiers. On vérifie les surfaces clés :
 * coulisses (album), mission (compte rendu / pré-réception / réception), réserves,
 * documents. Comportement identique, aucune régression.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
// Viewport smartphone (iPhone) : on est dans le cas d'usage principal de PHÉNIX.
const { page, consoleErrors } = await session(browser, { width: 390, height: 844 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photo = (i) => ({
  name: `p${i}.png`,
  mimeType: 'image/png',
  buffer: Buffer.from(PNG, 'base64'),
});

/** Attributs déterminant le comportement du sélecteur (natif sur mobile). */
const mediaAttrs = (input) =>
  input.evaluate((el) => ({
    accept: el.getAttribute('accept'),
    capture: el.getAttribute('capture'),
    multiple: el.hasAttribute('multiple'),
  }));

/**
 * Un champ « photo » est prêt pour l'acquisition native ssi : il accepte les images
 * (`image/*` → l'OS propose appareil photo + galerie + fichiers) ET n'impose PAS
 * `capture` (qui masquerait galerie/fichiers). `album` : sélection multiple attendue.
 */
const expectNative = async (input, { album }) => {
  const a = await mediaAttrs(input);
  if (!a.accept || !a.accept.includes('image/*'))
    throw new Error(`accept ne couvre pas les images : ${a.accept}`);
  if (a.capture !== null)
    throw new Error(`capture impose l'appareil photo (${a.capture}) → galerie/fichiers masqués`);
  if (album && !a.multiple) throw new Error('sélection multiple attendue (album)');
};

const newMission = async (label) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  if (label === 'coulisses') {
    await page.getByRole('button', { name: /Publier dans les coulisses/ }).click();
  } else {
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
  }
};

try {
  await openDemo(page);

  // ---- Coulisses : album, sélecteur natif, sélection multiple ------------
  await assert('COULISSES — champ photo natif (image/*, sans capture, multiple)', async () => {
    await newMission('coulisses');
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('heading', { name: 'Créer un moment' })
      .waitFor({ state: 'visible', timeout: 6000 });
    await expectNative(dialog.locator('input[type=file]'), { album: true });
  });

  await assert('COULISSES — album de plusieurs photos en une fois (3 → 1 album)', async () => {
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type=file]').setInputFiles([photo(1), photo(2), photo(3)]);
    await dialog
      .getByText(/3 photos/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await dialog.getByPlaceholder(/Décrivez ce moment/).fill('Album mobile');
    await dialog.getByRole('button', { name: /Créer le moment/ }).click();
    await dialog.waitFor({ state: 'detached', timeout: 8000 });
  });

  // ---- Mission : compte rendu / pré-réception / réception (même champ) ----
  // Le champ de capture est PARTAGÉ par toutes les missions : le tester une fois
  // couvre compte rendu, pré-réception ET réception.
  for (const mission of ['Réception', 'Pré-réception']) {
    await assert(`MISSION « ${mission} » — champ photo natif + ajout de photos`, async () => {
      await newMission(mission);
      const input = page.locator('input[type=file][accept="image/*"]').first();
      await input.waitFor({ state: 'attached', timeout: 6000 });
      await expectNative(input, { album: true });
      // Ajout réel de photos (comme le renverrait le sélecteur natif).
      await input.setInputFiles([photo(4), photo(5)]);
      await page
        .getByRole('button', { name: /J.ai terminé/ })
        .waitFor({ state: 'visible', timeout: 6000 });
      // On referme la mission sans la publier (on ne teste ici que l'acquisition).
      await page.getByRole('button', { name: 'Fermer' }).click();
    });
  }

  // ---- Réserves : photo de preuve à la levée (natif) ----------------------
  await assert('RÉSERVES — champ photo natif à la levée', async () => {
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page.getByRole('tab', { name: /^Réserves/ }).click();
    await page.getByRole('button', { name: 'Lever la réserve' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 6000 });
    await expectNative(dialog.locator('input[type=file]'), { album: false });
    await page.keyboard.press('Escape');
  });

  // ---- Documents avec photo : PDF OU photo (prise sur mobile) -------------
  // L'ajout d'un document passe par « Nouvelle mission → Ajouter un document ».
  await assert('DOCUMENTS — champ natif (PDF ou photo, sans capture)', async () => {
    await newMission('Ajouter un document');
    const input = page.getByRole('dialog').locator('input[type=file]');
    await input.waitFor({ state: 'attached', timeout: 6000 });
    const a = await mediaAttrs(input);
    if (!a.accept || !a.accept.includes('image/*'))
      throw new Error(`le document n'accepte pas la photo : ${a.accept}`);
    if (!a.accept.includes('pdf'))
      throw new Error(`le document n'accepte pas le PDF : ${a.accept}`);
    if (a.capture !== null) throw new Error('capture impose l’appareil photo');
    await page.keyboard.press('Escape');
  });

  // ---- Desktop : comportement INCHANGÉ (mêmes attributs → même sélecteur) -
  const desk = await session(browser, { width: 1280, height: 800 });
  await assert('DESKTOP — comportement inchangé (image/*, multiple, sans capture)', async () => {
    await openDemo(desk.page);
    await desk.page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await desk.page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await desk.page.getByRole('button', { name: /Publier dans les coulisses/ }).click();
    const dialog = desk.page.getByRole('dialog');
    await dialog
      .getByRole('heading', { name: 'Créer un moment' })
      .waitFor({ state: 'visible', timeout: 6000 });
    await expectNative(dialog.locator('input[type=file]'), { album: true });
    // Desktop : la sélection multiple de fichiers fonctionne comme avant.
    await dialog.locator('input[type=file]').setInputFiles([photo(6), photo(7)]);
    await dialog
      .getByText(/2 photos/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Zéro erreur console', async () => {
    const all = [...consoleErrors, ...desk.consoleErrors];
    if (all.length > 0) throw new Error(all.slice(0, 5).join(' | '));
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
