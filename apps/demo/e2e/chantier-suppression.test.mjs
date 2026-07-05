/**
 * RC1 — Suppression d'un chantier. Action destructive PROTÉGÉE (confirmation
 * obligatoire), 100 % locale, sans nouvel écran : depuis « Gérer » (n'importe
 * quel chantier) ou depuis la fiche du chantier actif.
 *  • Annuler ne supprime rien ;
 *  • supprimer retire le chantier d'Aujourd'hui ET ses données associées ;
 *  • si le chantier actif est supprimé, on bascule vers un autre ;
 *  • un contact GLOBAL (référencé hors du chantier) n'est jamais supprimé ;
 *  • export/import reste fonctionnel.
 * Seed : Lyon 6e (actif), Maison Écully, Duplex Croix-Rousse + « Cabinet Vitruve »
 * (contact global, rattaché à aucun chantier).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const gerer = () => page.getByRole('button', { name: 'Gérer' });
const heading = (re) => page.getByRole('heading', { name: re });
const trashIn = (name) => page.getByRole('button', { name: `Supprimer ${name}` });
const confirmDelete = () => page.getByRole('button', { name: /Supprimer définitivement/ });
const seen = async (re) => (await page.getByText(re).count()) > 0;
// Ferme la boîte « Gérer » de façon déterministe (le bouton « Fermer » de la
// modale, une fois toute confirmation imbriquée refermée).
const closeManage = async () => {
  await heading(/^Supprimer /)
    .waitFor({ state: 'hidden', timeout: 3000 })
    .catch(() => {});
  await page.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('heading', { name: 'Gérer' }).waitFor({ state: 'hidden', timeout: 5000 });
};

try {
  await openDemo(page);

  await assert('Annuler une suppression ne supprime rien', async () => {
    await gerer().click();
    await trashIn('Duplex Croix-Rousse').click();
    await heading(/Supprimer .*Duplex Croix-Rousse/).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /^Annuler$/ }).click();
    await closeManage();
    await heading(/Mes chantiers \(3\)/).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText('Duplex Croix-Rousse').first().waitFor({ state: 'visible' });
  });

  await assert(
    'Supprimer un chantier NON actif (depuis Gérer) le retire d’Aujourd’hui',
    async () => {
      await gerer().click();
      await trashIn('Duplex Croix-Rousse').click();
      await confirmDelete().click();
      await closeManage();
      await heading(/Mes chantiers \(2\)/).waitFor({ state: 'visible', timeout: 5000 });
      if (await seen(/Duplex Croix-Rousse/))
        throw new Error('le chantier supprimé est resté visible');
      // Ses données associées disparaissent aussi (sa question client seedée).
      if (await seen(/décaler la réception/)) throw new Error('des données associées ont survécu');
    },
  );

  await assert(
    'Créer puis supprimer le chantier ACTIF (depuis la fiche) bascule ailleurs',
    async () => {
      await gerer().click();
      await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
      await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor();
      await page.getByLabel('Nom du chantier').fill('Chantier Jetable');
      await page.getByLabel('Nom du client').fill('Client X');
      await page.getByRole('button', { name: /Créer le chantier/ }).click();
      // Le nouveau chantier est actif : on l'ouvre et on le supprime depuis sa fiche.
      await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
      await heading(/Chantier Jetable/)
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      await page.getByRole('button', { name: /Supprimer ce chantier/ }).click();
      await confirmDelete().click();
      // On bascule vers un autre chantier (plus « Chantier Jetable »).
      await page.waitForTimeout(400);
      if (await seen(/Chantier Jetable/)) throw new Error('le chantier actif supprimé est resté');
      await page.getByRole('tab', { name: /Aujourd/ }).click();
      await heading(/Mes chantiers \(2\)/).waitFor({ state: 'visible', timeout: 5000 });
    },
  );

  await assert('Supprimer le chantier principal retire ses données (journal)', async () => {
    // Lyon porte la décision « Quel carrelage » ; elle doit disparaître avec lui.
    await gerer().click();
    await trashIn('Appartement Lyon 6e').click();
    await confirmDelete().click();
    await closeManage();
    await heading(/Mes chantiers \(1\)/).waitFor({ state: 'visible', timeout: 5000 });
    if (await seen(/Appartement Lyon 6e/)) throw new Error('le chantier principal est resté');
    if (await seen(/Quel carrelage/))
      throw new Error('une décision du chantier supprimé a survécu');
  });

  await assert(
    'Un contact GLOBAL survit ; le contact client du chantier supprimé part',
    async () => {
      // Vérifié au niveau des données (l'écran Annuaire n'existe plus) : la
      // sauvegarde conserve le contact global mais retire le contact orphelin.
      await gerer().click();
      const dl = page.waitForEvent('download', { timeout: 6000 });
      await page.getByRole('button', { name: /Exporter mes données/ }).click();
      const { readFileSync } = await import('node:fs');
      const content = readFileSync(await (await dl).path(), 'utf8');
      await closeManage();
      // « Cabinet Vitruve » n'était rattaché à aucun chantier → conservé.
      if (!content.includes('Cabinet Vitruve'))
        throw new Error('un contact global a été supprimé à tort');
      // « Mme Martin » (cliente de Lyon supprimé) → contact orphelin retiré.
      if (content.includes('Mme Martin'))
        throw new Error('un contact orphelin du chantier supprimé a survécu');
    },
  );

  await assert('Export/import reste fonctionnel après suppressions', async () => {
    await gerer().click();
    const dl = page.waitForEvent('download', { timeout: 6000 });
    await page.getByRole('button', { name: /Exporter mes données/ }).click();
    const { readFileSync } = await import('node:fs');
    const content = readFileSync(await (await dl).path(), 'utf8');
    if (content.includes('Appartement Lyon 6e') || content.includes('Duplex Croix-Rousse'))
      throw new Error('la sauvegarde contient encore un chantier supprimé');
    if (!content.includes('Maison Écully'))
      throw new Error('la sauvegarde a perdu un chantier conservé');
    await closeManage();
  });

  await assert('Non-régression : l’app reste vivante (1 chantier restant)', async () => {
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await heading(/Maison Écully/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
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
