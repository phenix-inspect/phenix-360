/**
 * ANALYSE & VÉRIFICATION DU DEVIS — de bout en bout, LOT PAR LOT (12/07/2026).
 * =============================================================================
 * PHÉNIX analyse le devis en prestations structurées ; le conducteur vérifie et
 * valide CHAQUE LOT indépendamment. Un lot non validé n'alimente jamais une
 * fonctionnalité. Vérifie : gating (rien tant que rien n'est validé), écran de
 * vérification (prestations + état de lecture + « Voir pourquoi » + totaux),
 * validation partielle (1 lot → exploitable, les autres en attente), puis
 * validation complète (tout exploitable).
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { textPdf } from './pdf-fixtures.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

// Devis COHÉRENT (Σ lignes = Total net HT). Lot 2 = forfait (ligne « à vérifier »).
const DEVIS = [
  'Phenix-amo',
  '17 Rue Grand Rabbin Haguenauer',
  '54000 NANCY France',
  'Devis',
  'N° D-202601-042',
  'En date du : 15/01/2026',
  'M. Jean Testeur',
  '5 rue des Essais',
  '69100 Villeurbanne',
  'N° DESIGNATION QTE U. PRIX U. TVA TOTAL HT',
  '1 1. INSTALLATION / PREPARATION 850,00 €',
  '1.1 Installation de chantier, protection des sols',
  '1,00 u 850,00 € 10,00 % 850,00 €',
  '2 2. PLOMBERIE / SANITAIRE 2 000,00 €',
  '3 3. PEINTURE 1 150,00 €',
  '3.1 Peinture murs et plafonds sejour',
  '50,00 m2 23,00 € 10,00 % 1 150,00 €',
  'Total net HT 4 000,00 €',
  'TVA 10,00 % 400,00 €',
  'Total TTC 4 400,00 €',
];

const P1 = 'Installation de chantier, protection des sols'; // lot 1 🟢
const P2 = 'PLOMBERIE / SANITAIRE'; // lot 2 forfait 🟠
const P3 = 'Peinture murs et plafonds sejour'; // lot 3 🟢
// L'écran de vérification est une modale plein écran (`z-modal`) : on scope tout
// à la modale du dessus pour ne pas heurter la Préparation en dessous.
const modal = () => page.locator('.z-modal').last();
const lotSection = (txt) => modal().locator('section').filter({ hasText: txt }).first();
const closeModal = () => modal().getByRole('button', { name: 'Fermer', exact: true }).click();

const openVerification = async () => {
  await page
    .getByRole('tab', { name: /Préparation/ })
    .first()
    .click();
  await page.getByRole('button', { name: /Vérifier le devis/ }).click();
  await page
    .getByText('Vérifiez votre devis, lot par lot')
    .waitFor({ state: 'visible', timeout: 6000 });
};

try {
  await openDemo(page);

  await assert('Déposer un vrai devis → on entre dans le chantier', async () => {
    await page.getByRole('button', { name: 'Gérer' }).click();
    await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
    await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
    await page
      .locator('input[type=file]:not([capture])')
      .first()
      .setInputFiles([
        { name: 'devis-testeur.pdf', mimeType: 'application/pdf', buffer: textPdf(DEVIS) },
      ]);
    await page.getByRole('button', { name: /Préparer mon chantier/ }).click();
    await page.getByText('Lecture réelle du devis').waitFor({ state: 'visible', timeout: 12000 });
    await page.getByRole('button', { name: /Entrer dans le chantier/ }).click();
    await page
      .getByRole('heading', { name: /Jean Testeur/ })
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });
  });

  await assert('Préparation : prestations masquées, aucun lot validé', async () => {
    await page
      .getByText(/Le devis doit être analysé et validé avant d’afficher les prestations/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    if ((await page.getByText('Le devis', { exact: true }).count()) > 0)
      throw new Error('les prestations sont affichées avant validation');
  });

  await assert('Pré-réception : bloquée tant qu’aucun lot n’est validé', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByRole('dialog').getByText('Pré-réception', { exact: true }).click();
    await page
      .getByText(/Le devis doit être analysé et validé avant de lancer la pré-réception/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await closeModal();
  });

  await assert('Écran de vérification : prestations + état de lecture + totaux', async () => {
    await openVerification();
    const values = await page.locator('input').evaluateAll((els) => els.map((e) => e.value));
    for (const p of [P1, P2, P3])
      if (!values.includes(p)) throw new Error(`prestation « ${p} » absente`);
    if ((await page.getByText('Fiable').count()) === 0)
      throw new Error('aucun état de confiance « Fiable »');
    await page.getByText('Vérification des totaux').waitFor({ state: 'visible' });
    if ((await page.getByText(/Écart de/).count()) > 0)
      throw new Error('un écart est signalé alors que le devis est cohérent');
  });

  await assert('« Voir pourquoi » explique une ligne non vérifiée + extrait analysé', async () => {
    const lot2 = lotSection(P2);
    await lot2
      .getByRole('button', { name: /Voir pourquoi/ })
      .first()
      .click();
    await lot2.getByText(/Extrait analysé/).waitFor({ state: 'visible', timeout: 4000 });
    await lot2
      .getByText(/forfaitaire|Montant|TVA/)
      .first()
      .waitFor({ state: 'visible' });
  });

  await assert('Valider UN lot → validation partielle (1 sur 3)', async () => {
    await lotSection('INSTALLATION').getByRole('button', { name: 'Valider ce lot' }).click();
    await modal().getByText('1/3 lots validés').waitFor({ state: 'visible', timeout: 4000 });
    await closeModal();
  });

  await assert(
    'Préparation : bannière « 1 lot sur 3 validés » + section « Le devis »',
    async () => {
      await page
        .getByText(/1 lot sur 3 validé/)
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      await page
        .getByText('Le devis', { exact: true })
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
    },
  );

  await assert('Pré-réception : SEUL le lot validé alimente les prestations', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByRole('dialog').getByText('Pré-réception', { exact: true }).click();
    await page
      .getByText('Vérifiez chaque prestation vendue')
      .waitFor({ state: 'visible', timeout: 6000 });
    await page.getByText(P1, { exact: true }).first().waitFor({ state: 'visible', timeout: 6000 });
    if ((await page.getByText(P3, { exact: true }).count()) > 0)
      throw new Error('un lot NON validé alimente la pré-réception');
    await closeModal();
  });

  await assert('Tout valider → tous les lots exploitables', async () => {
    await openVerification();
    await modal().getByRole('button', { name: 'Tout valider' }).click();
    await modal().getByText('3/3 lots validés').waitFor({ state: 'visible', timeout: 4000 });
    await closeModal();
    // Plus de bannière « à vérifier » : le devis est entièrement validé.
    if (
      (await page
        .getByText(/Le devis doit être analysé et validé avant d’afficher les prestations/)
        .count()) > 0
    )
      throw new Error('le message « à valider » subsiste après validation complète');
  });

  await assert('Pré-réception : reprend TOUTES les prestations validées', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByRole('dialog').getByText('Pré-réception', { exact: true }).click();
    await page
      .getByText('Vérifiez chaque prestation vendue')
      .waitFor({ state: 'visible', timeout: 6000 });
    for (const p of [P1, P3])
      await page.getByText(p, { exact: true }).first().waitFor({ state: 'visible', timeout: 6000 });
    await closeModal();
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
