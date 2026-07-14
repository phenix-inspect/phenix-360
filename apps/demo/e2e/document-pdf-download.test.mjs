/**
 * MOTEUR PDF UNIQUE — le TÉLÉCHARGEMENT produit un VRAI PDF (bout en bout).
 * =============================================================================
 * On ne vérifie pas qu'« un téléchargement démarre » : on capture le FICHIER
 * réellement téléchargé depuis le bouton « Télécharger en PDF » et on contrôle,
 * pour de vrai, les quatre garanties demandées :
 *   • extension .pdf (nom de fichier réellement posé par l'application) ;
 *   • MIME application/pdf (type du Blob téléchargé) ;
 *   • signature binaire « %PDF- » (jamais « <!doctype html> ») ;
 *   • ouverture correcte (parse pdfjs) + contenu attendu.
 * Les documents IMPORTÉS gardent « Télécharger le fichier » (fichier d'origine).
 */
import { readFileSync } from 'node:fs';
import { launch, session, harness, openDemo } from './harness.mjs';

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1180, height: 2200 });
const { assert, summary } = harness();

// L'application télécharge via une ancre `download` ; en headless, Chromium ne
// propage pas toujours ce nom à Playwright. On capte donc le nom RÉELLEMENT posé.
await page.addInitScript(() => {
  const proto = HTMLAnchorElement.prototype;
  const orig = proto.click;
  // @ts-ignore
  proto.click = function () {
    if (this.hasAttribute('download')) window.__dl = this.getAttribute('download');
    return orig.apply(this, arguments);
  };
});

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

/** Capture le fichier téléchargé + le nom posé par l'app + le MIME du blob. */
const capture = async (action) => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }),
    action(),
  ]);
  const bytes = readFileSync(await download.path());
  const name = await page.evaluate(() => window.__dl ?? '');
  const mime = await page.evaluate(
    (u) =>
      fetch(u)
        .then((r) => r.blob())
        .then((b) => b.type)
        .catch(() => ''),
    download.url(),
  );
  return { name, mime, bytes };
};

const isPdf = (bytes) => bytes.subarray(0, 5).toString('latin1') === '%PDF-';
const pdfText = async (bytes) => {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    text += ' ' + tc.items.map((it) => it.str).join(' ');
  }
  return text;
};

const assertRealPdf = ({ name, mime, bytes }) => {
  if (!name.toLowerCase().endsWith('.pdf')) throw new Error(`extension inattendue : « ${name} »`);
  if (mime !== 'application/pdf') throw new Error(`MIME inattendu : « ${mime} »`);
  if (!isPdf(bytes)) throw new Error('signature %PDF- absente (ce n’est pas un PDF)');
};

try {
  await openDemo(page);
  await page.getByRole('tab', { name: 'Chantier', exact: true }).click();

  await assert('Préparer un document généré (pré-réception validée)', async () => {
    await page.getByRole('button', { name: /Nouvelle mission/ }).click();
    await page.getByRole('dialog').getByText('Pré-réception', { exact: true }).click();
    await page
      .getByText('Vérifiez chaque prestation vendue')
      .waitFor({ state: 'visible', timeout: 8000 });
    await page.getByRole('button', { name: 'Voir la synthèse' }).click();
    await page.getByRole('button', { name: /Générer les documents/ }).click();
    await page.getByRole('button', { name: /Valider et envoyer/ }).click();
    await page
      .getByText('Pré-réception validée et envoyée')
      .waitFor({ state: 'visible', timeout: 8000 });
  });

  await assert(
    '« Télécharger en PDF » (client) → .pdf + application/pdf + %PDF- + contenu',
    async () => {
      const dl = await capture(() =>
        page
          .getByRole('button', { name: /Télécharger en PDF/ })
          .first()
          .click(),
      );
      assertRealPdf(dl);
      const text = await pdfText(dl.bytes);
      if (!/Pré-réception/i.test(text)) throw new Error('contenu attendu absent du PDF');
      if (!/client ou son repr/i.test(text)) throw new Error('signataire client absent du PDF');
    },
  );

  await assert('« Télécharger en PDF » (artisan) → vrai PDF + signataire artisan', async () => {
    const dl = await capture(() =>
      page
        .getByRole('button', { name: /Télécharger en PDF/ })
        .nth(1)
        .click(),
    );
    assertRealPdf(dl);
    const text = await pdfText(dl.bytes);
    if (!/artisan ou son repr/i.test(text)) throw new Error('signataire artisan absent du PDF');
  });

  await assert('Depuis les Documents (après validation) → toujours un vrai PDF', async () => {
    await page.getByRole('button', { name: /^Terminer$/ }).click();
    await page
      .getByRole('tab', { name: /Documents/ })
      .first()
      .click();
    const dl = await capture(() =>
      page
        .getByRole('button', { name: /Télécharger : Pré-réception/ })
        .first()
        .click(),
    );
    assertRealPdf(dl);
  });

  await assert('Aucun téléchargement HTML : plus de bouton « Télécharger » nu', async () => {
    if ((await page.getByRole('button', { name: 'Télécharger', exact: true }).count()) > 0)
      throw new Error('un bouton « Télécharger » générique (HTML) subsiste');
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
