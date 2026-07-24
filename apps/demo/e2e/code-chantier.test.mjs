/**
 * CODE CHANTIER — affichage & immuabilité de bout en bout (dans l'app réelle).
 * ===========================================================================
 * Le code `AA-VV-NNN` est la référence unique du chantier. Ce test vérifie, dans
 * l'application :
 *   • chaque chantier de la liste « Mes chantiers » porte un code au bon format ;
 *   • les codes sont UNIQUES ;
 *   • la fiche du chantier affiche le même code que la liste ;
 *   • le code ne change JAMAIS quand on modifie le chantier (ici : le statut).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 1600 });
const { assert, summary } = harness();

const CODE_RE = /^\d{2}-[A-Z]{2}-\d{3}$/;
const codesOnPage = () =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('span, p'))
      .map((e) => (e.textContent || '').trim())
      .filter((t) => /^\d{2}-[A-Z]{2}-\d{3}$/.test(t)),
  );

try {
  await openDemo(page);

  let codes = [];
  await assert('Chaque chantier de la liste porte un code au bon format', async () => {
    codes = await codesOnPage();
    if (codes.length < 3) throw new Error(`attendu ≥ 3 codes, obtenu ${codes.length}`);
    for (const c of codes) if (!CODE_RE.test(c)) throw new Error(`format invalide : ${c}`);
  });

  await assert('Les codes chantier sont uniques', async () => {
    const uniq = new Set(codes);
    if (uniq.size !== codes.length) throw new Error(`doublon parmi ${codes.join(', ')}`);
  });

  let ficheCode = '';
  await assert('La fiche du chantier affiche son code', async () => {
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page.getByRole('button', { name: /Nouvelle mission/ }).waitFor({ timeout: 6000 });
    const onFiche = await codesOnPage();
    ficheCode = onFiche[0] ?? '';
    if (!CODE_RE.test(ficheCode)) throw new Error(`aucun code sur la fiche (${ficheCode})`);
    if (!codes.includes(ficheCode))
      throw new Error(`le code de la fiche ${ficheCode} ne figure pas dans la liste`);
  });

  await assert('Le code est DÉFINITIF : changer le statut ne le modifie pas', async () => {
    const select = page.getByLabel('Statut du chantier');
    await select.waitFor({ state: 'visible', timeout: 6000 });
    // Bascule vers un autre statut, puis relit le code.
    await select.selectOption('pre_reception');
    await page.waitForTimeout(300);
    const after = (await codesOnPage())[0] ?? '';
    if (after !== ficheCode)
      throw new Error(`le code a changé après modif : ${ficheCode} → ${after}`);
  });

  await assert('Zéro erreur console', async () => {
    if (consoleErrors.length > 0) throw new Error(consoleErrors.slice(0, 4).join(' | '));
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
