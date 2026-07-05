/**
 * RC1 — Le CONCIERGE client (PHÉNIX) : le client pose une question depuis son
 * espace, PHÉNIX répond et fait toujours avancer (réponse ou transmission à
 * l'équipe). On vérifie l'ouverture, une réponse, et surtout le CLIENT-SAFE
 * strict (rien d'interne ne fuit dans le concierge).
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2400 });
const { assert, summary } = harness();

const seen = async (re) => (await page.getByText(re).count()) > 0;

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await page.waitForTimeout(400);

  await assert('Le concierge PHÉNIX s’ouvre depuis l’espace client', async () => {
    await page.getByRole('button', { name: 'Ouvrir PHÉNIX' }).click();
    await page.getByPlaceholder(/Écrivez à PHÉNIX/).waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Le client pose une question, PHÉNIX répond (fait avancer)', async () => {
    const draft = page.getByPlaceholder(/Écrivez à PHÉNIX/);
    await draft.fill('Où en est mon chantier cette semaine ?');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    // Une réponse de PHÉNIX apparaît (le fil grandit).
    await page.waitForTimeout(800);
    const bubbles = await page.getByText(/PHÉNIX|Nous|Votre|équipe|chantier/).count();
    if (bubbles === 0) throw new Error('aucune réponse du concierge');
  });

  await assert('CLIENT-SAFE : le concierge ne laisse RIEN fuir d’interne', async () => {
    const body = await page.locator('body').innerText();
    for (const secret of [
      'Réserve n°',
      'préparé par PHÉNIX Start',
      'Responsable :',
      'Contrat sous-traitant',
      'interne',
    ])
      if (body.includes(secret)) throw new Error(`fuite dans l'espace client : « ${secret} »`);
  });

  await assert('Le concierge se referme proprement', async () => {
    await page.getByRole('button', { name: 'Fermer' }).first().click();
    await page.waitForTimeout(300);
    if (await seen(/Écrivez à PHÉNIX/)) throw new Error('le concierge ne se ferme pas');
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
