/**
 * RC1 — Création du chantier : UN SEUL parcours « Nouveau chantier ».
 *  • Des documents déposés → PHÉNIX ANALYSE (port unique déterministe), joue la
 *    scène « prépare » ENRICHIE, puis un écran de SYNTHÈSE montre tout ce qu'il a
 *    construit avant d'entrer.
 *  • Aucun document → bascule naturelle en création rapide (nom/client/adresse).
 * Persistance + export + client-safe.
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { readFileSync } from 'node:fs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const gerer = () => page.getByRole('button', { name: 'Gérer' });
const nouveau = () => page.getByRole('button', { name: /^Nouveau chantier$/ });
const file = (name, mime, data) => ({ name, mimeType: mime, buffer: Buffer.from(data) });

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
    // Aucun document : le bouton crée le chantier dès qu'un nom est saisi.
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

  await assert('Avec documents → PHÉNIX prépare (même bouton, même écran)', async () => {
    await gerer().click();
    await nouveau().click();
    await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles([
        file('devis-signe.pdf', 'application/pdf', 'devis'),
        file('plans-rdc.pdf', 'application/pdf', 'plans'),
        file('acompte-30pct.pdf', 'application/pdf', 'acompte'),
        { name: 'photo-avant.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') },
      ]);
    await page.getByRole('button', { name: /Préparer mon chantier/ }).click();
  });

  await assert('La scène « PHÉNIX prépare… » enrichie se joue', async () => {
    await page.getByText('Je prépare votre chantier…').waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('SYNTHÈSE : PHÉNIX montre tout ce qu’il a construit', async () => {
    await page
      .getByRole('heading', { name: /Maison Dubois/ })
      .waitFor({ state: 'visible', timeout: 12000 });
    // Un vrai récapitulatif du dossier construit.
    for (const bloc of ['Le client', 'Le planning', 'Les commandes', 'Les documents']) {
      await page.getByText(bloc, { exact: true }).first().waitFor({ state: 'visible' });
    }
    await page
      .getByText(/Cuisines Schmidt/)
      .first()
      .waitFor({ state: 'visible' });
    await page.getByText('Photos avant travaux', { exact: true }).waitFor({ state: 'visible' });
  });

  await assert('« Entrer dans le chantier » crée et ouvre le chantier préparé', async () => {
    await page.getByRole('button', { name: /Entrer dans le chantier/ }).click();
    await page
      .getByRole('heading', { name: /Maison Dubois/ })
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });
  });

  await assert('Le dossier + les « photos avant travaux » sont bien là', async () => {
    await page.getByRole('tab', { name: 'Préparation' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('tab', { name: 'Récit' }).click();
    await page.getByText('Avant travaux').first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Persistance : après rechargement, le chantier préparé est là', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page
      .getByRole('heading', { name: /Maison Dubois/ })
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
    if (!content.includes('Maison Dubois'))
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
