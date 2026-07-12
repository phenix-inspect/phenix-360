/**
 * PRÉ-RÉCEPTION — vérifier l'exécution du contrat signé (refonte 12/07/2026).
 * =============================================================================
 * La pré-réception n'est plus une liste de réserves : c'est le CONTRÔLE du
 * contrat. PHÉNIX reconstruit les prestations du devis signé + de tous les
 * avenants (postes actifs) ; le conducteur donne un statut par prestation
 * (🟢 Fait · 🟠 Réserve · 🟡 À faire · ⚫ Moins-value). Une seule saisie génère
 * deux documents (client / artisan) dérivés par destinataire — le client ne voit
 * JAMAIS le responsable, la date de reprise ni les motifs internes.
 *
 * Vérifie : fusion devis + avenants · toutes les prestations · les 4 statuts ·
 * champs conditionnels · 1 à 3 photos · document client · document artisan ·
 * étanchéité des données internes côté client · stockage Documents · Suivi ·
 * responsive · zéro erreur console.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1180, height: 2400 });
const { assert, summary } = harness();

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photo = (i) => ({
  name: `pv-${i}.png`,
  mimeType: 'image/png',
  buffer: Buffer.from(PNG, 'base64'),
});

// Prestations attendues (issues du devis + avenant n°1 du chantier « Lyon 6e »).
const P_WC = 'WC suspendu (fourniture & pose)'; // ajouté par l'avenant n°1
const P_CUISINE_HG = 'Fourniture cuisine équipée — finition haut de gamme'; // remplace p-cu-1
const P_CUISINE_ORIG = 'Fourniture cuisine équipée'; // poste REMPLACÉ → ne doit plus apparaître
const P_FAIENCE = 'Faïence murale';
const P_ETANCHEITE = 'Étanchéité sous carrelage';
const P_CARRELAGE = 'Carrelage sol salle de bain';

const RESERVE_COMMENT = 'Joint silicone à reprendre autour du receveur.';
const NONFAIT_COMMENT = 'Livraison prévue la semaine prochaine.';
const MOTIF = 'Erreur devis';
const MOT_GENERAL = 'Pré-réception globalement conforme, quelques finitions à reprendre.';

const card = (label) => page.locator('li').filter({ hasText: label }).first();
const setStatut = async (label, name) => {
  await card(label).getByRole('button', { name, exact: true }).click();
};
/** Boutons « Prévisualiser » de l'écran de validation : 0 = client, 1 = artisan. */
const previewBtn = (i) => page.getByRole('button', { name: 'Prévisualiser' }).nth(i);

/** Ouvre le document généré (popup blob) et renvoie son texte. */
const openedDocText = async (action) => {
  const [popup] = await Promise.all([page.waitForEvent('popup'), action()]);
  await popup.waitForLoadState('domcontentloaded');
  const text = await popup.evaluate(() => document.body.innerText);
  await popup.close();
  return text;
};

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();

  await assert('Lancer la Pré-réception ouvre le flux dédié (contrôle du contrat)', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByRole('dialog').getByText('Pré-réception', { exact: true }).click();
    await page
      .getByText('Vérifiez chaque prestation vendue')
      .waitFor({ state: 'visible', timeout: 8000 });
  });

  await assert(
    'Fusion devis + avenants : toutes les prestations actives, sans ressaisie',
    async () => {
      for (const label of [P_CARRELAGE, P_FAIENCE, P_ETANCHEITE, P_WC, P_CUISINE_HG])
        await page
          .getByText(label, { exact: true })
          .first()
          .waitFor({ state: 'visible', timeout: 6000 });
      // Le poste remplacé par l'avenant n'est PLUS au contrat.
      if ((await page.getByText(P_CUISINE_ORIG, { exact: true }).count()) > 0)
        throw new Error('le poste remplacé par l’avenant apparaît encore');
      // Le poste d'avenant porte son origine.
      if (
        (await card(P_WC)
          .getByText(/Avenant n.1/)
          .count()) === 0
      )
        throw new Error('l’origine « Avenant n°1 » n’est pas affichée');
    },
  );

  await assert('Chaque prestation propose les quatre statuts exclusifs', async () => {
    const c = card(P_CARRELAGE);
    for (const s of ['Fait', 'Réserve', 'À faire', 'Moins-value'])
      if ((await c.getByRole('button', { name: s, exact: true }).count()) === 0)
        throw new Error(`statut « ${s} » manquant`);
  });

  await assert('Responsive : la vérification tient sur mobile (375 px)', async () => {
    await page.setViewportSize({ width: 375, height: 2400 });
    await card(P_WC)
      .getByRole('button', { name: 'Fait', exact: true })
      .waitFor({ state: 'visible' });
    await page.setViewportSize({ width: 1180, height: 2400 });
  });

  await assert(
    '🟠 Fait avec réserve → photos (1 à 3) + commentaire + responsable + reprise',
    async () => {
      await setStatut(P_WC, 'Réserve');
      const c = card(P_WC);
      await c.getByText(/Photos \(0\/3\)/).waitFor({ state: 'visible', timeout: 4000 });
      // 1 à 3 photos : on en ajoute deux.
      await c.locator('input[type=file]').setInputFiles([photo(1), photo(2)]);
      await c.locator('img').nth(1).waitFor({ state: 'visible', timeout: 5000 });
      if ((await c.locator('img').count()) !== 2)
        throw new Error('les 2 photos ne sont pas montées');
      await c.locator('textarea').fill(RESERVE_COMMENT);
      await c.getByRole('button', { name: 'Artisan', exact: true }).click();
      await c.locator('input[type=date]').fill('2026-08-15');
    },
  );

  await assert('🟡 Non fait, à faire → commentaire obligatoire', async () => {
    await setStatut(P_FAIENCE, 'À faire');
    await card(P_FAIENCE).locator('textarea').fill(NONFAIT_COMMENT);
  });

  await assert('⚫ Plus à faire → motif obligatoire (déduit de la facture)', async () => {
    await setStatut(P_ETANCHEITE, 'Moins-value');
    await card(P_ETANCHEITE).getByRole('button', { name: MOTIF, exact: true }).click();
    await card(P_ETANCHEITE)
      .getByText(/déduite de la facture finale/)
      .waitFor({ state: 'visible', timeout: 4000 });
  });

  await assert('Synthèse automatique + commentaire général', async () => {
    await page.getByRole('button', { name: 'Voir la synthèse' }).click();
    await page
      .getByText('Synthèse de la pré-réception')
      .waitFor({ state: 'visible', timeout: 6000 });
    for (const t of ['Conformes', 'Avec réserve', 'Restant à réaliser', 'Supprimées'])
      await page.getByText(t, { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByPlaceholder(/La pré-réception s.est déroulée/).fill(MOT_GENERAL);
  });

  await assert('Générer les documents → ÉCRAN DE VALIDATION (brouillon, non envoyé)', async () => {
    await page.getByRole('button', { name: /Générer les documents/ }).click();
    await page
      .getByRole('heading', { name: 'Validation avant envoi' })
      .waitFor({ state: 'visible', timeout: 8000 });
    // Les deux versions sont en BROUILLON ; les actions de décision sont là.
    await page
      .getByText(/Brouillon/)
      .first()
      .waitFor({ state: 'visible' });
    for (const b of ['Valider et envoyer', 'Modifier la Pré-réception'])
      if ((await page.getByRole('button', { name: b }).count()) === 0)
        throw new Error(`action « ${b} » absente de l’écran de validation`);
  });

  await assert(
    'Prévisualisation ARTISAN : tout l’opérationnel (responsable, reprise, motif, commentaires)',
    async () => {
      const text = await openedDocText(() => previewBtn(1).click());
      if (!/Version artisan/i.test(text)) throw new Error('doc non marqué « Version artisan »');
      for (const must of [
        P_WC,
        RESERVE_COMMENT,
        NONFAIT_COMMENT,
        MOTIF,
        'Responsable',
        'PHÉNIX 360',
      ])
        if (!text.includes(must)) throw new Error(`le document artisan omet « ${must} »`);
      if (!/Reprise/.test(text)) throw new Error('la date de reprise manque côté artisan');
    },
  );

  await assert('Prévisualisation CLIENT : aucune donnée interne ne fuite', async () => {
    const text = await openedDocText(() => previewBtn(0).click());
    if (!/Version client/i.test(text)) throw new Error('doc non marqué « Version client »');
    // Ce que le client DOIT voir : prestations, statuts, la réserve (commentaire).
    for (const must of [P_WC, RESERVE_COMMENT, 'Fait sans réserve'])
      if (!text.includes(must)) throw new Error(`le document client omet « ${must} »`);
    // Ce que le client ne doit JAMAIS voir : responsable, reprise, motifs, notes internes.
    for (const leak of ['Responsable', 'Reprise', MOTIF, NONFAIT_COMMENT, 'déduite de la facture'])
      if (text.includes(leak))
        throw new Error(`fuite interne dans le document client : « ${leak} »`);
  });

  await assert('« Modifier la Pré-réception » revient à la saisie sans rien perdre', async () => {
    await page.getByRole('button', { name: /Modifier la Pré-réception/ }).click();
    await page
      .getByText('Vérifiez chaque prestation vendue')
      .waitFor({ state: 'visible', timeout: 6000 });
    // La réserve saisie est conservée (commentaire toujours là).
    if ((await card(P_WC).locator('textarea').first().inputValue()) !== RESERVE_COMMENT)
      throw new Error('la saisie a été perdue en revenant en arrière');
    // On repart vers la validation.
    await page.getByRole('button', { name: 'Voir la synthèse' }).click();
    await page.getByRole('button', { name: /Générer les documents/ }).click();
    await page
      .getByRole('heading', { name: 'Validation avant envoi' })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Valider et envoyer → document validé, verrouillé, diffusé', async () => {
    await page.getByRole('button', { name: /Valider et envoyer/ }).click();
    await page
      .getByText('Pré-réception validée et envoyée')
      .waitFor({ state: 'visible', timeout: 8000 });
    await page
      .getByText(/verrouillé et non modifiable/)
      .first()
      .waitFor({ state: 'visible' });
    await page.getByRole('button', { name: /^Terminer$/ }).click();
    await page
      .getByRole('heading', { name: /Appartement Lyon 6e/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Stockée dans Documents (famille « Pré-réceptions »)', async () => {
    await page
      .getByRole('tab', { name: /Documents/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: /Ouvrir : Pré-réception/ })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Apparaît dans le Suivi avec ses deux versions', async () => {
    await page.getByRole('tab', { name: 'Suivi', exact: true }).first().click();
    await page
      .getByRole('button', { name: 'Version client' })
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
    for (const b of ['Version client', 'Version artisan'])
      if ((await page.getByRole('button', { name: b }).count()) === 0)
        throw new Error(`bouton « ${b} » absent du Suivi`);
  });

  await assert('Le client est notifié de la pré-réception validée', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page
      .getByText(/Votre pré-réception est disponible/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert(
    'Espace client : la version client est consultable, sans fuite interne',
    async () => {
      await page.getByRole('tab', { name: 'Documents' }).first().click();
      await page
        .getByText('Pré-réception', { exact: true })
        .first()
        .waitFor({ state: 'visible', timeout: 6000 });
      const text = await openedDocText(() =>
        page
          .getByRole('button', { name: /Ouvrir : Pré-réception/ })
          .first()
          .click(),
      );
      if (!text.includes(RESERVE_COMMENT)) throw new Error('la réserve n’apparaît pas côté client');
      for (const leak of ['Responsable', MOTIF, NONFAIT_COMMENT])
        if (text.includes(leak))
          throw new Error(`fuite interne dans l’espace client : « ${leak} »`);
    },
  );

  await assert('Règle : un document PRÉPARÉ mais NON VALIDÉ ne quitte jamais PHÉNIX', async () => {
    // On prépare une nouvelle pré-réception jusqu'à l'écran de validation…
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByRole('dialog').getByText('Pré-réception', { exact: true }).click();
    await page
      .getByText('Vérifiez chaque prestation vendue')
      .waitFor({ state: 'visible', timeout: 8000 });
    await page.getByRole('button', { name: 'Voir la synthèse' }).click();
    await page.getByRole('button', { name: /Générer les documents/ }).click();
    await page
      .getByRole('heading', { name: 'Validation avant envoi' })
      .waitFor({ state: 'visible', timeout: 6000 });
    // …puis on ferme SANS valider.
    await page.getByRole('button', { name: 'Fermer' }).click();
    // Côté client : aucune nouvelle pré-réception, une seule (celle déjà validée).
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.getByRole('tab', { name: 'Documents' }).first().click();
    await page.waitForTimeout(300);
    const n = await page.getByRole('button', { name: /Ouvrir : Pré-réception/ }).count();
    if (n !== 1)
      throw new Error(`une pré-réception non validée a fuité côté client (${n} au lieu de 1)`);
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
