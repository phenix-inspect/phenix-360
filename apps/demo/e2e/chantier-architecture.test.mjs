/**
 * RC1 — Un onglet = un univers = une seule mission (réorg. conducteur).
 * ===========================================================================
 *   • SUIVI = « que s'est-il passé ? » → journal chronologique SEUL (pas de
 *     création, pas de bibliothèque de documents, pas de notifications).
 *   • PRÉPARATION = « le chantier est-il piloté ? » → cockpit (check-list, devis,
 *     planning, commandes, décisions) SANS bibliothèque de documents.
 *   • DOCUMENTS = « où retrouver un document ? » → tout est ici (devis, factures,
 *     comptes rendus, PV…), ouvrable + téléchargeable + partageable.
 *   • DANS LES COULISSES = photos seulement.
 *   • AUJOURD'HUI = centre de notifications (jamais dans un onglet de chantier).
 * On ne fait que DÉPLACER des briques : aucun doublon entre onglets.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const openChantier = async (sub) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: sub }).first().click();
};
const notifSection = () => page.locator('section[aria-label="Notifications"]');
const libraryHeading = () => page.getByRole('heading', { name: /Bibliothèque du chantier/ });

try {
  await openDemo(page);

  // ---- AUJOURD'HUI : le centre de notifications (AVANT d'entrer dans un
  // chantier — sinon la carte consommerait la notification). ---------------
  await assert('AUJOURD’HUI — une notification vit ICI (jamais QUE dans un chantier)', async () => {
    await notifSection()
      .getByRole('button', { name: /a commenté une publication/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('La notification ouvre directement le bon écran (chantier concerné)', async () => {
    await notifSection()
      .getByRole('button', { name: /a commenté une publication/ })
      .first()
      .click();
    await page
      .getByRole('heading', { name: 'Dans les coulisses du chantier' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert(
    'Les 5 univers existent (Suivi · Préparation · Documents · Coulisses · Réserves)',
    async () => {
      for (const t of ['Suivi', 'Préparation', 'Documents', 'Dans les coulisses', 'Réserves'])
        await page
          .getByRole('tab', { name: t })
          .first()
          .waitFor({ state: 'visible', timeout: 6000 });
    },
  );

  // ---- DOCUMENTS : la bibliothèque unique -------------------------------
  await assert(
    'DOCUMENTS — regroupe tout (devis + comptes rendus), ouvrable + téléchargeable',
    async () => {
      await openChantier('Documents');
      await libraryHeading().waitFor({ state: 'visible', timeout: 6000 });
      await page.getByText('Devis plomberie').first().waitFor({ state: 'visible', timeout: 5000 });
      if (
        (await page
          .getByRole('button', { name: /Ouvrir le document|Consulter le compte rendu/ })
          .count()) === 0
      )
        throw new Error('aucun document ouvrable dans la bibliothèque');
      if ((await page.getByRole('button', { name: /Télécharger/ }).count()) === 0)
        throw new Error('aucun document téléchargeable');
    },
  );

  // ---- PRÉPARATION : cockpit, PAS la bibliothèque de documents ----------
  await assert('PRÉPARATION — cockpit sans bibliothèque de documents (aucun doublon)', async () => {
    await openChantier('Préparation');
    await page.getByText('Commandes').first().waitFor({ state: 'visible', timeout: 6000 });
    if ((await libraryHeading().count()) > 0)
      throw new Error('la bibliothèque de documents apparaît AUSSI en Préparation (doublon)');
    if ((await page.getByRole('button', { name: /Télécharger/ }).count()) > 0)
      throw new Error('des documents téléchargeables traînent en Préparation');
  });

  // ---- SUIVI : journal SEUL (pas de création, pas de biblio, pas de notifs) --
  await assert(
    'SUIVI — journal seul (ni bibliothèque, ni création, ni notifications)',
    async () => {
      await openChantier('Suivi');
      await page
        .getByRole('heading', { name: /Dernière activité|Journal du chantier/ })
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      if ((await libraryHeading().count()) > 0)
        throw new Error('la bibliothèque de documents apparaît dans le Suivi');
      for (const creation of [/Ajouter un document/, /Demander au client/, /Répondre au client/])
        if ((await page.getByRole('button', { name: creation }).count()) > 0)
          throw new Error(`une action de création subsiste dans le Suivi : ${creation}`);
      if ((await notifSection().count()) > 0)
        throw new Error(
          'des notifications vivent dans le Suivi (elles doivent être dans Aujourd’hui)',
        );
    },
  );

  // ---- DANS LES COULISSES : photos, aucun document/CR -------------------
  await assert('COULISSES — photos seulement (aucun document ni compte rendu)', async () => {
    await openChantier('Dans les coulisses');
    if ((await libraryHeading().count()) > 0)
      throw new Error('la bibliothèque de documents apparaît dans les coulisses');
    if ((await page.getByRole('button', { name: /Télécharger/ }).count()) > 0)
      throw new Error('des documents apparaissent dans les coulisses');
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
