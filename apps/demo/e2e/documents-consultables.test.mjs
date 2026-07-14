/**
 * RC1 — Tout document est CONSULTABLE (retour terrain).
 * ===========================================================================
 * DEUX catégories, jamais confondues :
 *   • document IMPORTÉ (PDF / image déposé) → on ouvre TOUJOURS le FICHIER
 *     d'origine, jamais une page HTML de remplacement (fichier manquant → message
 *     clair « Le document n'est plus disponible. ») ;
 *   • document GÉNÉRÉ par PHÉNIX (compte rendu, PV de réception, liste de points à
 *     reprendre) → PHÉNIX le rend en page HTML autonome, imprimable.
 * Vérifié des DEUX côtés : documents partagés (client) et internes (conducteur).
 * Aucun nouvel écran — on enrichit le comportement des documents existants.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { ctx, page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

/** Clique une cible qui ouvre un nouvel onglet et renvoie le titre du document. */
const openAndTitle = async (locator) => {
  const popup = ctx.waitForEvent('page', { timeout: 8000 });
  await locator.click();
  const tab = await popup;
  await tab.waitForLoadState('domcontentloaded').catch(() => {});
  if (!tab.url().startsWith('blob:')) throw new Error(`ouverture invalide (url=${tab.url()})`);
  const title = await tab.title();
  await tab.close();
  return title;
};

const openSuivi = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Suivi', exact: true }).click();
  await page
    .getByRole('button', { name: /Voir tout le journal/ })
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
};

/** Ligne du Journal (ActivityItem = <li>) portant un libellé donné. */
const journalRow = (text) => page.locator('li').filter({ hasText: text }).first();

/**
 * Déroule une RÉCEPTION (flux dédié). Suppose qu'une Pré-réception a déjà été
 * validée (source unique). Sans réserve à lever, la réception est validable
 * d'emblée : on diffuse le PV au client puis on clôture le chantier.
 */
const runReception = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('dialog').getByText('Réception', { exact: true }).click();
  const valider = page.getByRole('button', { name: /Valider la Réception/ });
  await valider.waitFor({ state: 'visible', timeout: 6000 });
  await valider.click();
  await page
    .getByRole('heading', { name: 'Validation avant envoi' })
    .waitFor({ state: 'visible', timeout: 6000 });
  await page.getByRole('button', { name: /Diffuser au client/ }).click();
  await page
    .getByText(/Réception validée — chantier clôturé/)
    .waitFor({ state: 'visible', timeout: 8000 });
  await page.getByRole('button', { name: /^Terminer$/ }).click();
  await page
    .getByRole('heading', { name: /Appartement Lyon 6e/ })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });
};

/** Déroule une PRÉ-RÉCEPTION (flux dédié : contrôle du contrat, tout conforme). */
const runPrereception = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('dialog').getByText('Pré-réception', { exact: true }).click();
  await page
    .getByText('Vérifiez chaque prestation vendue')
    .waitFor({ state: 'visible', timeout: 8000 });
  await page.getByRole('button', { name: 'Voir la synthèse' }).click();
  await page.getByRole('button', { name: /Générer les documents/ }).click();
  await page.getByRole('button', { name: /Valider et envoyer/ }).click();
  await page
    .getByText('Pré-réception validée et envoyée')
    .waitFor({ state: 'visible', timeout: 8000 });
  await page.getByRole('button', { name: /^Terminer$/ }).click();
  await page
    .getByRole('heading', { name: /Appartement Lyon 6e/ })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });
};

try {
  await openDemo(page);

  // ---- Compte rendu (généré, seedé) --------------------------------------
  await assert('Ouverture d’un COMPTE RENDU → document généré par PHÉNIX', async () => {
    await openSuivi();
    const title = await openAndTitle(
      journalRow('Compte rendu').getByRole('button', { name: 'Consulter le compte rendu' }),
    );
    if (!/Compte rendu/i.test(title)) throw new Error(`titre inattendu : ${title}`);
  });

  // ---- Devis IMPORTÉ (vrai PDF) → ouverture du FICHIER, jamais une page HTML --
  await assert('Ouverture d’un DEVIS importé → le fichier d’origine s’ouvre', async () => {
    // Un document importé s'ouvre en tant que fichier (blob:) ; on ne substitue
    // JAMAIS une page HTML générée (« Ce document a été enregistré… »).
    await openAndTitle(
      journalRow('Devis plomberie').getByRole('button', { name: 'Ouvrir le document' }),
    );
  });

  // ---- Document interne IMPORTÉ (conducteur) → ouverture du fichier ---------
  await assert('Ouverture d’un DOCUMENT INTERNE importé → le fichier s’ouvre', async () => {
    await openAndTitle(
      journalRow('Contrat sous-traitant').getByRole('button', { name: 'Ouvrir le document' }),
    );
  });

  // ---- Pré-réception (flux dédié : vérification du contrat) ----------------
  await assert('Ouverture d’une PRÉ-RÉCEPTION → document généré', async () => {
    await runPrereception();
    await openSuivi();
    const title = await openAndTitle(
      journalRow('Pré-réception').getByRole('button', { name: 'Consulter le compte rendu' }),
    );
    if (!/Pré-réception/i.test(title)) throw new Error(`titre inattendu : ${title}`);
  });

  // ---- Réception (flux dédié → document « Réception » diffusé au client) ---
  await assert('Ouverture d’une RÉCEPTION → document de réception généré', async () => {
    await runReception();
    await openSuivi();
    // La réception est le compte rendu le plus récent : premier de la liste.
    const title = await openAndTitle(
      page.getByRole('button', { name: 'Consulter le compte rendu' }).first(),
    );
    if (!/^Réception/i.test(title)) throw new Error(`titre inattendu : ${title}`);
  });

  // ---- Document PARTAGÉ côté client (vrai fichier → ouverture du fichier) --
  await assert('Ouverture d’un DOCUMENT PARTAGÉ côté client → le fichier s’ouvre', async () => {
    await openClientTab(page, 'Documents');
    const card = page
      .locator('#section-documents li')
      .filter({ hasText: 'Plan de la salle de bain' })
      .first();
    await card.waitFor({ state: 'visible', timeout: 6000 });
    await openAndTitle(card.getByRole('button', { name: 'Ouvrir le document' }));
  });

  // ---- Client-safe : l'interne ne fuit jamais dans l'espace client --------
  await assert('Client-safe : les documents internes ne fuient pas', async () => {
    await openClientTab(page, 'Documents');
    await page.waitForTimeout(300);
    // La pré-réception et la réception sont CLIENT-VISIBLES (documents contractuels
    // diffusés) : elles ne sont plus des secrets. Reste interne : le contrat interne.
    for (const secret of ['Contrat sous-traitant'])
      if ((await page.getByText(secret, { exact: false }).count()) > 0)
        throw new Error(`fuite côté client : « ${secret} »`);
    // La réception, elle, DOIT être visible côté client (PV contractuel diffusé).
    if ((await page.getByText('Réception', { exact: false }).count()) === 0)
      throw new Error('la réception diffusée devrait être visible dans l’espace client');
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
