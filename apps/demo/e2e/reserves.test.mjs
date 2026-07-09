/**
 * Réserves après le RETRAIT de l'onglet dédié : une réserve est un événement du
 * Journal. Le conducteur la retrouve au SUIVI (historique), joint son responsable
 * (contact) et la LÈVE — elle passe alors « Levée ». Elle remonte dans
 * « Aujourd'hui » tant qu'une action est attendue, et reste client-safe. Toute la
 * logique métier (création via missions, suivi, levée, historique) est conservée.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { height: 2000 });
const { assert, summary } = harness();

// Réserve OUVERTE du seed (chantier « Appartement Lyon 6e »).
const RESERVE = /Cette prise peut-elle être déplacée/;

const voirTout = async () => {
  const voir = page.getByRole('button', { name: /Voir tout le journal/ });
  if (await voir.count()) await voir.first().click();
};
const goSuivi = async () => {
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
  await page.getByRole('tab', { name: 'Suivi', exact: true }).first().click();
  await voirTout();
};

try {
  await openDemo(page);
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();

  await assert('La page Chantier n’a PLUS d’onglet « Réserves »', async () => {
    await page.getByRole('tab', { name: 'Chantier', exact: true }).click();
    if ((await page.getByRole('tab', { name: /Réserves/ }).count()) > 0)
      throw new Error('l’onglet « Réserves » existe encore');
  });

  await assert('La réserve se lit au Suivi, avec « Lever la réserve » et son responsable', async () => {
    await goSuivi();
    await page.getByText(RESERVE).first().waitFor({ state: 'visible', timeout: 6000 });
    if ((await page.getByRole('button', { name: 'Lever la réserve' }).count()) === 0)
      throw new Error('action « Lever la réserve » absente du Suivi');
    // Le responsable (un contact) reste joignable depuis la réserve.
    await page
      .getByText(/Joindre .*Élec Pro/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Aujourd’hui remonte la réserve et l’ouvre au Suivi', async () => {
    await page
      .getByRole('tab', { name: /Aujourd/ })
      .first()
      .click();
    await page.getByRole('button', { name: /Filtrer.*réserves à lever/i }).click();
    await page.getByText(RESERVE).first().click();
    await page
      .getByRole('tab', { name: 'Suivi', exact: true, selected: true })
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Lever la réserve depuis le Suivi → elle passe « Levée »', async () => {
    await voirTout();
    await page.getByRole('button', { name: 'Lever la réserve' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').first().fill('Prise déplacée et contrôlée sur place.');
    await dialog.getByRole('button', { name: 'Lever la réserve' }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(300);
    // Plus d'action « à lever » sur cette réserve (la seule ouverte du chantier).
    if ((await page.getByRole('button', { name: 'Lever la réserve' }).count()) > 0)
      throw new Error('la réserve reste « à lever » après la levée');
    // La levée est tracée au Journal : « Réserve n°N levée ».
    await page
      .getByText(/Réserve n°\d+ levée/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Client-safe : les réserves ne fuient jamais côté client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(600);
    for (const secret of ['Cette prise peut-elle être déplacée', 'Réserve n°']) {
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
