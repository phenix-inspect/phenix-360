/**
 * RC1 — Planning CLIENT simplifié (premium, rassurant, non technique).
 *  • Avant démarrage (« Pas commencé ») → estimations, AUCUNE date.
 *  • Dès « En cours » → bascule automatique sur des dates estimées.
 *  • Exactement 5 grands jalons, JAMAIS de lot technique (plomberie/peinture…).
 *  • Léon (concierge) continue de répondre aux questions détaillées.
 * Le statut est piloté côté conducteur (source de vérité) ; l'espace client suit.
 */
import { launch, session, harness, openDemo } from './harness.mjs';
import { phenixDevisPdf } from './pdf-fixtures.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2600 });
const { assert, summary } = harness();

const setStatut = async (label) => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByLabel('Statut du chantier').selectOption({ label });
};
const planning = () => page.locator('#section-etapes');
const openClient = async () => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Les grandes étapes du chantier' })
    .first()
    .waitFor({ state: 'visible', timeout: 8000 });
};
const planText = async () => (await planning().innerText()).toLowerCase();

const futureDate = () => {
  const d = new Date(Date.now() + 60 * 86_400_000);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

try {
  await openDemo(page);

  await assert('EN COURS : le planning affiche des DATES (début officiel)', async () => {
    await setStatut('En cours');
    await openClient();
    if (!(await planText()).includes('début officiel'))
      throw new Error('pas de date de début officiel en phase « En cours »');
    await page.getByText(/prochaine grande étape sera la pré-réception/i).waitFor({
      state: 'visible',
      timeout: 5000,
    });
  });

  await assert('Exactement 5 grands jalons, dans le bon ordre', async () => {
    const items = planning().locator('ol > li');
    if ((await items.count()) !== 5)
      throw new Error(`attendu 5 jalons, obtenu ${await items.count()}`);
    for (const label of ['Projet validé', 'Préparation', 'Démarrage', 'Pré-réception', 'Réception'])
      await planning().getByText(label, { exact: true }).first().waitFor({ state: 'visible' });
  });

  await assert('AUCUN lot technique affiché côté client', async () => {
    const t = await planText();
    for (const lot of [
      'plomberie',
      'peinture',
      'électricité',
      'electricite',
      'carrelage',
      'cuisine',
    ])
      if (t.includes(lot))
        throw new Error(`un lot technique fuit dans le planning client : « ${lot} »`);
  });

  await assert('PAS COMMENCÉ : bascule sur des ESTIMATIONS, aucune date', async () => {
    await setStatut('Pas commencé');
    await openClient();
    const t = await planText();
    if (!t.includes('estimé')) throw new Error('pas d’estimation en phase « Pas commencé »');
    if (t.includes('début officiel'))
      throw new Error('une date officielle est affichée avant le démarrage');
    await page
      .getByText(/en préparation/i)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Léon (concierge) répond toujours aux questions détaillées', async () => {
    await page.getByRole('button', { name: 'Ouvrir PHÉNIX' }).click();
    const draft = page.getByPlaceholder(/Écrivez à PHÉNIX/);
    await draft.fill('Où en est la salle de bain ?');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await page.waitForTimeout(800);
    // Léon fait avancer : une réponse apparaît (le fil grandit).
    if ((await page.getByText(/PHÉNIX|équipe|chantier|salle|Nous/).count()) === 0)
      throw new Error('Léon ne répond pas aux questions détaillées');
    await page.getByRole('button', { name: 'Fermer' }).first().click();
  });

  await assert(
    'Devis futur : la date du devis ne préremplit PAS le démarrage → « Pas encore prêt »',
    async () => {
      await page.getByRole('button', { name: 'Gérer' }).click();
      await page.getByRole('button', { name: /^Nouveau chantier$/ }).click();
      await page.getByRole('heading', { name: 'Nouveau chantier' }).waitFor({ state: 'visible' });
      await page
        .locator('input[type=file]')
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
      // Le devis a été LU (« Devis signé » validé) mais la date du devis n'a PAS
      // fixé le démarrage : le dossier reste « Pas encore prêt » (1/3 bloquant).
      await page.getByRole('tab', { name: /Préparation/ }).click();
      await page.getByText('Pas encore prêt').first().waitFor({ state: 'visible', timeout: 6000 });
    },
  );

  await assert(
    'Après acompte + date officielle (à la main), statut PAS COMMENCÉ → « dans environ … semaines »',
    async () => {
      // On lève les deux bloquants restants À LA MAIN (jamais la date du devis).
      await page.getByRole('button', { name: 'Marquer comme payé' }).click();
      const iso = new Date(Date.now() + 42 * 86_400_000).toISOString().slice(0, 10);
      await page.getByLabel('Date officielle de démarrage').fill(iso);
      await page
        .getByText('Prêt à partager au client')
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
      // Le statut reste « Pas commencé » → le planning client montre une ESTIMATION.
      await openClient();
      const t = await planText();
      if (!t.includes('dans environ'))
        throw new Error('l’estimation « dans environ … semaines » ne s’affiche pas');
      if (t.includes('début officiel'))
        throw new Error('une date officielle est affichée avant le démarrage');
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
