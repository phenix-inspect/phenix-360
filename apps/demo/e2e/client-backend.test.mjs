/**
 * BACKEND MODE CLIENT — le routage des écritures du client vers les RPC gardées.
 * =============================================================================
 * `ClientSpaceBackend` sert les données de `client_space` au store (LECTURES) et
 * route les ÉCRITURES du client vers les RPC code-gardées. On injecte un CLIENT
 * SIMULÉ (aucun réseau) qui journalise chaque `rpc(name, params)` et renvoie un
 * espace client à jour. On vérifie que chaque geste du client appelle la BONNE
 * RPC avec les BONS paramètres, et que le cache se met à jour.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'client-')), 'client.mjs');
execFileSync(
  ESBUILD,
  [
    join(root, 'apps/demo/src/lib/clientSpaceBackend.ts'),
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
const { ClientSpaceBackend } = await import(outFile);

const ISO = '2026-07-19T10:00:00.000Z';
const PROJECT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CODE = 'test1234';

const eventRow = (over = {}) => ({
  id: 'e-1',
  project_id: PROJECT,
  type: 'compte_rendu',
  author_id: null,
  author_role: 'compagnon',
  visibility: 'client',
  state: 'publie',
  capture_id: null,
  created_at: ISO,
  published_by: null,
  published_at: null,
  content: { texte: 'ok' },
  ...over,
});
const space = (events) => ({
  project: {
    id: PROJECT,
    code: '26-LY-003',
    name: 'Chantier Test',
    address: 'Lyon',
    status: 'en_cours',
    current_step: null,
    created_at: ISO,
  },
  events,
});

/** Client simulé : journalise les rpc et renvoie l'espace fourni par `nextSpace`. */
function mockClient(nextSpace = null) {
  const rpcLog = [];
  const client = {
    rpc: (name, params) => {
      rpcLog.push({ name, params });
      return Promise.resolve({ data: nextSpace, error: null });
    },
  };
  return { client, rpcLog };
}

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

/* -- lectures : servies depuis le cache hydraté -------------------------- */
await check('hydrate : projet + membre client + événements depuis client_space', async () => {
  const { client } = mockClient();
  const be = new ClientSpaceBackend(client, PROJECT, CODE, space([eventRow()]));
  const snap = be.snapshot();
  assert(snap.projects.length === 1 && snap.projects[0].id === PROJECT, 'projet non hydraté');
  assert(
    snap.members.length === 1 && snap.members[0].role === 'client',
    'membre client synthétique absent',
  );
  assert(snap.events.length === 1, 'événement non hydraté');
});

/* -- répondre à une demande → client_respond_demande --------------------- */
await check('resolveDemande → client_respond_demande (bons paramètres)', async () => {
  const demande = eventRow({
    id: 'e-dem',
    type: 'demande',
    state: 'ouverte',
    author_role: 'client',
    content: { question: 'Couleur ?', destinataire: 'client' },
  });
  const traitee = eventRow({
    id: 'e-dem',
    type: 'demande',
    state: 'traitee',
    author_role: 'client',
    content: { question: 'Couleur ?', destinataire: 'client', resolution: { texte: 'Bleu' } },
  });
  const { client, rpcLog } = mockClient(space([traitee]));
  const be = new ClientSpaceBackend(client, PROJECT, CODE, space([demande]));
  await be.resolveDemande('e-dem', { texte: 'Bleu', resolvedBy: 'client', resolvedAt: ISO });
  assert(rpcLog.length === 1 && rpcLog[0].name === 'client_respond_demande', 'mauvaise RPC');
  assert(
    rpcLog[0].params.p_project === PROJECT &&
      rpcLog[0].params.p_code === CODE &&
      rpcLog[0].params.p_event === 'e-dem' &&
      rpcLog[0].params.p_texte === 'Bleu',
    'paramètres RPC incorrects',
  );
  // Le cache reflète l'espace renvoyé (demande traitée).
  assert(
    be.snapshot().events.find((e) => e.id === 'e-dem')?.state === 'traitee',
    'cache non mis à jour depuis l’espace renvoyé',
  );
});

/* -- valider un choix → client_validate_choix ---------------------------- */
await check(
  'appendEvent(decision validee) → client_validate_choix (carrier + option)',
  async () => {
    const carrier = eventRow({
      id: 'e-choix',
      type: 'decision',
      visibility: 'interne',
      content: {
        kind: 'envoyee',
        selectionId: 'sel-1',
        categorie: 'Carrelage',
        choix: { titre: 'Carrelage', options: [{ id: 'opt-b', title: 'Ardoise' }] },
      },
    });
    const { client, rpcLog } = mockClient(space([carrier]));
    const be = new ClientSpaceBackend(client, PROJECT, CODE, space([carrier]));
    await be.appendEvent({
      projectId: PROJECT,
      type: 'decision',
      actor: { userId: 'client-espace', role: 'client' },
      visibility: 'client',
      state: 'publie',
      content: { kind: 'validee', origin: 'client', selectionId: 'sel-1', optionId: 'opt-b' },
    });
    assert(rpcLog.length === 1 && rpcLog[0].name === 'client_validate_choix', 'mauvaise RPC');
    assert(
      rpcLog[0].params.p_event === 'e-choix' && rpcLog[0].params.p_option === 'opt-b',
      'carrier/option incorrects',
    );
  },
);

await check('appendEvent(decision deleguee) → client_validate_choix (délégation)', async () => {
  const carrier = eventRow({
    id: 'e-choix2',
    type: 'decision',
    visibility: 'interne',
    content: {
      kind: 'envoyee',
      selectionId: 'sel-2',
      categorie: 'Peinture',
      choix: { titre: 'Peinture', options: [] },
    },
  });
  const { client, rpcLog } = mockClient(space([carrier]));
  const be = new ClientSpaceBackend(client, PROJECT, CODE, space([carrier]));
  await be.appendEvent({
    projectId: PROJECT,
    type: 'decision',
    actor: { userId: 'client-espace', role: 'client' },
    visibility: 'client',
    state: 'publie',
    content: { kind: 'deleguee', origin: 'client', selectionId: 'sel-2' },
  });
  assert(rpcLog.length === 1 && rpcLog[0].name === 'client_validate_choix', 'mauvaise RPC');
  assert(rpcLog[0].params.p_option === '__phenix_delegate__', 'délégation non transmise');
});

/* -- Fil « Dans les coulisses » : servi par client_space ----------------- */
await check('filSnapshot : le Fil partagé est exposé depuis client_space', async () => {
  const { client } = mockClient();
  const withFil = {
    ...space([eventRow()]),
    fil: {
      moments: [{ id: 'm-shared', projectId: PROJECT, state: 'publie', visibleTo: ['client'] }],
      coups: [{ id: 'c1', momentId: 'm-shared' }],
      messages: [{ id: 'msg1', momentId: 'm-shared', texte: 'Bravo' }],
      zones: [{ id: 'z1', projectId: PROJECT, label: 'Cuisine', ordre: 0 }],
    },
  };
  const be = new ClientSpaceBackend(client, PROJECT, CODE, withFil);
  const fil = be.filSnapshot();
  assert(fil.moments.length === 1 && fil.moments[0].id === 'm-shared', 'moment partagé absent');
  assert(fil.coups.length === 1 && fil.messages.length === 1, 'coups/messages non exposés');
  assert(fil.zones.length === 1 && fil.zones[0].label === 'Cuisine', 'zones non exposées');
});

await check('filSnapshot : Fil vide par défaut (aucun champ fil dans l’espace)', async () => {
  const { client } = mockClient();
  const be = new ClientSpaceBackend(client, PROJECT, CODE, space([eventRow()]));
  const fil = be.filSnapshot();
  assert(
    fil.moments.length === 0 &&
      fil.coups.length === 0 &&
      fil.messages.length === 0 &&
      fil.zones.length === 0,
    'Fil non vide alors que l’espace n’en fournit pas',
  );
});

/* -- écrire un message → client_message ---------------------------------- */
await check('appendEvent(demande phenix) → client_message', async () => {
  const { client, rpcLog } = mockClient(space([]));
  const be = new ClientSpaceBackend(client, PROJECT, CODE, space([]));
  await be.appendEvent({
    projectId: PROJECT,
    type: 'demande',
    actor: { userId: 'client-espace', role: 'client' },
    visibility: 'client',
    state: 'ouverte',
    content: { question: 'Bonjour, une question', destinataire: 'phenix' },
  });
  assert(rpcLog.length === 1 && rpcLog[0].name === 'client_message', 'mauvaise RPC');
  assert(rpcLog[0].params.p_texte === 'Bonjour, une question', 'texte du message incorrect');
});

const passed = results.filter(Boolean).length;
console.log(`\n=== BACKEND MODE CLIENT — ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
