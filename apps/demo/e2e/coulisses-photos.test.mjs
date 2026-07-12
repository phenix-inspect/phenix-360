/**
 * RC1 — « Dans les coulisses » = album photo/vidéo UNIQUEMENT (brique plaisir).
 * ===========================================================================
 * Décision produit : les coulisses ne sont PAS l'historique du chantier. On y voit
 * l'avancement en images (moments photo, albums), on aime, on commente — rien
 * d'autre. Les documents, comptes rendus, PV, réserves vivent au Suivi / Documents /
 * Comptes rendus, JAMAIS ici.
 *   • un document partagé → Documents, pas les coulisses ;
 *   • une pré-réception générée (compte rendu) → Suivi, pas les coulisses ;
 *   • un album = 1 seul moment, jusqu'à 10 photos, 1 seule notification client ;
 *   • cœur + commentaire sous l'album.
 * Aucun nouvel écran : on clarifie le rôle des coulisses et on filtre le contenu.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2800 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photo = (i) => ({
  name: `photo-${i}.png`,
  mimeType: 'image/png',
  buffer: Buffer.from(PNG, 'base64'),
});
const TWELVE = Array.from({ length: 12 }, (_, i) => photo(i));

const ALBUM_TITLE = 'Avancement en images de la cuisine';
const DOC_LIBELLE = 'Plan technique interne partage';

const openCoulisses = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Dans les coulisses' }).first().click();
  await page
    .getByRole('heading', { name: 'Dans les coulisses du chantier' })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });
};
const openClient = async () => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await page.waitForTimeout(400);
};
/** Ouvre le composer d'album via « Nouvelle mission → Publier dans les coulisses »
 * (le sous-menu « Dans les coulisses » ne publie plus : consultation seule). */
const openAlbumComposer = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('button', { name: /Publier dans les coulisses/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('heading', { name: 'Créer un moment' })
    .waitFor({ state: 'visible', timeout: 6000 });
};

/** Déroule une PRÉ-RÉCEPTION (flux dédié : contrôle du contrat, tout conforme). */
const runPrereception = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('dialog').getByText('Pré-réception', { exact: true }).click();
  await page
    .getByText('Vérifiez chaque prestation vendue')
    .waitFor({ state: 'visible', timeout: 8000 });
  await page.getByRole('button', { name: 'Voir la synthèse' }).click();
  await page.getByRole('button', { name: /Générer les documents/ }).click();
  await page.getByRole('button', { name: /Valider et envoyer/ }).click();
  await page
    .getByText('Pré-réception validée et envoyée')
    .waitFor({ state: 'visible', timeout: 8000 });
  await page.getByRole('button', { name: /^Terminer$/ }).click();
  await page
    .getByRole('heading', { name: /Appartement Lyon 6e/ })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });
};

try {
  await openDemo(page);

  // ---- Un document partagé → Documents, PAS les coulisses -----------------
  await assert('Document partagé → apparaît dans Documents, pas dans les coulisses', async () => {
    // L'ajout passe par l'unique point d'entrée « Nouvelle mission ».
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByRole('button', { name: /Ajouter un document/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Libellé du document').fill(DOC_LIBELLE);
    await dlg.locator('input[type=file]').setInputFiles(photo(99));
    await dlg
      .getByText(/photo-99/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await dlg.locator('select').selectOption({ label: 'Client' });
    await dlg.getByRole('button', { name: 'Publier' }).click();
    await dlg.waitFor({ state: 'hidden', timeout: 6000 });
    await page.getByRole('tab', { name: 'Documents', exact: true }).click();
    await page.locator('li').filter({ hasText: DOC_LIBELLE }).first().waitFor({ state: 'visible' });
    // Côté client : présent dans l'onglet Documents, absent des coulisses.
    await openClient();
    await page.getByRole('tab', { name: 'Documents' }).first().click();
    await page
      .locator('#section-documents')
      .getByText(DOC_LIBELLE)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    if ((await page.locator('#section-fil').getByText(DOC_LIBELLE).count()) > 0)
      throw new Error('le document apparaît dans les coulisses');
  });

  // ---- Une pré-réception générée → Suivi, PAS les coulisses ---------------
  await assert('Pré-réception générée (compte rendu) → pas dans les coulisses', async () => {
    await runPrereception();
    await openCoulisses();
    if ((await page.locator('#section-fil').getByText('Pré-réception').count()) > 0)
      throw new Error('la pré-réception apparaît dans les coulisses');
  });

  // ---- Publication via Nouvelle mission UNIQUEMENT (jamais le sous-menu) --
  await assert('Ajout d’1 photo via Nouvelle mission → moment visible en coulisses', async () => {
    // On publie SANS ouvrir « Dans les coulisses » (le sous-menu ne publie plus).
    await openAlbumComposer();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type=file]').setInputFiles(photo(1));
    await dialog.getByPlaceholder(/Décrivez ce moment/).fill('Une première photo');
    await dialog.getByRole('button', { name: /Créer le moment/ }).click();
    await dialog.waitFor({ state: 'detached', timeout: 8000 });
    // On OUVRE les coulisses seulement pour CONSULTER — et le moment y est.
    await openCoulisses();
    await page
      .locator('article')
      .filter({ hasText: 'Une première photo' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('« Dans les coulisses » ne publie pas (consultation seule)', async () => {
    await openCoulisses();
    if ((await page.getByRole('button', { name: /Créer un moment/ }).count()) > 0)
      throw new Error('le bouton de publication subsiste dans le sous-menu coulisses');
  });

  // ---- Album : 10 photos max → UN SEUL album, limite respectée -----------
  await assert('Ajout de 12 photos → un seul album, limité à 10 (partagé client)', async () => {
    await openAlbumComposer();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type=file]').setInputFiles(TWELVE);
    // La limite est atteinte → « Album complet — 10 photos maximum ».
    await dialog
      .getByText(/Album complet — 10 photos maximum/)
      .waitFor({ state: 'visible', timeout: 8000 });
    await dialog.getByPlaceholder(/Décrivez ce moment/).fill(ALBUM_TITLE);
    // Plus de case « Partager » : une publication coulisses est toujours pour le client.
    await dialog.getByRole('button', { name: /Créer le moment/ }).click();
    await dialog.waitFor({ state: 'detached', timeout: 8000 });
    // Un SEUL moment/album, avec le badge « 10 photos » (vu en consultation).
    await openCoulisses();
    const album = page.locator('article').filter({ hasText: ALBUM_TITLE }).first();
    await album.waitFor({ state: 'visible', timeout: 6000 });
    await album.getByText('10 photos').first().waitFor({ state: 'visible', timeout: 5000 });
    if ((await page.locator('article').filter({ hasText: ALBUM_TITLE }).count()) !== 1)
      throw new Error('l’album n’est pas un moment unique');
  });

  // ---- UNE notification PAR ALBUM (jamais une par photo) -----------------
  await assert('Notification par album, pas par photo (2 albums publiés → 2)', async () => {
    await openClient();
    const notif = page
      .locator('section[aria-label="Notifications"]')
      .getByRole('button', { name: /Nouvelles photos ajoutées dans les coulisses/ });
    await notif.first().waitFor({ state: 'visible', timeout: 6000 });
    // Deux albums publiés dans la session (1 photo + 10 photos = 11 photos) → si la
    // notification était PAR PHOTO on en aurait 11 ; par ALBUM, on en a exactement 2.
    if ((await notif.count()) !== 2)
      throw new Error(`attendu 2 notifications (une par album), vu ${await notif.count()}`);
  });

  // ---- Cœur + commentaire client sous l'album ----------------------------
  await assert('Le client aime l’album (cœur rouge vif)', async () => {
    await page.getByRole('tab', { name: 'Dans les coulisses' }).first().click();
    const album = page.locator('#section-fil article').filter({ hasText: ALBUM_TITLE }).first();
    await album.waitFor({ state: 'visible', timeout: 6000 });
    const heart = album.getByRole('button', { name: /coup de cœur/i }).first();
    await heart.click();
    if ((await heart.getAttribute('aria-pressed')) === 'false') await heart.click();
    if ((await heart.getAttribute('aria-pressed')) !== 'true')
      throw new Error('le ❤️ n’est pas actif');
  });

  await assert('Le client commente sous l’album', async () => {
    const album = page.locator('#section-fil article').filter({ hasText: ALBUM_TITLE }).first();
    const input = album.getByPlaceholder(/Écrire un petit mot/);
    await input.fill('Superbes photos, merci !');
    await input.press('Enter');
    await album
      .getByText('Superbes photos, merci !')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  // ---- Client-safe : rien de technique ne fuit dans les coulisses --------
  await assert('Client-safe : ni document interne, ni PV, ni CR dans les coulisses', async () => {
    await page.waitForTimeout(300);
    const fil = page.locator('#section-fil');
    for (const secret of ['Pré-réception', DOC_LIBELLE])
      if ((await fil.getByText(secret, { exact: false }).count()) > 0)
        throw new Error(`fuite dans les coulisses : « ${secret} »`);
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
