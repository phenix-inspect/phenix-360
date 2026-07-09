/**
 * Léon V3 — BATTERIE D'INTENTIONS (pur Node, sans navigateur).
 * ===========================================================================
 * On teste le CERVEAU directement (packages/core/phenix.ts) sur des dizaines de
 * formulations naturelles : synonymes, tournures courantes, fautes de frappe.
 * Objectif : chaque question part vers la BONNE source, jamais au hasard, et une
 * information absente donne « je ne trouve pas » (jamais une mauvaise réponse).
 *
 * Le core est en TypeScript (ESM, specifiers .js) : on le bundle à la volée avec
 * le binaire esbuild déjà présent dans node_modules, puis on l'importe.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
// Localise le binaire esbuild (node_modules/.pnpm/esbuild@x/.../bin/esbuild).
const pnpmDir = join(root, 'node_modules/.pnpm');
const esbuildPkg = readdirSync(pnpmDir).find((d) => /^esbuild@/.test(d));
if (!esbuildPkg) throw new Error('esbuild introuvable dans node_modules/.pnpm');
const ESBUILD = join(pnpmDir, esbuildPkg, 'node_modules/esbuild/bin/esbuild');

const outFile = join(mkdtempSync(join(tmpdir(), 'leon-core-')), 'core.mjs');
execFileSync(
  ESBUILD,
  [
    join(root, 'packages/core/src/phenix.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${outFile}`,
    '--log-level=error',
  ],
  { cwd: root },
);
const { askPhenix } = await import(outFile);

/* --------------------------- Fixture réaliste ---------------------------- */
const CHANTIER_ADDRESS = '8 rue Vauban, 69006 Lyon';
const doc = (id, libelle) => ({
  id,
  type: 'document',
  state: 'publie',
  visibility: 'client',
  createdAt: '2026-06-01T10:00:00.000Z',
  content: { libelle },
});
const events = [
  doc('devis1', 'Devis plomberie — lot sanitaire'),
  doc('facture1', "Facture d'acompte n°1"),
  {
    id: 'cr1',
    type: 'compte_rendu',
    state: 'publie',
    visibility: 'client',
    createdAt: '2026-06-02T10:00:00.000Z',
    content: { etapeConfirmee: 'second_oeuvre', docTitre: 'Compte rendu de chantier' },
  },
  // Décision client en attente (todo).
  {
    id: 'dec1',
    type: 'demande',
    state: 'ouverte',
    visibility: 'client',
    createdAt: '2026-06-03T10:00:00.000Z',
    actor: { role: 'compagnon' },
    content: { question: 'Valider le carrelage de la salle de bain', destinataire: 'client' },
  },
  // Document demandé au client (documents_manquants).
  {
    id: 'docreq1',
    type: 'demande',
    state: 'ouverte',
    visibility: 'client',
    createdAt: '2026-06-04T10:00:00.000Z',
    actor: { role: 'compagnon' },
    content: {
      question: "Merci de transmettre votre attestation d'assurance habitation",
      destinataire: 'client',
      attendu: 'document',
      docLibelle: "Attestation d'assurance",
    },
  },
  // Demande du client à PHÉNIX, en attente de réponse (demande_status).
  {
    id: 'dem1',
    type: 'demande',
    state: 'ouverte',
    visibility: 'client',
    createdAt: '2026-06-05T10:00:00.000Z',
    actor: { role: 'client' },
    content: { question: 'Est-il possible de décaler la réception ?', destinataire: 'phenix' },
  },
];
const dossier = {
  orders: [
    { id: 'o1', label: 'Cuisine équipée', statut: 'commandee', dateLivraisonEstimee: '2026-07-14' },
  ],
  selections: [
    { id: 's1', categorie: 'Carrelage', label: 'Carrelage sol', statut: 'a_choisir' },
    { id: 's2', categorie: 'Peinture', label: 'Peinture murs', statut: 'valide', detail: 'Blanc' },
  ],
  planning: [
    { id: 'p1', label: 'Plomberie', start: '2026-06-15', end: '2026-06-30' },
    { id: 'p2', label: 'Réception', start: '2026-08-14', end: '2026-08-14' },
  ],
  devis: { id: 'dv' },
  avenants: [],
};
const artisans = [
  { nom: 'Martin Plomberie', trade: 'Plombier' },
  { nom: 'Léa Peinture', trade: 'Peintre' },
];
const base = {
  events,
  dossier,
  moments: [],
  zones: [],
  history: [],
  chantierAddress: CHANTIER_ADDRESS,
  chantierName: 'Appartement Lyon 6e',
  clientName: 'Mme Martin',
  statutLabel: 'En cours',
  artisans,
};
const ask = (question, history = []) => askPhenix({ ...base, question, history });

/* ------------------------------ Mini-harness ----------------------------- */
let passed = 0;
const results = [];
const check = (label, fn) => {
  try {
    fn();
    passed++;
    results.push(true);
    console.log('  OK ', label);
  } catch (e) {
    results.push(false);
    console.log('  XX ', label, '--', e.message);
  }
};
// Helpers d'assertion sur une réponse.
const say = (q, re, hist) => () => {
  const r = ask(q, hist);
  if (!re.test(r.message)) throw new Error(`« ${q} » → ${r.kind}: ${r.message.slice(0, 90)}`);
};
const notSay = (q, re) => () => {
  const r = ask(q);
  if (re.test(r.message))
    throw new Error(`« ${q} » ne devrait pas dire : ${r.message.slice(0, 90)}`);
};
const escalates = (q) => () => {
  const r = ask(q);
  if (r.kind !== 'escalade')
    throw new Error(`« ${q} » aurait dû escalader (${r.message.slice(0, 60)})`);
};
const answers = (q) => () => {
  const r = ask(q);
  if (r.kind !== 'reponse') throw new Error(`« ${q} » aurait dû répondre, pas escalader`);
};
const hasButton = (q, re) => () => {
  const r = ask(q);
  if (!r.action || !re.test(r.action.label))
    throw new Error(`« ${q} » sans bouton attendu (${r.action?.label ?? 'aucun'})`);
};

/* ------------------------- ADRESSE : chantier ≠ PHÉNIX -------------------- */
check(
  'adresse chantier — formulation directe',
  say('Quelle est l’adresse du chantier ?', /8 rue Vauban/),
);
check('adresse chantier — « où est le chantier »', say('Où est le chantier ?', /8 rue Vauban/));
check(
  'adresse chantier — « mon appartement »',
  say('À quelle adresse est mon appartement ?', /8 rue Vauban/),
);
check(
  'adresse chantier — « où intervenez-vous »',
  say('Où intervenez-vous exactement ?', /8 rue Vauban/),
);
check(
  'adresse chantier ≠ commande',
  notSay('Quelle est l’adresse du chantier ?', /cuisine|commande/i),
);
check(
  'adresse PHÉNIX — « votre adresse »',
  say('C’est quoi votre adresse ?', /adresse de PHÉNIX/i),
);
check(
  'adresse PHÉNIX — « adresse de PHÉNIX »',
  say('Quelle est l’adresse de PHÉNIX ?', /adresse de PHÉNIX/i),
);
check('adresse PHÉNIX — « vos bureaux »', say('Où sont vos bureaux ?', /adresse de PHÉNIX/i));

/* ----------------------------- COORDONNÉES PHÉNIX ------------------------ */
check('téléphone PHÉNIX', say('Quel est votre téléphone ?', /01 84 80 00 00/));
check('téléphone — « votre numéro »', say('C’est quoi votre numéro ?', /01 84 80 00 00/));
check(
  'téléphone — « comment vous joindre »',
  say('Comment puis-je vous joindre ?', /01 84 80 00 00/),
);
check('email PHÉNIX', say('Quel est votre email ?', /contact@phenix360\.fr/));
check('email — « votre mail »', say('C’est quoi votre mail ?', /contact@phenix360\.fr/));
check('horaires PHÉNIX', say('Quels sont vos horaires ?', /8h30|joignable/i));
check('site internet PHÉNIX', say('Vous avez un site internet ?', /phenix360\.fr/));

/* ------------------------------- DOCUMENTS ------------------------------- */
check('devis — « montre-moi le devis »', hasButton('Montre-moi le devis', /Ouvrir.*[Dd]evis/));
check('devis — « je veux voir le devis »', hasButton('Je veux voir le devis', /Ouvrir.*[Dd]evis/));
check(
  'devis — « où est le devis signé »',
  hasButton('Où est le devis signé ?', /Ouvrir.*[Dd]evis/),
);
check(
  'facture — « je veux la facture »',
  hasButton('Je veux voir la facture', /Ouvrir.*[Ff]acture/),
);
check('facture — « mes factures »', hasButton('Montre-moi mes factures', /Ouvrir.*[Ff]acture/));
check(
  'DPE absent → « je ne trouve pas de DPE »',
  say('Montre-moi le DPE', /ne trouve pas de DPE/i),
);
check('DPE absent → propose conducteur', say('Montre-moi le DPE', /conducteur/i));
check('DPE absent → ne crée pas de bouton', () => {
  const r = ask('Montre-moi le DPE');
  if (r.action) throw new Error(`DPE absent ne devrait pas ouvrir : ${r.action.label}`);
});
check(
  'assurance absente → « je ne trouve pas »',
  say('Je voudrais voir l’attestation d’assurance', /ne trouve pas de assurance/i),
);

/* -------------------------------- PLANNING ------------------------------- */
check(
  'réception — « quand est la réception »',
  say('Quand est la réception ?', /réception.*(prévue|planifiée) autour du/i),
);
check(
  'réception — « c’est quand la réception »',
  say('C’est quand la réception ?', /réception.*(prévue|planifiée) autour du/i),
);
check(
  'planning — « quand intervient le plombier »',
  say('Quand intervient le plombier ?', /Plomberie.*autour du/i),
);
check('planning — « prochaine étape »', answers('Quelle est la prochaine étape ?'));

/* ------------------------------- COMMANDES ------------------------------- */
check(
  'commande — « quand arrive ma cuisine »',
  say('Quand arrive ma cuisine ?', /Cuisine équipée/),
);
check(
  'commande — « ma cuisine est livrée quand »',
  say('Ma cuisine est livrée quand ?', /Cuisine équipée/),
);

/* ------------------------- AUJOURD’HUI / CHOIX / DEMANDES ----------------- */
check(
  'todo — « qu’est-ce que je dois faire »',
  say('Qu’est-ce que je dois faire ?', /action|attend|carrelage|décision/i),
);
check(
  'todo — « il me reste quoi à faire »',
  say('Il me reste quoi à faire ?', /action|attend|carrelage|décision/i),
);
check(
  'todo ≠ date de réception',
  notSay('Qu’est-ce qu’il me reste à faire ?', /réception.*autour du/i),
);
check(
  'choix restants — « qu’est-ce qu’il me reste à choisir »',
  say('Qu’est-ce qu’il me reste à choisir ?', /Carrelage/),
);
check(
  'choix validés — « qu’ai-je déjà validé »',
  say('Qu’est-ce que j’ai déjà validé ?', /Peinture/),
);
check(
  'documents manquants — « quels documents manquent »',
  say('Quels documents me manquent ?', /assurance/i),
);
check(
  'demande status — « où en est ma demande »',
  say('Où en est ma demande ?', /transmise|attente|réponse/i),
);
check('demande status ≠ avancement chantier', () => {
  const r = ask('Où en est mon chantier ?');
  if (/demande/i.test(r.message) && /transmise/i.test(r.message))
    throw new Error('« mon chantier » routé vers demande_status');
});

/* -------------------------------- ARTISANS ------------------------------- */
check(
  'artisans — « qui travaille sur mon chantier »',
  say('Qui travaille sur mon chantier ?', /Martin Plomberie|Plombier/),
);
check('artisans — « qui sont les artisans »', say('Qui sont les artisans ?', /Peintre|Plombier/));
check('artisans ≠ timing (planning gère « quand »)', () => {
  const r = ask('Quand intervient le plombier ?');
  if (/coordonnés par votre conducteur/i.test(r.message))
    throw new Error('« quand le plombier » routé vers artisans au lieu du planning');
});

/* ----------------------------- ESCALADES CIBLÉES ------------------------- */
check('problème technique — « j’ai une fissure »', escalates('J’ai une fissure dans le mur'));
check('problème — « il y a une fuite »', escalates('Il y a une fuite sous l’évier'));
check(
  'modification — « je veux déplacer la réception »',
  escalates('Je voudrais déplacer la réception'),
);
check('modification — « peut-on décaler »', escalates('Peut-on décaler la réception ?'));
check(
  'administratif — « je n’ai plus les clés »',
  escalates('Je n’ai plus les clés, comment récupérer'),
);
check('parler à un humain', escalates('Je voudrais parler à quelqu’un'));
check('prix — « combien ça coûte »', escalates('Combien ça coûte au total ?'));

/* ------------------------ INFO ABSENTE / CHARABIA ------------------------ */
check(
  'conducteur (nom) — n’invente pas',
  say('Comment s’appelle mon conducteur ?', /conducteur de travaux PHÉNIX/i),
);
check(
  'conducteur (nom) — ne donne pas un numéro',
  notSay('Comment s’appelle mon conducteur ?', /01 84 80/),
);
check('charabia → « je ne trouve pas »', say('azerty qsdfgh wxcvbn', /trouv/i));
check('charabia → n’ouvre aucun document', () => {
  const r = ask('azerty qsdfgh wxcvbn');
  if (r.action) throw new Error(`charabia a produit un bouton : ${r.action.label}`);
});
check('remerciement → réponse chaleureuse (pas de doc)', () => {
  const r = ask('Merci beaucoup');
  if (r.action || /retrouvé/i.test(r.message))
    throw new Error(`« merci » a produit un document : ${r.message.slice(0, 60)}`);
});
check('salutation → accueil', say('Bonjour', /Bonjour/));

/* --------------------------- FAUTES DE FRAPPE ---------------------------- */
check('faute — « adrese du chantier »', say('c est quoi l adrese du chantier', /8 rue Vauban/));
check('faute — « telephone » sans accents', say('votre telephone svp', /01 84 80 00 00/));

/* -------------------------------- MÉMOIRE -------------------------------- */
check('mémoire — « et l’avenant ? » suit « montre le devis »', () => {
  // « et l'avenant ? » est une relance de continuité → intention documentaire.
  const r = ask('Et l’avenant ?', [{ role: 'client', texte: 'Montre-moi le devis' }]);
  if (r.kind !== 'reponse') throw new Error('la relance a escaladé au lieu de rester documentaire');
});

/* --------------------------------- Photos -------------------------------- */
check('photo jointe → transmise au conducteur (jamais à l’aveugle)', () => {
  const r = askPhenix({ ...base, question: 'Voici une photo du salon', hasPhotos: true });
  if (r.kind !== 'escalade') throw new Error('une photo jointe doit être transmise au conducteur');
});

console.log(`\n=== ${passed}/${results.length} PASS ===`);
process.exit(results.every(Boolean) ? 0 : 1);
