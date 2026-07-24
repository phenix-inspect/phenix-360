/**
 * RC1 — Gate mot de passe (protection TEMPORAIRE d'une démo déployée). Pas une
 * vraie auth. Piloté par la variable d'env `VITE_DEMO_PASSWORD` ; en test, on la
 * simule via `window.__PHENIX_GATE_PW__` (bypass propre, aucun rebuild).
 *  • sans variable → app accessible ; avec variable → écran mot de passe ;
 *  • mauvais mdp → refus clair ; bon mdp → accès ; persistance au reload ;
 *  • bouton « Verrouiller » → l'écran revient ; zéro erreur console.
 */
import { launch, harness } from './harness.mjs';

const URL = process.env.E2E_URL ?? 'http://localhost:4173/';
const PW = 'rc1-secret';
const browser = await launch();
const { assert, summary } = harness();
const allConsole = [];

/** Nouvelle page ; `gated` → injecte le mot de passe (simule la variable d'env). */
async function newPage(gated) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && allConsole.push(m.text()));
  page.on('pageerror', (e) => allConsole.push('pageerror: ' + e.message));
  if (gated) await page.addInitScript((pw) => (window.__PHENIX_GATE_PW__ = pw), PW);
  return { ctx, page };
}

const gate = (page) => page.getByLabel('Mot de passe');
const enterDemo = async (page) => {
  await page
    .getByRole('button', { name: /Découvrir la démo/ })
    .click()
    .catch(() => {});
  await page.getByRole('heading', { name: /Bonjour Mickaël/ }).waitFor({ timeout: 12000 });
};

try {
  await assert('Sans variable → app accessible (aucun gate)', async () => {
    const { ctx, page } = await newPage(false);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    if ((await gate(page).count()) > 0) throw new Error('gate affiché sans variable configurée');
    await enterDemo(page);
    await ctx.close();
  });

  const { ctx, page } = await newPage(true);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await assert('Avec variable → écran mot de passe', async () => {
    await gate(page).waitFor({ state: 'visible', timeout: 6000 });
    if ((await page.getByRole('heading', { name: /Bonjour Mickaël/ }).count()) > 0)
      throw new Error('app accessible malgré la variable');
  });

  await assert('Mauvais mot de passe → refus clair', async () => {
    await gate(page).fill('mauvais');
    await page.getByRole('button', { name: 'Entrer' }).click();
    await page.getByText(/incorrect/i).waitFor({ state: 'visible', timeout: 4000 });
    if ((await page.getByRole('heading', { name: /Bonjour Mickaël/ }).count()) > 0)
      throw new Error('accès accordé malgré un mauvais mot de passe');
  });

  await assert('Bon mot de passe → accès', async () => {
    await gate(page).fill(PW);
    await page.getByRole('button', { name: 'Entrer' }).click();
    await enterDemo(page);
  });

  await assert('Persistance après reload (pas de re-demande)', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    if ((await gate(page).count()) > 0) throw new Error('mot de passe redemandé après reload');
    await enterDemo(page);
  });

  await assert('« Verrouiller » → l’écran mot de passe revient', async () => {
    await page.getByRole('button', { name: 'Verrouiller la démo' }).click();
    await gate(page).waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Zéro erreur console', async () => {
    if (allConsole.length > 0) throw new Error(allConsole.slice(0, 5).join(' | '));
  });

  await ctx.close();
} catch (e) {
  await assert('FATAL', async () => {
    throw e;
  });
} finally {
  const failed = summary(allConsole);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
