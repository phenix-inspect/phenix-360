/**
 * RC1 — Parcours signature « Nouvelle mission » : capturer → PHÉNIX comprend →
 * valider → partager. Le conducteur ne rédige pas : il capture, PHÉNIX structure,
 * il valide. On vérifie que la mission produit bien une trace au Journal.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page
    .getByRole('heading', { name: /Appartement Lyon 6e/ })
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });

  await assert('« Nouvelle mission » ouvre le choix des missions', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByText('Compte rendu de chantier').waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert(
    'Menu allégé (V1) : « SAV » et « Note / observation » n’apparaissent plus',
    async () => {
      const dialog = page.getByRole('dialog');
      for (const label of ['SAV', 'Note / observation'])
        if ((await dialog.getByText(label, { exact: true }).count()) > 0)
          throw new Error(`la mission « ${label} » ne devrait plus apparaître dans le menu`);
      // Les six entrées du quotidien restent présentes (3 missions + album + 2 actions).
      for (const label of [
        'Publier dans les coulisses',
        'Compte rendu de chantier',
        'Pré-réception',
        'Réception',
        'Ajouter un document',
        'Demander au client',
      ])
        await dialog.getByText(label, { exact: true }).first().waitFor({ state: 'visible' });
    },
  );

  await assert('Capture : on dicte/écrit une observation', async () => {
    await page.getByRole('dialog').getByText('Pré-réception').click();
    const draft = page.getByPlaceholder(/Dites ce qu/);
    await draft.waitFor({ state: 'visible', timeout: 5000 });
    await draft.fill('Coulage de la dalle terminé, séchage en cours côté séjour.');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  });

  await assert('« J’ai terminé » → PHÉNIX travaille puis COMPREND', async () => {
    await page.getByRole('button', { name: /J.ai terminé/ }).click();
    // On arrive à l'étape « comprend » : le bouton « Valider » apparaît.
    await page
      .getByRole('button', { name: /^Valider$/ })
      .waitFor({ state: 'visible', timeout: 12000 });
    // PHÉNIX a bien pris en compte l'observation dictée.
    await page
      .getByText(/dalle terminé/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Valider → étape de partage', async () => {
    await page.getByRole('button', { name: /^Valider$/ }).click();
    // L'étape partage propose de terminer ou de partager.
    await page
      .getByRole('button', { name: /Terminer|Partager/ })
      .first()
      .waitFor({
        state: 'visible',
        timeout: 8000,
      });
  });

  await assert('Terminer referme la mission sans erreur', async () => {
    await page.getByRole('button', { name: /^Terminer$/ }).click();
    await page
      .getByRole('heading', { name: /Appartement Lyon 6e/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('La mission a laissé une trace (Récit / Journal du chantier)', async () => {
    // Une note se matérialise en Moment du Récit ; on la retrouve après création.
    await page.getByRole('tab', { name: 'Dans les coulisses' }).click();
    await page.waitForTimeout(300);
    if ((await page.getByText(/dalle terminé/).count()) === 0) {
      await page.getByRole('tab', { name: 'Suivi', exact: true }).click();
      await page.waitForTimeout(300);
    }
    if ((await page.getByText(/dalle terminé/).count()) === 0)
      throw new Error('la mission n’a laissé aucune trace visible (Récit ni Journal)');
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
