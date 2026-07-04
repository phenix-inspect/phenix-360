/**
 * RC1 — Coup de cœur : le feedback visuel DOIT être immédiat (retour terrain).
 * Au clic, le cœur se remplit en rouge vif (#e11d48 = rgb(225,29,72)) ; un second
 * clic le vide. L'état « aimé » pilote réellement la couleur ET le remplissage.
 * Persiste après rechargement. Fonctionne côté conducteur ET côté client.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const RED = 'rgb(225, 29, 72)';
const heart = (btn) => btn.locator('svg').first();
const fillOf = (btn) => heart(btn).evaluate((el) => getComputedStyle(el).fill);
const pressed = (btn) => btn.getAttribute('aria-pressed');

/** Ouvre le Récit du chantier actif côté conducteur et rend le 1er cœur. */
async function firstHeartButton() {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Récit' }).click();
  const btn = page.getByRole('button', { name: /coup de cœur/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 6000 });
  return btn;
}

try {
  await openDemo(page);

  await assert('CONDUCTEUR — au départ, le cœur est en contour (non aimé)', async () => {
    const btn = await firstHeartButton();
    if ((await pressed(btn)) !== 'false') throw new Error('le cœur est déjà « aimé »');
    if ((await fillOf(btn)) === RED) throw new Error('le cœur est déjà rempli de rouge');
  });

  await assert('Premier clic → cœur rouge REMPLI', async () => {
    const btn = page.getByRole('button', { name: /coup de cœur/i }).first();
    await btn.click();
    await page.waitForTimeout(250); // laisse le « pop » se terminer
    if ((await pressed(btn)) !== 'true') throw new Error('aria-pressed n’est pas passé à true');
    if ((await fillOf(btn)) !== RED)
      throw new Error(`le cœur n’est pas rempli en rouge (fill=${await fillOf(btn)})`);
  });

  await assert('Second clic → retour à l’état initial (contour)', async () => {
    const btn = page.getByRole('button', { name: /coup de cœur/i }).first();
    await btn.click();
    await page.waitForTimeout(250);
    if ((await pressed(btn)) !== 'false') throw new Error('aria-pressed n’est pas revenu à false');
    if ((await fillOf(btn)) === RED) throw new Error('le cœur reste rempli après le second clic');
  });

  await assert('Persistance : aimé, puis rechargement → toujours aimé', async () => {
    const btn = page.getByRole('button', { name: /coup de cœur/i }).first();
    await btn.click(); // on aime
    if ((await pressed(btn)) !== 'true') throw new Error('like non pris en compte');
    await page.reload({ waitUntil: 'networkidle' });
    const btn2 = await firstHeartButton();
    if ((await pressed(btn2)) !== 'true') throw new Error('le coup de cœur n’a pas persisté');
    if ((await fillOf(btn2)) !== RED) throw new Error('le cœur n’est pas rouge après rechargement');
    // On nettoie pour ne pas polluer la vérif client (état conducteur ≠ client).
    await btn2.click();
  });

  await assert('CLIENT — le coup de cœur marche aussi dans l’espace client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    const btn = page.getByRole('button', { name: /coup de cœur/i }).first();
    await btn.waitFor({ state: 'visible', timeout: 6000 });
    const before = await pressed(btn);
    await btn.click();
    await page.waitForTimeout(250);
    if ((await pressed(btn)) === before) throw new Error('l’état n’a pas basculé côté client');
    if ((await pressed(btn)) === 'true' && (await fillOf(btn)) !== RED)
      throw new Error('le cœur n’est pas rouge rempli côté client');
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
