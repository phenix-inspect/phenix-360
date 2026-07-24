/**
 * CONDITION BÊTA #3 — AVENANTS : DÉPÔT HONNÊTE, JAMAIS DE FABRICATION.
 * ===================================================================
 * « Déposer un avenant signé » ne fabrique AUCUNE donnée et n'intègre RIEN
 * automatiquement. Le vrai flux : déposer le document signé → saisir ce que
 * l'avenant modifie → relire les impacts proposés → VALIDATION HUMAINE →
 * consolidation. Tant qu'il n'est pas validé, l'avenant reste un BROUILLON qui
 * ne nourrit NI le devis consolidé, NI le budget, NI la Préparation, NI Léon.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1180, height: 2200 });
const { assert, summary } = harness();

const PDF = {
  name: 'avenant-signe.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 avenant'),
};
const POSTE = 'Plan de travail quartz (avenant test bêta)';
const dialog = () => page.getByRole('dialog');
const devisSection = () => page.locator('section').filter({ hasText: 'Le devis' }).first();

const openPreparation = async () => {
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
  await page.getByRole('tab', { name: 'Préparation' }).click();
  await page
    .getByRole('button', { name: /Déposer un avenant signé/ })
    .waitFor({ state: 'visible', timeout: 8000 });
};

try {
  await openDemo(page);
  await openPreparation();

  await assert('Dépôt : le document signé est OBLIGATOIRE (pas de fabrication)', async () => {
    await page.getByRole('button', { name: /Déposer un avenant signé/ }).click();
    await dialog()
      .getByRole('heading', { name: 'Déposer un avenant signé' })
      .waitFor({ state: 'visible', timeout: 6000 });
    // Sans document ni poste saisi, on ne peut pas enregistrer : PHÉNIX n'invente rien.
    const save = dialog().getByRole('button', { name: /Enregistrer le brouillon/ });
    if (await save.isEnabled()) throw new Error('enregistrement possible sans document ni saisie');
  });

  await assert('Dépôt : document réel + poste saisi → impacts proposés calculés', async () => {
    await dialog().locator('input[type=file]:not([capture])').setInputFiles(PDF);
    await dialog().getByText(PDF.name).first().waitFor({ state: 'visible', timeout: 6000 });
    await dialog()
      .getByPlaceholder(/Désignation du poste/)
      .fill(POSTE);
    await dialog().locator('input[type=number]').first().fill('2500');
    // Les impacts proposés apparaissent, calculés depuis la saisie (pas inventés).
    await dialog()
      .getByText(/Impacts proposés/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await dialog()
      .getByText(/budget \+.*HT/)
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Enregistrer → BROUILLON non intégré (le contrat ne bouge pas)', async () => {
    await dialog()
      .getByRole('button', { name: /Enregistrer le brouillon/ })
      .click();
    await dialog().waitFor({ state: 'detached', timeout: 6000 });
    // La carte brouillon est là, clairement « non intégré ».
    await page
      .getByText(/Brouillon — non intégré/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    // Le poste NE figure PAS dans le devis consolidé (rien n'est intégré).
    await devisSection()
      .getByRole('button', { name: /Voir le devis/ })
      .click();
    await page.waitForTimeout(300);
    if ((await page.getByText(POSTE, { exact: false }).count()) > 1)
      throw new Error('le poste brouillon apparaît déjà dans le devis consolidé (fuite)');
    // Refermer le détail du devis.
    await devisSection()
      .getByRole('button', { name: /Masquer/ })
      .click();
  });

  await assert('VALIDATION HUMAINE → l’avenant est intégré au contrat', async () => {
    await page.getByRole('button', { name: /Valider et intégrer l’avenant/ }).click();
    // Note d'intégration de PHÉNIX.
    await page
      .getByText(/J'ai intégré l'avenant/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    // Plus de brouillon en attente.
    if ((await page.getByText(/Brouillon — non intégré/).count()) > 0)
      throw new Error('le brouillon subsiste après validation');
    // Le poste figure DÉSORMAIS dans le devis consolidé.
    await devisSection()
      .getByRole('button', { name: /Voir le devis/ })
      .click();
    await page
      .getByText(POSTE, { exact: false })
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
