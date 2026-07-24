/**
 * COFFRE CLOUD des satellites (`CloudKv`) — hydratation + synchro best-effort.
 * =============================================================================
 * `CloudKv` fait suivre au conducteur ses « satellites » (préparation, contacts,
 * Le Fil, réglages…) d'un appareil à l'autre, via la table `app_kv` (RLS privée).
 * On injecte un CLIENT SIMULÉ (aucun réseau) et on vérifie :
 *   • loadAll → transforme les lignes (k,v) en dictionnaire ;
 *   • loadAll tolère un échec (renvoie {} sans jeter) ;
 *   • set → upsert (user_id, k, v) ; remove → delete filtré (user_id, k) ;
 *   • coalescing/sérialisation par clé : deux écritures rapides → la DERNIÈRE
 *     valeur gagne (jamais réécrite par une synchro plus lente).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const pnpmDir = join(root, 'node_modules/.pnpm');
const esbuildPkg = readdirSync(pnpmDir).find((d) => /^esbuild@/.test(d));
const ESBUILD = join(pnpmDir, esbuildPkg, 'node_modules/esbuild/bin/esbuild');
const outFile = join(mkdtempSync(join(tmpdir(), 'ckv-')), 'ckv.mjs');
execFileSync(
  ESBUILD,
  [
    join(root, 'apps/demo/src/lib/cloudKv.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${outFile}`,
    '--log-level=error',
    '--define:__APP_VERSION__="test"',
    '--define:__APP_COMMIT__="test"',
    '--define:__APP_BUILD_TIME__="test"',
  ],
  { cwd: root },
);
const { CloudKv } = await import(outFile);

/* ------------------------------ Client simulé ----------------------------- */
// from(table) → objet chaînable et « thenable » : upsert / delete().eq().eq() /
// select().eq(). `selectResponder` fournit les lignes lues.
function mockClient(selectResponder = () => ({ data: [], error: null }), writeError = null) {
  const upserts = [];
  const deletes = [];
  const from = () => {
    const chain = { op: null, values: null, opts: null, eq: [] };
    const b = {
      select() {
        chain.op = 'select';
        return b;
      },
      upsert(values, opts) {
        chain.op = 'upsert';
        chain.values = values;
        chain.opts = opts;
        return b;
      },
      delete() {
        chain.op = 'delete';
        return b;
      },
      eq(col, val) {
        chain.eq.push([col, val]);
        return b;
      },
      then(resolve, reject) {
        return Promise.resolve()
          .then(() => {
            if (chain.op === 'select') return selectResponder();
            if (chain.op === 'upsert') {
              upserts.push(chain.values);
              return { data: null, error: writeError };
            }
            deletes.push(chain.eq);
            return { data: null, error: writeError };
          })
          .then(resolve, reject);
      },
    };
    return b;
  };
  return { client: { from }, upserts, deletes };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/* --------------------------------- Runner --------------------------------- */
const results = [];
const check = async (label, fn) => {
  try {
    await fn();
    results.push(true);
    console.log('  OK ', label);
  } catch (e) {
    results.push(false);
    console.log('  XX ', label, '--', String(e?.message ?? e));
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const USER = 'user-1';

/* -- loadAll : lignes (k,v) → dictionnaire -------------------------------- */
await check('loadAll : transforme les lignes (k,v) en dictionnaire', async () => {
  const { client } = mockClient(() => ({
    data: [
      { k: 'phenix-demo:contacts:v1', v: '[{"id":"c1"}]' },
      { k: 'phenix-demo:active:v1', v: '"p-1"' },
    ],
    error: null,
  }));
  const kv = new CloudKv(client, USER);
  const all = await kv.loadAll();
  assert(all['phenix-demo:contacts:v1'] === '[{"id":"c1"}]', 'contacts non chargés');
  assert(all['phenix-demo:active:v1'] === '"p-1"', 'projet actif non chargé');
});

/* -- loadAll : tolérant à l'échec (renvoie {}) ---------------------------- */
await check('loadAll : un échec renvoie {} sans jeter', async () => {
  const { client } = mockClient(() => ({ data: null, error: { message: 'RLS denied' } }));
  const kv = new CloudKv(client, USER);
  const all = await kv.loadAll();
  assert(Object.keys(all).length === 0, 'devrait renvoyer un dictionnaire vide');
});

/* -- set : upsert (user_id, k, v) ----------------------------------------- */
await check('set : upsert de la paire pour le bon utilisateur', async () => {
  const { client, upserts } = mockClient();
  const kv = new CloudKv(client, USER);
  kv.set('phenix-demo:dossiers:v1', '{"x":1}');
  await tick();
  assert(upserts.length === 1, 'aucun upsert émis');
  assert(
    upserts[0].user_id === USER &&
      upserts[0].k === 'phenix-demo:dossiers:v1' &&
      upserts[0].v === '{"x":1}',
    'payload upsert incorrect',
  );
});

/* -- remove : delete filtré (user_id, k) ---------------------------------- */
await check('remove : delete filtré par user_id et clé', async () => {
  const { client, deletes } = mockClient();
  const kv = new CloudKv(client, USER);
  kv.remove('phenix-demo:contacts:v1');
  await tick();
  assert(deletes.length === 1, 'aucun delete émis');
  const flt = Object.fromEntries(deletes[0]);
  assert(flt.user_id === USER && flt.k === 'phenix-demo:contacts:v1', 'filtres delete incorrects');
});

/* -- coalescing : deux écritures rapides → la dernière valeur gagne -------- */
await check('coalescing : écritures rapides d’une même clé — la DERNIÈRE gagne', async () => {
  const { client, upserts } = mockClient();
  const kv = new CloudKv(client, USER);
  kv.set('phenix-demo:seen:v1', 'A');
  kv.set('phenix-demo:seen:v1', 'B');
  await tick();
  await tick();
  assert(upserts.length >= 1, 'aucun upsert');
  assert(upserts[upserts.length - 1].v === 'B', 'la dernière valeur écrite doit être B');
});

const passed = results.filter(Boolean).length;
console.log(`\n=== COFFRE CLOUD (app_kv) — ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
