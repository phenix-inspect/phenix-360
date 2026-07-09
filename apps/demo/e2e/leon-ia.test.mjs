/**
 * Léon, assistant IA premium (le CERVEAU, pas le visage).
 * =============================================================================
 * Léon cherche dans les données du chantier (documents, planning, choix,
 * demandes, coordonnées PHÉNIX…) AVANT de transmettre au conducteur. Il ne crée
 * une demande conducteur qu'en dernier recours : décision humaine, information
 * absente, problème signalé, changement demandé. Le chat ne se bloque jamais.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1280, height: 2200 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photo = { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') };

const leon = () => page.getByRole('dialog', { name: /concierge/ });
const goClient = async () => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await page.getByRole('tab', { name: 'Aujourd’hui' }).last().click();
};
const openLeon = async () => {
  if ((await leon().count()) === 0)
    await page.getByRole('button', { name: 'Ouvrir PHÉNIX' }).click();
  await leon().waitFor({ state: 'visible', timeout: 6000 });
};
/** Nombre de demandes client (destinataire PHÉNIX) actuellement au Journal. */
const demandeCount = () =>
  page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('phenix-demo:state:v1') || '{}');
    return (raw.events || []).filter(
      (e) =>
        e.type === 'demande' && e.content?.destinataire === 'phenix' && e.actor?.role === 'client',
    ).length;
  });
/** Envoie un message à Léon (texte + n photos), sans fermer le chat. */
const ask = async (texte, nbPhotos = 0) => {
  await goClient();
  await openLeon();
  if (texte) await leon().getByPlaceholder('Écrivez à PHÉNIX').fill(texte);
  if (nbPhotos > 0) {
    await leon()
      .locator('input[type=file]')
      .setInputFiles(Array.from({ length: nbPhotos }, () => photo));
    await page.waitForTimeout(400);
  }
  await leon().getByRole('button', { name: 'Envoyer' }).click();
  await page.waitForTimeout(500);
};
/** Le chat est-il utilisable ? (on retape → « Envoyer » se réactive.) */
const chatUsable = async () => {
  await leon().getByPlaceholder('Écrivez à PHÉNIX').fill('test');
  await page.waitForTimeout(120);
  const disabled = await leon().getByRole('button', { name: 'Envoyer' }).isDisabled();
  await leon().getByPlaceholder('Écrivez à PHÉNIX').fill('');
  return !disabled;
};

try {
  await openDemo(page);

  await assert(
    '« Montre-moi le devis » → Léon trouve le devis + bouton, sans escalade',
    async () => {
      const before = await demandeCount();
      await ask('Montre-moi le devis');
      await leon()
        .getByRole('button', { name: /Ouvrir .*[Dd]evis/ })
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      if ((await demandeCount()) !== before)
        throw new Error('Léon a créé une demande alors qu’il a trouvé le devis');
    },
  );

  await assert('« Le numéro de PHÉNIX ? » → Léon répond, sans escalade', async () => {
    const before = await demandeCount();
    await ask('C’est quoi le numéro de téléphone de PHÉNIX ?');
    await leon()
      .getByText(/01 84 80 00 00/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    if ((await demandeCount()) !== before)
      throw new Error('Léon a escaladé une simple demande de coordonnées');
  });

  await assert('« Quand est prévue la réception ? » → réponse depuis les dates', async () => {
    const before = await demandeCount();
    await ask('Quand est prévue la réception ?');
    await leon()
      .getByText(/réception.*(prévue|planifiée) autour du/i)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    if ((await demandeCount()) !== before)
      throw new Error('Léon a escaladé alors que la date est dans le planning');
  });

  await assert('Document introuvable → Léon explique + propose, ne bloque jamais', async () => {
    const before = await demandeCount();
    await ask('Montre-moi le DPE');
    await leon()
      .getByText(/ne trouve pas de DPE/i)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await leon()
      .getByText(/conducteur/i)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    if ((await demandeCount()) !== before)
      throw new Error('Léon a créé une demande pour un document simplement introuvable');
    if (!(await chatUsable())) throw new Error('le chat est bloqué après « document introuvable »');
  });

  await assert('Demande nécessitant le conducteur → Léon escalade', async () => {
    const before = await demandeCount();
    await ask('Peut-on décaler la réception à la semaine prochaine ?');
    await leon()
      .getByText(/transmettre votre demande à votre conducteur/)
      .last()
      .waitFor({ state: 'visible', timeout: 6000 });
    if ((await demandeCount()) !== before + 1)
      throw new Error('la demande conducteur n’a pas été créée');
  });

  await assert('… et le conducteur la reçoit dans « Aujourd’hui »', async () => {
    await page
      .getByRole('tab', { name: /Aujourd’hui/ })
      .first()
      .click();
    await page
      .getByText(/Nouvelle demande client à traiter/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Message AVEC photo → photo conservée, chat utilisable', async () => {
    const before = await demandeCount();
    await ask('Voici une photo du salon', 1);
    // La photo est conservée dans le fil (bulle client) et la demande est créée.
    if ((await leon().locator('img').count()) < 1)
      throw new Error('la photo jointe n’apparaît pas dans le fil');
    if ((await demandeCount()) !== before + 1)
      throw new Error('la demande avec photo n’a pas été créée');
    if (!(await chatUsable())) throw new Error('le chat est bloqué après une photo');
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
