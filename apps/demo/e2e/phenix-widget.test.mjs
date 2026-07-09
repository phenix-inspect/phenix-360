/**
 * RC1 — Widget PHÉNIX / Léon : concierge flottant compact (retour terrain espace
 * client). Le bouton reste fixé en bas à droite, visible à tout scroll, sur
 * desktop / tablette / mobile. Au clic, un PETIT panneau flottant s'ouvre (jamais
 * plein écran, jamais de fond assombri) : question → réponse → recherche de
 * document → navigation intelligente, sans rupture de navigation.
 */
import { launch, harness } from './harness.mjs';

const URL = process.env.E2E_URL ?? 'http://localhost:4173/';
const browser = await launch();
const { assert, summary } = harness();
const allConsole = [];

const VIEWPORTS = [
  { name: 'Mobile', width: 390, height: 740 },
  { name: 'Tablette', width: 768, height: 1024 },
  { name: 'Desktop', width: 1280, height: 800 },
];

const openBtn = (page) => page.getByRole('button', { name: 'Ouvrir PHÉNIX' });
const panel = (page) => page.getByRole('dialog', { name: /PHÉNIX, votre concierge/ });

async function openClientOn(page) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page
    .getByRole('button', { name: /Découvrir la démo/ })
    .click()
    .catch(() => {});
  await page.getByRole('heading', { name: /Bonjour Mickaël/ }).waitFor({ timeout: 15000 });
  await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
  await page.waitForTimeout(400);
}

try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') allConsole.push(`[${vp.name}] ${m.text()}`);
    });
    page.on('pageerror', (e) => allConsole.push(`[${vp.name}] pageerror: ${e.message}`));

    await openClientOn(page);

    // Position RELATIVE AU VIEWPORT (getBoundingClientRect) — un élément `fixed`
    // y reste constant quel que soit le scroll (boundingBox de Playwright, lui,
    // est relatif au document et bougerait avec le scroll).
    const rectOf = (loc) =>
      loc.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });

    await assert(
      `[${vp.name}] Bouton flottant fixé en bas à droite (scroll haut/milieu/bas)`,
      async () => {
        for (const p of [0, 0.5, 1]) {
          await page.evaluate((r) => window.scrollTo(0, document.body.scrollHeight * r), p);
          await page.waitForTimeout(120);
          const b = openBtn(page);
          if (!(await b.isVisible())) throw new Error(`bouton non visible au scroll ${p}`);
          const r = await rectOf(b);
          // Toujours dans le viewport, ancré en bas à droite.
          if (r.y + r.h > vp.height + 1)
            throw new Error(`bouton hors viewport (bas) au scroll ${p}`);
          if (r.x + r.w > vp.width + 1) throw new Error('bouton hors viewport (droite)');
          if (r.x < vp.width / 2) throw new Error('bouton pas ancré à droite');
        }
      },
    );

    await assert(
      `[${vp.name}] Clic → petit panneau flottant compact (jamais plein écran)`,
      async () => {
        await openBtn(page).click();
        const p = panel(page);
        await p.waitFor({ state: 'visible', timeout: 5000 });
        const r = await rectOf(p);
        // Compact : largeur bornée (~360–420), jamais toute la largeur.
        if (r.w > 430) throw new Error(`panneau trop large : ${Math.round(r.w)}px`);
        // Jamais plein écran : de la hauteur reste visible au-dessus.
        if (r.h > vp.height - 40)
          throw new Error(`panneau quasi plein écran : ${Math.round(r.h)} / ${vp.height}`);
        // Ancré en bas à droite, sans débordement.
        if (r.x + r.w > vp.width + 1) throw new Error('panneau déborde à droite');
        if (r.y + r.h > vp.height + 1) throw new Error('panneau déborde en bas');
      },
    );

    await assert(`[${vp.name}] Fermeture facile (X)`, async () => {
      await page.getByRole('button', { name: 'Fermer' }).first().click();
      await page.waitForTimeout(200);
      if ((await page.getByPlaceholder(/Écrivez à PHÉNIX/).count()) > 0)
        throw new Error('le panneau ne se ferme pas');
    });

    await ctx.close();
  }

  // ----------------------- Parcours fonctionnel (desktop) -----------------------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') allConsole.push(`[fn] ${m.text()}`);
  });
  page.on('pageerror', (e) => allConsole.push(`[fn] pageerror: ${e.message}`));
  await openClientOn(page);

  await assert('Question → réponse : PHÉNIX répond dans le fil', async () => {
    await openBtn(page).click();
    const draft = page.getByPlaceholder(/Écrivez à PHÉNIX/);
    await draft.fill('Où en est mon chantier cette semaine ?');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await page.waitForTimeout(800);
    if ((await page.getByText(/prochaine|étape|prévue|planning|équipe/i).count()) === 0)
      throw new Error('aucune réponse du concierge');
  });

  await assert('Recherche de document : PHÉNIX traite la demande de devis', async () => {
    const draft = page.getByPlaceholder(/Écrivez à PHÉNIX/);
    await draft.fill('Où est le devis signé ?');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await page.waitForTimeout(800);
    // Soit un bouton d'ouverture, soit une réponse (trouvé ou transmis à l'équipe).
    const action = await page.getByRole('button', { name: /Ouvrir/i }).count();
    const texte = await page.getByText(/retrouvé|l.ouvrir|documents|équipe PHÉNIX/i).count();
    if (action + texte === 0) throw new Error('la recherche de document ne répond pas');
  });

  await assert(
    'Navigation intelligente : « Voir les coulisses » ouvre le récit du chantier',
    async () => {
      const nav = page.getByRole('button', { name: /Voir les coulisses/ });
      await nav.first().waitFor({ state: 'visible', timeout: 5000 });
      await nav.first().click();
      // Sans rupture : le widget se ferme et on arrive à l'écran d'avancement.
      await page.waitForTimeout(400);
      if ((await page.getByPlaceholder(/Écrivez à PHÉNIX/).count()) > 0)
        throw new Error('le widget ne s’est pas fermé après navigation');
      // Plus de planning dédié : l'avancement du chantier se vit « Dans les coulisses ».
      await page
        .getByRole('heading', { name: 'Dans les coulisses du chantier' })
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
    },
  );

  await assert(
    'Non-régression espace client : l’historique de conversation est gardé',
    async () => {
      // On rouvre : le fil précédent est toujours là (persisté).
      await openBtn(page).click();
      await panel(page).waitFor({ state: 'visible', timeout: 5000 });
      if ((await page.getByText('Où en est mon chantier cette semaine ?').count()) === 0)
        throw new Error('la conversation n’a pas été conservée');
      await page.getByRole('button', { name: 'Fermer' }).first().click();
    },
  );

  await assert('Zéro erreur console', async () => {
    if (allConsole.length > 0) throw new Error(allConsole.slice(0, 5).join(' | '));
  });

  await ctx.close();
} catch (e) {
  await assert('FATAL', async () => {
    throw e;
  });
} finally {
  const failed = summary(allConsole);
  await browser.close();
  process.exit(failed ? 1 : 0);
}
