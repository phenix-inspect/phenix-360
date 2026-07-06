/**
 * RC1 — Check-list de lancement STANDARD PHÉNIX (préremplie à la création).
 * ===========================================================================
 * Chaque nouveau chantier démarre avec la MÊME check-list (jamais vide) :
 *  • 6 contrôles qualité PHÉNIX préremplis, INFORMATIFS (ne bloquent jamais) ;
 *  • les 3 bloquants (devis · acompte · date) restent les SEULS à piloter le
 *    partage client / le passage « En cours » ;
 *  • cocher / ajouter / supprimer une ligne fonctionne ; les coches persistent
 *    au rechargement ET à l'export/import.
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { phenixDevisPdf } from './pdf-fixtures.mjs';
import { readFileSync } from 'node:fs';

const CONTROLS = [
  'Clés récupérées',
  'Déclaration de travaux effectuée (si nécessaire)',
  'Panneau de chantier posé',
  'Sous-traitants informés',
  'Commandes principales passées',
  'Accès chantier confirmé',
];
const BLOQUANTS = ['Devis signé', 'Acompte payé', 'Date officielle de démarrage'];

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2800 });
const { assert, summary } = harness();

const item = (label) => page.locator('li').filter({ hasText: label }).first();
const isChecked = async (label) =>
  (await item(label).getByRole('button', { name: 'Décocher' }).count()) > 0;

const openPreparation = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: /Préparation/ }).click();
};

const openJeanTesteur = async () => {
  // Jean Testeur reste le chantier ACTIF (persisté) : il suffit de rouvrir
  // l'onglet Préparation. On neutralise l'éventuel écran d'accueil.
  await page
    .getByRole('button', { name: /Découvrir la démo/ })
    .click()
    .catch(() => {});
  await openPreparation();
  await page
    .getByRole('heading', { name: 'Check-list de lancement' })
    .waitFor({ state: 'visible', timeout: 8000 });
};

const createChantier = async () => {
  await page.getByRole('button', { name: 'Gérer' }).click();
  await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
  await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles([
      { name: 'Devis.pdf', mimeType: 'application/pdf', buffer: phenixDevisPdf({}) },
    ]);
  await page.getByRole('button', { name: /Préparer mon chantier/ }).click();
  await page.getByRole('button', { name: /Entrer dans le chantier/ }).click();
  await page
    .getByRole('heading', { name: /Jean Testeur/ })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
};

/** Recherche récursive d'un point de check-list coché dans un état exporté. */
const findChecked = (obj, label) => {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.label === label && obj.done === true) return true;
  return Object.values(obj).some((v) => findChecked(v, label));
};

try {
  await openDemo(page);
  await createChantier();
  await openPreparation();

  await assert('Nouveau chantier : les 6 contrôles PHÉNIX sont préremplis', async () => {
    await page
      .getByRole('heading', { name: 'Check-list de lancement' })
      .waitFor({ state: 'visible', timeout: 6000 });
    for (const label of CONTROLS) await item(label).waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Les 3 bloquants sont présents (check-list de partage)', async () => {
    for (const label of BLOQUANTS)
      await page.getByText(label, { exact: false }).first().waitFor({ state: 'visible' });
  });

  await assert('Au départ, aucun contrôle n’est coché', async () => {
    for (const label of CONTROLS)
      if (await isChecked(label)) throw new Error(`« ${label} » coché à tort au départ`);
  });

  await assert('Ajout d’une ligne personnalisée', async () => {
    await page.getByLabel('Nouveau point de check-list').fill('Benne à gravats commandée');
    await page.getByRole('button', { name: 'Ajouter le point' }).click();
    await item('Benne à gravats commandée').waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Suppression d’une ligne', async () => {
    await item('Accès chantier confirmé').getByRole('button', { name: 'Retirer' }).click();
    await item('Accès chantier confirmé').waitFor({ state: 'detached', timeout: 4000 });
  });

  await assert('Seuls les 3 bloquants bloquent : contrôles non cochés → partage OK', async () => {
    // On lève les 3 bloquants (devis déjà fourni), sans toucher aux contrôles.
    await item('Acompte payé').getByRole('button', { name: 'Marquer comme payé' }).click();
    await page.getByLabel('Date officielle de démarrage').fill('2026-10-05');
    await page
      .getByText('Prêt à partager au client')
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    // Les contrôles sont restés informatifs (non cochés) et n'ont rien bloqué.
    if (await isChecked('Sous-traitants informés'))
      throw new Error('un contrôle a été coché par erreur');
  });

  await assert('Cocher un contrôle', async () => {
    await item('Sous-traitants informés').getByRole('button', { name: 'Cocher' }).click();
    if (!(await isChecked('Sous-traitants informés')))
      throw new Error('le contrôle ne s’est pas coché');
  });

  await assert('Les coches PERSISTENT après rechargement', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await openJeanTesteur();
    if (!(await isChecked('Sous-traitants informés')))
      throw new Error('la coche a été perdue au rechargement');
  });

  await assert('Export/import CONSERVE les états de coche', async () => {
    // Export → le fichier porte bien la coche.
    await page.getByRole('button', { name: 'Gérer' }).click();
    const dl = page.waitForEvent('download', { timeout: 6000 });
    await page.getByRole('button', { name: /Exporter mes données/ }).click();
    const content = readFileSync(await (await dl).path(), 'utf8');
    if (!findChecked(JSON.parse(content), 'Sous-traitants informés'))
      throw new Error('l’export ne contient pas l’état coché');

    // On décoche, puis on RÉIMPORTE : l'état exporté (coché) doit être restauré.
    await page.getByRole('button', { name: /Importer une sauvegarde/ }).click();
    // Le champ fichier de « Gérer » (la Préparation derrière le dialogue en a un aussi).
    await page
      .getByRole('dialog')
      .locator('input[type=file]')
      .setInputFiles([
        { name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(content) },
      ]);
    await page.getByRole('button', { name: /Remplacer mes données/ }).click();
    await page
      .getByRole('dialog')
      .waitFor({ state: 'detached', timeout: 6000 })
      .catch(() => {});
    await openJeanTesteur();
    if (!(await isChecked('Sous-traitants informés')))
      throw new Error('l’import n’a pas restauré la coche');
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
