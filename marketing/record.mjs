// Enregistre les fichiers motion en vidéo 1080p (Playwright → webm VP8),
// puis transcode en .mp4 H.264 (ffmpeg bundled par imageio-ffmpeg).
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readdirSync, renameSync, rmSync, existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG;
const outDir = join(here, 'output');
const rawDir = join(here, 'output', '_raw');
rmSync(rawDir, { recursive: true, force: true });

const jobs = [
  { file: 'video-presentation.html', out: 'PHENIX360-presentation-1min.mp4' },
  { file: 'video-explainer.html', out: 'PHENIX360-guide-2min.mp4' },
];

const browser = await pw.chromium.launch({ args: ['--force-color-profile=srgb'] });

for (const job of jobs) {
  console.log(`\n▶ enregistrement : ${job.file}`);
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  await page.goto('file://' + resolve(here, job.file), { waitUntil: 'networkidle' });
  const total = await page.evaluate(() => window.__TOTAL__);
  const waitMs = Math.round(400 + total * 1000 + 1300);
  console.log(`  durée timeline ${total.toFixed(1)}s → attente ${(waitMs / 1000).toFixed(1)}s`);
  await page.waitForTimeout(waitMs);
  await context.close(); // finalise le webm
  const webm = await page.video().path();
  console.log('  webm :', webm);

  // Transcode → mp4 H.264 (compatibilité universelle : iPhone, WhatsApp, mail).
  const mp4 = join(outDir, job.out);
  const args = [
    '-y',
    '-i', webm,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '19',
    '-pix_fmt', 'yuv420p',
    '-vf', 'fps=30,scale=1920:1080:flags=lanczos',
    '-movflags', '+faststart',
    mp4,
  ];
  const r = spawnSync(FFMPEG, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('  ✗ ffmpeg', r.stderr?.split('\n').slice(-8).join('\n'));
  } else {
    console.log('  ✓ mp4  :', mp4);
  }
}

await browser.close();
rmSync(rawDir, { recursive: true, force: true });
console.log('\n✓ terminé');
