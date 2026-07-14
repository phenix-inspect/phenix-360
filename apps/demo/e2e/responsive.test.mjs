/**
 * CONDITION BÊTA #7 — RECETTE RESPONSIVE (desktop 1440, tablette 768, mobile 390/320).
 * ===================================================================================
 * À chaque largeur cible, on vérifie que :
 *  • l'app se charge (écran conducteur « Bonjour Mickaël ») ;
 *  • le CORPS de page ne défile JAMAIS horizontalement (aucun débordement) —
 *    les tableaux/larges blocs défilent DANS leur propre conteneur, pas la page ;
 *  • l'ouverture d'un chantier reste sans débordement ;
 *  • zéro erreur console.
 * Le 320 px (petit mobile) est le pire cas : rien ne doit déborder.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { assert, summary } = harness();

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 2200 },
  { name: 'tablette', width: 768, height: 2200 },
  { name: 'mobile', width: 390, height: 2400 },
  { name: 'petit-mobile', width: 320, height: 2600 },
];

// Débordement horizontal du CORPS (≠ conteneurs à overflow-x interne).
const bodyOverflow = (page) =>
  page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return { scroll: el.scrollWidth, inner: window.innerWidth };
  });

const allErrors = [];
try {
  for (const vp of VIEWPORTS) {
    const { page, consoleErrors } = await session(browser, { width: vp.width, height: vp.height });

    await assert(`[${vp.name} ${vp.width}px] l'app se charge`, async () => {
      await openDemo(page);
    });

    await assert(
      `[${vp.name} ${vp.width}px] tableau de bord sans débordement horizontal`,
      async () => {
        const { scroll, inner } = await bodyOverflow(page);
        // 1 px de tolérance (arrondis sub-pixels).
        if (scroll > inner + 1)
          throw new Error(`le corps déborde : scrollWidth ${scroll} > innerWidth ${inner}`);
      },
    );

    await assert(
      `[${vp.name} ${vp.width}px] ouverture d'un chantier sans débordement`,
      async () => {
        await page.getByText('Appartement Lyon 6e').first().click();
        await page
          .getByRole('button', { name: /Nouvelle mission/ })
          .waitFor({ state: 'visible', timeout: 8000 });
        const { scroll, inner } = await bodyOverflow(page);
        if (scroll > inner + 1)
          throw new Error(`le corps déborde sur le chantier : ${scroll} > ${inner}`);
      },
    );

    await assert(`[${vp.name} ${vp.width}px] zéro erreur console`, async () => {
      if (consoleErrors.length > 0) throw new Error(consoleErrors.slice(0, 4).join(' | '));
    });

    allErrors.push(...consoleErrors);
    await page.context().close();
  }
} catch (e) {
  await assert('FATAL', async () => {
    throw e;
  });
} finally {
  const failed = summary(allErrors);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
