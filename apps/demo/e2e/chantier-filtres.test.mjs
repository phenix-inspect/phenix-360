/**
 * RC1 — « Aujourd'hui » = tableau de pilotage multi-chantiers (VISION Art. 3, 10,
 * 11). Au-dessus de « Mes chantiers », des filtres COMBINABLES et instantanés,
 * sans nouvel écran : statut (puces visibles) + ville / client / urgence (repliés
 * derrière « Filtres »). Compteur des chantiers affichés, réinitialisation, et un
 * message clair quand rien ne correspond.
 *
 * Seed : Lyon 6e (En cours · Lyon · Mme Martin), Écully (Pré-réception · Écully ·
 * M. Dubois), Croix-Rousse (Levée des réserves · Lyon · Mme Bernard).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const LYON = 'Appartement Lyon 6e';
const ECULLY = 'Maison Écully';
const CROIX = 'Duplex Croix-Rousse';

const heading = (re) => page.getByRole('heading', { name: re });
const openFiltres = () => page.getByRole('button', { name: /^Filtres/ }).click();
const ville = () => page.getByLabel('Filtrer par ville');
const client = () => page.getByLabel('Filtrer par client');
const urgence = () => page.getByLabel('Filtrer par urgence');
const reinit = () => page.getByRole('button', { name: /^Réinitialiser$/ });
const visibleCount = async (name) => page.getByText(name, { exact: true }).count();

try {
  await openDemo(page);

  await assert('Un bouton « Filtres » repliable coiffe « Mes chantiers »', async () => {
    await heading(/Mes chantiers \(3\)/).waitFor({ state: 'visible', timeout: 5000 });
    // Replié par défaut : les selects ne sont pas montés.
    if ((await ville().count()) > 0) throw new Error('le panneau de filtres est ouvert par défaut');
    await openFiltres();
    await ville().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Filtrer par VILLE (dérivée des adresses) regroupe les chantiers', async () => {
    await ville().selectOption({ label: 'Lyon' });
    await heading(/Mes chantiers \(2 sur 3\)/).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(LYON, { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText(CROIX, { exact: true }).first().waitFor({ state: 'visible' });
    if ((await visibleCount(ECULLY)) > 0)
      throw new Error('un chantier d’une autre ville est resté');
  });

  await assert('« Réinitialiser » restaure la liste complète', async () => {
    await reinit().click();
    await heading(/Mes chantiers \(3\)/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Filtrer par CLIENT', async () => {
    await client().selectOption({ label: 'Mme Bernard' });
    await heading(/Mes chantiers \(1 sur 3\)/).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(CROIX, { exact: true }).first().waitFor({ state: 'visible' });
    if ((await visibleCount(LYON)) > 0) throw new Error('un chantier d’un autre client est resté');
    await reinit().click();
  });

  await assert('Filtrer par URGENCE (avec décisions client)', async () => {
    await urgence().selectOption({ label: 'Avec décisions client' });
    // Lyon + Écully ont une décision client ; Croix-Rousse non.
    await heading(/Mes chantiers \(2 sur 3\)/).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(LYON, { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText(ECULLY, { exact: true }).first().waitFor({ state: 'visible' });
    if ((await visibleCount(CROIX)) > 0) throw new Error('un chantier sans décision est resté');
  });

  await assert('Les filtres se COMBINENT (urgence + ville)', async () => {
    // Toujours « avec décisions client » ; on ajoute ville = Écully → 1 seul.
    await ville().selectOption({ label: 'Écully' });
    await heading(/Mes chantiers \(1 sur 3\)/).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(ECULLY, { exact: true }).first().waitFor({ state: 'visible' });
    if ((await visibleCount(LYON)) > 0) throw new Error('la combinaison n’a pas restreint Lyon');
    // Le bouton « Filtres » signale 2 affinages actifs.
    await page.getByRole('button', { name: /^Filtres \(2\)/ }).waitFor({ state: 'visible' });
    await reinit().click();
    await heading(/Mes chantiers \(3\)/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Combiner STATUT (puce) + un affinage', async () => {
    // Puce statut « En cours » = Lyon uniquement.
    await page.getByRole('button', { name: /^En cours \(1\)$/ }).click();
    await heading(/Mes chantiers \(1 sur 3\)/).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(LYON, { exact: true }).first().waitFor({ state: 'visible' });
    await reinit().click();
  });

  await assert('Aucun résultat → message clair + réinitialisation', async () => {
    // Écully (ville) ∩ Mme Bernard (client Croix-Rousse) = ∅.
    await ville().selectOption({ label: 'Écully' });
    await client().selectOption({ label: 'Mme Bernard' });
    await page
      .getByText('Aucun chantier ne correspond à ces filtres.')
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /Réinitialiser les filtres/ }).click();
    await heading(/Mes chantiers \(3\)/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Non-régression : les compteurs du matin filtrent toujours la journée', async () => {
    await page.getByRole('button', { name: /Filtrer.*décisions en attente/i }).click();
    await heading('Décisions client en attente').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /Tout afficher/ }).click();
    await heading(/Mes chantiers \(3\)/).waitFor({ state: 'visible', timeout: 5000 });
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
