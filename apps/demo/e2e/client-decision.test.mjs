/**
 * RC1 — « Décision client » depuis Nouvelle mission (retour terrain).
 * Le conducteur prépare une décision (titre + contexte + photos + jusqu'à 5
 * choix), l'envoie au client ; le client la voit dans « Une décision vous
 * attend », choisit (ou délègue à PHÉNIX) ; le choix validé remonte au radar
 * Aujourd'hui et au Journal. Réutilise le modèle décision existant. Client-safe.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

// PNG 1×1 valide (pour tester l'ajout de photo).
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TITRE = 'Choix du carrelage';
const OPT_A = 'Beige nacré';
const OPT_E = 'Zellige artisanal';

const selector = () => page.getByLabel('Changer de chantier');
const dialog = () => page.getByRole('dialog');

try {
  await openDemo(page);

  await assert('Nouvelle mission propose « Décision client »', async () => {
    // On travaille sur un chantier vierge de décision (Écully) via le sélecteur.
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await selector().selectOption({ label: 'Maison Écully' });
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByRole('button', { name: /Décision client/ }).click();
    await page
      .getByRole('heading', { name: 'Demander une décision au client' })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Saisir titre + contexte + une photo', async () => {
    await dialog()
      .getByPlaceholder(/Ex\. Choix du carrelage/)
      .fill(TITRE);
    await dialog()
      .getByPlaceholder(/Expliquez au client/)
      .fill('Deux ambiances possibles pour la salle de bain.');
    // Photo de la décision (exerce l'upload → data URL).
    await dialog()
      .locator('input[type=file]')
      .first()
      .setInputFiles({
        name: 'sdb.png',
        mimeType: 'image/png',
        buffer: Buffer.from(PNG, 'base64'),
      });
    await dialog().locator('img').first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Ajouter jusqu’à 5 choix — la limite est respectée', async () => {
    await dialog().getByPlaceholder('Titre du choix A').fill(OPT_A);
    const labels = ['Gris ardoise', 'Blanc mat', 'Terrazzo doux', OPT_E];
    const refs = ['B', 'C', 'D', 'E'];
    for (let i = 0; i < 4; i++) {
      await dialog()
        .getByRole('button', { name: /Ajouter un choix/ })
        .click();
      await dialog().getByPlaceholder(`Titre du choix ${refs[i]}`).fill(labels[i]);
    }
    // 5 choix atteints → le bouton d'ajout est désactivé (max 5).
    const add = dialog().getByRole('button', { name: /Ajouter un choix/ });
    if (!(await add.isDisabled())) throw new Error('le bouton d’ajout reste actif au-delà de 5');
  });

  await assert('Envoyer au client', async () => {
    await dialog()
      .getByRole('button', { name: /Envoyer au client/ })
      .click();
    await page
      .getByRole('heading', { name: 'Demander une décision au client' })
      .waitFor({ state: 'hidden', timeout: 6000 });
  });

  await assert('CLIENT — la décision apparaît avec titre, choix et délégation PHÉNIX', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.getByRole('button', { name: 'Voir la décision' }).click();
    await page.getByText(TITRE).first().waitFor({ state: 'visible', timeout: 5000 });
    await page
      .getByText(/Deux ambiances possibles/)
      .first()
      .waitFor({ state: 'visible' });
    await page.getByText(OPT_A).first().waitFor({ state: 'visible' });
    await page.getByText(OPT_E).first().waitFor({ state: 'visible' });
    await page
      .getByText(/Je laisse PHÉNIX choisir/)
      .first()
      .waitFor({ state: 'visible' });
  });

  await assert('CLIENT — valide un choix', async () => {
    await page.getByRole('radio', { name: new RegExp(OPT_A, 'i') }).click();
    await page.getByRole('button', { name: /Valider mon choix/ }).click();
    await page.getByText('Vos choix').first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('CONDUCTEUR — Aujourd’hui affiche le choix validé, exact', async () => {
    await page.getByRole('tab', { name: /Aujourd/ }).click();
    const counter = page.getByRole('button', { name: /Filtrer.*à traiter/i });
    await counter.waitFor({ state: 'visible', timeout: 5000 });
    await counter.click();
    await page
      .getByText(`${TITRE} — ${OPT_A}`)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Le Journal garde la trace (Historique)', async () => {
    await page.getByText(`${TITRE} — ${OPT_A}`).first().click();
    await page
      .getByRole('tab', { name: /Historique/, selected: true })
      .waitFor({ state: 'visible', timeout: 6000 });
    await page
      .getByText(new RegExp(`Décision client · ${TITRE}`))
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Client-safe : aucune fuite interne', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(300);
    for (const secret of ['Réserve n°', 'Pris en compte', 'à traiter', 'Décision envoyée'])
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
