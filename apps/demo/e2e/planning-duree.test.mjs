/**
 * RC1 — La DURÉE pilote le planning (source de vérité).
 * ===========================================================================
 * Régression du bug « la durée estimée ne pilote pas le planning » :
 *   • Réception estimée   = date de démarrage + durée (jamais la somme des lots).
 *   • Pré-réception estimée = réception − fenêtre de levée des réserves, DÉRIVÉE
 *     de la durée (proportion, jamais un nombre de jours figé).
 *   • Aucune date n'est antérieure au démarrage (le bug produisait une
 *     pré-réception AVANT le début).
 *   • Le conducteur (« s'achève autour du ») et le client voient la MÊME réception.
 * On couvre plusieurs durées (7, 15, 31, 60 jours) pour verrouiller le calcul.
 *
 * Fuseau forcé à UTC : les dates ISO (minuit) s'affichent alors telles quelles,
 * ce qui rend les comparaisons de dates déterministes.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600, timezoneId: 'UTC' });
const { assert, summary } = harness();

const START = '2026-09-07'; // lundi arbitraire, loin dans le futur
const DURATIONS = [7, 15, 31, 60];
const LEVEE_RATIO = 0.1; // doit refléter LEVEE_RESERVES_RATIO (core)

/** Ajoute n jours calendaires à une date ISO (calcul en UTC, sans dérive). */
const addDaysIso = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Formatage identique à l'app (fmtDate = fr-FR dateStyle long), en UTC. */
const fmtFr = (iso) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );
const leveeDays = (duration) => Math.max(1, Math.round(duration * LEVEE_RATIO));

const planning = () => page.locator('#section-etapes');

const setStatut = async (label) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByLabel('Statut du chantier').selectOption({ label });
};

/** Revient à la vue conducteur (« Chantier ») puis ouvre le sous-onglet Préparation. */
const openPreparation = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: /Préparation/ }).click();
};

/** Renseigne durée + date de démarrage via « Modifier les infos » (Préparation). */
const setDureeEtDebut = async (duration, startIso) => {
  await openPreparation();
  await page.getByRole('button', { name: 'Modifier les infos' }).click();
  const duree = page.getByLabel('Durée estimée');
  await duree.waitFor({ state: 'visible', timeout: 8000 });
  await duree.fill(String(duration));
  await page.getByLabel('Date de début souhaitée').fill(startIso);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
};

const openClient = async () => {
  // Le planning (grandes étapes) vit dans l'onglet « Le projet » de l'Espace client.
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await page.getByRole('tab', { name: 'Le projet' }).click();
  await planning()
    .getByText('Réception', { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 8000 });
};

try {
  await openDemo(page);
  await setStatut('En cours'); // le planning client n'affiche des dates qu'« En cours »

  for (const duration of DURATIONS) {
    const receptionIso = addDaysIso(START, duration);
    const levee = leveeDays(duration);
    const preIso = addDaysIso(receptionIso, -levee);

    await setDureeEtDebut(duration, START);
    await openClient();

    await assert(`Durée ${duration} j → réception = démarrage + ${duration} j`, async () => {
      await planning()
        .getByText(`Réception estimée : ${fmtFr(receptionIso)}`)
        .waitFor({ state: 'visible', timeout: 8000 });
      // Le démarrage affiché est bien celui saisi (source de la durée).
      await planning()
        .getByText(`Début officiel : ${fmtFr(START)}`)
        .waitFor({ state: 'visible', timeout: 4000 });
    });

    await assert(
      `Durée ${duration} j → pré-réception = réception − ${levee} j (proportion, pas de valeur figée)`,
      async () => {
        await planning()
          .getByText(`Pré-réception estimée : ${fmtFr(preIso)}`)
          .waitFor({ state: 'visible', timeout: 8000 });
      },
    );

    await assert(`Durée ${duration} j → aucune date antérieure au démarrage`, async () => {
      if (preIso < START) throw new Error(`pré-réception ${preIso} avant le démarrage ${START}`);
      if (receptionIso <= preIso)
        throw new Error(`réception ${receptionIso} pas après la pré-réception ${preIso}`);
    });
  }

  await assert('Conducteur et client voient la MÊME réception (source unique)', async () => {
    // Sur la dernière durée (60 j), le conducteur « s'achève autour du » doit
    // afficher la même réception que le client.
    const receptionIso = addDaysIso(START, 60);
    await openPreparation();
    await page
      .getByText(new RegExp(`s'achève autour du.*${fmtFr(receptionIso).replace(/\s/g, '\\s')}`))
      .first()
      .waitFor({ state: 'visible', timeout: 8000 });
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
