/**
 * Léon, point d'entrée UNIQUE du client → demande conducteur (1 demande = 1 réponse).
 * =============================================================================
 * Le client n'a PLUS de bouton « Faire une demande » : il parle simplement à Léon
 * (texte et/ou 0 à 3 photos). Léon répond quand il sait ; sinon il crée
 * AUTOMATIQUEMENT une demande au conducteur (texte + photos + date + auteur,
 * statut « À traiter »). La demande remonte dans « Aujourd'hui » du conducteur
 * tant qu'elle n'est pas traitée, trace le Suivi (mémoire officielle), et une
 * notification part au client à la réponse. Le client la voit dès l'envoi
 * (jamais dans le vide), côté « Vos demandes » ET dans le fil de Léon.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1280, height: 2400 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photo = (i) => ({
  name: `d-${i}.png`,
  mimeType: 'image/png',
  buffer: Buffer.from(PNG, 'base64'),
});

// Deux demandes qui NÉCESSITENT le conducteur (Léon ne les trouve pas dans le
// dossier → escalade automatique). La 2e est aussi accompagnée de photos.
const D1 = 'Peut-on décaler la réception du chantier à la semaine prochaine ?';
const D2 = 'Je voudrais récupérer les clés du logement vendredi, est-ce possible ?';
const R1 = 'Oui, nous decalons la reception au 12.';
const R2 = 'Les cles seront remises a la reception.';

const TRANSMIS = /transmettre votre demande à votre conducteur/;

const goClient = async () => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  // Deux onglets « Aujourd'hui » coexistent : la nav conducteur (première) et
  // l'onglet INTERNE du client (dernière). On veut l'espace client.
  await page.getByRole('tab', { name: 'Aujourd’hui' }).last().click();
};
const goSuivi = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Suivi', exact: true }).first().click();
};
const goDemandes = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: /Demandes client/ }).click();
};
/** Déplie la carte d'une demande (onglet « Demandes client ») → la marque lue. */
const openCard = async (texte) => {
  await page.getByRole('button').filter({ hasText: texte }).first().click();
  await page.waitForTimeout(200);
};

const leon = () => page.getByRole('dialog', { name: /concierge/ });
const openLeon = async () => {
  if ((await leon().count()) === 0)
    await page.getByRole('button', { name: 'Ouvrir PHÉNIX' }).click();
  await leon().waitFor({ state: 'visible', timeout: 6000 });
};
const closeLeon = async () => {
  if ((await leon().count()) > 0) {
    await leon().getByRole('button', { name: 'Fermer' }).click();
    await leon().waitFor({ state: 'hidden', timeout: 6000 });
  }
};

/** Parler à Léon (texte et/ou n photos), puis envoyer. */
const parleAleon = async (texte, nbPhotos = 0) => {
  await openLeon();
  if (texte) await leon().getByPlaceholder('Écrivez à PHÉNIX').fill(texte);
  if (nbPhotos > 0) {
    const files = Array.from({ length: nbPhotos }, (_, k) => photo(k));
    await leon().locator('input[type=file]').setInputFiles(files);
    await page.waitForTimeout(400); // laisse le temps à l'upload
  }
  await leon().getByRole('button', { name: 'Envoyer' }).click();
  await page.waitForTimeout(300);
};

/** L'onglet « Vos demandes » côté client. */
const vosDemandes = () => page.locator('[data-tab="client-demandes"]');
const goVosDemandes = async () => {
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await page.getByRole('tab', { name: 'Vos demandes' }).first().click();
};
/** Déplie la carte d'une demande dans « Vos demandes » (pour voir photos / réponse). */
const openClientCard = async (texte) => {
  await vosDemandes().getByRole('button').filter({ hasText: texte }).first().click();
  await page.waitForTimeout(200);
};
/** Le thread d'une demande donnée (côté conducteur/Suivi ou client). */
const threadOf = (texte) =>
  page.locator('div').filter({ hasText: 'Demande client' }).filter({ hasText: texte }).last();

try {
  await openDemo(page);

  // ---- CÔTÉ CLIENT : Léon est l'UNIQUE point d'entrée ----------------------
  await assert('Client : aucun bouton « Faire une demande » (Léon = point d’entrée)', async () => {
    await goClient();
    if ((await page.getByRole('button', { name: /Faire une demande/ }).count()) > 0)
      throw new Error('le bouton « Faire une demande » existe encore');
    if ((await page.getByRole('button', { name: 'Ouvrir PHÉNIX' }).count()) === 0)
      throw new Error('le point d’entrée Léon est absent');
  });

  await assert('Client : Léon transmet au conducteur → confirmation + « En attente »', async () => {
    await parleAleon(D1, 0);
    // Léon confirme la transmission dans le fil (le client ne parle pas dans le vide).
    await leon().getByText(TRANSMIS).first().waitFor({ state: 'visible', timeout: 6000 });
    await closeLeon();
    // La demande apparaît dans l'onglet « Vos demandes » avec un statut client-safe.
    await goVosDemandes();
    await vosDemandes().getByText(D1).first().waitFor({ state: 'visible', timeout: 6000 });
    if ((await vosDemandes().getByText('En attente').count()) === 0)
      throw new Error('statut « En attente » manquant');
    if (
      (await vosDemandes()
        .getByText(/à traiter/i)
        .count()) > 0
    )
      throw new Error('le « à traiter » interne fuite côté client');
  });

  await assert('Client : le chat reste UTILISABLE juste après l’envoi (jamais figé)', async () => {
    await openLeon();
    // On peut retaper un message → « Envoyer » se réactive (busy libéré).
    await leon().getByPlaceholder('Écrivez à PHÉNIX').fill('Un autre point rapide');
    await page.waitForTimeout(150);
    if (await leon().getByRole('button', { name: 'Envoyer' }).isDisabled())
      throw new Error('chat figé : « Envoyer » reste désactivé malgré un nouveau message');
    // On peut aussi rouvrir le sélecteur de photos (bouton d’ajout actif).
    if (
      await leon()
        .getByRole('button', { name: /Ajouter une photo/ })
        .isDisabled()
    )
      throw new Error('chat figé : l’ajout de photo est bloqué');
    await leon().getByPlaceholder('Écrivez à PHÉNIX').fill('');
    await closeLeon();
  });

  await assert('Client : Léon accepte texte + photos → escalade avec photos', async () => {
    await parleAleon(D2, 2);
    await leon().getByText(TRANSMIS).last().waitFor({ state: 'visible', timeout: 6000 });
    // Les photos jointes s'affichent dans le fil de Léon (bulle client).
    if ((await leon().locator('img').count()) < 2)
      throw new Error('les photos jointes n’apparaissent pas dans le fil de Léon');
    await closeLeon();
    await goVosDemandes();
    await vosDemandes().getByText(D2).first().waitFor({ state: 'visible', timeout: 6000 });
    // Déplier la carte pour voir les photos jointes à la demande.
    await openClientCard(D2);
    const imgs = await vosDemandes().locator('li').filter({ hasText: D2 }).locator('img').count();
    if (imgs < 1) throw new Error('les photos jointes n’apparaissent pas dans « Vos demandes »');
  });

  // ---- CÔTÉ CONDUCTEUR : Aujourd'hui + réponse ----------------------------
  await assert('Conducteur : NOTIFICATION « Nouvelle demande client à traiter »', async () => {
    await page
      .getByRole('tab', { name: /Aujourd’hui/ })
      .first()
      .click();
    // La notification saute aux yeux, sans même dérouler un filtre.
    await page
      .getByText(/Nouvelle demande client à traiter/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Conducteur : la demande remonte aussi dans « à traiter »', async () => {
    // Filtre « à traiter aujourd’hui » (distinct de la notification homonyme).
    await page
      .getByRole('button', { name: /à traiter aujourd’hui/ })
      .first()
      .click();
    await page.getByText(`Question client · ${D1}`).first().waitFor({ timeout: 6000 });
  });

  await assert(
    'Conducteur : RÉPONDRE depuis l’onglet « Demandes client » (texte seul)',
    async () => {
      await goDemandes();
      await openCard(D1); // déplie la carte → la marque lue
      const th = threadOf(D1);
      await th.getByRole('button', { name: 'Répondre' }).click();
      await th.getByLabel('Réponse au client').fill(R1);
      await th.getByRole('button', { name: /Envoyer la réponse/ }).click();
      // Statut → Répondu, réponse visible.
      await th.getByText(R1).first().waitFor({ state: 'visible', timeout: 6000 });
      if ((await th.getByText('Répondu').count()) === 0)
        throw new Error('statut « Répondu » manquant');
    },
  );

  await assert('Conducteur : répondre avec texte + photos (2e demande)', async () => {
    await openCard(D2);
    const th = threadOf(D2);
    await th.getByRole('button', { name: 'Répondre' }).click();
    await th.getByLabel('Réponse au client').fill(R2);
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles([photo(7), photo(8)]);
    await page.waitForTimeout(400);
    await th.getByRole('button', { name: /Envoyer la réponse/ }).click();
    await th.getByText(R2).first().waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Conducteur : la demande répondue DISPARAÎT d’Aujourd’hui', async () => {
    await page
      .getByRole('tab', { name: /Aujourd’hui/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: /à traiter aujourd’hui/ })
      .first()
      .click();
    await page.waitForTimeout(300);
    if ((await page.getByText(`Question client · ${D1}`).count()) > 0)
      throw new Error('la demande répondue reste dans Aujourd’hui');
    // La notification de demande a disparu elle aussi (demande traitée).
    if ((await page.getByText(/Nouvelle demande client à traiter/).count()) > 0)
      throw new Error('la notification de demande persiste après réponse');
  });

  // ---- SUIVI : mémoire officielle -----------------------------------------
  await assert('Suivi : demande + réponse + photos + statut Répondu', async () => {
    await goSuivi();
    const th = threadOf(D1);
    for (const t of [D1, R1, 'Répondu']) await th.getByText(t).first().waitFor({ timeout: 6000 });
    // La 2e demande garde ses photos des deux côtés.
    const th2 = threadOf(D2);
    if ((await th2.locator('img').count()) < 2)
      throw new Error('les photos (client + conducteur) ne sont pas toutes visibles au Suivi');
  });

  // ---- CÔTÉ CLIENT : notification + réponse visible -----------------------
  await assert('Client : notification après réponse + réponse visible', async () => {
    // La notification « PHÉNIX a répondu » s'affiche dans « Aujourd'hui ».
    await goClient();
    if ((await page.getByText(/PHÉNIX a répondu à votre demande/).count()) === 0)
      throw new Error('pas de notification de réponse côté client');
    // La réponse elle-même se lit dans « Vos demandes » (carte dépliée).
    await goVosDemandes();
    if ((await vosDemandes().getByText('Répondu').count()) === 0)
      throw new Error('statut « Répondu » manquant côté client');
    await openClientCard(D1);
    await vosDemandes().getByText(R1).first().waitFor({ state: 'visible', timeout: 6000 });
    // La réponse revient AUSSI dans le fil de Léon (reprise de l'échange).
    await openLeon();
    await leon().getByText(R1).first().waitFor({ state: 'visible', timeout: 6000 });
    await closeLeon();
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
