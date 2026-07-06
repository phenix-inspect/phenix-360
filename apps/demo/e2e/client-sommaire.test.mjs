/**
 * RC1 — Sommaire de l'Espace client (retour terrain).
 * Un bandeau de puces en haut de la page : chaque puce défile vers SA section
 * (aucun nouvel écran). Récit / Bibliothèque étant deux vues d'une même section,
 * leur puce défile ET bascule la vue. Une section vide n'a pas de puce.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
// Fenêtre courte : le défilement est mesurable (les sections sortent du cadre).
const { page, consoleErrors } = await session(browser, { height: 720 });
const { assert, summary } = harness();

const nav = () => page.getByRole('navigation', { name: 'Sommaire de votre espace' });
const chip = (name) => nav().getByRole('button', { name });
const rectTop = (loc) => loc.first().evaluate((el) => Math.round(el.getBoundingClientRect().top));

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await nav().waitFor({ state: 'visible', timeout: 6000 });

  await assert('Le sommaire liste les six sections (toutes présentes au seed)', async () => {
    for (const label of [
      'Décisions',
      'Planning',
      'Documents',
      'Comptes rendus',
      'Dans les coulisses',
      'Bibliothèque',
    ])
      await chip(label).waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Cliquer « Comptes rendus » défile jusqu’à la section', async () => {
    const heading = page.getByRole('heading', { name: 'Comptes rendus' });
    const before = await rectTop(heading); // sous le pli (grand)
    await chip('Comptes rendus').click();
    await page.waitForTimeout(800);
    const after = await rectTop(heading); // remontée près du haut
    if (!(after < before - 150))
      throw new Error(`pas de défilement vers Comptes rendus (${before} → ${after})`);
  });

  await assert('Cliquer « Décisions » remonte en haut de page', async () => {
    const heading = page.getByRole('heading', { name: 'Comptes rendus' });
    const before = await rectTop(heading);
    await chip('Décisions').click();
    await page.waitForTimeout(800);
    const after = await rectTop(heading); // la section redescend (on est remonté)
    if (!(after > before + 150)) throw new Error(`pas de remontée (${before} → ${after})`);
  });

  await assert('Cliquer « Bibliothèque » bascule le Récit en vue Bibliothèque', async () => {
    await chip('Bibliothèque').click();
    await page
      .getByText('Toutes vos photos, prêtes à être retrouvées.')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Cliquer « Dans les coulisses » rebascule en vue coulisses', async () => {
    await chip('Dans les coulisses').click();
    await page
      .getByText('L’histoire de votre chantier, en images.')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Client-safe : le sommaire ne trahit rien d’interne', async () => {
    for (const secret of ['Réserve n°', 'Moment interne', 'à traiter'])
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
