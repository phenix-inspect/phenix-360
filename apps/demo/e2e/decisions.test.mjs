/**
 * RC1 — Choix client validés (radar Aujourd'hui, retour terrain).
 * Deux faces d'une décision : « le client doit agir » (en attente) vs « le
 * CONDUCTEUR doit agir » (choix validé). Quand le client valide une ambiance,
 * une notification apparaît dans Aujourd'hui, montre le choix EXACT, ouvre le
 * chantier au bon endroit, et se vide quand le conducteur la marque « pris en
 * compte ». Client-safe : rien de ce radar ne fuit côté client.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const CHOIX = 'Cuisine — Façades beige sable & plan de travail pierre';

const choixCounter = () => page.getByRole('button', { name: /Filtrer.*choix validés à traiter/i });

try {
  await openDemo(page);

  await assert('Au départ, aucun choix validé à traiter (compteur non cliquable)', async () => {
    if ((await choixCounter().count()) > 0) throw new Error('un choix est déjà « à traiter »');
  });

  await assert('CLIENT — le client valide une ambiance (cuisine)', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.getByRole('button', { name: 'Voir la décision' }).click();
    await page.getByRole('radio', { name: new RegExp('beige sable', 'i') }).click();
    await page.getByRole('button', { name: /Valider mon choix/ }).click();
    // Le choix validé apparaît dans « Vos choix » côté client (badge Validé).
    await page.getByText('Vos choix').first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('CONDUCTEUR — une notification « choix validé à traiter » apparaît', async () => {
    await page.getByRole('tab', { name: /Aujourd/ }).click();
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    await choixCounter().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Le clic filtre et affiche le choix EXACT du client', async () => {
    await choixCounter().click();
    await page
      .getByRole('heading', { name: 'Choix client validés à traiter' })
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(CHOIX).first().waitFor({ state: 'visible', timeout: 5000 });
    // Le chantier concerné est clairement indiqué.
    await page
      .getByText('Appartement Lyon 6e')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert(
    'Le clic sur le choix ouvre le chantier à l’Historique (choix visible)',
    async () => {
      await page.getByText(CHOIX).first().click();
      await page
        .getByRole('tab', { name: /Historique/, selected: true })
        .waitFor({ state: 'visible', timeout: 6000 });
      // Le jalon de décision porte le choix retenu (catégorie + option).
      await page
        .getByText(/Décision client · Cuisine/)
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
      await page
        .getByText(/Façades beige sable/)
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
    },
  );

  await assert('« Pris en compte » vide la notification', async () => {
    await page.getByRole('tab', { name: /Aujourd/ }).click();
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    await choixCounter().click();
    await page.getByRole('button', { name: /Pris en compte/ }).click();
    await page.waitForTimeout(300);
    if ((await choixCounter().count()) > 0)
      throw new Error('le choix reste « à traiter » après prise en compte');
  });

  await assert('Client-safe : le radar « à traiter » ne fuit pas côté client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(300);
    for (const secret of ['choix validés à traiter', 'Pris en compte', 'Choix client validés']) {
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
