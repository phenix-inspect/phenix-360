/**
 * RC1 — Suivi = « que dois-je faire sur CE chantier ? », pas « que s'est-il
 * passé ? » (c'est le Récit). Le journal complet est une archive : le Suivi n'en
 * montre que la « Dernière activité », dépliable à la demande (100 % conservé).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2000 });
const { assert, summary } = harness();

const heading = (name) => page.getByRole('heading', { name, exact: true });

try {
  await openDemo(page);
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
  await page.getByRole('tab', { name: 'Suivi', exact: true }).click();

  await assert('Le Suivi montre « Dernière activité », pas le journal complet', async () => {
    await heading('Dernière activité').waitFor({ state: 'visible', timeout: 6000 });
    if ((await heading('Journal du chantier').count()) > 0)
      throw new Error('le journal complet est affiché d’office dans le Suivi');
  });

  await assert('« Voir tout le journal » déplie l’archive complète', async () => {
    const before = await page.getByRole('listitem').count();
    await page.getByRole('button', { name: /Voir tout le journal/ }).click();
    await heading('Journal du chantier').waitFor({ state: 'visible', timeout: 4000 });
    await page
      .getByRole('button', { name: 'Réduire' })
      .waitFor({ state: 'visible', timeout: 4000 });
    const after = await page.getByRole('listitem').count();
    if (after <= before) throw new Error('« Voir tout » n’ajoute aucune entrée au journal');
  });

  await assert('« Réduire » revient à la dernière activité', async () => {
    await page.getByRole('button', { name: 'Réduire' }).click();
    await heading('Dernière activité').waitFor({ state: 'visible', timeout: 4000 });
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
