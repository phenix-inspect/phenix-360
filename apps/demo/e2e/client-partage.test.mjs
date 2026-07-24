/**
 * RC1 — Partage client : les 3 BLOQUANTS avant d'ouvrir l'espace client
 * (devis signé · acompte payé · date officielle de démarrage fixée À LA MAIN).
 *  • 3 validés → espace client ACCESSIBLE ;
 *  • un seul manquant → espace client BLOQUÉ (écran interne « Espace client non
 *    prêt », aucune fuite de récit/planning/documents) ;
 *  • le bloc « Pas encore prêt » sépare visuellement les BLOQUANTS des ALERTES ;
 *  • la date du devis ne préremplit JAMAIS le démarrage.
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { phenixDevisPdf } from './pdf-fixtures.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const openPreparation = async () => {
  // « Espace client » est une vue de PREMIER niveau : pour revenir à la
  // Préparation (sous-onglet conducteur), on repasse d'abord par « Chantier ».
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: /Préparation/ }).click();
};
const openClient = async () => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await page.waitForTimeout(500);
};
// La check-list de partage est TOUJOURS visible (aucun dépliage) : on attend
// simplement que le cockpit soit rendu.
const waitShareBlock = async () => {
  await page
    .getByText('éléments obligatoires validés')
    .first()
    .waitFor({ state: 'visible', timeout: 6000 });
};
const acompteRow = () => page.locator('li').filter({ hasText: 'Acompte payé' }).first();
const dateRow = () =>
  page.locator('li').filter({ hasText: 'Date officielle de démarrage' }).first();
const futureDate = () => {
  const d = new Date(Date.now() + 60 * 86_400_000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

try {
  await openDemo(page);
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();

  await assert('Les 3 bloquants validés → espace client ACCESSIBLE', async () => {
    await openClient();
    if ((await page.getByText('Espace client non prêt').count()) > 0)
      throw new Error('espace client bloqué alors que les 3 bloquants sont validés');
    // L'espace client est accessible : ses onglets sont rendus.
    await page
      .getByRole('tab', { name: 'Vos demandes' })
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });
  });

  await assert('Sans acompte → espace client BLOQUÉ (« il manque : Acompte payé »)', async () => {
    await openPreparation();
    await waitShareBlock();
    await acompteRow().getByRole('button', { name: 'Annuler' }).click(); // acompte → non payé
    await openClient();
    await page
      .getByRole('heading', { name: 'Espace client non prêt' })
      .waitFor({ state: 'visible', timeout: 6000 });
    await page.getByText('Acompte payé').first().waitFor({ state: 'visible', timeout: 4000 });
    // Aucune fuite : les onglets client ne s'affichent pas quand l'espace est bloqué.
    if ((await page.getByRole('tab', { name: 'Vos demandes' }).count()) > 0)
      throw new Error('le contenu client fuit alors que l’espace est bloqué');
  });

  await assert('Sans date officielle → espace client BLOQUÉ', async () => {
    await openPreparation();
    await waitShareBlock();
    await acompteRow().getByRole('button', { name: 'Marquer comme payé' }).click(); // acompte remis
    await dateRow().getByRole('button', { name: 'Effacer' }).click(); // date effacée
    await openClient();
    await page
      .getByRole('heading', { name: 'Espace client non prêt' })
      .waitFor({ state: 'visible', timeout: 6000 });
    await page
      .getByText('Date officielle de démarrage')
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('« Pas encore prêt » : check-list toujours visible + ALERTES séparées', async () => {
    await openPreparation();
    await waitShareBlock(); // check-list toujours visible (non partageable)
    await page.getByText('Pas encore prêt').first().waitFor({ state: 'visible', timeout: 4000 });
    // Les 3 éléments obligatoires sont listés directement (aucun dépliage).
    for (const b of ['Devis signé', 'Acompte payé', 'Date officielle de démarrage'])
      await page.getByText(b, { exact: true }).first().waitFor({ state: 'visible' });
    // La section ALERTES est distincte (non bloquantes).
    await page
      .getByRole('heading', { name: 'Alertes (non bloquantes)' })
      .waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert(
    'Nouveau chantier (devis lu) : la date du devis ne fixe PAS le démarrage → bloqué',
    async () => {
      await page.getByRole('button', { name: 'Gérer' }).click();
      await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
      await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
      await page
        .locator('input[type=file]:not([capture])')
        .first()
        .setInputFiles([
          {
            name: 'Devis_futur.pdf',
            mimeType: 'application/pdf',
            buffer: phenixDevisPdf({ debut: futureDate() }),
          },
        ]);
      await page.getByRole('button', { name: /Préparer mon chantier/ }).click();
      await page.getByRole('button', { name: /Entrer dans le chantier/ }).click();
      await page
        .getByRole('heading', { name: /Jean Testeur/ })
        .first()
        .waitFor({ state: 'visible', timeout: 8000 });
      // Devis LU (« Devis signé » validé) mais démarrage NON fixé → bloqué.
      await openClient();
      await page
        .getByRole('heading', { name: 'Espace client non prêt' })
        .waitFor({ state: 'visible', timeout: 6000 });
    },
  );

  await assert('Devis retiré → « Devis signé » devient un bloquant manquant', async () => {
    // On valide d'abord acompte + date (2 bloquants), puis on RETIRE le devis :
    // l'espace doit rester bloqué sur le seul « Devis signé ».
    await openPreparation();
    await waitShareBlock();
    await acompteRow().getByRole('button', { name: 'Marquer comme payé' }).click();
    const iso = new Date(Date.now() + 42 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel('Date officielle de démarrage').fill(iso);
    await page
      .getByText('Prêt à partager au client')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    // Retrait du document « Devis signé » — la gestion des documents vit désormais
    // dans l'onglet DOCUMENTS (bibliothèque unique).
    await page.getByRole('tab', { name: 'Documents', exact: true }).click();
    await page.getByRole('button', { name: 'Retirer Devis signé' }).click();
    await openClient();
    await page
      .getByRole('heading', { name: 'Espace client non prêt' })
      .waitFor({ state: 'visible', timeout: 6000 });
    await page.getByText('Devis signé').first().waitFor({ state: 'visible', timeout: 4000 });
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
