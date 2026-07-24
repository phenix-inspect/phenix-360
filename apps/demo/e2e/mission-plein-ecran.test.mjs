/**
 * MISSION PLEIN ÉCRAN — l'overlay recouvre TOUT le viewport (anti-régression).
 * ===========================================================================
 * Une mission (Compte rendu, Pré-réception, Réception) est une surface
 * `position: fixed; inset: 0` : elle DOIT couvrir l'écran entier, depuis le
 * tout premier pixel en haut. Un défaut réel l'a un temps décalée de 24 px vers
 * le bas — un liseré de l'en-tête du chantier réapparaissait au-dessus de la
 * mission (« deux en-têtes »), et l'utilisateur ne savait plus s'il était DANS
 * la mission ou encore sur la page précédente. Cause : la mission était rendue
 * en flux, enfant non-premier d'un conteneur `space-y-*` (Tailwind pose alors
 * `margin-top` sur elle) — et un `fixed; top:0` avec `margin-top` se décale.
 *
 * La correction : les overlays plein écran sont PORTALISÉS sous `<body>`
 * (composant `Portal`), donc positionnés par rapport au viewport, immunisés
 * contre toute marge / `transform` / `contain` d'un ancêtre. Ce test verrouille :
 *   • l'overlay est bien un enfant direct de `<body>` (preuve du portail) ;
 *   • son rectangle couvre le viewport (haut ≈ 0, gauche = 0, pleine largeur,
 *     jusqu'en bas) ;
 *   • aucun autre élément (en-tête) ne « perce » au-dessus de lui.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { assert, summary } = harness();
const allErrors = [];

// Mesure le rectangle du `.z-modal` + son parent + l'élément visible en haut-centre.
const measure = (page) =>
  page.evaluate(() => {
    const m = document.querySelector('.z-modal');
    if (!m) return { found: false };
    const r = m.getBoundingClientRect();
    const cx = Math.round(window.innerWidth / 2);
    const elTop = document.elementFromPoint(cx, 3);
    return {
      found: true,
      parent: m.parentElement ? m.parentElement.tagName : null,
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      // L'élément tout en haut est-il DANS la mission (et non un en-tête resté visible) ?
      topCoveredByModal: elTop ? m.contains(elTop) : false,
    };
  });

try {
  const { page, consoleErrors } = await session(browser, { width: 1440, height: 1000 });
  await openDemo(page);
  await page.getByText('Appartement Lyon 6e').first().click();
  await page
    .getByRole('button', { name: /Nouvelle mission/ })
    .first()
    .click();
  await page.getByRole('button', { name: /^Compte rendu de chantier/ }).click();
  await page.getByPlaceholder(/Décrivez ce point/).waitFor({ timeout: 8000 });
  await page.waitForTimeout(250);

  const m = await measure(page);

  await assert('la mission (compte rendu) est présente', async () => {
    if (!m.found) throw new Error('aucun overlay .z-modal trouvé');
  });

  await assert('la mission est portalisée sous <body>', async () => {
    if (m.parent !== 'BODY')
      throw new Error(`parent attendu BODY, obtenu ${m.parent} (portail manquant)`);
  });

  await assert("la mission couvre le HAUT du viewport (aucun liseré d'en-tête)", async () => {
    if (m.top > 1) throw new Error(`top = ${m.top}px (attendu ≈ 0) — un liseré perce en haut`);
    if (!m.topCoveredByModal)
      throw new Error("l'élément en (centre, 3px) n'appartient pas à la mission");
  });

  await assert('la mission couvre toute la largeur et jusquen bas', async () => {
    if (m.left !== 0) throw new Error(`left = ${m.left} (attendu 0)`);
    if (m.right < m.innerW - 1) throw new Error(`right ${m.right} < largeur ${m.innerW}`);
    if (m.bottom < m.innerH - 1) throw new Error(`bottom ${m.bottom} < hauteur ${m.innerH}`);
  });

  await assert('zéro erreur console', async () => {
    if (consoleErrors.length > 0) throw new Error(consoleErrors.slice(0, 4).join(' | '));
  });

  allErrors.push(...consoleErrors);
} catch (e) {
  await assert('FATAL', async () => {
    throw e;
  });
} finally {
  const failed = summary(allErrors);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
