/**
 * VOS CHOIX — un choix pas encore prêt rassure, il n'alarme pas (anti-régression).
 * ===========================================================================
 * Un choix que PHÉNIX n'a pas encore proposé (statut « à choisir », options non
 * présentées) apparaissait avec une pastille ambre « En attente » et AUCUN bouton.
 * Un client lisait « en attente… de moi ? » sans rien pouvoir faire — une peur
 * d'être bloqué ou en retard. On l'annonce désormais d'un ton neutre (« Bientôt »)
 * avec une phrase qui déculpabilise : « rien à faire pour l'instant ».
 *
 * Ce test verrouille, sur le chantier de démonstration (qui contient un choix
 * carrelage encore à préparer) :
 *   • la carte non actionnable montre « Bientôt » et la réassurance ;
 *   • elle ne montre PAS de pastille « En attente » anxiogène ;
 *   • un choix réellement à valider garde bien son action (« Voir la décision »).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 1600 });
const { assert, summary } = harness();

try {
  await openDemo(page);

  await assert('Ouvrir l’aperçu client → onglet « Vos choix »', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.getByRole('tab', { name: 'Vos choix' }).click();
    await page
      .getByRole('heading', { name: 'Vos choix', exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  // La carte du choix carrelage (pas encore proposé) est la carte « Bientôt ».
  const carte = page.locator('li', { hasText: /Salle de bain/i }).first();

  await assert('Un choix pas encore prêt affiche « Bientôt », pas « En attente »', async () => {
    await carte.getByText('Bientôt').first().waitFor({ state: 'visible', timeout: 6000 });
    if ((await carte.getByText('En attente').count()) > 0)
      throw new Error('la carte non actionnable montre encore une pastille « En attente »');
  });

  await assert('Le choix pas encore prêt rassure (« rien à faire pour l’instant »)', async () => {
    await carte
      .getByText(/rien à faire pour l.instant/i)
      .first()
      .waitFor({ state: 'visible', timeout: 3000 });
  });

  await assert('Un choix réellement à valider garde son action', async () => {
    // La décision « propose » reste actionnable (bouton « Voir la décision »).
    await page.getByRole('button', { name: 'Voir la décision' }).first().waitFor({
      state: 'visible',
      timeout: 6000,
    });
  });

  await assert('Zéro erreur console', async () => {
    if (consoleErrors.length > 0) throw new Error(consoleErrors.slice(0, 4).join(' | '));
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
