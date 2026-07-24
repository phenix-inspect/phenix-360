/**
 * ADAPTATEUR SUPABASE — le port `Backend` traduit correctement en requêtes.
 * =============================================================================
 * Migration SaaS (Mission M) : `SupabaseBackend` implémente les MÊMES 12 méthodes
 * que la démo (`InMemoryBackend`). Ici, on ne parle PAS à un vrai Supabase (non
 * joignable en CI/sandbox) : on injecte un CLIENT SIMULÉ qui enregistre chaque
 * requête (table, opération, filtres, payload) et renvoie des lignes canoniques.
 *
 * On vérifie donc la LOGIQUE de l'adaptateur, indépendamment du réseau :
 *   • createProject génère le code chantier `AA-VV-NNN` et insère la bonne ligne ;
 *   • appendEvent pose `published_by/at` quand l'état est « publie » ;
 *   • resolveDemande relit puis fusionne la résolution et passe à « traitee » ;
 *   • lectures : bon tri, bons filtres, remap ligne→domaine ;
 *   • une erreur Supabase est propagée (jamais avalée en silence).
 *
 * La vérification contre une vraie base (colonnes réelles, RLS, auth) reste à
 * faire à l'activation, quand le projet Supabase existe (cf. docs/MIGRATION.md).
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
const outFile = join(mkdtempSync(join(tmpdir(), 'sb-')), 'core.mjs');
execFileSync(
  ESBUILD,
  [
    join(root, 'packages/core/src/index.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${outFile}`,
    '--log-level=error',
  ],
  { cwd: root },
);
const { SupabaseBackend } = await import(outFile);

/* ------------------------------ Client simulé ----------------------------- */
// Constructeur fluide + « thenable » (comme le PostgrestBuilder de supabase-js).
// `responder(chain)` renvoie { data, error } selon la requête enregistrée.
function mockClient(responder) {
  const log = [];
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
  return { client: { from: (t) => builder(t) }, log };
}

const ISO = '2026-07-19T10:00:00.000Z';
const projectRow = (over = {}) => ({
  id: 'p-1',
  code: '26-LY-003',
  name: 'Chantier Test',
  client_id: 'c-1',
  address: '24 rue Bugeaud, 69006 Lyon',
  status: 'en_cours',
  current_step: null,
  created_at: ISO,
  ...over,
});
const eventRow = (over = {}) => ({
  id: 'e-1',
  project_id: 'p-1',
  type: 'compte_rendu',
  author_id: 'u-1',
  author_role: 'compagnon',
  visibility: 'interne',
  state: 'brouillon',
  capture_id: null,
  created_at: ISO,
  published_by: null,
  published_at: null,
  content: { texte: 'ok' },
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

/* -- createProject : code AA-VV-NNN généré + insert conforme --------------- */
await check('createProject : génère le code chantier et insère la bonne ligne', async () => {
  const { client, log } = mockClient((chain) => {
    if (chain.select === 'code' && !chain.insert)
      return { data: [{ code: '26-LY-001' }, { code: '26-PA-002' }], error: null };
    if (chain.insert) return { data: projectRow({ code: chain.insert.code }), error: null };
    return { data: null, error: null };
  });
  const be = new SupabaseBackend(client);
  const project = await be.createProject({
    name: 'Chantier Test',
    clientId: 'c-1',
    address: '24 rue Bugeaud, 69006 Lyon',
  });
  const insert = log.find((c) => c.insert)?.insert;
  assert(insert, 'aucune requête insert enregistrée');
  assert(/^\d{2}-LY-\d{3}$/.test(insert.code), `code ville inattendu : ${insert.code}`);
  assert(insert.name === 'Chantier Test', 'nom non transmis');
  assert(insert.client_id === 'c-1', 'client_id non transmis');
  assert(insert.status === 'pas_commence', `statut par défaut attendu : ${insert.status}`);
  assert(/^\d{2}-LY-\d{3}$/.test(project.code), `code domaine invalide : ${project.code}`);
});

/* -- listProjects : tri décroissant + remap domaine ----------------------- */
await check('listProjects : trie par created_at desc et remappe (snake→camel)', async () => {
  const { client, log } = mockClient(() => ({
    data: [projectRow(), projectRow({ id: 'p-2', code: '26-PA-002' })],
    error: null,
  }));
  const be = new SupabaseBackend(client);
  const projects = await be.listProjects();
  assert(projects.length === 2, 'mauvais nombre de projets');
  assert(projects[0].clientId === 'c-1', 'client_id non remappé en clientId');
  assert(
    projects[0].address === '24 rue Bugeaud, 69006 Lyon',
    'address non remappée (colonne perdue à l’hydratation)',
  );
  const ord = log[0].order;
  assert(
    ord && ord[0] === 'created_at' && ord[1]?.ascending === false,
    'tri created_at desc absent',
  );
});

/* -- getProject : maybeSingle nul → null ---------------------------------- */
await check('getProject : absent → null (jamais une erreur)', async () => {
  const { client } = mockClient(() => ({ data: null, error: null }));
  const be = new SupabaseBackend(client);
  const p = await be.getProject('inconnu');
  assert(p === null, 'devrait renvoyer null');
});

/* -- addMember : insert project_member + remap ---------------------------- */
await check('addMember : insère (project_id,user_id,role) et remappe', async () => {
  const { client, log } = mockClient((chain) => ({
    data: {
      id: 'm-1',
      project_id: chain.insert.project_id,
      user_id: chain.insert.user_id,
      role: chain.insert.role,
      created_at: ISO,
    },
    error: null,
  }));
  const be = new SupabaseBackend(client);
  const m = await be.addMember({ projectId: 'p-1', userId: 'u-9', role: 'sous_traitant' });
  const ins = log[0].insert;
  assert(log[0].table === 'project_member', 'mauvaise table');
  assert(
    ins.project_id === 'p-1' && ins.user_id === 'u-9' && ins.role === 'sous_traitant',
    'payload membre incorrect',
  );
  assert(m.role === 'sous_traitant' && m.projectId === 'p-1', 'membre non remappé');
});

/* -- appendEvent (publié) : pose published_by/at -------------------------- */
await check('appendEvent : un événement « publie » porte published_by/at', async () => {
  const { client, log } = mockClient((chain) => ({
    data: eventRow({ ...chain.insert, id: 'e-9' }),
    error: null,
  }));
  const be = new SupabaseBackend(client);
  await be.appendEvent({
    projectId: 'p-1',
    type: 'compte_rendu',
    actor: { userId: 'u-1', role: 'compagnon' },
    visibility: 'client',
    state: 'publie',
    content: { texte: 'Chantier avancé' },
  });
  const ins = log[0].insert;
  assert(ins.state === 'publie', 'état non transmis');
  assert(ins.published_by === 'u-1', 'published_by absent alors que publié');
  assert(
    typeof ins.published_at === 'string' && ins.published_at.length > 0,
    'published_at absent',
  );
});

/* -- appendEvent (brouillon) : pas de publication ------------------------- */
await check('appendEvent : un brouillon ne porte PAS published_by/at', async () => {
  const { client, log } = mockClient((chain) => ({
    data: eventRow({ ...chain.insert, id: 'e-8' }),
    error: null,
  }));
  const be = new SupabaseBackend(client);
  await be.appendEvent({
    projectId: 'p-1',
    type: 'compte_rendu',
    actor: { userId: 'u-1', role: 'compagnon' },
    visibility: 'interne',
    state: 'brouillon',
    content: { texte: 'brouillon' },
  });
  const ins = log[0].insert;
  assert(
    ins.published_by === null && ins.published_at === null,
    'brouillon ne doit pas être publié',
  );
});

/* -- publishEvent : update état + publication ----------------------------- */
await check('publishEvent : passe à « publie » avec publieur + date', async () => {
  const { client, log } = mockClient((chain) => ({
    data: eventRow({ id: 'e-1', ...chain.update }),
    error: null,
  }));
  const be = new SupabaseBackend(client);
  await be.publishEvent('e-1', 'u-2');
  const up = log[0].update;
  assert(up.state === 'publie', 'état non passé à publie');
  assert(up.published_by === 'u-2', 'publieur absent');
  assert(
    log[0].eq.some(([c, v]) => c === 'id' && v === 'e-1'),
    'filtre id absent',
  );
});

/* -- setEventVisibility : update visibilité ------------------------------- */
await check('setEventVisibility : met à jour la seule visibilité', async () => {
  const { client, log } = mockClient((chain) => ({ data: eventRow(chain.update), error: null }));
  const be = new SupabaseBackend(client);
  await be.setEventVisibility('e-1', 'client');
  assert(log[0].update.visibility === 'client', 'visibilité non transmise');
});

/* -- resolveDemande : relit, fusionne la résolution, passe à traitee ------ */
await check('resolveDemande : fusionne la résolution et passe à « traitee »', async () => {
  const { client, log } = mockClient((chain) => {
    if (chain.select === 'type, content')
      return {
        data: { type: 'demande', content: { question: 'q', destinataire: 'client' } },
        error: null,
      };
    return { data: eventRow({ type: 'demande', state: 'traitee', ...chain.update }), error: null };
  });
  const be = new SupabaseBackend(client);
  await be.resolveDemande('e-1', { reponse: 'oui', par: 'u-1' });
  const up = log.find((c) => c.update)?.update;
  assert(up, 'aucune requête update');
  assert(up.state === 'traitee', 'état non passé à traitee');
  assert(up.content?.resolution?.reponse === 'oui', 'résolution non fusionnée');
  assert(up.content?.question === 'q', 'contenu existant non préservé');
});

/* -- resolveDemande : refuse un événement qui n'est pas une demande ------- */
await check('resolveDemande : refuse si l’événement n’est pas une demande', async () => {
  const { client } = mockClient(() => ({
    data: { type: 'compte_rendu', content: {} },
    error: null,
  }));
  const be = new SupabaseBackend(client);
  let threw = false;
  try {
    await be.resolveDemande('e-1', { reponse: 'x', par: 'u-1' });
  } catch {
    threw = true;
  }
  assert(threw, 'aurait dû refuser une non-demande');
});

/* -- deleteProject : delete filtré par id (cascade FK côté base) ----------- */
await check('deleteProject : supprime le projet filtré par id', async () => {
  const { client, log } = mockClient(() => ({ data: null, error: null }));
  const be = new SupabaseBackend(client);
  await be.deleteProject('p-1');
  assert(log[0].delete === true, 'opération delete absente');
  assert(
    log[0].eq.some(([c, v]) => c === 'id' && v === 'p-1'),
    'filtre id absent',
  );
});

/* -- Propagation d'erreur : jamais avalée -------------------------------- */
await check('Erreur Supabase : propagée (jamais silencieuse)', async () => {
  const { client } = mockClient(() => ({ data: null, error: { message: 'RLS denied' } }));
  const be = new SupabaseBackend(client);
  let msg = '';
  try {
    await be.listProjects();
  } catch (e) {
    msg = String(e?.message ?? e);
  }
  assert(/RLS denied/.test(msg), `erreur non propagée : ${msg}`);
});

const passed = results.filter(Boolean).length;
console.log(`\n=== ADAPTATEUR SUPABASE — ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
