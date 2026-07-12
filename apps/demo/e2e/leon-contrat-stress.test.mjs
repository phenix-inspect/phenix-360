/**
 * STRESS TEST LÉON — le contrat validé, seule source de vérité (zéro hallucination).
 * =============================================================================
 * Pur Node : on bundle le core, on charge le devis OBAT de référence (validé), et
 * on pose 110+ questions (simples, ambiguës, pièges). On mesure : réponses exactes,
 * incomplètes (« je ne trouve pas », honnête), et surtout ZÉRO invention. Barème :
 *  • une question sur une prestation ABSENTE (jacuzzi, piscine…) doit renvoyer
 *    found=false — jamais « oui, c'est prévu » (= hallucination, échec dur) ;
 *  • une prestation PRÉSENTE citée doit réellement figurer au contrat (postes tracés) ;
 *  • une EXCLUSION (porte d'entrée) doit être annoncée « exclu », pas « prévu » ;
 *  • les totaux/lots/TVA doivent être exacts.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const pnpmDir = join(root, 'node_modules/.pnpm');
const esbuildPkg = readdirSync(pnpmDir).find((d) => /^esbuild@/.test(d));
const ESBUILD = join(pnpmDir, esbuildPkg, 'node_modules/esbuild/bin/esbuild');
const outFile = join(mkdtempSync(join(tmpdir(), 'leon-')), 'core.mjs');
execFileSync(
  ESBUILD,
  [join(root, 'packages/core/src/index.ts'), '--bundle', '--format=esm', '--platform=node', `--outfile=${outFile}`, '--log-level=error'],
  { cwd: root },
);
const { analyserDevis, answerContractQuestion } = await import(outFile);

const a = analyserDevis(
  JSON.parse(readFileSync(join(here, 'fixtures/devis-reel-geometrie.json'), 'utf8')),
);
// Contrat VALIDÉ (tous les lots validés) — la seule source dont Léon a le droit.
const holder = { devis: { lots: a.devis.lots.map((l) => ({ ...l, statut: 'valide' })) } };
const exclusions = a.exclusions;
// Normalise les espaces (les montants fr-FR utilisent une espace insécable étroite).
const norm = (s) => s.replace(/[   ]/g, ' ');
const ask = (q) => {
  const r = answerContractQuestion(holder, q, [], exclusions);
  return { ...r, answer: norm(r.answer) };
};

const results = [];
const check = (label, fn) => {
  try {
    fn();
    results.push(true);
  } catch (e) {
    results.push(false);
    console.log('  XX ', label, '--', String(e?.message ?? e));
  }
};

// Prestations RÉELLEMENT présentes au contrat de référence (mots-clés).
const PRESENTES = [
  'cuisine', 'peinture', 'carrelage', 'faïence', 'terrasse', 'électrique', 'électricité',
  'plomberie', 'agencement', 'cloison', 'isolation', 'ventilation', 'chauffe-eau', 'plinthe',
  'ragréage', 'doublage', 'installation', 'démolition', 'dépose', 'lame', 'douche', 'wc',
  'salle d\'eau', 'sols', 'sanitaire',
];
// Prestations ABSENTES (pièges : ne JAMAIS répondre « oui, c'est prévu »).
const ABSENTES = [
  'jacuzzi', 'piscine', 'véranda', 'spa', 'sauna', 'climatisation', 'pergola', 'portail',
  'ascenseur', 'panneaux solaires', 'garage', 'toiture', 'charpente', 'ravalement',
];

let exactes = 0;
let incompletes = 0;
let inventions = 0;

/* -- 1. Totaux / TVA / lots (exactitude) ---------------------------------- */
check('Montant HT exact', () => {
  const r = ask('quel est le montant HT du chantier ?');
  if (!r.found || !r.answer.includes('39 773,03')) throw new Error(r.answer);
  exactes += 1;
});
check('Montant TTC exact', () => {
  const r = ask('quel est le montant TTC ?');
  if (!r.found || !r.answer.includes('43 993,35')) throw new Error(r.answer);
  exactes += 1;
});
check('TVA détaillée (5,5 / 10 / 20)', () => {
  const r = ask('quelle TVA est appliquée ?');
  if (!r.found || !/5\.5|5,5/.test(r.answer) || !r.answer.includes('20')) throw new Error(r.answer);
  exactes += 1;
});
check('Liste des lots (13)', () => {
  const r = ask('quels sont les lots du chantier ?');
  if (!r.found || !r.answer.includes('13 lot')) throw new Error(r.answer);
  exactes += 1;
});
check('Prestation la plus chère (électrique 5 802,78)', () => {
  const r = ask('quelle est la prestation la plus chère ?');
  if (!r.found || !r.answer.includes('5 802,78')) throw new Error(r.answer);
  exactes += 1;
});
check('Avenants : aucun', () => {
  const r = ask("qu'est-ce qui a été modifié par les avenants ?");
  if (!r.found || !/aucun avenant/i.test(r.answer)) throw new Error(r.answer);
  exactes += 1;
});

/* -- 2. Exclusion (piège) : porte d'entrée -------------------------------- */
check('Exclusion : porte d\'entrée = EXCLUE (jamais « prévue »)', () => {
  const r = ask("la porte d'entrée est-elle comprise ?");
  if (!/exclu/i.test(r.answer)) throw new Error(`porte d'entrée mal classée: ${r.answer}`);
  if (/mentionne « porte/i.test(r.answer)) throw new Error('présentée comme prestation !');
  exactes += 1;
});

/* -- 3. Prestations PRÉSENTES : found=true, poste réellement cité ---------- */
const gabarits = (kw) => [
  `que prévoit le devis pour ${kw} ?`,
  `${kw} est-il compris ?`,
  `y a-t-il ${kw} dans le devis ?`,
  `quel ${kw} est prévu ?`,
];
for (const kw of PRESENTES) {
  check(`Présente « ${kw} » → trouvée & tracée`, () => {
    let ok = false;
    for (const q of gabarits(kw)) {
      const r = ask(q);
      if (r.found && r.postes.length > 0) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      incompletes += 1; // honnête (« je ne trouve pas ») mais recall imparfait
      throw new Error(`« ${kw} » non retrouvée (incomplet)`);
    }
    exactes += 1;
  });
}

/* -- 4. Prestations ABSENTES : found=false OBLIGATOIRE (anti-hallucination) - */
for (const kw of ABSENTES) {
  for (const q of [`${kw} est-il prévu ?`, `y a-t-il ${kw} ?`, `le devis prévoit-il ${kw} ?`]) {
    check(`Absente « ${kw} » → jamais inventée`, () => {
      const r = ask(q);
      // Piège : une prestation absente NE DOIT JAMAIS être présentée comme prévue.
      if (r.found && r.postes.length > 0) {
        inventions += 1;
        throw new Error(`HALLUCINATION : « ${kw} » présentée comme prévue → ${r.answer}`);
      }
      exactes += 1;
    });
  }
}

/* -- 5. Aucun contrat validé → refuse, n'invente pas ---------------------- */
check('Sans lot validé → Léon ne répond pas depuis le vide', () => {
  const brouillon = { devis: { lots: a.devis.lots.map((l) => ({ ...l, statut: 'brouillon' })) } };
  const r = answerContractQuestion(brouillon, 'quel est le montant HT ?', [], exclusions);
  if (r.found) throw new Error('a répondu sans contrat validé');
  exactes += 1;
});

const passed = results.filter(Boolean).length;
console.log(`\n=== STRESS LÉON — ${results.length} questions ===`);
console.log(`  Exactes/attendues : ${exactes}`);
console.log(`  Incomplètes (honnêtes) : ${incompletes}`);
console.log(`  HALLUCINATIONS : ${inventions}`);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
// Échec DUR sur toute hallucination ; les incomplètes (recall) ne bloquent pas si rares.
process.exit(inventions === 0 && passed >= results.length - 3 ? 0 : 1);
