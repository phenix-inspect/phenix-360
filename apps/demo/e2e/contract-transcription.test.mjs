/**
 * TRANSCRIPTION CONTRACTUELLE — de bout en bout (refonte 12/07/2026).
 * =============================================================================
 * Le devis n'est plus « lu » à moitié : PHÉNIX en transcrit les PRESTATIONS
 * structurées (lots → postes chiffrés) et RIEN n'est contractuel tant que le
 * conducteur n'a pas VALIDÉ la transcription face à l'original. Vérifie :
 *  • un vrai devis déposé → transcription structurée en BROUILLON ;
 *  • Préparation n'affiche PAS les prestations tant que non validé (message) ;
 *  • pré-réception bloquée tant que non validé ;
 *  • écran « Vérifier la transcription » : prestations + confiance + totaux ;
 *  • réconciliation : un écart bloque la validation aveugle ;
 *  • après validation : prestations en Préparation ET reprises en pré-réception.
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { textPdf } from './pdf-fixtures.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

// Devis « Phenix-amo » COHÉRENT (Σ lignes = Total net HT), anonymisé.
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
  '2.1 Remplacement receveur et robinetterie',
  '1,00 forfait 2 000,00 € 10,00 % 2 000,00 €',
  '3 3. PEINTURE 1 150,00 €',
  '3.1 Peinture murs et plafonds sejour',
  '50,00 m2 23,00 € 10,00 % 1 150,00 €',
  'Total net HT 4 000,00 €',
  'TVA 10,00 % 400,00 €',
  'Total TTC 4 400,00 €',
];

const P1 = 'Installation de chantier, protection des sols';
const P2 = 'Remplacement receveur et robinetterie';
const P3 = 'Peinture murs et plafonds sejour';

try {
  await openDemo(page);

  await assert(
    'Déposer un vrai devis → PHÉNIX prépare puis on entre dans le chantier',
    async () => {
      await page.getByRole('button', { name: 'Gérer' }).click();
      await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
      await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
      await page
        .locator('input[type=file]')
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
    },
  );

  await assert(
    'Préparation : prestations MASQUÉES tant que le devis n’est pas validé',
    async () => {
      // Message contractuel obligatoire + bouton de vérification.
      await page
        .getByText(/Le devis doit être analysé et validé avant d’afficher les prestations/)
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      // La section « Le devis » (prestations) n'est PAS encore affichée.
      if ((await page.getByText('Le devis', { exact: true }).count()) > 0)
        throw new Error('les prestations sont affichées avant validation');
    },
  );

  await assert('Pré-réception : bloquée tant que le contrat n’est pas validé', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByRole('dialog').getByText('Pré-réception', { exact: true }).click();
    await page
      .getByText(/Le devis doit être analysé et validé avant de lancer la pré-réception/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await page.getByRole('button', { name: 'Fermer' }).click();
  });

  await assert('Écran de vérification : prestations STRUCTURÉES + confiance + totaux', async () => {
    await page.getByRole('button', { name: /Vérifier la transcription du devis/ }).click();
    await page
      .getByText('Contrôlez le contrat face à votre devis')
      .waitFor({ state: 'visible', timeout: 6000 });
    const values = await page.locator('input').evaluateAll((els) => els.map((e) => e.value));
    for (const p of [P1, P2, P3])
      if (!values.includes(p)) throw new Error(`prestation « ${p} » absente de la transcription`);
    // Chaque poste chiffré porte un niveau de confiance.
    if ((await page.getByText('Confiance élevée').count()) === 0)
      throw new Error('aucun niveau de confiance affiché');
    // Réconciliation cohérente : pas d'alerte d'écart.
    await page.getByText('Réconciliation des totaux').waitFor({ state: 'visible' });
    if ((await page.getByText(/Écart de/).count()) > 0)
      throw new Error('un écart est signalé alors que le devis est cohérent');
  });

  await assert('Réconciliation : casser un montant BLOQUE la validation aveugle', async () => {
    const montant = page.getByLabel('Montant HT').first();
    await montant.fill('999');
    await page
      .getByText(/Écart de/)
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    if (!(await page.getByRole('button', { name: /Valider la transcription/ }).isDisabled()))
      throw new Error('la validation devrait être bloquée en cas d’écart');
    // On corrige : la cohérence revient et la validation redevient possible.
    await montant.fill('850');
    await page.waitForTimeout(200);
    if (await page.getByRole('button', { name: /Valider la transcription/ }).isDisabled())
      throw new Error('la validation devrait redevenir possible une fois corrigé');
  });

  await assert('Valider la transcription → le contrat devient exploitable', async () => {
    await page.getByRole('button', { name: /Valider la transcription/ }).click();
    // Retour à la Préparation : la section « Le devis » apparaît, le message disparaît.
    await page
      .getByText('Le devis', { exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    if (
      (await page
        .getByText(/Le devis doit être analysé et validé avant d’afficher les prestations/)
        .count()) > 0
    )
      throw new Error('le message « à valider » subsiste après validation');
  });

  await assert('Pré-réception : reprend EXACTEMENT les prestations validées', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByRole('dialog').getByText('Pré-réception', { exact: true }).click();
    await page
      .getByText('Vérifiez chaque prestation vendue')
      .waitFor({ state: 'visible', timeout: 6000 });
    for (const p of [P1, P2, P3])
      await page.getByText(p, { exact: true }).first().waitFor({ state: 'visible', timeout: 6000 });
    await page.getByRole('button', { name: 'Fermer' }).click();
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
