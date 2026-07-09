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

/** Déroule une mission (capture → PHÉNIX comprend → valider → terminer). */
const runMission = async (missionLabel, observation) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  // La carte mission est un bouton « <Label> <description> » — on l'ancre au début
  // du libellé (« Pré-réception » ne doit pas matcher « Réception », ni l'option
  // de statut du chantier qui porte le même texte).
  await page.getByRole('button', { name: new RegExp(`^${missionLabel}`) }).click();
  const draft = page.getByPlaceholder(/Dites ce qu/);
  await draft.waitFor({ state: 'visible', timeout: 6000 });
  await draft.fill(observation);
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByRole('button', { name: /J.ai terminé/ }).click();
  await page
    .getByRole('button', { name: /^Valider$/ })
    .waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: /^Valider$/ }).click();
  await page
    .getByRole('button', { name: /Terminer|Partager/ })
    .first()
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

  // ---- Pré-réception (mission → « Liste des points à reprendre ») ----------
  await assert('Ouverture d’une PRÉ-RÉCEPTION → document généré', async () => {
    await runMission('Pré-réception', 'Pré-réception : quelques points à reprendre avant la fin.');
    await openSuivi();
    const title = await openAndTitle(
      page.getByRole('button', { name: 'Consulter le compte rendu' }).first(),
    );
    if (!/points à reprendre/i.test(title)) throw new Error(`titre inattendu : ${title}`);
  });

  // ---- Réception (mission → « PV de réception ») --------------------------
  await assert('Ouverture d’une RÉCEPTION → PV de réception généré', async () => {
    await runMission('Réception', 'Réception réalisée, chantier conforme, clôture en cours.');
    await openSuivi();
    const title = await openAndTitle(
      page.getByRole('button', { name: 'Consulter le compte rendu' }).first(),
    );
    if (!/PV de réception/i.test(title)) throw new Error(`titre inattendu : ${title}`);
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
    for (const secret of ['Contrat sous-traitant', 'PV de réception', 'points à reprendre'])
      if ((await page.getByText(secret, { exact: false }).count()) > 0)
        throw new Error(`fuite côté client : « ${secret} »`);
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
