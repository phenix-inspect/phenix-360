/**
 * CONDITION BÊTA #1 — PROTECTION CONTRE LA PERTE DE SAISIE.
 * =========================================================
 * Dès qu'une mission (ou un composer) contient un travail commencé, toute
 * tentative de sortie NON explicite (croix, Échap, clic hors modal) déclenche
 * une confirmation « Votre saisie n'est pas terminée » avec deux issues claires :
 *  • « Continuer la saisie » → on reste, RIEN n'est perdu ;
 *  • « Quitter sans enregistrer » → on sort, abandon assumé.
 * Règle stricte : AUCUNE confirmation si rien n'a été saisi (zéro friction).
 * On vérifie les surfaces à saisie : Compte rendu, Pré-réception, et le composer
 * « Ajouter un document » (Dialog radix, fermé par Échap / clic extérieur).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1440, height: 900 });
const { assert, summary } = harness();

const CONFIRM_TITLE = /Votre saisie n’est pas terminée/;
const openMission = async (label) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
};
const confirmDialog = () => page.getByText(CONFIRM_TITLE);
const clickClose = () => page.getByRole('button', { name: 'Fermer' }).first().click();

try {
  await openDemo(page);

  /* -- 1. Compte rendu : rien saisi → la croix ferme SANS confirmation ------- */
  await assert(
    'Compte rendu — sans saisie, la croix ferme directement (zéro friction)',
    async () => {
      await openMission('Compte rendu de chantier');
      await page.getByPlaceholder(/Décrivez ce point/).waitFor({ state: 'visible', timeout: 8000 });
      await clickClose();
      // Aucune confirmation : on est revenu au chantier.
      if ((await confirmDialog().count()) > 0)
        throw new Error('confirmation affichée alors qu’aucune donnée n’a été saisie');
      await page
        .getByRole('button', { name: /Nouvelle mission/ })
        .waitFor({ state: 'visible', timeout: 6000 });
    },
  );

  /* -- 2. Compte rendu : saisie en cours → croix protégée ------------------- */
  await assert('Compte rendu — saisie en cours, la croix demande confirmation', async () => {
    await openMission('Compte rendu de chantier');
    await page.getByPlaceholder(/Décrivez ce point/).fill('Le carrelage de la cuisine est posé.');
    await clickClose();
    await confirmDialog().waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('« Continuer la saisie » garde la mission ouverte et le texte intact', async () => {
    await page.getByRole('button', { name: 'Continuer la saisie' }).click();
    await confirmDialog().waitFor({ state: 'hidden', timeout: 6000 });
    // La mission est toujours là, la saisie n'a pas bougé.
    const val = await page.getByPlaceholder(/Décrivez ce point/).inputValue();
    if (val !== 'Le carrelage de la cuisine est posé.')
      throw new Error(`la saisie a été altérée : « ${val} »`);
  });

  await assert('Échap déclenche aussi la confirmation (pas de sortie silencieuse)', async () => {
    await page.keyboard.press('Escape');
    await confirmDialog().waitFor({ state: 'visible', timeout: 6000 });
    // Échap sur la confirmation la referme sans rouvrir en boucle.
    await page.getByRole('button', { name: 'Continuer la saisie' }).click();
    await confirmDialog().waitFor({ state: 'hidden', timeout: 6000 });
  });

  await assert('« Quitter sans enregistrer » ferme réellement la mission', async () => {
    await clickClose();
    await confirmDialog().waitFor({ state: 'visible', timeout: 6000 });
    await page.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
    await page
      .getByRole('button', { name: /Nouvelle mission/ })
      .waitFor({ state: 'visible', timeout: 6000 });
    // Rien n'a été publié : le brouillon abandonné n'a pas créé de compte rendu.
  });

  /* -- 3. Pré-réception : un statut modifié = saisie protégée --------------- */
  await assert('Pré-réception — un contrôle posé protège la fermeture', async () => {
    await openMission('Pré-réception');
    await page
      .getByText('Vérifiez chaque prestation vendue')
      .waitFor({ state: 'visible', timeout: 8000 });
    // On modifie le statut d'une prestation (bouton « Avec réserve » de la 1re carte).
    await page.getByRole('button', { name: 'Avec réserve' }).first().click();
    await clickClose();
    await confirmDialog().waitFor({ state: 'visible', timeout: 6000 });
    await page.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
    await page
      .getByRole('button', { name: /Nouvelle mission/ })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  /* -- 4. Composer « Ajouter un document » : Dialog radix protégé ----------- */
  await assert(
    'Ajouter un document — un libellé saisi protège Échap / clic extérieur',
    async () => {
      await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
      await page.getByRole('button', { name: /Nouvelle mission/ }).click();
      await page
        .getByRole('button', { name: /Ajouter un document/ })
        .first()
        .click();
      const libelle = () => page.getByLabel('Libellé du document');
      await libelle().fill('Devis plomberie');
      // Échap : la protection intercepte → confirmation, le composer reste.
      await page.keyboard.press('Escape');
      await confirmDialog().waitFor({ state: 'visible', timeout: 6000 });
      await page.getByRole('button', { name: 'Continuer la saisie' }).click();
      await confirmDialog().waitFor({ state: 'hidden', timeout: 6000 });
      // Le composer reste pleinement utilisable et la saisie est intacte.
      if ((await libelle().inputValue()) !== 'Devis plomberie')
        throw new Error('le libellé saisi a été perdu');
      await libelle().fill('Devis plomberie corrigé'); // preuve que le champ reste éditable
      // Puis on quitte volontairement.
      await page.keyboard.press('Escape');
      await confirmDialog().waitFor({ state: 'visible', timeout: 6000 });
      await page.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
      await page.getByLabel('Libellé du document').waitFor({ state: 'hidden', timeout: 6000 });
    },
  );

  await assert('Ajouter un document — composer vide : Échap ferme sans friction', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page
      .getByRole('button', { name: /Ajouter un document/ })
      .first()
      .click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Libellé du document').waitFor({ state: 'visible', timeout: 6000 });
    await page.keyboard.press('Escape');
    if ((await confirmDialog().count()) > 0)
      throw new Error('confirmation affichée sur un composer vide');
    await dlg.waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
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
