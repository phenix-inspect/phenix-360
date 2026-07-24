/**
 * FENÊTRE « Nouvelle mission » — À L'ÉCRAN (régression positionnement).
 * =============================================================================
 * Régression : passer un `className` contenant `relative` (ou une autre classe de
 * position) à `DialogContent` faisait TOMBER `fixed` (tailwind-merge résout le
 * conflit de position en gardant la dernière) → la fenêtre se retrouvait HORS
 * ÉCRAN, ne laissant que le voile gris. Les autres tests ne l'attrapaient pas :
 * Playwright trouve un élément même hors écran. Ici on vérifie EXPLICITEMENT que
 * la fenêtre est `position: fixed` et DANS le viewport.
 */
import { launch, session, openDemo } from './harness.mjs';

const browser = await launch();
const results = [];
const check = (ok, label) => {
  results.push(ok);
  console.log(`  ${ok ? 'OK ' : 'XX '} ${label}`);
};

try {
  const { page } = await session(browser, { width: 1280, height: 900 });
  await openDemo(page);
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.waitForTimeout(300);

  for (const action of ['Demander au client', 'Ajouter un document']) {
    await page
      .getByRole('button', { name: /Nouvelle mission/ })
      .first()
      .click();
    await page.waitForTimeout(300);
    await page.getByRole('button').filter({ hasText: action }).first().click();
    await page.waitForTimeout(350);
    const dlg = page.getByRole('dialog').first();
    const info = await dlg.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { position: getComputedStyle(el).position, top: r.top, h: window.innerHeight };
    });
    const onScreen = info.position === 'fixed' && info.top >= 0 && info.top < info.h;
    check(
      onScreen,
      `« ${action} » à l'écran — position=${info.position} top=${Math.round(info.top)} (viewport=${info.h})`,
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n=== FENÊTRE MISSION À L'ÉCRAN — ${passed}/${results.length} PASS ===`);
  await browser.close();
  process.exit(passed === results.length ? 0 : 1);
} catch (e) {
  console.log('  XX exception:', e?.message ?? e);
  await browser.close();
  process.exit(1);
}
