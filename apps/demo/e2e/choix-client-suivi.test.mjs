/**
 * « Demande de choix » client — suivi complet dans « Demandes client ».
 * ===========================================================================
 * Un choix client est un OBJET PILOTABLE (statut + historique), pas une demande
 * simple. Parcours de bout en bout :
 *   1. le conducteur crée une demande de choix (2 options + photos) ;
 *   2. elle apparaît dans « Demandes client » avec le statut « Non lu » ;
 *   3. côté client, le choix est dans « Aujourd'hui » ET « Vos choix » ;
 *   4. quand le client OUVRE le choix → statut « En attente » côté conducteur ;
 *   5. quand il RÉPOND → statut « Répondu », l'option choisie en clair (libellé +
 *      photo), jamais un simple « Option 2 » ;
 *   6. le choix DISPARAÎT d'« Aujourd'hui » client ;
 *   7. il reste dans « Vos choix » ;
 *   8. il reste dans « Demandes client » conducteur ;
 *   9. une trace existe au Suivi.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const PNG = {
  name: 'option.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
};

const TITRE = 'Choix du carrelage salle de bain';
const OPT_A = 'Carrelage effet béton gris';
const OPT_B = 'Carrelage effet pierre beige';
const COMMENT = 'On préfère celui-ci pour rester lumineux.';

const goChantier = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page
    .getByRole('heading', { name: /Appartement Lyon 6e/ })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });
};
const openDemandes = async () => {
  await goChantier();
  await page.getByRole('tab', { name: /Demandes client/ }).click();
};
const demandesBox = () => page.locator('[data-tab="demandes-client"]');
const filtre = (name) => demandesBox().getByRole('tab', { name });
const choixCard = () => demandesBox().locator('li').filter({ hasText: TITRE }).first();

const goClient = async (sub) => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  const isAuj = /Aujourd/.test(sub);
  await page
    .getByRole('tab', { name: isAuj ? /Aujourd/ : sub })
    [isAuj ? 'last' : 'first']()
    .click();
  await page.waitForTimeout(200);
};

try {
  await openDemo(page);

  // ---- 1. Le conducteur crée une demande de CHOIX (2 options + photos) -----
  await assert('Le conducteur crée une demande de choix (2 options, photos)', async () => {
    await goChantier();
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page
      .getByRole('button', { name: /Demander au client/ })
      .first()
      .click();
    await page.getByText('Demander une décision').click();
    const dlg = page.getByRole('dialog');
    await dlg
      .getByRole('heading', { name: /Demander une décision au client/ })
      .waitFor({ state: 'visible', timeout: 6000 });
    await dlg.getByPlaceholder('Ex. Choix du carrelage de la salle de bain').fill(TITRE);
    // Les inputs fichier du dialogue, dans l'ordre : [0] photos de la demande,
    // [1] photo de l'option A, puis [2] photo de l'option B après « Ajouter ».
    // Option A + photo.
    await dlg.getByPlaceholder('Titre du choix A').fill(OPT_A);
    await dlg.locator('input[type=file]:not([capture])').nth(1).setInputFiles(PNG);
    // Option B + photo.
    await dlg.getByRole('button', { name: /Ajouter un choix/ }).click();
    await dlg.getByPlaceholder('Titre du choix B').fill(OPT_B);
    await dlg.locator('input[type=file]:not([capture])').nth(2).setInputFiles(PNG);
    await page.waitForTimeout(400);
    await dlg.getByRole('button', { name: /Envoyer au client/ }).click();
    await dlg.waitFor({ state: 'detached', timeout: 6000 });
  });

  // ---- 2. Visible dans « Demandes client » avec statut « Non lu » ----------
  await assert('La demande de choix apparaît dans « Demandes client » (Non lu)', async () => {
    await openDemandes();
    await filtre(/^Choix client/).click();
    await choixCard().waitFor({ state: 'visible', timeout: 6000 });
    if ((await choixCard().getByText('Non lu').count()) === 0)
      throw new Error('le choix devrait être « Non lu » (client n’a pas encore ouvert)');
    await choixCard().getByText('Choix client').first().waitFor({ state: 'visible' });
  });

  // ---- 3. Côté client : présent dans « Aujourd'hui » ET « Vos choix » ------
  // Le seed peut porter d'autres décisions en attente : on RAISONNE EN DELTA sur
  // le nombre de bandeaux « Une décision vous attend » (chacun = un choix à faire).
  let aujCountAvant = 0;
  await assert('Côté client, le choix est dans « Aujourd’hui »', async () => {
    await goClient('Aujourd’hui');
    await page
      .getByText(/Une décision vous attend/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    aujCountAvant = await page.getByRole('button', { name: 'Voir la décision' }).count();
    if (aujCountAvant < 1) throw new Error('aucun choix actionnable dans « Aujourd’hui »');
  });

  await assert('Côté client, le choix est aussi dans « Vos choix »', async () => {
    await goClient('Vos choix');
    await page
      .locator('#section-choix')
      .getByText(/Une décision vous attend/)
      .first()
      .waitFor({
        state: 'visible',
        timeout: 6000,
      });
  });

  // ---- 4. Le client OUVRE le choix → « En attente » côté conducteur --------
  await assert('Quand le client ouvre le choix → « En attente » côté conducteur', async () => {
    await goClient('Vos choix');
    await page.getByRole('button', { name: 'Voir la décision' }).first().click();
    await page.getByText(TITRE).first().waitFor({ state: 'visible', timeout: 6000 });
    // Côté conducteur : le statut a basculé.
    await openDemandes();
    await filtre(/^En attente/).click();
    await choixCard().waitFor({ state: 'visible', timeout: 6000 });
    if ((await choixCard().getByText('En attente').count()) === 0)
      throw new Error('le choix ouvert devrait être « En attente de réponse »');
  });

  // ---- 5. Le client RÉPOND → « Répondu » + option en clair (libellé + photo) --
  await assert('Le client répond (option B + commentaire)', async () => {
    await goClient('Vos choix');
    // Le banner peut être encore ouvert ; sinon on le rouvre.
    if ((await page.getByRole('radio', { name: new RegExp(OPT_B) }).count()) === 0)
      await page.getByRole('button', { name: 'Voir la décision' }).first().click();
    await page
      .getByRole('radio', { name: new RegExp(OPT_B) })
      .first()
      .click();
    await page.getByPlaceholder(/On préfère celui-ci/).fill(COMMENT);
    await page.getByRole('button', { name: /Valider mon choix/ }).click();
    await page.waitForTimeout(400);
  });

  await assert(
    'Conducteur : « Répondu » + option choisie en clair (jamais « Option 2 » seul)',
    async () => {
      await openDemandes();
      await filtre(/^Répondus/).click();
      await choixCard().waitFor({ state: 'visible', timeout: 6000 });
      if ((await choixCard().getByText('Répondu').count()) === 0)
        throw new Error('le choix répondu devrait être « Répondu »');
      // Le conducteur ouvre la carte pour voir la réponse détaillée.
      await choixCard().getByRole('button').first().click();
      await page.waitForTimeout(200);
      // Libellé complet de l'option choisie (pas un simple numéro).
      await choixCard().getByText(new RegExp(OPT_B)).first().waitFor({ state: 'visible' });
      // Photo de l'option choisie présente.
      if ((await choixCard().locator('img').count()) === 0)
        throw new Error('la photo de l’option choisie devrait être affichée');
      // Commentaire du client conservé.
      await choixCard()
        .getByText(new RegExp(COMMENT.slice(0, 20)))
        .first()
        .waitFor({
          state: 'visible',
        });
    },
  );

  // ---- 6. Le choix DISPARAÎT d'« Aujourd'hui » client (un bandeau en moins) --
  await assert('Le choix répondu disparaît d’« Aujourd’hui » client', async () => {
    await goClient('Aujourd’hui');
    await page.waitForTimeout(300);
    const apres = await page.getByRole('button', { name: 'Voir la décision' }).count();
    if (apres !== aujCountAvant - 1)
      throw new Error(
        `le choix répondu devrait avoir quitté « Aujourd’hui » (avant ${aujCountAvant}, après ${apres})`,
      );
  });

  // ---- 7. Il reste dans « Vos choix » (avec l'option choisie) --------------
  await assert('Le choix reste visible dans « Vos choix » (Répondu + option)', async () => {
    await goClient('Vos choix');
    const card = page.locator('#section-choix li').filter({ hasText: TITRE }).first();
    await card.waitFor({ state: 'visible', timeout: 6000 });
    await card.getByText(new RegExp(OPT_B)).first().waitFor({ state: 'visible' });
  });

  // ---- 8. Il reste dans « Demandes client » conducteur --------------------
  await assert('Le choix reste dans « Demandes client » (Répondus)', async () => {
    await openDemandes();
    await filtre(/^Répondus/).click();
    await choixCard().waitFor({ state: 'visible', timeout: 6000 });
  });

  // ---- 9. Trace au Suivi ---------------------------------------------------
  await assert('Une trace du choix validé existe au Suivi', async () => {
    await goChantier();
    await page.getByRole('tab', { name: 'Suivi', exact: true }).first().click();
    await page
      .getByRole('button', { name: /Voir tout le journal/ })
      .click()
      .catch(() => {});
    await page
      .getByText(/Choix validé par le client|carrelage/i)
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
