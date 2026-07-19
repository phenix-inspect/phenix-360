/**
 * RC1 — Création du chantier : UN SEUL parcours « Nouveau chantier ».
 *  • Des documents déposés → PHÉNIX LIT RÉELLEMENT le devis (extraction texte
 *    locale), joue la scène « prépare », puis un écran de SYNTHÈSE montre ce qu'il
 *    a réellement extrait avant d'entrer.
 *  • Aucun document → bascule naturelle en création rapide (nom/client/adresse).
 * Persistance + export + client-safe.
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { textPdf, DEVIS_LINES } from './pdf-fixtures.mjs';
import { readFileSync } from 'node:fs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const gerer = () => page.getByRole('button', { name: 'Gérer' });
const nouveau = () => page.getByRole('button', { name: /^Nouveau chantier$/ });

try {
  await openDemo(page);

  await assert('Un SEUL bouton « Nouveau chantier » (plus de vide / intelligent)', async () => {
    await gerer().click();
    if ((await page.getByRole('button', { name: /chantier vide|déposer le dossier/i }).count()) > 0)
      throw new Error('il reste un bouton « vide » ou « déposer le dossier »');
    await nouveau().click();
    await page
      .getByRole('heading', { name: 'Nouveau chantier' })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Sans document → bascule NATURELLE sur la création rapide', async () => {
    const creer = page.getByRole('button', { name: /Créer le chantier/ });
    if (!(await creer.isDisabled())) throw new Error('« Créer » actif sans nom');
    await page.getByLabel('Nom du chantier').fill('Chantier Express');
    await page.getByLabel('Nom du client').fill('M. Test');
    await creer.click();
    await page
      .getByRole('heading', { name: 'Chantier Express' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Avec un devis → PHÉNIX prépare (même bouton, même écran)', async () => {
    await gerer().click();
    await nouveau().click();
    await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
    await page
      .locator('input[type=file]:not([capture])')
      .first()
      .setInputFiles([
        { name: 'devis-signe.pdf', mimeType: 'application/pdf', buffer: textPdf(DEVIS_LINES) },
        { name: 'photo-avant.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') },
      ]);
    await page.getByRole('button', { name: /Préparer mon chantier/ }).click();
    await page.getByText('Je prépare votre chantier…').waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('SYNTHÈSE : PHÉNIX montre ce qu’il a RÉELLEMENT lu dans le devis', async () => {
    await page.getByText('Lecture réelle du devis').waitFor({ state: 'visible', timeout: 12000 });
    // Des données réellement extraites du texte du devis.
    await page.getByText('Mme Camille Martin').first().waitFor({ state: 'visible' });
    await page.getByText('24 rue Bugeaud, 69006 Lyon').first().waitFor({ state: 'visible' });
    await page
      .getByText(/46\s?200/)
      .first()
      .waitFor({ state: 'visible' });
    for (const bloc of ['Le client', 'Le bien', 'Les documents'])
      await page.getByText(bloc, { exact: true }).first().waitFor({ state: 'visible' });
  });

  await assert('« Entrer dans le chantier » crée et ouvre le chantier préparé', async () => {
    await page.getByRole('button', { name: /Entrer dans le chantier/ }).click();
    await page
      .getByRole('heading', { name: /Mme Camille Martin/ })
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });
  });

  await assert(
    'La création attribue automatiquement un code chantier (ville Lyon → LY)',
    async () => {
      // Adresse du devis « … 69006 Lyon » ⇒ VV = LY. Le code est généré à la création.
      const codes = await page.evaluate(() =>
        Array.from(document.querySelectorAll('span, p'))
          .map((e) => (e.textContent || '').trim())
          .filter((t) => /^\d{2}-[A-Z]{2}-\d{3}$/.test(t)),
      );
      const code = codes[0] ?? '';
      if (!/^\d{2}-LY-\d{3}$/.test(code))
        throw new Error(`code attendu au format AA-LY-NNN, obtenu « ${code} »`);
    },
  );

  await assert('Les « photos avant travaux » sont bien au Récit', async () => {
    await page.getByRole('tab', { name: 'Dans les coulisses' }).click();
    await page.getByText('Avant travaux').first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Persistance : après rechargement, le chantier préparé est là', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page
      .getByRole('heading', { name: /Mme Camille Martin/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Client-safe : rien d’interne ne fuit côté client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(400);
    for (const secret of ['Réserve n°', 'préparé par PHÉNIX Start', 'Responsable :'])
      if ((await page.getByText(secret, { exact: false }).count()) > 0)
        throw new Error(`fuite côté client : « ${secret} »`);
  });

  await assert('Export : la sauvegarde contient le chantier préparé', async () => {
    await gerer().click();
    const dl = page.waitForEvent('download', { timeout: 6000 });
    await page.getByRole('button', { name: /Exporter mes données/ }).click();
    const content = readFileSync(await (await dl).path(), 'utf8');
    if (!content.includes('Camille Martin'))
      throw new Error('la sauvegarde exportée ne contient pas le chantier préparé');
    await page.keyboard.press('Escape');
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
