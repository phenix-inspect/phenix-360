// Rend les brochures HTML en PDF vectoriel A4 (Chromium print, fonds imprimés).
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const jobs = [
  { file: 'pdf-presentation.html', out: 'PHENIX360-presentation.pdf' },
  { file: 'pdf-explainer.html', out: 'PHENIX360-guide-pratique.pdf' },
];

const browser = await pw.chromium.launch();
const page = await browser.newPage();
for (const job of jobs) {
  await page.goto('file://' + resolve(here, job.file), { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(400);
  const out = join(here, 'output', job.out);
  await page.pdf({
    path: out,
    width: '210mm',
    height: '297mm',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });
  console.log('✓ pdf :', out);
}
await browser.close();
