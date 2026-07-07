/**
 * RC1 — « Nouvelle mission » = point d'entrée UNIQUE des créations.
 * ===========================================================================
 * Règle unique à mémoriser : « je veux faire quelque chose → Nouvelle mission ».
 * Les actions de CRÉATION quittent le Suivi (qui ne sert plus qu'à CONSULTER —
 * radar, dernière activité) : « Ajouter un document », « Demander au client » et
 * « Répondre au client » vivent désormais dans le sélecteur « Nouvelle mission ».
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const PDF = {
  name: 'plan-cuisine.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 plan'),
};
const DOC_LABEL = 'Plan cuisine via mission';

const openChantierSuivi = async () => {
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
  await page.getByRole('tab', { name: 'Suivi', exact: true }).click();
};
const openPicker = async () => {
  // Referme un éventuel dialog resté ouvert (picker/composer) avant de rouvrir.
  if ((await page.getByRole('dialog').count()) > 0) {
    await page.keyboard.press('Escape');
    await page
      .getByRole('dialog')
      .first()
      .waitFor({ state: 'detached', timeout: 5000 })
      .catch(() => {});
  }
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await page
    .getByRole('heading', { name: 'Pourquoi êtes-vous là ?' })
    .waitFor({ state: 'visible', timeout: 6000 });
};
const closeDialog = async () => {
  await page.keyboard.press('Escape');
  await page
    .getByRole('dialog')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {});
};

const MOVED = [
  { name: /Ajouter un document/, dialog: 'Ajouter un document' },
  { name: /Demander au client/, dialog: 'Demander une décision au client' },
  { name: /Répondre au client/, dialog: 'Répondre au client' },
];

try {
  await openDemo(page);
  await openChantierSuivi();

  await assert('SUIVI — plus AUCUNE carte de création (document / demande / réponse)', async () => {
    for (const a of MOVED)
      if ((await page.getByRole('button', { name: a.name }).count()) > 0)
        throw new Error(`une carte de création subsiste dans le Suivi : ${a.name}`);
  });

  await assert('SUIVI — reste un espace de CONSULTATION (dernière activité présente)', async () => {
    await page
      .getByRole('heading', { name: /Dernière activité|Journal du chantier/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('NOUVELLE MISSION — les 3 actions déplacées y sont disponibles', async () => {
    await openPicker();
    for (const a of MOVED)
      await page
        .getByRole('button', { name: a.name })
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert(
    'NOUVELLE MISSION — « Répondre au client » porte le compteur des questions',
    async () => {
      // Le seed a une question client en attente → un badge sur « Répondre au client ».
      const repondre = page.getByRole('button', { name: /Répondre au client/ }).first();
      if (!/\d/.test((await repondre.innerText()) ?? ''))
        throw new Error('aucun compteur de questions en attente sur « Répondre au client »');
    },
  );

  // Chaque action ouvre bien son composer (parcours fonctionnels).
  for (const a of MOVED) {
    await assert(`NOUVELLE MISSION → « ${a.dialog} » ouvre son composer`, async () => {
      await openPicker();
      await page.getByRole('button', { name: a.name }).first().click();
      await page
        .getByRole('dialog')
        .getByRole('heading', { name: a.dialog })
        .waitFor({ state: 'visible', timeout: 6000 });
      await closeDialog();
    });
  }

  await assert(
    'Parcours complet : ajouter un document via Nouvelle mission → au Journal',
    async () => {
      await openPicker();
      await page
        .getByRole('button', { name: /Ajouter un document/ })
        .first()
        .click();
      const dlg = page.getByRole('dialog');
      await dlg.getByLabel('Libellé du document').fill(DOC_LABEL);
      await dlg.locator('input[type=file]').setInputFiles(PDF);
      await dlg.getByText(PDF.name).waitFor({ state: 'visible', timeout: 6000 });
      await dlg.getByRole('button', { name: 'Publier' }).click();
      await dlg.waitFor({ state: 'detached', timeout: 6000 });
      // Consultation : le document apparaît au Journal (Suivi).
      await page.getByRole('tab', { name: 'Suivi', exact: true }).click();
      await page
        .getByRole('button', { name: /Voir tout le journal/ })
        .click()
        .catch(() => {});
      await page.getByText(DOC_LABEL).first().waitFor({ state: 'visible', timeout: 6000 });
    },
  );

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
