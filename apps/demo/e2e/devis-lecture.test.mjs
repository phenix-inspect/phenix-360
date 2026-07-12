/**
 * RC1 — Lecture RÉELLE du devis à la création. PHÉNIX lit vraiment le contenu du
 * PDF (extraction texte locale, sans réseau) et n'invente jamais :
 *  • PDF avec texte → extraction réelle (client, adresse, montant, date,
 *    prestations, pièces, matériaux, délais, acompte, entreprise) + confiance ;
 *  • PDF scanné/image → message clair « semble être une image » ;
 *  • PDF nommé « devis » mais sans info exploitable → rien d'inventé (non détecté).
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { textPdf, imagePdf, DEVIS_LINES } from './pdf-fixtures.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const gerer = () => page.getByRole('button', { name: 'Gérer' });
const seen = async (re) => (await page.getByText(re).count()) > 0;

const deposit = async (buffer, name) => {
  await gerer().click();
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

  await assert('PDF avec texte → PHÉNIX lit réellement le devis', async () => {
    await deposit(textPdf(DEVIS_LINES), 'devis-signe.pdf');
    await page.getByText('Lecture réelle du devis').waitFor({ state: 'visible', timeout: 12000 });
  });

  await assert('Les informations clés sont RÉELLEMENT extraites', async () => {
    const checks = {
      client: /Mme Camille Martin/,
      adresse: /24 rue Bugeaud, 69006 Lyon/,
      montant: /46\s?200/,
      date: /2025-03-12/,
      entreprise: /RENOV BATIMENT SARL/,
      prestations: /Dépose & démolition/,
      pieces: /Salle de bain/,
      materiaux: /Grès cérame/,
      delais: /8 semaines/,
      acompte: /Acompte de 30/,
    };
    for (const [k, re] of Object.entries(checks))
      if (!(await seen(re))) throw new Error(`information non extraite : ${k}`);
  });

  await assert('Une confiance est affichée (lecture jugée fiable)', async () => {
    await page.getByText(/100\s*% des repères/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('PDF scanné / image → message clair, aucune invention', async () => {
    await backHome();
    await deposit(imagePdf(), 'devis-scanne.pdf');
    await page
      .getByText(/n'est pas extractible automatiquement pour l'instant/)
      .waitFor({ state: 'visible', timeout: 12000 });
    if (await seen(/Mme Camille Martin/)) throw new Error('des données ont été inventées');
  });

  await assert('PDF nommé « devis » mais sans info exploitable → non détecté', async () => {
    await backHome();
    await deposit(
      textPdf([
        'Ce document ne contient aucune information exploitable pour le moment.',
        'Merci de votre comprehension.',
      ]),
      'devis-vide.pdf',
    );
    await page.getByText('Lecture réelle du devis').waitFor({ state: 'visible', timeout: 12000 });
    await page.getByText(/0\s*% des repères/).waitFor({ state: 'visible' });
    await page.getByText(/Non détecté/).waitFor({ state: 'visible' });
    // On n'a rien inventé : pas de client fabriqué.
    if (await seen(/Mme Camille Martin/)) throw new Error('un client a été inventé');
  });

  await assert('Le chantier réellement lu se crée et persiste', async () => {
    await backHome();
    await deposit(textPdf(DEVIS_LINES), 'devis-signe.pdf');
    await page.getByRole('button', { name: /Entrer dans le chantier/ }).click();
    await page
      .getByRole('heading', { name: /Mme Camille Martin/ })
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page
      .getByRole('heading', { name: /Mme Camille Martin/ })
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
