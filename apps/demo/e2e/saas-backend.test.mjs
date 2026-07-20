/**
 * BACKEND SaaS (write-through) — cache mémoire + persistance durable ciblée.
 * =============================================================================
 * `SaaSBackend` enveloppe `SupabaseBackend` : les LECTURES viennent d'un cache
 * hydraté depuis le cloud (synchrone pour l'UI), les ÉCRITURES vont à Supabase
 * puis se répercutent dans le cache. La frontière de la tranche M3 :
 *   • le CONDUCTEUR connecté (`selfUserId`) écrit DURABLEMENT — il s'attache à son
 *     chantier via la RPC sécurisée `app_add_self_as` ;
 *   • les identités FABRIQUÉES (client démo) et leurs écritures restent en cache
 *     LOCAL (aperçu) — jamais poussées au cloud (la RLS les refuserait).
 *
 * On injecte un CLIENT SIMULÉ (aucun réseau) qui journalise `from()` et `rpc()`.
 * On vérifie la LOGIQUE d'aiguillage durable/local, pas la base réelle.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'saas-')), 'saas.mjs');
execFileSync(
  ESBUILD,
  [
    join(root, 'apps/demo/src/lib/saasBackend.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${outFile}`,
    '--log-level=error',
    // Les défines Vite (injectées au build réel) — valeurs factices ici.
    '--define:__APP_VERSION__="test"',
    '--define:__APP_COMMIT__="test"',
    '--define:__APP_BUILD_TIME__="test"',
  ],
  { cwd: root },
);
const { SaaSBackend } = await import(outFile);

/* ------------------------------ Client simulé ----------------------------- */
// Journalise chaque requête (`from(...).…`) et chaque `rpc(...)`. `responder`
// renvoie { data, error } selon la requête ; `rpcResponder` selon l'appel RPC.
function mockClient(responder, rpcResponder = () => ({ data: null, error: null })) {
  const log = [];
  const rpcLog = [];
  const builder = (table) => {
    const chain = {
      table,
      select: null,
      insert: null,
      update: null,
      delete: false,
      eq: [],
      order: null,
      single: false,
      maybe: false,
    };
    const b = {
      select(cols) {
        chain.select = cols ?? '*';
        return b;
      },
      insert(v) {
        chain.insert = v;
        return b;
      },
      update(v) {
        chain.update = v;
        return b;
      },
      delete() {
        chain.delete = true;
        return b;
      },
      eq(col, val) {
        chain.eq.push([col, val]);
        return b;
      },
      order(col, opts) {
        chain.order = [col, opts];
        return b;
      },
      single() {
        chain.single = true;
        return b;
      },
      maybeSingle() {
        chain.maybe = true;
        return b;
      },
      then(resolve, reject) {
        log.push(chain);
        return Promise.resolve()
          .then(() => responder(chain))
          .then(resolve, reject);
      },
    };
    return b;
  };
  const client = {
    from: (t) => builder(t),
    rpc: (name, params) => {
      rpcLog.push({ name, params });
      return Promise.resolve(rpcResponder(name, params));
    },
  };
  return { client, log, rpcLog };
}

const ISO = '2026-07-19T10:00:00.000Z';
const SELF = 'user-self';
const projectRow = (over = {}) => ({
  id: 'p-1',
  code: '26-LY-003',
  name: 'Chantier Test',
  client_id: 'c-1',
  status: 'en_cours',
  current_step: null,
  created_at: ISO,
  ...over,
});
const eventRow = (over = {}) => ({
  id: 'e-1',
  project_id: 'p-1',
  type: 'compte_rendu',
  author_id: SELF,
  author_role: 'compagnon',
  visibility: 'interne',
  state: 'publie',
  capture_id: null,
  created_at: ISO,
  published_by: SELF,
  published_at: ISO,
  content: { texte: 'ok' },
  ...over,
});
const memberRow = (over = {}) => ({
  id: 'm-1',
  project_id: 'p-1',
  user_id: SELF,
  role: 'compagnon',
  created_at: ISO,
  ...over,
});

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

/* -- hydrate : charge projets + membres + événements dans le cache --------- */
await check(
  'hydrate : peuple le cache (projets, membres, événements) depuis le cloud',
  async () => {
    const { client } = mockClient((chain) => {
      if (chain.table === 'project') return { data: [projectRow()], error: null };
      if (chain.table === 'project_member') return { data: [memberRow()], error: null };
      if (chain.table === 'event') return { data: [eventRow()], error: null };
      return { data: [], error: null };
    });
    const be = new SaaSBackend(client, SELF);
    await be.hydrate();
    const snap = be.snapshot();
    assert(
      snap.projects.length === 1 && snap.projects[0].clientId === 'c-1',
      'projet non hydraté/remappé',
    );
    assert(snap.members.length === 1, 'membre non hydraté');
    assert(snap.events.length === 1, 'événement non hydraté');
  },
);

/* -- hydrate : tolérant à l'échec réseau (cache vide, pas d'exception) ----- */
await check('hydrate : un échec réseau laisse un cache vide, sans jeter', async () => {
  const { client } = mockClient(() => ({ data: null, error: { message: 'network down' } }));
  const be = new SaaSBackend(client, SELF);
  await be.hydrate(); // ne doit pas jeter
  assert(be.snapshot().projects.length === 0, 'devrait démarrer sur un cache vide');
});

/* -- createProject : durable (insert cloud) + présent dans le cache -------- */
await check('createProject : insère au cloud et apparaît dans le cache', async () => {
  const { client, log } = mockClient((chain) => {
    if (chain.select === 'code' && !chain.insert) return { data: [], error: null };
    if (chain.insert)
      return { data: projectRow({ id: 'p-new', code: chain.insert.code }), error: null };
    return { data: null, error: null };
  });
  const be = new SaaSBackend(client, SELF);
  const p = await be.createProject({ name: 'Nouveau', address: '1 rue X, 75001 Paris' });
  assert(
    log.some((c) => c.insert && c.table === 'project'),
    'aucun insert projet au cloud',
  );
  assert(
    be.snapshot().projects.some((x) => x.id === p.id),
    'projet absent du cache',
  );
});

/* -- addMember(self) : passe par la RPC sécurisée + entre au cache --------- */
await check('addMember(conducteur) : appelle app_add_self_as et met en cache', async () => {
  const { client, rpcLog } = mockClient(() => ({ data: null, error: null }));
  const be = new SaaSBackend(client, SELF);
  const m = await be.addMember({ projectId: 'p-1', userId: SELF, role: 'compagnon' });
  assert(rpcLog.length === 1 && rpcLog[0].name === 'app_add_self_as', 'RPC bootstrap non appelée');
  assert(
    rpcLog[0].params.p_project === 'p-1' && rpcLog[0].params.p_role === 'compagnon',
    'params RPC incorrects',
  );
  assert(
    be.snapshot().members.some((x) => x.userId === SELF),
    'membre conducteur absent du cache',
  );
});

/* -- addMember(autre) : PAS de RPC, cache local seulement ----------------- */
await check('addMember(client fabriqué) : aucune écriture cloud, cache local', async () => {
  const { client, rpcLog, log } = mockClient(() => ({ data: null, error: null }));
  const be = new SaaSBackend(client, SELF);
  await be.addMember({ projectId: 'p-1', userId: 'client-x', role: 'client' });
  assert(rpcLog.length === 0, 'ne doit PAS appeler la RPC pour une identité fabriquée');
  assert(
    !log.some((c) => c.table === 'project_member' && c.insert),
    'ne doit PAS insérer au cloud',
  );
  assert(
    be.snapshot().members.some((x) => x.userId === 'client-x'),
    'membre local absent du cache',
  );
});

/* -- appendEvent(auteur = conducteur) : durable (insert cloud) ------------- */
await check('appendEvent(conducteur) : écrit DURABLEMENT au cloud', async () => {
  const { client, log } = mockClient((chain) => ({
    data: eventRow({ ...chain.insert, id: 'e-durable' }),
    error: null,
  }));
  const be = new SaaSBackend(client, SELF);
  await be.appendEvent({
    projectId: 'p-1',
    type: 'compte_rendu',
    actor: { userId: SELF, role: 'compagnon' },
    visibility: 'interne',
    state: 'publie',
    content: { texte: 'avancé' },
  });
  assert(
    log.some((c) => c.table === 'event' && c.insert),
    'événement conducteur non écrit au cloud',
  );
  assert(
    be.snapshot().events.some((e) => e.id === 'e-durable'),
    'événement durable absent du cache',
  );
});

/* -- appendEvent(auteur = client) : aperçu LOCAL, pas de cloud ------------- */
await check('appendEvent(client) : aperçu local, aucune écriture cloud', async () => {
  const { client, log } = mockClient(() => ({ data: null, error: null }));
  const be = new SaaSBackend(client, SELF);
  const ev = await be.appendEvent({
    projectId: 'p-1',
    type: 'demande',
    actor: { userId: 'client-x', role: 'client' },
    visibility: 'client',
    state: 'ouverte',
    content: { question: 'q', destinataire: 'client' },
  });
  assert(
    !log.some((c) => c.table === 'event' && c.insert),
    'ne doit PAS écrire l’événement client au cloud',
  );
  assert(
    be.snapshot().events.some((e) => e.id === ev.id),
    'aperçu local absent du cache',
  );
});

/* -- listProjects / listEvents : servis depuis le cache (pas de réseau) ---- */
await check('listProjects / listEvents : lus dans le cache, sans requête réseau', async () => {
  const { client, log } = mockClient((chain) => {
    if (chain.table === 'project') return { data: [projectRow()], error: null };
    if (chain.table === 'project_member') return { data: [], error: null };
    if (chain.table === 'event') return { data: [eventRow()], error: null };
    return { data: [], error: null };
  });
  const be = new SaaSBackend(client, SELF);
  await be.hydrate();
  const before = log.length;
  const projects = await be.listProjects();
  const events = await be.listEvents('p-1');
  assert(projects.length === 1 && events.length === 1, 'lecture cache incorrecte');
  assert(log.length === before, 'les lectures ne doivent PAS refaire de requête réseau');
});

/* -- deleteProject : supprime au cloud + purge le cache lié --------------- */
await check(
  'deleteProject : supprime au cloud et purge le cache (membres/événements)',
  async () => {
    const { client, log } = mockClient((chain) => {
      if (chain.table === 'project' && chain.select) return { data: [projectRow()], error: null };
      if (chain.table === 'project_member') return { data: [memberRow()], error: null };
      if (chain.table === 'event') return { data: [eventRow()], error: null };
      return { data: null, error: null };
    });
    const be = new SaaSBackend(client, SELF);
    await be.hydrate();
    await be.deleteProject('p-1');
    assert(
      log.some((c) => c.table === 'project' && c.delete),
      'suppression cloud absente',
    );
    const snap = be.snapshot();
    assert(
      snap.projects.length === 0 && snap.members.length === 0 && snap.events.length === 0,
      'cache non purgé',
    );
  },
);

const passed = results.filter(Boolean).length;
console.log(`\n=== BACKEND SaaS — ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
