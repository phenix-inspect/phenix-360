/**
 * Onglet « Demandes client » (Chantier) — tableau de pilotage des demandes Léon.
 * =============================================================================
 * Regroupe TOUTES les demandes créées via Léon (ET les choix client), sans
 * polluer le Suivi. Filtres (Tous / Demandes / Choix client / Non lus / En attente
 * / Répondus), badge « non lu » qui diminue à l'ouverture, réponse unique
 * (1 demande = 1 réponse) qui fait passer « Répondu », disparaître d'« Aujourd'hui »
 * et conserver la trace ici comme au Suivi. Ce test cible les DEMANDES simples.
 *
 * Le seed porte déjà des demandes client : le test raisonne en DELTAS et par le
 * TEXTE d'une demande unique qu'il crée, pour rester robuste au jeu de données.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1280, height: 2400 });
const { assert, summary } = harness();

// Demande unique (escalade garantie) — texte distinctif, sans collision avec le seed.
const UNIQ = 'Peut-on décaler la réception du chantier à la semaine prochaine ?';
const REP = 'Oui, nous decalons la reception au 12.';

const leon = () => page.getByRole('dialog', { name: /concierge/ });
const goChantier = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
};
const openDemandesTab = async () => {
  await goChantier();
  await page.getByRole('tab', { name: /Demandes client/ }).click();
};
const tabBox = () => page.locator('[data-tab="demandes-client"]');
const filtre = (name) => page.getByRole('tab', { name });
const cardOf = (texte) => page.getByRole('button').filter({ hasText: texte }).first();
const threadOf = (texte) =>
  page.locator('div').filter({ hasText: 'Demande client' }).filter({ hasText: texte }).last();
/** Garantit la carte dépliée (le fil « Demande client » n'existe que dépliée). */
const ensureOpen = async (texte) => {
  if ((await threadOf(texte).count()) === 0) {
    await cardOf(texte).click();
    await page.waitForTimeout(250);
  }
};

/** Nombre affiché par le badge « non lus » de l'onglet (0 si absent). Chantier actif requis. */
const badgeNum = async () => {
  await goChantier();
  const b = page.getByRole('tab', { name: /Demandes client/ }).locator('span.rounded-full');
  if ((await b.count()) === 0) return 0;
  return parseInt((await b.innerText()).trim(), 10) || 0;
};

const creerDemandeLeon = async (texte) => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await page.getByRole('tab', { name: 'Aujourd’hui' }).last().click();
  if ((await leon().count()) === 0)
    await page.getByRole('button', { name: 'Ouvrir PHÉNIX' }).click();
  await leon().waitFor({ state: 'visible', timeout: 6000 });
  await leon().getByPlaceholder('Écrivez à PHÉNIX').fill(texte);
  await leon().getByRole('button', { name: 'Envoyer' }).click();
  await leon()
    .getByText(/transmettre votre demande/)
    .first()
    .waitFor({ timeout: 6000 });
  await leon().getByRole('button', { name: 'Fermer' }).click();
  await leon().waitFor({ state: 'hidden', timeout: 6000 });
};

const clean = (s) => s.replace(/\s+/g, ' ').trim();

try {
  await openDemo(page);

  await assert('L’onglet « Demandes client » existe, après « Dans les coulisses »', async () => {
    await goChantier();
    const tl = page
      .getByRole('tablist')
      .filter({ has: page.getByRole('tab', { name: /Demandes client/ }) });
    const order = (await tl.getByRole('tab').allInnerTexts()).map(clean);
    const iCoul = order.findIndex((n) => /Dans les coulisses/.test(n));
    const iDem = order.findIndex((n) => /Demandes client/.test(n));
    if (!(iCoul >= 0 && iCoul < iDem)) throw new Error(`ordre inattendu : ${order.join(' | ')}`);
    // L'onglet « Réserves » a été retiré.
    if (order.some((n) => /Réserves/.test(n)))
      throw new Error('l’onglet « Réserves » ne devrait plus exister');
  });

  const base = await badgeNum();

  await assert('Une demande créée via Léon fait +1 au badge « non lus »', async () => {
    await creerDemandeLeon(UNIQ);
    const now = await badgeNum();
    if (now !== base + 1) throw new Error(`badge attendu ${base + 1}, obtenu ${now}`);
  });

  await assert('La demande apparaît dans l’onglet', async () => {
    await openDemandesTab();
    await tabBox().getByText(UNIQ).first().waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Filtres : Tous / Demandes / Non lus la montrent, Répondus non', async () => {
    for (const name of [/^Tous/, /^Demandes \(/, /^Non lus/]) {
      await filtre(name).click();
      await tabBox().getByText(UNIQ).first().waitFor({ state: 'visible', timeout: 6000 });
    }
    await filtre(/^Répondus/).click();
    await page.waitForTimeout(200);
    if ((await tabBox().getByText(UNIQ).count()) > 0)
      throw new Error('une demande non répondue apparaît dans « Répondus »');
  });

  await assert('Ouvrir la demande la marque LUE → badge −1 et sort de « Non lus »', async () => {
    await filtre(/^Tous/).click();
    await cardOf(UNIQ).click(); // déplie → markSeen
    await page.waitForTimeout(300);
    const now = await badgeNum();
    if (now !== base) throw new Error(`badge attendu ${base} après ouverture, obtenu ${now}`);
    await openDemandesTab();
    await filtre(/^Non lus/).click();
    await page.waitForTimeout(200);
    if ((await tabBox().getByText(UNIQ).count()) > 0)
      throw new Error('la demande lue apparaît encore dans « Non lus »');
  });

  await assert('Répondre depuis l’onglet → statut Répondu', async () => {
    await filtre(/^Tous/).click();
    await ensureOpen(UNIQ); // déplier si besoin (l'état d'ouverture peut persister)
    const th = threadOf(UNIQ);
    await th.getByRole('button', { name: 'Répondre' }).click();
    await th.getByLabel('Réponse au client').fill(REP);
    await th.getByRole('button', { name: /Envoyer la réponse/ }).click();
    await th.getByText(REP).first().waitFor({ state: 'visible', timeout: 6000 });
    if ((await th.getByText('Répondu').count()) === 0)
      throw new Error('statut « Répondu » manquant');
  });

  await assert('Après réponse : dans « Répondus », plus dans « En attente »', async () => {
    await filtre(/^Répondus/).click();
    await tabBox().getByText(UNIQ).first().waitFor({ state: 'visible', timeout: 6000 });
    await filtre(/^En attente/).click();
    await page.waitForTimeout(200);
    if ((await tabBox().getByText(UNIQ).count()) > 0)
      throw new Error('la demande répondue reste dans « En attente »');
  });

  await assert('La demande répondue DISPARAÎT d’« Aujourd’hui »', async () => {
    await page
      .getByRole('tab', { name: /Aujourd’hui/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: /à traiter aujourd’hui/ })
      .first()
      .click();
    await page.waitForTimeout(300);
    if ((await page.getByText(`Question client · ${UNIQ}`).count()) > 0)
      throw new Error('la demande répondue reste dans Aujourd’hui');
  });

  await assert('Conservée dans « Demandes client » (Répondus)', async () => {
    await openDemandesTab();
    await filtre(/^Répondus/).click();
    await tabBox().getByText(UNIQ).first().waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Trace conservée au Suivi', async () => {
    await goChantier();
    await page.getByRole('tab', { name: 'Suivi', exact: true }).first().click();
    const th = threadOf(UNIQ);
    for (const t of [UNIQ, REP, 'Répondu'])
      await th.getByText(t).first().waitFor({ timeout: 6000 });
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
