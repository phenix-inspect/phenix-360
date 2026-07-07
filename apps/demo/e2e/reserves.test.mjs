/**
 * Registre des réserves : création (responsable = Contact via sélecteur),
 * segments en retard / à lever / levées, report dans « Aujourd'hui », levée,
 * client-safe.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 1600 });
const { assert, summary } = harness();

const A = 'Joint de silicone à refaire dans la douche';
const B = 'Reprise peinture couloir niveau 1';

async function addReserve({ libelle, responsable, echeance, priorite }) {
  await page.getByRole('button', { name: /Nouvelle réserve/ }).click();
  await page.getByLabel('Description de la réserve').fill(libelle);
  if (responsable) await page.getByLabel('Responsable', { exact: true }).selectOption({ index: 1 });
  if (echeance) await page.getByLabel('Échéance', { exact: true }).fill(echeance);
  if (priorite) await page.getByRole('button', { name: priorite, exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.getByText(libelle).first().waitFor({ state: 'visible', timeout: 5000 });
}

try {
  await openDemo(page);

  await assert('Ouvrir le registre des réserves', async () => {
    await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
    await page.getByRole('tab', { name: /^Réserves/ }).click();
    await page
      .getByRole('heading', { name: 'Réserves du chantier' })
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Créer une réserve EN RETARD (échéance passée, priorité haute)', async () => {
    await addReserve({ libelle: A, responsable: true, echeance: '2020-01-01', priorite: 'Haute' });
    await page
      .getByRole('heading', { name: /En retard/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText('en retard').first().waitFor({ state: 'visible', timeout: 4000 });
    await page.getByText('Priorité haute').first().waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Créer une réserve À LEVER (échéance future)', async () => {
    await addReserve({ libelle: B, echeance: '2030-06-01', priorite: 'Normale' });
    await page.getByText(B).first().waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Aujourd’hui reflète les nouvelles réserves (1 seed + 2 = 3)', async () => {
    await page
      .getByRole('tab', { name: /Aujourd/ })
      .first()
      .click();
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    const cardBtn = page.getByRole('button', { name: /Appartement Lyon 6e/ });
    await cardBtn.getByText(/3 réserves/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Lever une réserve la fait passer en « Levées »', async () => {
    await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
    await page.getByRole('tab', { name: /^Réserves/ }).click();
    await page.getByRole('button', { name: 'Lever la réserve' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill('Silicone repris et contrôlé sur place.');
    await dialog.getByRole('button', { name: 'Lever la réserve' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await page
      .getByRole('heading', { name: /^Levées/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    await page
      .getByText(/Levée le .* par Mickaël/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Client-safe : les réserves ne fuient jamais côté client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(600);
    for (const secret of [A, B, 'Réserve n°']) {
      if ((await page.getByText(secret, { exact: false }).count()) > 0)
        throw new Error(`fuite côté client : « ${secret} »`);
    }
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
