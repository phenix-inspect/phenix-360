/**
 * RÉCEPTION — dernière étape contractuelle : lever les réserves puis clôturer.
 * =============================================================================
 * La Réception ne repart JAMAIS du devis : elle repart de la Pré-réception validée
 * et vérifie que TOUTES les réserves ont été levées (commentaire de levée + photo
 * « après »). Tant qu'une réserve reste ouverte, « Valider la Réception » est
 * désactivé. À la validation : PV diffusé au client (notifié) + chantier clôturé.
 *
 * Vérifie : blocage sans Pré-réception · en-tête (devis, avenants, réf. PR) ·
 * résumé (prestations / réserves) · validation impossible réserve ouverte · photo
 * ET commentaire obligatoires · document (réserves levées, signatures PHÉNIX +
 * Client, conclusion) · diffusion + notification client · clôture · responsive ·
 * zéro erreur console.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1180, height: 2400 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photo = (i) => ({
  name: `rec-${i}.png`,
  mimeType: 'image/png',
  buffer: Buffer.from(PNG, 'base64'),
});

const P_WC = 'WC suspendu (fourniture & pose)';
const RESERVE_COMMENT = 'Joint silicone à reprendre autour du receveur.';
const LEVEE_COMMENT = 'Joint refait proprement, séché et contrôlé.';

const missionPicker = () => page.getByRole('dialog');
// La surface active (mission plein écran) — évite les doublons du fond derrière l'overlay.
const overlay = () => page.locator('.z-modal').last();
const card = (label) => overlay().locator('li').filter({ hasText: label }).first();
const validerBtn = () => page.getByRole('button', { name: /Valider la Réception/ });

/** Ouvre le document généré (popup blob) et renvoie son texte. */
const openedDocText = async (action) => {
  const [popup] = await Promise.all([page.waitForEvent('popup'), action()]);
  await popup.waitForLoadState('domcontentloaded');
  const text = await popup.evaluate(() => document.body.innerText);
  await popup.close();
  return text;
};

const ouvrirReception = async () => {
  await page.getByRole('button', { name: /Nouvelle mission/ }).click();
  await missionPicker().getByText('Réception', { exact: true }).click();
};

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();

  await assert('Sans Pré-réception validée, la Réception est bloquée', async () => {
    await ouvrirReception();
    await page
      .getByText('La Pré-réception doit être validée avant de réaliser la Réception.')
      .waitFor({ state: 'visible', timeout: 6000 });
    await page.getByRole('button', { name: /J.ai compris/ }).click();
  });

  await assert('Responsive mobile (375 px) : l’écran Réception tient', async () => {
    await page.setViewportSize({ width: 375, height: 2400 });
    await ouvrirReception();
    await page
      .getByText('La Pré-réception doit être validée avant de réaliser la Réception.')
      .waitFor({ state: 'visible', timeout: 6000 });
    await page.getByRole('button', { name: /J.ai compris/ }).click();
    await page.setViewportSize({ width: 1180, height: 2400 });
  });

  // — On crée d'abord une Pré-réception validée avec UNE réserve (source unique). —
  await assert('Préparer la source : une Pré-réception validée avec une réserve', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await missionPicker().getByText('Pré-réception', { exact: true }).click();
    await page
      .getByText('Vérifiez chaque prestation vendue')
      .waitFor({ state: 'visible', timeout: 8000 });
    await card(P_WC).getByRole('button', { name: 'Avec réserve', exact: true }).click();
    const c = card(P_WC);
    await c.locator('input[type=file]:not([capture])').setInputFiles([photo(1)]);
    await c.locator('img').first().waitFor({ state: 'visible', timeout: 5000 });
    await c.locator('textarea').fill(RESERVE_COMMENT);
    await page.getByRole('button', { name: 'Voir la synthèse' }).click();
    await page.getByRole('button', { name: /Générer les documents/ }).click();
    await page
      .getByRole('heading', { name: 'Validation avant envoi' })
      .waitFor({ state: 'visible', timeout: 8000 });
    await page.getByRole('button', { name: /Valider et envoyer/ }).click();
    await page
      .getByText('Pré-réception validée et envoyée')
      .waitFor({ state: 'visible', timeout: 8000 });
    await page.getByRole('button', { name: /^Terminer$/ }).click();
    await page
      .getByRole('heading', { name: /Appartement Lyon 6e/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Réception : en-tête (devis, avenants, réf. Pré-réception) + résumé', async () => {
    await ouvrirReception();
    await page
      .getByRole('heading', { name: 'Levée des réserves' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    for (const l of ['N° du devis', 'Avenants intégrés', 'Réf. Pré-réception'])
      if ((await page.getByText(l, { exact: true }).count()) === 0)
        throw new Error(`en-tête sans « ${l} »`);
    if ((await page.getByText('DEV-2024-0188', { exact: true }).count()) === 0)
      throw new Error('numéro de devis absent');
    if ((await page.getByText(/PR-\d{8}-V\d/).count()) === 0)
      throw new Error('référence de Pré-réception absente');
    // Résumé : réserves créées 1, restantes 1.
    for (const l of ['Prestations', 'Réserves créées', 'Réserves levées', 'Réserves restantes'])
      if ((await page.getByText(l, { exact: true }).count()) === 0)
        throw new Error(`résumé sans « ${l} »`);
  });

  await assert(
    'La réserve issue de la Pré-réception est affichée (commentaire initial)',
    async () => {
      await card('Réserve n°1')
        .getByText(RESERVE_COMMENT)
        .first()
        .waitFor({ state: 'visible', timeout: 4000 });
    },
  );

  await assert('Validation IMPOSSIBLE tant qu’une réserve reste ouverte', async () => {
    await page
      .getByText(/1 réserve reste à lever/)
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    if (!(await validerBtn().isDisabled()))
      throw new Error(
        '« Valider la Réception » n’est pas désactivé alors qu’une réserve est ouverte',
      );
  });

  await assert('Cocher « Réserve levée » → commentaire ET photo obligatoires', async () => {
    const c = card('Réserve n°1');
    await c.locator('input[type=checkbox]').check();
    // Commentaire seul (sans photo) → toujours bloqué (photo obligatoire).
    await c.locator('textarea').fill(LEVEE_COMMENT);
    if (!(await validerBtn().isDisabled()))
      throw new Error('validation permise sans photo « après »');
    // + une photo « après » → la réserve est levée.
    await c.locator('input[type=file]:not([capture])').setInputFiles([photo(2)]);
    await c.locator('img').last().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Toutes les réserves levées → résumé à jour + validation possible', async () => {
    await page
      .getByText(/Toutes les réserves sont levées/)
      .first()
      .waitFor({ state: 'visible', timeout: 4000 });
    if (await validerBtn().isDisabled())
      throw new Error('validation bloquée alors que toutes les réserves sont levées');
  });

  await assert(
    'Prévisualisation : PV avec réserves levées, signatures PHÉNIX + Client',
    async () => {
      await validerBtn().click();
      await page
        .getByRole('heading', { name: 'Validation avant envoi' })
        .waitFor({ state: 'visible', timeout: 6000 });
      const text = await openedDocText(() =>
        page.locator('.z-modal').last().getByRole('button', { name: 'Prévisualiser' }).click(),
      );
      for (const must of [
        'DEV-2024-0188',
        RESERVE_COMMENT,
        LEVEE_COMMENT,
        'Les travaux sont réceptionnés.',
        'BROUILLON',
      ])
        if (!text.includes(must)) throw new Error(`le PV omet « ${must} »`);
      // Libellés en petites capitales CSS → innerText en MAJUSCULES : comparaison insensible.
      if (!/photo avant/i.test(text) || !/photo après/i.test(text))
        throw new Error('le PV omet les photos avant / après');
      if (!/client ou son repr/i.test(text)) throw new Error('bloc de signature Client absent');
      if (/artisan ou son repr/i.test(text))
        throw new Error('un bloc ARTISAN apparaît sur le PV de réception');
      // Condition bêta #4 : le PV client ne porte AUCUN code système interne
      // (REC-…/PR-…), ni la « Réf. Pré-réception » — identifiants techniques. Il
      // conserve le n° de devis (utile, contractuel), vérifié plus haut.
      if (/REC-\d{8}-V\d/.test(text) || /PR-\d{8}-V\d/.test(text))
        throw new Error('code système interne (REC-…/PR-…) présent sur le PV client');
      if (/Réf\. (Pré-réception|Réception)/.test(text))
        throw new Error('une référence système interne fuit sur le PV client');
    },
  );

  await assert('Diffuser au client → réception validée + chantier clôturé', async () => {
    await page.getByRole('button', { name: /Diffuser au client/ }).click();
    await page
      .getByText(/Réception validée — chantier clôturé/)
      .waitFor({ state: 'visible', timeout: 8000 });
    await page.getByRole('button', { name: /^Terminer$/ }).click();
    await page
      .getByRole('heading', { name: /Appartement Lyon 6e/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Le chantier est passé en CLÔTURÉ (archivable)', async () => {
    const sel = page
      .locator('select')
      .filter({ has: page.locator('option[value="cloture"]') })
      .first();
    await sel.waitFor({ state: 'visible', timeout: 6000 });
    if ((await sel.inputValue()) !== 'cloture')
      throw new Error('le chantier n’est pas passé en clôturé');
  });

  await assert('Le PV de réception est stocké dans les Documents', async () => {
    await page
      .getByRole('tab', { name: /Documents/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: /Ouvrir : Réception/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Le client est notifié de la réception + PDF consultable', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page
      .getByText(/Votre réception de chantier est disponible/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    await page.getByRole('tab', { name: 'Documents' }).first().click();
    const text = await openedDocText(() =>
      page
        .getByRole('button', { name: /Ouvrir : Réception/ })
        .first()
        .click(),
    );
    if (!text.includes('Les travaux sont réceptionnés.'))
      throw new Error('le PV client ne conclut pas la réception');
    if (text.includes('BROUILLON'))
      throw new Error('le document validé porte encore le filigrane BROUILLON');
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
