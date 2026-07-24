// Capture d'écran d'un fichier motion, scène par scène, pour vérifier le rendu.
// Usage: node shoot.mjs <fichier.html> [scèneIndex...]
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2];
const idxs = process.argv.slice(3).map(Number);
const url = 'file://' + resolve(here, file);

const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const n = await page.evaluate(() => document.querySelectorAll('.scene').length);
const targets = idxs.length ? idxs : [...Array(n).keys()];
for (const k of targets) {
  await page.evaluate((k) => {
    const s = [...document.querySelectorAll('.scene')];
    s.forEach((el, j) => el.classList.toggle('is-active', j === k));
  }, k);
  await page.waitForTimeout(1400); // laisser les reveals se jouer
  const out = join(here, 'output', `${file.replace(/\W+/g, '_')}-s${k}.png`);
  await page.screenshot({ path: out });
  console.log('shot', out);
}
await browser.close();
