/**
 * ANTI-RÉGRESSION — la page « Chantier » ne doit JAMAIS rester blanche.
 * =============================================================================
 * Bug critique (09/07/2026) : après le passage du compte rendu à un mini-album
 * (point.photos[]), les comptes rendus créés avec la version précédente (point.
 * imageUrl unique, SANS `photos`) faisaient planter le rendu du Suivi
 * (`p.photos.map` sur `undefined`) → page Chantier blanche. On garde donc la
 * COMPATIBILITÉ avec les anciens événements : un point historique doit s'afficher.
 * On vérifie aussi qu'un chantier s'ouvre normalement, sans crash, tous onglets
 * accessibles.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1280, height: 2200 });
const { assert, summary } = harness();

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Injecte un compte rendu à l'ANCIEN format (point.imageUrl, sans `photos`). */
const injectLegacyCompteRendu = () =>
  page.evaluate((png) => {
    const KEY = 'phenix-demo:state:v1';
    const raw = localStorage.getItem(KEY);
    if (!raw) throw new Error('état démo introuvable');
    const st = JSON.parse(raw);
    const cr = st.events.find((e) => e.type === 'compte_rendu');
    if (!cr) throw new Error('aucun compte rendu à cloner');
    const clone = JSON.parse(JSON.stringify(cr));
    clone.id = 'legacy-cr-anti-regression';
    clone.visibility = 'client';
    clone.state = 'publie';
    // Daté MAINTENANT → en tête du Suivi (les 4 événements récents sont rendus).
    const now = new Date().toISOString();
    clone.createdAt = now;
    clone.publishedAt = now;
    clone.content = {
      ...clone.content,
      texte: '',
      docTitre: 'Compte rendu de chantier',
      missionKind: 'compte_rendu',
      // ANCIEN format : `imageUrl` sur le point, PAS de `photos`.
      points: [
        { imageUrl: png, comment: 'Point historique (ancien format).', diffusion: 'client' },
      ],
    };
    st.events.push(clone);
    localStorage.setItem(KEY, JSON.stringify(st));
  }, PNG);

const openChantier = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
};

try {
  await openDemo(page);

  await assert('Compat : un compte rendu à l’ANCIEN format n’explose pas le Suivi', async () => {
    await injectLegacyCompteRendu();
    await page.reload();
    await openChantier();
    await page.getByRole('tab', { name: 'Suivi', exact: true }).first().click();
    // Le point historique s'affiche (compat ascendante).
    await page
      .getByText('Point historique (ancien format).')
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('La page Chantier ne reste PAS blanche (contenu rendu)', async () => {
    // Un chantier ouvert affiche ses onglets et son en-tête — pas un écran vide.
    const tabs = ['Suivi', 'Préparation', 'Documents', 'Dans les coulisses'];
    for (const t of tabs)
      await page.getByRole('tab', { name: t }).first().waitFor({ state: 'visible', timeout: 6000 });
    // Un peu de contenu réel doit être présent (heuristique anti-page-blanche).
    const textLen = (await page.locator('body').innerText()).trim().length;
    if (textLen < 200) throw new Error(`la page semble vide (${textLen} caractères)`);
  });

  await assert('Chaque onglet du chantier s’ouvre sans crash', async () => {
    for (const t of ['Préparation', 'Documents', 'Dans les coulisses', 'Suivi']) {
      await page.getByRole('tab', { name: t }).first().click();
      await page.waitForTimeout(150);
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
