/**
 * RC1 — Suivi : entrée UNIQUE « Nouvelle mission » (suppression des doublons).
 * ===========================================================================
 * Une action = un seul point d'entrée. « Nouveau compte rendu » et « Ajouter des
 * photos » disparaissent du Suivi : c'est « Nouvelle mission » qui couvre les deux
 * (photos + compte rendu, via le flux « Compte rendu de chantier »). Aucune
 * fonctionnalité perdue.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

// PNG 1×1 valide (mediaUploader lit un vrai fichier image).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PHOTO = { name: 'chantier.png', mimeType: 'image/png', buffer: PNG };
const OBS = 'Reprise étanchéité salle de bain avant carrelage';

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page
    .getByRole('heading', { name: /Appartement Lyon 6e/ })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });

  await assert('Les deux anciens boutons ont DISPARU du Suivi', async () => {
    if ((await page.getByRole('button', { name: 'Nouveau compte rendu' }).count()) > 0)
      throw new Error('« Nouveau compte rendu » est toujours présent');
    if ((await page.getByRole('button', { name: 'Ajouter des photos' }).count()) > 0)
      throw new Error('« Ajouter des photos » est toujours présent');
  });

  await assert('« Nouvelle mission » reste l’entrée unique (présente)', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).waitFor({ state: 'visible' });
  });

  await assert('Nouvelle mission → AJOUTER DES PHOTOS (capture)', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    // Pré-réception et Réception ont leur flux dédié ; le parcours générique
    // (photos + observation → Journal) vit dans « Compte rendu de chantier ».
    await page.getByRole('dialog').getByText('Compte rendu de chantier', { exact: true }).click();
    await page.getByPlaceholder(/Décrivez ce point/).waitFor({ state: 'visible', timeout: 6000 });
    // La photo se joint dans le point en cours (input image du plein écran).
    await page.locator('input[type="file"]:not([capture])').first().setInputFiles(PHOTO);
    await page
      .getByRole('button', { name: /Ajouter \(1\/3\)/ })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Nouvelle mission → CRÉER UN COMPTE RENDU (observation + validation)', async () => {
    await page.getByPlaceholder(/Décrivez ce point/).fill(OBS);
    await page.getByRole('button', { name: /Ajouter ce point/ }).click();
    await page.getByRole('button', { name: /Publier le compte rendu/ }).click();
    await page
      .getByText('Compte rendu publié')
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });
    await page.getByRole('button', { name: /^Terminer$/ }).click();
    await page
      .getByRole('heading', { name: /Appartement Lyon 6e/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('La mission a laissé un COMPTE RENDU au Journal (Suivi)', async () => {
    await page.getByRole('tab', { name: 'Suivi', exact: true }).click();
    await page
      .getByRole('button', { name: /Voir tout le journal/ })
      .click()
      .catch(() => {});
    await page
      .getByText(/étanchéité/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('La photo est bien au Récit (aucune fonctionnalité perdue)', async () => {
    await page.getByRole('tab', { name: 'Dans les coulisses' }).click();
    await page.waitForTimeout(400);
    // La mission a créé un Moment ; le récit s'est enrichi (au moins une image).
    if ((await page.locator('img').count()) === 0)
      throw new Error('aucune photo au Récit après la mission');
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
