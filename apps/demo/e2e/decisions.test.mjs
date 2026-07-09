/**
 * RC1 — Choix client validés (radar Aujourd'hui, retour terrain). Quand le client
 * valide une ambiance, le choix rejoint le compteur unifié « À traiter » côté
 * conducteur : il y apparaît (préfixé « Choix validé · »), ouvre le chantier au
 * bon endroit, et se retire quand le conducteur le marque « pris en compte ».
 * Client-safe : rien de ce radar ne fuit côté client.
 */
import { launch, session, harness, openDemo, openClientTab } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2200 });
const { assert, summary } = harness();

const CHOIX = 'Cuisine — Façades beige sable & plan de travail pierre';
const aTraiter = () => page.getByRole('button', { name: /Filtrer.*à traiter/i });
const openATraiter = async () => {
  await aTraiter().click();
  await page
    .getByRole('heading', { name: /À traiter aujourd/i })
    .waitFor({ state: 'visible', timeout: 6000 });
};

try {
  await openDemo(page);

  await assert('Au départ, le choix cuisine n’est pas encore « à traiter »', async () => {
    await openATraiter();
    if ((await page.getByText(CHOIX).count()) > 0)
      throw new Error('le choix est déjà « à traiter »');
    await page.getByRole('button', { name: /Tout afficher/ }).click();
  });

  await assert('CLIENT — le client valide une ambiance (cuisine)', async () => {
    await openClientTab(page); // Aujourd'hui = la décision à prendre
    await page.getByRole('button', { name: 'Voir la décision' }).click();
    await page.getByRole('radio', { name: new RegExp('beige sable', 'i') }).click();
    await page.getByRole('button', { name: /Valider mon choix/ }).click();
    // « Vos choix » (le récap) vit dans son onglet dédié.
    await page.getByRole('tab', { name: 'Vos choix' }).click();
    await page
      .getByRole('heading', { name: 'Vos choix', exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('CONDUCTEUR — le choix validé rejoint « À traiter »', async () => {
    await page
      .getByRole('tab', { name: /Aujourd/ })
      .first()
      .click();
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    await openATraiter();
    // Préfixé « Choix validé · » et rattaché au bon chantier.
    await page
      .getByText(/Choix validé ·/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(CHOIX).first().waitFor({ state: 'visible', timeout: 5000 });
    await page
      .getByText('Appartement Lyon 6e')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Le clic sur le choix ouvre le chantier au Suivi (Journal)', async () => {
    await page.getByText(CHOIX).first().click();
    await page
      .getByRole('tab', { name: 'Suivi', selected: true })
      .waitFor({ state: 'visible', timeout: 6000 });
    // La décision est tracée dans le Journal du chantier (Suivi).
    await page
      .getByText(/Décision client · Cuisine/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
    await page
      .getByText(/Façades beige sable/)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('« Pris en compte » retire le choix de « À traiter »', async () => {
    await page
      .getByRole('tab', { name: /Aujourd/ })
      .first()
      .click();
    await page
      .getByRole('heading', { name: /Bonjour Mickaël/ })
      .waitFor({ state: 'visible', timeout: 5000 });
    await openATraiter();
    await page.getByRole('button', { name: /Pris en compte/ }).click();
    await page.waitForTimeout(300);
    if ((await page.getByText(CHOIX).count()) > 0)
      throw new Error('le choix reste « à traiter » après prise en compte');
  });

  await assert('Client-safe : le radar « à traiter » ne fuit pas côté client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(300);
    for (const secret of ['à traiter aujourd', 'Pris en compte', 'Choix validé ·']) {
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
