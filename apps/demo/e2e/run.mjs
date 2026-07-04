/**
 * Runner e2e : démarre le serveur de preview (build servi sur :4173), exécute
 * chaque suite `*.test.mjs` du dossier, agrège les résultats, puis arrête le
 * serveur. Suppose que le build existe (le script `test:e2e` fait `vite build`
 * avant). Code de sortie non nul si au moins une suite échoue.
 */
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const URL = 'http://localhost:4173/';

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await ping(url)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview indisponible sur ${url}`);
}

function runNode(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: appDir,
    stdio: 'ignore',
  });
  let failed = 0;
  let suites = [];
  try {
    await waitFor(URL);
    suites = readdirSync(here)
      .filter((f) => f.endsWith('.test.mjs'))
      .sort();
    for (const s of suites) {
      console.log(`\n### ${s}`);
      const code = await runNode(join(here, s));
      if (code !== 0) failed++;
    }
    console.log(`\n===== ${suites.length - failed}/${suites.length} SUITES PASS =====`);
  } finally {
    preview.kill('SIGTERM');
  }
  process.exit(failed ? 1 : 0);
}

void main();
