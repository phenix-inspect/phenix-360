/**
 * PRÉ-RÉCEPTION — raccourci intelligent vers les prestations incomplètes.
 * =============================================================================
 * Une alerte doit TOUJOURS conduire directement à l'action qui la résout. Quand
 * la synthèse indique « N prestations à compléter », le conducteur clique et
 * PHÉNIX : revient à la vérification, défile jusqu'à la BONNE prestation, la met
 * en évidence, ouvre le champ conditionnel et pose le focus dans le champ
 * obligatoire manquant. Navigation Précédent/Suivant + compteur live, validation
 * bloquée tant qu'un champ manque, état positif une fois tout complet.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1180, height: 1400 });
const { assert, summary } = harness();

const P_WC = 'WC suspendu (fourniture & pose)';
const P_FAIENCE = 'Faïence murale';
const P_ETANCHEITE = 'Étanchéité sous carrelage';
const P_CARRELAGE = 'Carrelage sol salle de bain';

const card = (label) => page.locator('li').filter({ hasText: label }).first();
const setStatut = async (label, name) => {
  await card(label).getByRole('button', { name, exact: true }).click();
};
const synthese = () => page.getByRole('button', { name: 'Voir la synthèse' });
const focusedId = () => page.evaluate(() => document.activeElement?.id ?? '');
/** Attend que le focus soit réellement posé dans un champ obligatoire « champ-… ». */
const waitChampFocus = () =>
  page.waitForFunction(() => (document.activeElement?.id ?? '').startsWith('champ-'), null, {
    timeout: 5000,
  });

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('dialog').getByText('Pré-réception', { exact: true }).click();
  await page
    .getByText('Vérifiez chaque prestation vendue')
    .waitFor({ state: 'visible', timeout: 8000 });

  await assert(
    '1 réserve sans commentaire → synthèse « 1 à compléter » + sous-texte explicite',
    async () => {
      await setStatut(P_WC, 'Avec réserve'); // réserve sans commentaire → incomplet
      await synthese().click();
      await page.getByText('Synthèse de la pré-réception').waitFor({ state: 'visible' });
      await page
        .getByText(/1 prestation à compléter/)
        .first()
        .waitFor({ state: 'visible', timeout: 4000 });
      // Sous-texte : quelle prestation, quel champ.
      await page
        .getByText(/commentaire de réserve manquant/)
        .first()
        .waitFor({ state: 'visible', timeout: 4000 });
    },
  );

  await assert(
    'Clic sur l’alerte → retour vérification, carte mise en évidence, champ focusé',
    async () => {
      await page
        .getByText(/1 prestation à compléter/)
        .first()
        .click();
      await page
        .getByText('Vérifiez chaque prestation vendue')
        .waitFor({ state: 'visible', timeout: 6000 });
      // La carte visée porte le message local « Champ obligatoire à compléter ».
      await card(P_WC)
        .getByText('Champ obligatoire à compléter')
        .waitFor({ state: 'visible', timeout: 4000 });
      // Le focus est réellement posé dans un champ « champ-<posteId> ».
      await waitChampFocus();
      // Le champ focusé est ENTIÈREMENT visible (jamais caché sous l'en-tête sticky).
      await page.waitForTimeout(700); // laisse le défilement se stabiliser
      const dansViewport = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
      });
      if (!dansViewport) throw new Error('le champ focusé est hors écran / caché sous l’en-tête');
    },
  );

  await assert('Correction → l’alerte disparaît, état positif affiché', async () => {
    // On remplit le commentaire de réserve (le champ focusé).
    await card(P_WC).locator('textarea').first().fill('Joint à reprendre autour du receveur.');
    await synthese().click();
    await page
      .getByText('Toutes les prestations sont complètes. Les documents peuvent être vérifiés.')
      .waitFor({ state: 'visible', timeout: 4000 });
    if ((await page.getByText(/prestation.* à compléter/).count()) > 0)
      throw new Error('l’alerte subsiste alors que tout est complet');
  });

  await assert('Validation possible immédiatement après correction complète', async () => {
    const btn = page.getByRole('button', { name: /Générer les documents/ });
    if (await btn.isDisabled()) throw new Error('validation bloquée alors que tout est complet');
  });

  await assert('« Non réceptionné » sans commentaire → raccourci + focus commentaire', async () => {
    await page.getByRole('button', { name: 'Revenir aux prestations' }).click();
    await setStatut(P_FAIENCE, 'À réaliser'); // sans commentaire → incomplet
    await synthese().click();
    await page
      .getByText(/1 prestation à compléter/)
      .first()
      .click();
    await card(P_FAIENCE)
      .getByText('Champ obligatoire à compléter')
      .waitFor({ state: 'visible', timeout: 4000 });
    await waitChampFocus();
    await card(P_FAIENCE).locator('textarea').first().fill('Livraison la semaine prochaine.');
  });

  await assert('« Retiré du périmètre » sans motif → raccourci + focus motif', async () => {
    await setStatut(P_ETANCHEITE, 'Retiré'); // sans motif → incomplet
    await synthese().click();
    await page
      .getByText(/1 prestation à compléter/)
      .first()
      .click();
    await card(P_ETANCHEITE)
      .getByText('Champ obligatoire à compléter')
      .waitFor({ state: 'visible', timeout: 4000 });
    await waitChampFocus();
  });

  await assert('Validation IMPOSSIBLE tant qu’un champ obligatoire manque', async () => {
    await synthese().click();
    const btn = page.getByRole('button', { name: /Générer les documents/ });
    if (!(await btn.isDisabled())) throw new Error('validation permise alors qu’un motif manque');
    // On revient et on complète le motif pour la suite.
    await page.getByRole('button', { name: 'Revenir aux prestations' }).click();
    await card(P_ETANCHEITE).getByRole('button', { name: 'Erreur devis', exact: true }).click();
  });

  await assert(
    'Plusieurs incomplets → liste compacte + navigation Précédent/Suivant + compteur live',
    async () => {
      // On recrée trois incomplets d'un coup.
      await setStatut(P_CARRELAGE, 'Avec réserve');
      await setStatut(P_WC, 'À réaliser');
      await setStatut(P_FAIENCE, 'Retiré');
      await synthese().click();
      await page
        .getByText(/3 prestations à compléter/)
        .first()
        .waitFor({ state: 'visible', timeout: 4000 });
      // Liste compacte cliquable (au moins une ligne « manquant »).
      await page
        .getByRole('button', { name: /manquant/ })
        .first()
        .click();
      // Barre de navigation « Élément incomplet 1 sur 3 ».
      await page
        .getByText(/Élément incomplet \d+ sur 3/)
        .waitFor({ state: 'visible', timeout: 4000 });
      // Suivant / Précédent fonctionnent (le focus revient dans un champ obligatoire).
      await page.getByRole('button', { name: /Suivant/ }).click();
      await waitChampFocus();
      await page.getByRole('button', { name: /Précédent/ }).click();
      await waitChampFocus();
      // On corrige la cible courante → le compteur passe à « sur 2 ».
      const id = await focusedId();
      const el = page.locator(`[id="${id}"]`);
      const kind = await el.evaluate((n) => n.tagName);
      await el.fill(kind === 'TEXTAREA' ? 'Complété via le raccourci.' : 'Demande client');
      await page
        .getByText(/Élément incomplet \d+ sur 2/)
        .waitFor({ state: 'visible', timeout: 4000 });
    },
  );

  await assert('Responsive mobile (375 px) : raccourci et focus fonctionnent', async () => {
    await page.setViewportSize({ width: 375, height: 1400 });
    await synthese().click();
    await page
      .getByText(/prestation.* à compléter/)
      .first()
      .click();
    await page
      .getByText('Champ obligatoire à compléter')
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    await waitChampFocus();
    await page.setViewportSize({ width: 1180, height: 1400 });
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
