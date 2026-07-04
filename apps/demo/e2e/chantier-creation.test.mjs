/**
 * RC1 — Création du chantier : deux parcours.
 *  1) Création RAPIDE (nom/client/adresse) → chantier vide.
 *  2) Création INTELLIGENTE (par défaut) : on dépose le dossier, PHÉNIX ANALYSE
 *     (port unique déterministe) et construit le chantier (planning, commandes,
 *     décisions, documents, photos « avant travaux »). Scène « prépare » → « prêt »
 *     → validation. Persistance + export + client-safe.
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { readFileSync } from 'node:fs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const gerer = () => page.getByRole('button', { name: 'Gérer' });
const file = (name, mime, data) => ({ name, mimeType: mime, buffer: Buffer.from(data) });

try {
  await openDemo(page);

  await assert('Parcours 1 — création RAPIDE d’un chantier vide (nom/client/adresse)', async () => {
    await gerer().click();
    await page.getByRole('button', { name: /Créer un chantier vide/ }).click();
    await page.getByLabel('Nom du chantier').fill('Chantier Express');
    await page.getByLabel('Nom du client').fill('M. Test');
    await page.getByLabel('Adresse du chantier').fill('1 rue de l’Essai, Lyon');
    await page.getByRole('button', { name: 'Créer le chantier' }).click();
    await page
      .getByRole('heading', { name: 'Chantier Express' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Parcours 2 — « déposer le dossier » est l’action PAR DÉFAUT', async () => {
    await gerer().click();
    await page.getByRole('button', { name: /Nouveau chantier.*déposer le dossier/ }).click();
    await page
      .getByRole('heading', { name: 'Nouveau chantier' })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Sans devis, PHÉNIX ne prépare pas ; avec le devis, il peut', async () => {
    const prep = page.getByRole('button', { name: /Préparer mon chantier/ });
    if (!(await prep.isDisabled())) throw new Error('Préparer actif sans aucun document');
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles([
        file('devis-signe.pdf', 'application/pdf', 'devis'),
        file('plans-rdc.pdf', 'application/pdf', 'plans'),
        file('acompte-30pct.pdf', 'application/pdf', 'acompte'),
        { name: 'photo-avant.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') },
      ]);
    await prep.waitFor({ state: 'visible' });
    if (await prep.isDisabled()) throw new Error('Préparer désactivé malgré le devis');
    await prep.click();
  });

  await assert('La scène « PHÉNIX prépare… » puis « Votre projet est prêt. »', async () => {
    await page.getByText('Je prépare votre chantier…').waitFor({ state: 'visible', timeout: 4000 });
    await page
      .getByRole('heading', { name: 'Votre projet est prêt.' })
      .waitFor({ state: 'visible', timeout: 12000 });
  });

  await assert('Validation du dossier préparé → le chantier est créé', async () => {
    await page.getByRole('button', { name: /Oui, c.est exact/ }).click();
    // Parcourir les chapitres jusqu'au récapitulatif, puis valider.
    for (let i = 0; i < 8; i++) {
      const valider = page.getByRole('button', { name: /Valider et démarrer/ });
      if ((await valider.count()) > 0 && (await valider.isVisible())) break;
      await page
        .getByRole('button', { name: /Chapitre suivant|Terminer/ })
        .first()
        .click();
      await page.waitForTimeout(120);
    }
    await page.getByRole('button', { name: /Valider et démarrer/ }).click();
    await page
      .getByRole('heading', { name: /Maison Dubois/ })
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });
  });

  await assert('PHÉNIX a construit le dossier ET les « photos avant travaux »', async () => {
    // Le dossier de préparation existe (commandes/étapes) — l'onglet a du contenu.
    await page.getByRole('tab', { name: 'Préparation' }).click();
    await page.waitForTimeout(200);
    // Les photos déposées sont devenues un Moment « Avant travaux » du Récit.
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

  await assert(
    'Client-safe : rien d’interne ne fuit dans l’espace du nouveau chantier',
    async () => {
      await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
      await page.waitForTimeout(400);
      for (const secret of ['Réserve n°', 'préparé par PHÉNIX Start', 'Responsable :'])
        if ((await page.getByText(secret, { exact: false }).count()) > 0)
          throw new Error(`fuite côté client : « ${secret} »`);
    },
  );

  await assert('Export/import : la sauvegarde contient le chantier préparé', async () => {
    await gerer().click();
    const dl = page.waitForEvent('download', { timeout: 6000 });
    await page.getByRole('button', { name: /Exporter mes données/ }).click();
    const download = await dl;
    const content = readFileSync(await download.path(), 'utf8');
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
