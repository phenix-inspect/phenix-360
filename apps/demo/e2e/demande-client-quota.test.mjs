/**
 * Anti-régression : demande à Léon AVEC photo quand localStorage est saturé.
 * =============================================================================
 * Bug critique observé : après avoir beaucoup testé l'app (photos accumulées),
 * envoyer une demande AVEC photo figeait le chat — `localStorage.setItem` levait
 * `QuotaExceededError` dans `askPhenix`, la promesse était rejetée, `busy`
 * restait bloqué, rien ne s'affichait et aucune demande n'était créée.
 *
 * Garanties verrouillées ici, sous pression de stockage réelle :
 *   • aucune exception `quota` non rattrapée (persistance best-effort) ;
 *   • le chat reste UTILISABLE (jamais figé sur `busy`) ;
 *   • la confirmation de transmission s'affiche (le client ne parle pas dans le vide) ;
 *   • la question NE DISPARAÎT PAS du fil (miroir mémoire vs read-through localStorage) ;
 *   • la demande est bien CRÉÉE et le conducteur est NOTIFIÉ, même quota plein.
 */
import zlib from 'node:zlib';
import { launch, session, harness, openDemo } from './harness.mjs';

/** Construit un PNG RVBA de bruit (incompressible → gros payload, comme une vraie photo). */
function bigPng(size = 1200) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  let o = 0;
  let seed = 123456789;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16) & 0xff;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filtre 0
    for (let x = 0; x < size * 4; x++) raw[o++] = rnd();
  }
  const crc32 = (buf) => {
    let crc = ~0;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (~crc >>> 0) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crcB]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const browser = await launch();
const { page, consoleErrors } = await session(browser, { width: 1280, height: 1600 });
const { assert, summary } = harness();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));

const leon = () => page.getByRole('dialog', { name: /concierge/ });

try {
  await openDemo(page);

  await assert('Prépare un localStorage quasi plein (marge ~512 Ko)', async () => {
    const left = await page.evaluate(() => {
      const CHUNK = 128 * 1024;
      let i = 0;
      try {
        for (; i < 200; i++) localStorage.setItem('__fill_' + i, 'x'.repeat(CHUNK));
      } catch {
        /* quota atteint */
      }
      // Libère ~4 blocs pour laisser une petite marge (insuffisante pour dupliquer une photo).
      for (let k = 0; k < 4; k++) localStorage.removeItem('__fill_' + (i - 1 - k));
      return i;
    });
    if (left < 3) throw new Error('remplissage insuffisant pour tester la pression mémoire');
  });

  await assert('Léon + photo sous pression : pas de gel, pas d’exception, confirmation visible', async () => {
    await page.getByRole('tab', { name: 'Espace client', exact: true }).click();
    await page.getByRole('tab', { name: 'Aujourd’hui' }).last().click();
    await page.getByRole('button', { name: 'Ouvrir PHÉNIX' }).click();
    await leon().getByPlaceholder('Écrivez à PHÉNIX').fill('Peut-on décaler la réception ?');
    await leon()
      .locator('input[type=file]')
      .setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: bigPng(1200) });
    await page.waitForTimeout(1200);
    await leon().getByRole('button', { name: 'Envoyer' }).click();
    await page.waitForTimeout(1500);

    // 1) La confirmation s'affiche (le client ne parle jamais dans le vide).
    if ((await leon().getByText(/transmettre votre demande/).count()) === 0)
      throw new Error('aucune confirmation affichée après l’envoi sous pression');

    // 2) La question ne disparaît PAS du fil (bug observé : elle s'effaçait).
    if ((await leon().getByText('Peut-on décaler la réception ?').count()) === 0)
      throw new Error('la question a disparu du fil sous pression mémoire');

    // 3) Le chat reste utilisable : « Envoyer » se réactive dès qu'on retape.
    await leon().getByPlaceholder('Écrivez à PHÉNIX').fill('encore un mot');
    await page.waitForTimeout(150);
    if (await leon().getByRole('button', { name: 'Envoyer' }).isDisabled())
      throw new Error('CHAT FIGÉ : « Envoyer » reste désactivé (busy bloqué)');

    // 4) Aucune exception quota non rattrapée n'a fui (persistance best-effort).
    const quotaLeak = pageErrors.filter((e) => /quota/i.test(e));
    if (quotaLeak.length > 0)
      throw new Error('exception quota non rattrapée : ' + quotaLeak.join(' | '));
  });

  await assert('Sous pression : la demande EST créée et le conducteur est NOTIFIÉ', async () => {
    await leon().getByRole('button', { name: 'Fermer' }).click();
    await page.getByRole('tab', { name: /Aujourd’hui/ }).first().click();
    await page
      .getByText(/Nouvelle demande client à traiter/)
      .first()
      .waitFor({ state: 'visible', timeout: 6000 });
  });

  await assert('Zéro erreur console (hors avertissements de quota volontaires)', async () => {
    const hard = consoleErrors.filter((e) => !/quota/i.test(e));
    if (hard.length > 0) throw new Error(hard.slice(0, 5).join(' | '));
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
