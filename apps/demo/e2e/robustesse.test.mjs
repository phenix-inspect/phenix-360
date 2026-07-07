/**
 * RC1 — QA ROBUSTESSE : on essaie de CASSER l'app comme sur le terrain.
 * Fichiers cassés, flux abandonnés, plus aucun chantier, imports invalides,
 * rechargements au milieu d'un flux. Aucune erreur console, aucun blocage.
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { phenixDevisPdf, imagePdf } from './pdf-fixtures.mjs';
import { readFileSync } from 'node:fs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const gerer = () => page.getByRole('button', { name: 'Gérer' });
const heading = (re) => page.getByRole('heading', { name: re });
const seen = async (re) => (await page.getByText(re).count()) > 0;
const closeManage = async () => {
  await heading(/^Supprimer /)
    .waitFor({ state: 'hidden', timeout: 3000 })
    .catch(() => {});
  await page.getByRole('button', { name: 'Fermer' }).click();
  await heading(/^Gérer$/)
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
};
const deposit = async (files) => {
  await gerer().click();
  await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
  await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
  await page.locator('input[type=file]').first().setInputFiles(files);
  await page.getByRole('button', { name: /Préparer mon chantier/ }).click();
};
const pdf = (name, buffer) => ({ name, mimeType: 'application/pdf', buffer });

try {
  await openDemo(page);

  await assert('Devis + acompte + photo ensemble : lu + photo au récit', async () => {
    const PNG =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await deposit([
      pdf('Devis_D202601001.pdf', phenixDevisPdf()),
      pdf('acompte-30.pdf', phenixDevisPdf({ numero: 'D-202601-002' })),
      { name: 'photo-avant.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') },
    ]);
    await page.getByText('Lecture réelle du devis').waitFor({ state: 'visible', timeout: 15000 });
    await page
      .getByText(/M\. Jean Testeur/)
      .first()
      .waitFor({ state: 'visible' });
    await page
      .getByText(/Photos avant travaux/)
      .first()
      .waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /Entrer dans le chantier/ }).click();
    await heading(/Jean Testeur/)
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });
  });

  await assert('PDF illisible (contenu non-PDF) → message clair, pas de crash', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await heading(/Bonjour Mickaël/).waitFor({ timeout: 8000 });
    await deposit([pdf('devis.pdf', Buffer.from('ceci n est pas un pdf du tout, juste du texte'))]);
    await page
      .getByText(/n'est pas extractible automatiquement/)
      .waitFor({ state: 'visible', timeout: 15000 });
  });

  await assert('PDF vide → message clair, pas de crash', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await heading(/Bonjour Mickaël/).waitFor({ timeout: 8000 });
    await deposit([pdf('vide.pdf', Buffer.from('%PDF-1.4\n%%EOF'))]);
    await page
      .getByText(/n'est pas extractible automatiquement|Lecture réelle du devis/)
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
  });

  await assert('Reload EN PLEINE création → retour à un état utilisable', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await heading(/Bonjour Mickaël/).waitFor({ timeout: 8000 });
    await gerer().click();
    await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
    await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
    await page.getByLabel('Nom du chantier').fill('Brouillon perdu');
    // On recharge au milieu : rien n'est créé, l'app reste utilisable.
    await page.reload({ waitUntil: 'networkidle' });
    await heading(/Bonjour Mickaël/).waitFor({ timeout: 8000 });
    if (await seen(/Brouillon perdu/)) throw new Error('un brouillon non validé a été créé');
  });

  await assert('Import d’un fichier INVALIDE → erreur claire, données intactes', async () => {
    await gerer().click();
    await page.getByRole('button', { name: /Importer une sauvegarde/ }).click();
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles([
        {
          name: 'nimp.json',
          mimeType: 'application/json',
          buffer: Buffer.from('{pas du json valide'),
        },
      ]);
    await page.getByRole('button', { name: /Remplacer mes données/ }).click();
    await page.getByRole('alert').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /^Annuler$/ }).click();
    await closeManage();
    // Les chantiers seedés sont toujours là.
    await heading(/Mes chantiers \(\d+\)/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Export puis import du MÊME fichier → cohérent, pas de crash', async () => {
    await gerer().click();
    const dl = page.waitForEvent('download', { timeout: 6000 });
    await page.getByRole('button', { name: /Exporter mes données/ }).click();
    const content = readFileSync(await (await dl).path(), 'utf8');
    await page.getByRole('button', { name: /Importer une sauvegarde/ }).click();
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles([
        { name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(content) },
      ]);
    await page.getByRole('button', { name: /Remplacer mes données/ }).click();
    await heading(/Bonjour Mickaël/).waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('AUCUN chantier : supprimer tout → état vide, aucun crash', async () => {
    // Supprime tous les chantiers via Gérer.
    for (let i = 0; i < 12; i += 1) {
      await gerer().click();
      const trash = page.getByRole('button', { name: /^Supprimer / });
      if ((await trash.count()) === 0) {
        await closeManage();
        break;
      }
      await trash.first().click();
      await page.getByRole('button', { name: /Supprimer définitivement/ }).click();
      await closeManage();
    }
    await page
      .getByText(/Aucun chantier pour l.instant/)
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Sans chantier : Chantier / Espace client ne crashent pas', async () => {
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page.waitForTimeout(200);
    await page
      .getByText(/Aucun chantier pour l.instant/)
      .first()
      .waitFor({ state: 'visible' });
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(200);
    await page
      .getByText(/Aucun chantier pour l.instant/)
      .first()
      .waitFor({ state: 'visible' });
    await page
      .getByRole('tab', { name: /Aujourd/ })
      .first()
      .click();
  });

  await assert('Recharger la démonstration restaure des chantiers', async () => {
    await gerer().click();
    await page.getByRole('button', { name: /Recharger la démonstration/ }).click();
    await heading(/Mes chantiers \(3\)/).waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Zéro erreur console sur tout le parcours', async () => {
    if (consoleErrors.length > 0) throw new Error(consoleErrors.slice(0, 6).join(' | '));
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
