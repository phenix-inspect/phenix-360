/**
 * DURCISSEMENT PRODUCTION — sécurité (CSP) & observabilité (diagnostic).
 * =============================================================================
 * Vérifie, dans l'app RÉELLE servie (build + preview), les garde-fous de mise en
 * ligne ajoutés en Mission K :
 *   • une Content-Security-Policy est présente et stricte (script-src 'self',
 *     object-src 'none', pas de default-src laxiste) ;
 *   • aucun script INLINE dans le HTML servi (condition d'une CSP sans 'unsafe-inline') ;
 *   • l'app démarre normalement SOUS la CSP (l'écran conducteur s'affiche) ;
 *   • l'observabilité expose `window.__PHENIX_DIAG__()` : version figée au build,
 *     navigateur, écran, et un anneau d'erreurs qui capture réellement un incident ;
 *   • zéro erreur console (une violation CSP en produirait une).
 */
import { launch, session, harness, openDemo, URL } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser);
const { assert, summary } = harness();

try {
  await assert('CSP : en-tête meta présent et strict', async () => {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    const csp = await page.evaluate(
      () =>
        document
          .querySelector('meta[http-equiv="Content-Security-Policy"]')
          ?.getAttribute('content') ?? '',
    );
    if (!csp) throw new Error('aucune meta CSP');
    for (const must of ["default-src 'self'", "script-src 'self'", "object-src 'none'"])
      if (!csp.includes(must)) throw new Error(`CSP sans « ${must} » : ${csp}`);
    // 'unsafe-eval' interdit (sinon la CSP n'empêche plus l'exécution de code injecté).
    if (/unsafe-eval/.test(csp)) throw new Error("la CSP autorise 'unsafe-eval'");
  });

  await assert('Aucun script inline dans le HTML servi', async () => {
    const html = await (await fetch(URL)).text();
    // Un <script> sans src = inline. Le build Vite n'en produit pas ; on le garde vrai.
    const inline = [...html.matchAll(/<script\b([^>]*)>/gi)].filter(
      (m) => !/\bsrc=/.test(m[1]),
    );
    if (inline.length) throw new Error(`${inline.length} script(s) inline dans index.html`);
  });

  await assert('L’app démarre normalement SOUS la CSP (écran conducteur)', async () => {
    await openDemo(page); // échoue si la CSP casse le boot (chargement des chunks)
  });

  await assert('Observabilité : __PHENIX_DIAG__ expose la version figée au build', async () => {
    const diag = await page.evaluate(() => window.__PHENIX_DIAG__?.());
    if (!diag) throw new Error('window.__PHENIX_DIAG__ absent');
    if (!diag.version || diag.version.includes('__APP_VERSION__'))
      throw new Error(`version non injectée : ${diag.version}`);
    if (typeof diag.userAgent !== 'string' || !diag.userAgent)
      throw new Error('navigateur (userAgent) absent du diagnostic');
    if (!Array.isArray(diag.errors)) throw new Error('anneau d’erreurs absent');
  });

  await assert('Observabilité : une erreur non gérée est réellement capturée', async () => {
    const captured = await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', { message: 'diagnostic-selftest', filename: 'test', lineno: 1 }),
      );
      const diag = window.__PHENIX_DIAG__?.();
      return diag?.errors?.some((e) => e.message === 'diagnostic-selftest') ?? false;
    });
    if (!captured) throw new Error('l’erreur simulée n’a pas été collectée');
    // La dernière erreur est aussi miroir sur disque (survit au reload).
    const persisted = await page.evaluate(() => localStorage.getItem('phenix-diag:last'));
    if (!persisted || !persisted.includes('diagnostic-selftest'))
      throw new Error('dernière erreur non persistée dans localStorage');
  });

  await assert('Zéro erreur console (aucune violation CSP)', async () => {
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
