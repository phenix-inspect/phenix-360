/**
 * Consolidation 2 — Documents = une bibliothèque unique. Un document déposé dans
 * l'onglet DOCUMENTS devient un événement `document` du Journal (fini le silo) ; la
 * checklist pointe vers lui. Client-safe : un document interne ne fuit pas.
 */
import { launch, session, harness, openDemo } from './harness.mjs';

const PDF = {
  name: 'attestation-tva.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 test tva'),
};
const DOC = 'Attestation TVA réduite';

const browser = await launch();
const { page, consoleErrors } = await session(browser);
const { assert, summary } = harness();

try {
  await openDemo(page);
  await page.getByRole('button', { name: /Appartement Lyon 6e/ }).click();
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();

  await assert('Déposer un document dans l’onglet Documents (fichier réel)', async () => {
    await page.getByRole('heading', { name: /^Documents/ }).scrollIntoViewIfNeeded();
    await page.getByLabel('Libellé du document').fill(DOC);
    await page.setInputFiles('[data-testid="prep-doc-file"]', PDF);
    await page.getByRole('button', { name: /Ajouter le document/ }).click();
    await page.getByText(DOC).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert(
    'Document FOURNI avec fichier ouvrable (résolu depuis la bibliothèque)',
    async () => {
      const row = page.locator('li').filter({ hasText: DOC }).first();
      await row.getByText('Fourni').waitFor({ state: 'visible', timeout: 4000 });
      if ((await row.getByRole('button').count()) + (await row.getByRole('link').count()) === 0)
        throw new Error('aucun lien de fichier');
    },
  );

  await assert('Base UNIQUE : le document préparé remonte au Journal (fini le silo)', async () => {
    await page.getByRole('tab', { name: 'Suivi', exact: true }).click();
    await page.getByText(DOC).first().waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert('Client-safe : un document interne ne fuit pas côté client', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.waitForTimeout(600);
    if ((await page.getByText(DOC, { exact: false }).count()) > 0)
      throw new Error('fuite du document interne côté client');
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
