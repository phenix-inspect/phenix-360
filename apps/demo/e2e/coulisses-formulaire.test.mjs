/**
 * RC1 — Formulaire « Dans les coulisses » simplifié (publier en < 20 s).
 * ===========================================================================
 * Les coulisses sont un espace ÉMOTIONNEL (Instagram privé du chantier), pas un
 * compte rendu. Le formulaire se réduit à l'essentiel :
 *   📸 Photos · 📝 Légende (optionnelle) · 🏠 Pièce (optionnelle) · Créer
 * Champs SUPPRIMÉS : « Titre » (on n'invente pas un titre), « Partager avec le
 * client » (une publication coulisses est TOUJOURS pour le client → partage
 * automatique), « Intervenants présents » (le client regarde des photos). Le champ
 * « Observations » est renommé « Légende ». On vérifie chaque suppression + que la
 * publication marche avec photos seules, ou photos + légende (affichée côté client).
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photo = (i) => ({
  name: `p${i}.png`,
  mimeType: 'image/png',
  buffer: Buffer.from(PNG, 'base64'),
});
const LEGENDE = 'La cuisine prend forme !';

const dialog = () => page.getByRole('dialog');
const legendeField = () => dialog().getByPlaceholder(/Décrivez ce moment/);

/** Ouvre le composer d'album via « Nouvelle mission → Publier dans les coulisses ». */
const openAlbumComposer = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('button', { name: /Publier dans les coulisses/ }).click();
  await dialog()
    .getByRole('heading', { name: 'Créer un moment' })
    .waitFor({ state: 'visible', timeout: 6000 });
};
const openClientCoulisses = async () => {
  await openClientTab(page, 'Dans les coulisses');
};

try {
  await openDemo(page);

  await assert('Le champ « Titre » n’existe plus', async () => {
    await openAlbumComposer();
    if ((await dialog().getByText('Titre', { exact: true }).count()) > 0)
      throw new Error('le champ « Titre » est encore là');
    if (
      (await dialog()
        .getByPlaceholder(/Avancement de la cuisine/)
        .count()) > 0
    )
      throw new Error('le champ « Titre » (ancien placeholder) est encore là');
  });

  await assert('« Observations » est remplacé par « Légende » (optionnelle)', async () => {
    if (
      (await dialog()
        .getByText(/Observations/i)
        .count()) > 0
    )
      throw new Error('« Observations » est encore présent');
    await dialog()
      .getByText(/Légende \(optionnelle\)/i)
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    await legendeField().waitFor({ state: 'visible' });
  });

  await assert('Ni « Partager » ni « Intervenants » (déjà retirés)', async () => {
    if ((await dialog().getByRole('checkbox').count()) > 0)
      throw new Error('une case « Partager avec le client » subsiste');
    if (
      (await dialog()
        .getByText(/Intervenants/i)
        .count()) > 0
    )
      throw new Error('le champ « Intervenants présents » subsiste');
  });

  await assert('Le formulaire = Photos + Légende + Pièce, puis Créer', async () => {
    await dialog().getByText('Pièce (optionnel)').first().waitFor({ state: 'visible' });
    await dialog()
      .getByRole('button', { name: /Créer le moment/ })
      .waitFor({ state: 'visible' });
  });

  await assert('Publication avec des PHOTOS SEULES (sans légende) fonctionne', async () => {
    await dialog()
      .locator('input[type=file]')
      .setInputFiles([photo(1), photo(2)]);
    await dialog()
      .getByText(/2 photos/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    // Aucune légende saisie : la légende est OPTIONNELLE → le bouton reste actif.
    const creer = dialog().getByRole('button', { name: /Créer le moment/ });
    if (await creer.isDisabled())
      throw new Error('publication bloquée sans légende (elle est optionnelle)');
    await creer.click();
    // Le dialog se ferme → la publication photos-seules a bien été créée.
    await dialog().waitFor({ state: 'detached', timeout: 8000 });
  });

  await assert('Publication avec PHOTOS + LÉGENDE fonctionne', async () => {
    await openAlbumComposer();
    await dialog()
      .locator('input[type=file]')
      .setInputFiles([photo(3)]);
    await legendeField().fill(LEGENDE);
    await dialog()
      .getByRole('button', { name: /Créer le moment/ })
      .click();
    await dialog().waitFor({ state: 'detached', timeout: 8000 });
  });

  await assert('La LÉGENDE est bien affichée dans « Dans les coulisses » (client)', async () => {
    await openClientCoulisses();
    await page
      .locator('#section-fil article')
      .filter({ hasText: LEGENDE })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
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
