/**
 * « Dans les coulisses » — viewer photo IMMERSIF (retour terrain RC1 + RC2).
 * =============================================================================
 * Le viewer est une expérience type Photos iPhone / Instagram : la photo est le
 * sujet, l'interface s'efface. On vérifie l'ossature (RC1) ET l'immersion (RC2) :
 *   • plein écran noir, photo entière (object-contain) contenue, body verrouillé ;
 *   • header ET concierge Léon passent DESSOUS ;
 *   • chrome minimal : un tap sur la photo masque tout, un mouvement le ramène ;
 *   • commentaires dans un Bottom Sheet (ne vole plus de hauteur) ;
 *   • fermeture : croix, Échap, clic sur le fond ; focus rendu à l'ouvrant ;
 *   • navigation flèches + pellicule ; zoom ; mosaïque ; vignette Bibliothèque.
 * Photos réelles requises (le seed n'a que des tuiles dégradées).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 390, height: 844 });
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

/** Le viewer plein écran (unique dialog en `aria-modal`). */
const viewer = (p = page) => p.locator('[role="dialog"][aria-modal="true"]');

/** Réveille le chrome (mouvement souris au centre) — RC2 le montre au mouvement. */
const wake = async (p = page) => {
  const vp = p.viewportSize();
  await p.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2));
};

/** Attend une opacité donnée de la barre haute (chrome niveau 1). */
const waitTop = (op, p = page) =>
  p.waitForFunction(
    (o) => {
      const el = document.querySelector('[data-chrome="top"]');
      return Boolean(el) && getComputedStyle(el).opacity === o;
    },
    op,
    { timeout: 3000 },
  );

const openCoulisses = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Dans les coulisses' }).first().click();
  await page
    .getByRole('heading', { name: 'Dans les coulisses du chantier' })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });
};

const albumCover = () =>
  page
    .locator('article')
    .filter({ hasText: ALBUM })
    .first()
    .getByRole('button', { name: /Ouvrir l’album/ });

const openAlbum = async () => {
  await albumCover().click();
  await viewer().waitFor({ state: 'visible', timeout: 5000 });
};

const topIsViewer = (x, y) =>
  page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return Boolean(el && el.closest('[role="dialog"][aria-modal="true"]'));
    },
    { x, y },
  );

try {
  await openDemo(page);

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

  await assert('Carte album : aperçu multi-photos (mosaïque ≥ 2 images)', async () => {
    await openCoulisses();
    await albumCover().waitFor({ state: 'visible', timeout: 6000 });
    if ((await albumCover().locator('img').count()) < 2)
      throw new Error('mosaïque attendue (≥ 2 images)');
  });

  await assert('Viewer : fond noir plein écran + photo entière (object-contain)', async () => {
    await openAlbum();
    const vp = page.viewportSize();
    const box = await viewer().boundingBox();
    if (box.x > 1 || box.y > 1 || box.width < vp.width - 1 || box.height < vp.height - 1)
      throw new Error(`le viewer ne couvre pas la fenêtre : ${JSON.stringify(box)}`);
    const bg = await viewer().evaluate((el) => getComputedStyle(el).backgroundColor);
    if (bg !== 'rgb(0, 0, 0)') throw new Error(`fond non noir : ${bg}`);
    const img = viewer().locator('img').first();
    const cls = await img.getAttribute('class');
    if (!cls || !cls.includes('object-contain'))
      throw new Error('photo recadrée (pas object-contain)');
    const ib = await img.boundingBox();
    if (
      ib.y < -1 ||
      ib.x < -1 ||
      ib.y + ib.height > vp.height + 1 ||
      ib.x + ib.width > vp.width + 1
    )
      throw new Error('la photo déborde de la fenêtre (scroll nécessaire)');
  });

  await assert('Viewer : body verrouillé (aucun scroll de page)', async () => {
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    if (overflow !== 'hidden') throw new Error(`body non verrouillé : ${overflow}`);
  });

  await assert('Viewer : le header passe DESSOUS (occulté)', async () => {
    const vp = page.viewportSize();
    if (!(await topIsViewer(Math.round(vp.width / 2), 8)))
      throw new Error('le header reste visible au-dessus du viewer');
  });

  // ---- RC2 : chrome minimal, tap pour masquer, mouvement pour révéler --------
  await assert('RC2 : un tap masque le chrome, un mouvement le ramène', async () => {
    const vp = page.viewportSize();
    await wake();
    await waitTop('1'); // révélé au mouvement
    // Tap sur la photo (centre) → immersion : le chrome disparaît.
    await page.mouse.click(Math.round(vp.width / 2), Math.round(vp.height / 2));
    await waitTop('0');
    // Le moindre mouvement le ramène.
    await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2) - 60);
    await waitTop('1');
  });

  await assert('Viewer : pellicule + saut de photo (compteur clair)', async () => {
    await wake();
    await viewer()
      .getByText(/1\s*\/\s*3/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    await viewer().getByRole('button', { name: 'Aller à la photo 3' }).click();
    await viewer()
      .getByText(/3\s*\/\s*3/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Viewer : zoom + flèches masquées pendant le zoom', async () => {
    await wake();
    await viewer().getByRole('button', { name: 'Aller à la photo 2' }).click();
    if (
      (await viewer()
        .getByRole('button', { name: /Photo (précédente|suivante)/ })
        .count()) === 0
    )
      throw new Error('flèches absentes avant zoom');
    await viewer().getByRole('button', { name: 'Zoomer' }).click();
    const dezoom = viewer().getByRole('button', { name: 'Dézoomer' });
    if ((await dezoom.getAttribute('aria-pressed')) !== 'true') throw new Error('zoom inactif');
    if (
      (await viewer()
        .getByRole('button', { name: /Photo (précédente|suivante)/ })
        .count()) !== 0
    )
      throw new Error('flèches visibles pendant le zoom');
    await dezoom.click();
  });

  // ---- RC2 : commentaires dans un Bottom Sheet ------------------------------
  await assert('RC2 : les commentaires ouvrent un Bottom Sheet (photo derrière)', async () => {
    await wake();
    await viewer()
      .getByRole('button', { name: /Commentaires \(/ })
      .click();
    const sheet = page.getByRole('dialog', { name: 'Commentaires de la photo' });
    await sheet.waitFor({ state: 'visible', timeout: 5000 });
    // La photo (viewer) reste visible derrière la feuille.
    if (!(await viewer().isVisible())) throw new Error('le viewer disparaît sous la feuille');
    await sheet.getByRole('button', { name: 'Réduire les commentaires' }).click();
    await sheet.waitFor({ state: 'hidden', timeout: 5000 });
  });

  await assert('RC2 : fermeture au clavier (Échap)', async () => {
    await page.keyboard.press('Escape');
    await viewer().waitFor({ state: 'hidden', timeout: 5000 });
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    if (overflow === 'hidden') throw new Error('body toujours verrouillé après fermeture');
  });

  await assert('RC2 : clic sur le fond noir ferme le viewer', async () => {
    await openAlbum();
    // Point dans la bande noire (au-dessus de la photo carrée, sous la barre haute).
    await page.mouse.click(Math.round(page.viewportSize().width / 2), 150);
    await viewer().waitFor({ state: 'hidden', timeout: 5000 });
  });

  // ---- RC2 : focus rendu à l'ouvrant + ouverture depuis la Bibliothèque -----
  await assert('RC2 : Bibliothèque ouvre le viewer, focus rendu à la fermeture', async () => {
    await page.getByRole('tab', { name: 'Bibliothèque' }).first().click();
    const tuile = page.getByRole('button', { name: /^Ouvrir la photo/ }).first();
    await tuile.waitFor({ state: 'visible', timeout: 6000 });
    await tuile.click();
    await viewer().waitFor({ state: 'visible', timeout: 5000 });
    await wake();
    await viewer().getByRole('button', { name: 'Fermer' }).first().click();
    await viewer().waitFor({ state: 'hidden', timeout: 5000 });
    const label = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    if (!label || !/Ouvrir la photo/.test(label))
      throw new Error(`focus non rendu à l'ouvrant (actif : ${label})`);
  });

  // ---- Côté CLIENT : le concierge Léon passe DESSOUS le viewer -------------
  await assert('Client : le widget Léon passe DESSOUS le viewer (occulté)', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.getByRole('tab', { name: 'Dans les coulisses' }).first().click();
    await page.getByRole('button', { name: 'Ouvrir PHÉNIX' }).waitFor({ state: 'visible' });
    await page
      .locator('#section-fil article')
      .filter({ hasText: ALBUM })
      .first()
      .getByRole('button', { name: /Ouvrir l’album/ })
      .click();
    await viewer().waitFor({ state: 'visible', timeout: 5000 });
    const vp = page.viewportSize();
    if (!(await topIsViewer(vp.width - 24, vp.height - 24)))
      throw new Error('Léon reste visible au-dessus du viewer');
    await page.keyboard.press('Escape');
    await viewer().waitFor({ state: 'hidden', timeout: 5000 });
  });

  // ---- DESKTOP : même viewer plein écran, photo contenue -------------------
  await assert('Desktop : viewer plein écran + photo contenue', async () => {
    const desk = await session(browser, { width: 1280, height: 800 });
    await openDemo(desk.page);
    await desk.page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await desk.page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await desk.page.getByRole('button', { name: /Publier dans les coulisses/ }).click();
    const dlg = desk.page.getByRole('dialog');
    await dlg.getByRole('heading', { name: 'Créer un moment' }).waitFor({ state: 'visible' });
    await dlg.locator('input[type=file]').setInputFiles(THREE);
    await dlg.getByPlaceholder(/Décrivez ce moment/).fill(ALBUM);
    await dlg.getByRole('button', { name: /Créer le moment/ }).click();
    await dlg.waitFor({ state: 'detached', timeout: 8000 });
    await desk.page.getByRole('tab', { name: 'Dans les coulisses' }).first().click();
    await desk.page
      .locator('article')
      .filter({ hasText: ALBUM })
      .first()
      .getByRole('button', { name: /Ouvrir l’album/ })
      .click();
    const v = viewer(desk.page);
    await v.waitFor({ state: 'visible', timeout: 5000 });
    const vp = desk.page.viewportSize();
    const box = await v.boundingBox();
    if (box.width < vp.width - 1 || box.height < vp.height - 1)
      throw new Error('viewer desktop ne couvre pas la fenêtre');
    const ib = await v.locator('img').first().boundingBox();
    if (ib.y + ib.height > vp.height + 1 || ib.x + ib.width > vp.width + 1)
      throw new Error('photo desktop déborde de la fenêtre');
    if (desk.consoleErrors.length > 0) throw new Error(desk.consoleErrors.slice(0, 3).join(' | '));
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
