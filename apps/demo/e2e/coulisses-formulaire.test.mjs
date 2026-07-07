/**
 * RC1 — Formulaire « Dans les coulisses » simplifié (publier en < 30 s).
 * ===========================================================================
 * Les coulisses sont un espace ÉMOTIONNEL (Instagram privé du chantier), pas un
 * compte rendu. On retire les deux champs sans valeur pour le client :
 *   • ☐ « Partager avec le client » → SUPPRIMÉ : une publication coulisses est
 *     TOUJOURS destinée au client (partage automatique) ;
 *   • « Intervenants présents » → SUPPRIMÉ : le client regarde des photos, pas
 *     une feuille de présence.
 * Le formulaire se réduit à : photos, titre, description, pièce (optionnelle).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

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
const TITLE = 'Belles finitions du séjour';

/** Ouvre le composer d'album via « Nouvelle mission → Publier dans les coulisses ». */
const openAlbumComposer = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('button', { name: /Publier dans les coulisses/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('heading', { name: 'Créer un moment' })
    .waitFor({ state: 'visible', timeout: 6000 });
};

try {
  await openDemo(page);

  const dialog = () => page.getByRole('dialog');

  await assert('Le formulaire n’a NI case « Partager » NI champ « Intervenants »', async () => {
    await openAlbumComposer();
    if ((await dialog().getByRole('checkbox').count()) > 0)
      throw new Error('une case à cocher subsiste (Partager avec le client)');
    if (
      (await dialog()
        .getByText(/Partager avec le client/i)
        .count()) > 0
    )
      throw new Error('« Partager avec le client » est encore proposé');
    if (
      (await dialog()
        .getByText(/Intervenants/i)
        .count()) > 0
    )
      throw new Error('le champ « Intervenants présents » est encore là');
  });

  await assert('Le formulaire garde bien photos + titre + description + pièce', async () => {
    await dialog()
      .getByPlaceholder(/Avancement de la cuisine/)
      .waitFor({ state: 'visible' }); // Titre
    await dialog().getByText('Observations (optionnel)').first().waitFor({ state: 'visible' });
    await dialog().getByText('Pièce (optionnel)').first().waitFor({ state: 'visible' });
  });

  await assert('Publication SANS aucune action de partage (photos + titre seulement)', async () => {
    await dialog()
      .locator('input[type=file]')
      .setInputFiles([photo(1), photo(2)]);
    await dialog()
      .getByText(/2 photos/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await dialog()
      .getByPlaceholder(/Avancement de la cuisine/)
      .fill(TITLE);
    await dialog()
      .getByRole('button', { name: /Créer le moment/ })
      .click();
    await dialog().waitFor({ state: 'detached', timeout: 8000 });
  });

  await assert(
    'PARTAGE AUTOMATIQUE : la publication apparaît côté client (coulisses)',
    async () => {
      await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
      await page
        .locator('#section-fil article')
        .filter({ hasText: TITLE })
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
    },
  );

  await assert(
    'Côté conducteur, la publication est marquée « Partagé avec le client »',
    async () => {
      await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
      await page.getByRole('tab', { name: 'Dans les coulisses' }).first().click();
      const album = page.locator('article').filter({ hasText: TITLE }).first();
      await album.waitFor({ state: 'visible', timeout: 6000 });
      await album
        .getByText(/Partagé avec le client/)
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
    },
  );

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
