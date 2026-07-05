/**
 * RC1 — Épure de l'écran Chantier : la frise des lots (Dépose · Gros œuvre ·
 * Plomberie · … · Réception) est SUPPRIMÉE de l'entrée du chantier. Elle
 * n'apportait aucune aide à la décision et surchargeait l'écran. Les données
 * (feuille de route) restent intactes (planning, préparation). On vérifie que la
 * frise a disparu de l'écran Chantier et qu'aucune régression n'est introduite.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const seen = async (re) => (await page.getByText(re).count()) > 0;

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page
    .getByRole('heading', { name: /Appartement Lyon 6e/ })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });

  await assert('La frise des lots a disparu de l’écran Chantier (Suivi)', async () => {
    // « Dépose » et « Plâtrerie » n'apparaissaient QUE dans la frise ; ils ne
    // doivent plus être visibles sur l'entrée du chantier.
    if (await seen(/^Dépose$/)) throw new Error('la frise des lots (« Dépose ») est encore là');
    if (await seen(/^Plâtrerie$/))
      throw new Error('la frise des lots (« Plâtrerie ») est encore là');
    // Aucune liste ordonnée de pastilles de lots numérotées en tête d'écran.
    const numbered = await page.getByText(/^\d+$/).count();
    if (numbered > 3) throw new Error(`des pastilles numérotées de lots subsistent (${numbered})`);
  });

  await assert('Non-régression : l’écran Chantier reste complet et actionnable', async () => {
    // Le projet reste le héros, le statut est éditable, la mission accessible.
    await page.getByLabel('Statut du chantier').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /Nouvelle mission/ }).waitFor({ state: 'visible' });
    for (const tab of ['Suivi', 'Préparation', 'Récit', 'Réserves', 'Historique'])
      await page.getByRole('tab', { name: tab }).waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Les données de feuille de route restent disponibles (Préparation)', async () => {
    // La donnée métier (étapes) est intacte : elle alimente directement le
    // Planning prévisionnel (on ne double plus la liste des étapes au-dessus).
    await page.getByRole('tab', { name: 'Préparation' }).click();
    await page
      .getByRole('heading', { name: /Planning prévisionnel/ })
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
