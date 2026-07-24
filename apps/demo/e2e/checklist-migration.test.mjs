/**
 * RC1 — Migration : un chantier créé AVANT la check-list standard (donc sans champ
 * `checklist`) doit récupérer la check-list PHÉNIX au chargement. Reproduit le cas
 * terrain « ma check-list est vide » (état localStorage antérieur à la fonctionnalité).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const CONTROLS = ['Clés récupérées', 'Panneau de chantier posé', 'Sous-traitants informés'];

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const openPreparation = async () => {
  await page
    .getByRole('button', { name: /Découvrir la démo/ })
    .click()
    .catch(() => {});
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
  await page.getByRole('tab', { name: /Préparation/ }).click();
};

try {
  await openDemo(page);

  await assert('Simule un état LEGACY : on retire le champ `checklist` des dossiers', async () => {
    const stripped = await page.evaluate(() => {
      let count = 0;
      for (const k of Object.keys(localStorage)) {
        let v;
        try {
          v = JSON.parse(localStorage.getItem(k) ?? 'null');
        } catch {
          continue;
        }
        if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
        let touched = false;
        for (const val of Object.values(v)) {
          if (
            val &&
            typeof val === 'object' &&
            'roadmap' in val &&
            'documents' in val &&
            'checklist' in val
          ) {
            delete val.checklist;
            touched = true;
            count += 1;
          }
        }
        if (touched) localStorage.setItem(k, JSON.stringify(v));
      }
      return count;
    });
    if (stripped === 0) throw new Error('aucun dossier trouvé à dégrader (setup invalide)');
  });

  await assert('Au rechargement, la migration backfill la check-list PHÉNIX', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await openPreparation();
    await page
      .getByRole('heading', { name: 'Check-list de lancement' })
      .waitFor({ state: 'visible', timeout: 8000 });
    for (const label of CONTROLS)
      await page
        .locator('li')
        .filter({ hasText: label })
        .first()
        .waitFor({ state: 'visible', timeout: 4000 });
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
