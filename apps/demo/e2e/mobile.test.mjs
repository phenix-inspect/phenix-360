/**
 * RC1 — QA MOBILE / responsive. On vérifie sur iPhone, tablette et desktop :
 *  • aucun débordement horizontal (pas de scroll latéral bloquant) ;
 *  • le logo, « Gérer », le sélecteur de vue et les filtres restent utilisables ;
 *  • une modale s'ouvre ET se ferme ;
 *  • le dépôt de dossier (capture / upload) est atteignable.
 */
import { launch, harness } from './harness.mjs';

const URL = process.env.E2E_URL ?? 'http://localhost:4173/';
const browser = await launch();
const { assert, summary } = harness();
const allConsole = [];

const VIEWPORTS = [
  { name: 'iPhone', width: 390, height: 844 },
  { name: 'Tablette', width: 768, height: 1024 },
  { name: 'Desktop', width: 1280, height: 800 },
];

/** Débordement horizontal du document (au-delà de 2px de tolérance). */
const overflowX = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function openDemoOn(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page
    .getByRole('button', { name: /Découvrir la démo/ })
    .click()
    .catch(() => {});
  await page.getByRole('heading', { name: /Bonjour Mickaël/ }).waitFor({ timeout: 15000 });
}

try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') allConsole.push(`[${vp.name}] ${m.text()}`);
    });
    page.on('pageerror', (e) => allConsole.push(`[${vp.name}] pageerror: ${e.message}`));

    await openDemoOn(page);

    await assert(`[${vp.name}] Aujourd'hui : pas de débordement horizontal`, async () => {
      const ov = await overflowX(page);
      if (ov > 2) throw new Error(`débordement de ${ov}px`);
    });

    await assert(`[${vp.name}] Le logo et « Gérer » sont visibles`, async () => {
      await page.getByRole('button', { name: /Revenir à l'accueil/ }).waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Gérer' }).waitFor({ state: 'visible' });
    });

    await assert(`[${vp.name}] La modale « Gérer » s'ouvre ET se ferme`, async () => {
      await page.getByRole('button', { name: 'Gérer' }).click();
      await page
        .getByRole('heading', { name: /^Gérer$/ })
        .waitFor({ state: 'visible', timeout: 5000 });
      await page.getByRole('button', { name: 'Fermer' }).click();
      await page
        .getByRole('heading', { name: /^Gérer$/ })
        .waitFor({ state: 'hidden', timeout: 5000 });
    });

    await assert(`[${vp.name}] Ouvrir un chantier : pas de débordement`, async () => {
      await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
      await page
        .getByRole('heading', { name: /Appartement Lyon 6e/ })
        .first()
        .waitFor({
          state: 'visible',
          timeout: 6000,
        });
      const ov = await overflowX(page);
      if (ov > 2) throw new Error(`débordement de ${ov}px sur le chantier`);
    });

    await assert(`[${vp.name}] Espace client : lisible, pas de débordement`, async () => {
      await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
      await page.waitForTimeout(400);
      const ov = await overflowX(page);
      if (ov > 2) throw new Error(`débordement de ${ov}px côté client`);
    });

    await assert(`[${vp.name}] Dépôt de dossier (upload) atteignable`, async () => {
      await page
        .getByRole('tab', { name: /Aujourd/ })
        .first()
        .click();
      await page.getByRole('button', { name: 'Gérer' }).click();
      await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
      await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
      // La zone de dépôt et le champ fichier existent (capture / upload).
      if ((await page.locator('input[type=file]:not([capture])').count()) === 0)
        throw new Error('aucun champ de dépôt de fichier');
      const ov = await overflowX(page);
      if (ov > 2) throw new Error(`débordement de ${ov}px sur « Nouveau chantier »`);
    });

    await ctx.close();
  }

  await assert('Zéro erreur console sur tous les formats', async () => {
    if (allConsole.length > 0) throw new Error(allConsole.slice(0, 6).join(' | '));
  });
} catch (e) {
  await assert('FATAL', async () => {
    throw e;
  });
} finally {
  const failed = summary(allConsole);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
