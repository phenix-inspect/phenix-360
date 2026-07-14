/**
 * RC1 — Gestion des statuts de chantier. Le statut MÉTIER (Pas commencé / En
 * cours / Pré-réception / Levée des réserves / Clôturé) est une propriété unique
 * et persistée, source de vérité partout :
 *  • badge TRÈS VISIBLE sur chaque carte « Mes chantiers » (au coup d'œil) ;
 *  • barre de filtres au-dessus de « Mes chantiers » → filtrage INSTANTANÉ ;
 *  • dropdown simple sur l'écran chantier → transition MANUELLE ;
 *  • persistance (rechargement + export) ; aucun impact sur « Aujourd'hui ».
 * Seed : Lyon = En cours, Écully = Pré-réception, Croix-Rousse = Levée des réserves.
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { readFileSync } from 'node:fs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const gerer = () => page.getByRole('button', { name: 'Gérer' });
const statusChip = (name) => page.getByRole('button', { name });

try {
  await openDemo(page);

  await assert('Chaque carte porte un badge de statut VISIBLE (au coup d’œil)', async () => {
    for (const label of ['En cours', 'Pré-réception', 'Levée des réserves']) {
      await page
        .getByText(label, { exact: true })
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
    }
  });

  await assert('Une barre de filtres par statut coiffe « Mes chantiers »', async () => {
    await statusChip(/^Tous \(3\)$/).waitFor({ state: 'visible', timeout: 5000 });
    await statusChip(/^En cours \(1\)$/).waitFor({ state: 'visible' });
    await statusChip(/^Pré-réception \(1\)$/).waitFor({ state: 'visible' });
    await statusChip(/^Réserves \(1\)$/).waitFor({ state: 'visible' });
  });

  await assert('Cliquer un statut FILTRE la liste instantanément', async () => {
    await statusChip(/^Pré-réception \(1\)$/).click();
    await page.getByText('Maison Écully').first().waitFor({ state: 'visible', timeout: 5000 });
    if ((await page.getByText('Duplex Croix-Rousse').count()) > 0)
      throw new Error('un chantier d’un autre statut est resté visible');
    if ((await page.getByText('Appartement Lyon 6e').count()) > 0)
      throw new Error('un chantier d’un autre statut est resté visible');
  });

  await assert('« Tous » restaure la liste complète', async () => {
    await statusChip(/^Tous \(3\)$/).click();
    await page
      .getByText('Duplex Croix-Rousse')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText('Appartement Lyon 6e').first().waitFor({ state: 'visible' });
  });

  await assert('L’écran chantier change le statut via un simple dropdown (manuel)', async () => {
    await page.getByText('Appartement Lyon 6e').first().click();
    const select = page.getByLabel('Statut du chantier');
    await select.waitFor({ state: 'visible', timeout: 6000 });
    // Condition bêta #5 : « Clôturé » n'est JAMAIS choisi à la main — il découle
    // d'une réception validée (source de vérité = les faits). L'option n'est pas offerte.
    if ((await select.locator('option[value="cloture"]').count()) > 0)
      throw new Error('« Clôturé » ne doit pas être proposé au choix manuel');
    // Transition manuelle COHÉRENTE : ce chantier porte une réserve ouverte → on
    // passe en « Levée des réserves ».
    await select.selectOption({ label: 'Levée des réserves' });
    await page
      .getByText('Levée des réserves', { exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Source de vérité unique : « Aujourd’hui » suit le changement', async () => {
    await page
      .getByRole('tab', { name: /Aujourd/ })
      .first()
      .click();
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    // Lyon est désormais « Levée des réserves » → le filtre « Réserves » compte 2
    // (Lyon + Croix-Rousse), et « En cours » (Lyon seul) a disparu.
    await statusChip(/^Réserves \(2\)$/).waitFor({ state: 'visible', timeout: 5000 });
    if ((await statusChip(/^En cours \(1\)$/).count()) > 0)
      throw new Error('le filtre « En cours » persiste après le changement de statut');
  });

  await assert('Aucun impact sur « Aujourd’hui » : la journée reste intègre', async () => {
    // Le nombre de chantiers et les compteurs de travail ne bougent pas.
    await page
      .getByRole('heading', { name: /Mes chantiers \(3\)/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /Filtrer.*à traiter/i }).waitFor({
      state: 'visible',
    });
  });

  await assert('Persistance : le statut survit au rechargement', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 8000 });
    await statusChip(/^Réserves \(2\)$/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Export : la sauvegarde porte le statut à jour', async () => {
    await gerer().click();
    const dl = page.waitForEvent('download', { timeout: 6000 });
    await page.getByRole('button', { name: /Exporter mes données/ }).click();
    const content = readFileSync(await (await dl).path(), 'utf8');
    if (!content.includes('levee_reserves'))
      throw new Error('la sauvegarde exportée ne porte pas le statut « levee_reserves »');
    await page.keyboard.press('Escape');
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
