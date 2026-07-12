/**
 * RC1 — Lecture EXPERTE du format « Phenix-amo » (le logiciel de devis officiel
 * du conducteur : PDF à polices CID Identity-H, lus par pdf.js). Le lecteur dédié
 * extrait précisément client, adresse chantier, date, montant, lots réels,
 * délais et acompte — sans rien inventer. En dernier recours (PDF non
 * extractible), on peut coller le texte du devis à la main.
 *
 * Fixture anonymisée reproduisant la mise en page réelle (pas de vrai devis).
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { phenixDevisPdf, phenixDevisText, imagePdf } from './pdf-fixtures.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const seen = async (re) => (await page.getByText(re).count()) > 0;
const deposit = async (buffer, name) => {
  await page.getByRole('button', { name: 'Gérer' }).click();
  await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
  await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles([{ name, mimeType: 'application/pdf', buffer }]);
  await page.getByRole('button', { name: /Préparer mon chantier/ }).click();
};
const backHome = async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Bonjour Mickaël/ }).waitFor({ timeout: 8000 });
};

try {
  await openDemo(page);

  await assert('Un devis Phenix-amo est lu par le lecteur EXPERT', async () => {
    await deposit(phenixDevisPdf(), 'Devis_D202601001.pdf');
    await page.getByText('Lecture réelle du devis').waitFor({ state: 'visible', timeout: 15000 });
  });

  await assert('Les champs clés du format Phenix-amo sont extraits précisément', async () => {
    const checks = {
      client: /M\. Jean Testeur/,
      adresse: /5 rue des Essais, 69100 Villeurbanne/,
      montant: /11\s?000/,
      date: /2026-01-15/,
      emetteur: /Phenix-amo/,
      lotReel: /INSTALLATION \/ PREPARATION/,
      delais: /durée 3 mois/,
      acompte: /Acompte de 30/,
    };
    for (const [k, re] of Object.entries(checks))
      if (!(await seen(re))) throw new Error(`champ non extrait : ${k}`);
    await page.getByText(/100\s*% des repères/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Le chantier lu se crée avec le bon client et persiste', async () => {
    await page.getByRole('button', { name: /Entrer dans le chantier/ }).click();
    await page
      .getByRole('heading', { name: /Jean Testeur/ })
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page
      .getByRole('heading', { name: /Jean Testeur/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('PDF non extractible → message clair + collage manuel possible', async () => {
    await backHome();
    await deposit(imagePdf(), 'devis-scanne.pdf');
    await page
      .getByText(/n'est pas extractible automatiquement pour l'instant/)
      .waitFor({ state: 'visible', timeout: 12000 });
    // On n'est pas bloqué : on colle le texte du devis.
    await page.getByLabel('Coller le texte du devis').fill(phenixDevisText());
    await page.getByRole('button', { name: /Analyser ce texte/ }).click();
    // La lecture repart sur le texte collé.
    await page.getByText('Lecture réelle du devis').waitFor({ state: 'visible', timeout: 8000 });
    await page
      .getByText(/M\. Jean Testeur/)
      .first()
      .waitFor({ state: 'visible' });
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
