/**
 * Compte rendu de chantier — mission fusionnée (visite + réunion), à POINTS.
 * =============================================================================
 * Décision produit (09/07/2026) : « Visite » et « Réunion » fusionnent en un seul
 * « Compte rendu de chantier ». Un CR = une suite de points ; chaque point = 1 photo
 * + 1 commentaire + 1 cible de diffusion (Client / Artisan / Client + Artisan).
 *   • le conducteur voit TOUT (photo + commentaire + badge de diffusion) ;
 *   • le client ne voit QUE les points qui lui sont destinés (jamais l'artisan) ;
 *   • l'export PDF est filtré par destinataire (client / artisan).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1280, height: 2200 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photo = (i) => ({
  name: `cr-${i}.png`,
  mimeType: 'image/png',
  buffer: Buffer.from(PNG, 'base64'),
});

const P1 = 'Le carrelage est terminé.';
const P2 = 'Prévoir reprise des joints.';
const P3 = 'Le meuble vasque sera posé demain.';

const openComposer = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
};

/** La section « nouveau point » en cours de saisie. */
const draftSection = () => page.locator('section').filter({ hasText: 'Ajouter ce point' });

/** Ajoute un point : n photos + commentaire + cible, puis « Ajouter ce point ». */
const addPoint = async (i, comment, cible, nbPhotos = 1) => {
  const files = Array.from({ length: nbPhotos }, (_, k) => photo(i * 10 + k));
  await page.locator('input[type=file]').first().setInputFiles(files);
  await page.getByPlaceholder(/Décrivez ce point/).fill(comment);
  await page.getByRole('button', { name: cible, exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter ce point' }).click();
};

/** Ouvre le document généré (popup blob) et renvoie son texte. */
const openedDocText = async (action) => {
  const [popup] = await Promise.all([page.waitForEvent('popup'), action()]);
  await popup.waitForLoadState('domcontentloaded');
  const text = await popup.evaluate(() => document.body.innerText);
  await popup.close();
  return text;
};

try {
  await openDemo(page);

  await assert(
    'Nouvelle mission : « Compte rendu de chantier » (plus de Visite / Réunion)',
    async () => {
      await openComposer();
      const dlg = page.getByRole('dialog');
      await dlg
        .getByText('Compte rendu de chantier')
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      if ((await dlg.getByText('Visite de chantier').count()) > 0)
        throw new Error('« Visite de chantier » subsiste dans le picker');
      if ((await dlg.getByText('Réunion de chantier').count()) > 0)
        throw new Error('« Réunion de chantier » subsiste dans le picker');
      // « Livraison de matériel » retirée du menu (V1 simplifiée).
      if ((await dlg.getByText('Livraison de matériel').count()) > 0)
        throw new Error('« Livraison de matériel » subsiste dans le picker');
    },
  );

  await assert('Un point porte 1 à 3 photos (mini-album), commentaire commun', async () => {
    await page.getByRole('dialog').getByText('Compte rendu de chantier').first().click();
    await page.getByText('point par point', { exact: false }).first().waitFor({ timeout: 6000 });
    // Point 1 : un mini-album de 3 photos (l'upload est asynchrone → on attend).
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles([photo(10), photo(11), photo(12)]);
    await draftSection().locator('img').nth(2).waitFor({ state: 'visible', timeout: 5000 });
    if ((await draftSection().locator('img').count()) !== 3)
      throw new Error('le point ne montre pas ses 3 photos (mini-album)');
    // Limite atteinte → plus de bouton d'ajout de photo.
    if (
      (await draftSection()
        .getByRole('button', { name: /Ajouter \(/ })
        .count()) > 0
    )
      throw new Error('on peut dépasser 3 photos');
    await page.getByPlaceholder(/Décrivez ce point/).fill(P1);
    await page.getByRole('button', { name: 'Client', exact: true }).click();
    await page.getByRole('button', { name: 'Ajouter ce point' }).click();
  });

  await assert('Enchaîner les points puis publier', async () => {
    await addPoint(2, P2, 'Artisan');
    await addPoint(3, P3, 'Client + Artisan');
    await page.getByRole('button', { name: /Publier le compte rendu/ }).click();
    await page.getByRole('button', { name: 'Terminer' }).click();
  });

  await assert('Conducteur : voit les 3 points + badges de diffusion', async () => {
    await page.getByRole('tab', { name: 'Suivi', exact: true }).first().click();
    for (const t of [P1, P2, P3]) await page.getByText(t).first().waitFor({ timeout: 6000 });
    // Badges de diffusion visibles côté conducteur.
    for (const b of ['Client', 'Artisan', 'Client + Artisan'])
      if ((await page.getByText(b, { exact: true }).count()) === 0)
        throw new Error(`badge « ${b} » manquant côté conducteur`);
  });

  await assert(
    'Conducteur : PDF artisan = points artisan + les deux (jamais le point client seul)',
    async () => {
      const text = await openedDocText(() =>
        page.getByRole('button', { name: 'PDF artisan' }).first().click(),
      );
      if (!text.includes(P2) || !text.includes(P3)) throw new Error('PDF artisan incomplet');
      if (text.includes(P1)) throw new Error('le point CLIENT fuite dans le PDF artisan');
      if (!/Version artisan/i.test(text)) throw new Error('le PDF artisan n’est pas marqué');
    },
  );

  await assert('Client : ne voit QUE ses points (le point artisan reste invisible)', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.getByRole('tab', { name: 'Documents' }).first().click();
    await page
      .locator('#section-documents')
      .getByText('Compte rendu de chantier')
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    // Le commentaire ARTISAN ne doit jamais apparaître dans l'espace client.
    if ((await page.getByText(P2).count()) > 0)
      throw new Error('le point artisan fuite dans l’espace client');
  });

  await assert('PDF client = points client + les deux (jamais le point artisan)', async () => {
    const text = await openedDocText(() =>
      page
        .locator('#section-documents')
        .getByRole('button', { name: /Ouvrir : Compte rendu de chantier/ })
        .first()
        .click(),
    );
    if (!text.includes(P1) || !text.includes(P3)) throw new Error('PDF client incomplet');
    if (text.includes(P2)) throw new Error('le point ARTISAN fuite dans le PDF client');
    if (!/Version client/i.test(text)) throw new Error('le PDF client n’est pas marqué');
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
