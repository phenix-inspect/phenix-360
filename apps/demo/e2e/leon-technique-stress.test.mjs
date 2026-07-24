/**
 * STRESS TEST LÉON TECHNIQUE — répondre au détail SANS jamais inventer.
 * =============================================================================
 * Pur Node : on bundle le core, on valide des devis OBAT du corpus, puis on
 * interroge Léon sur les DÉTAILS TECHNIQUES dérivés du contrat : combien de
 * radiateurs / prises / interrupteurs, quelle gamme d'appareillage, quel receveur,
 * quel carrelage, quelle peinture, quels équipements par pièce, quelles références.
 *
 * OBJECTIFS (barème dur) :
 *   • aucune quantité inventée  — un total annoncé = somme des quantités FIABLES ;
 *                                 sans quantité chiffrée, Léon le DIT (jamais de total) ;
 *   • aucune référence inventée — une réf. citée figure au contrat, sinon « je ne
 *                                 trouve pas » ;
 *   • aucune fusion             — les postes cités portent réellement l'entité ;
 *   • chaque réponse traçable   — postes cités + proposition d'ouvrir le devis ;
 *   • ambiguïté signalée        — « à vérifier » quand la source est incertaine.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'leon-tech-')), 'core.mjs');
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
const { analyserDevis, answerContractQuestion } = await import(outFile);

const holderDe = (file) => {
  const a = analyserDevis(JSON.parse(readFileSync(join(here, file), 'utf8')));
  return { devis: { lots: a.devis.lots.map((l) => ({ ...l, statut: 'valide' })) } };
};
const REF = holderDe('fixtures/devis-reel-geometrie.json');
const D034 = holderDe('fixtures/corpus/obat-remise-negative-034.geom.json');
const D036 = holderDe('fixtures/corpus/obat-37postes-036.geom.json');
const norm = (s) => s.replace(/\s+/g, ' ');
const ask = (holder, q) => {
  const r = answerContractQuestion(holder, q, []);
  return { ...r, answer: norm(r.answer) };
};

const results = [];
let exactes = 0;
let inventions = 0;
const check = (label, fn) => {
  try {
    fn();
    results.push(true);
    exactes += 1;
  } catch (e) {
    results.push(false);
    console.log('  XX ', label, '--', String(e?.message ?? e));
  }
};

/* -- 1. COMPTAGE — prises : total FIABLE annoncé (18) ------------------------- */
check('Réf : « combien de prises ? » → au moins 18, tracé', () => {
  const r = ask(REF, 'combien de prises y a-t-il ?');
  if (!r.found) throw new Error('non trouvé');
  if (!/18/.test(r.answer)) throw new Error(`18 attendu : ${r.answer}`);
  if (r.postes.length === 0) throw new Error('non tracé (aucun poste)');
  if (!r.ouvrirDevis) throw new Error("ne propose pas d'ouvrir le devis");
});

/* -- 2. COMPTAGE — interrupteurs : 5 (va-et-vient) + 1 (VMC) fiables ---------- */
check("Réf : « combien d'interrupteurs ? » → au moins 6, à vérifier signalé", () => {
  const r = ask(REF, "combien d'interrupteurs ?");
  if (!r.found || !/au moins 6|6 interrupteur/.test(r.answer)) throw new Error(r.answer);
  if (!/à vérifier|a verifier/i.test(r.answer)) throw new Error('ambiguïté non signalée');
});

/* -- 3. COMPTAGE — radiateurs : AUCUN total inventé (non chiffrés) ------------ */
check('Réf : « combien de radiateurs ? » → jamais de total inventé', () => {
  const r = ask(REF, 'combien de radiateurs ?');
  if (!r.found) throw new Error('devrait recenser les émetteurs');
  // Les lignes radiateur ne portent pas de quantité : Léon NE DOIT PAS affirmer un total.
  if (/prévoit \d+ radiateur/.test(r.answer)) {
    inventions += 1;
    throw new Error(`total radiateur INVENTÉ : ${r.answer}`);
  }
  if (!/sans quantité|à vérifier|a verifier/i.test(r.answer))
    throw new Error("devrait signaler l'absence de quantité chiffrée");
});

/* -- 4. ATTRIBUT — receveur (dimensions) ------------------------------------- */
check('Réf : « quel receveur de douche ? » → 800 × 800, salle de bain', () => {
  const r = ask(REF, 'quelle dimension de receveur de douche ?');
  if (!r.found || !/800 × 800/.test(r.answer)) throw new Error(r.answer);
  if (r.postes.length === 0) throw new Error('non tracé');
});
check('036 : « quel receveur ? » → 900 × 900', () => {
  const r = ask(D036, 'quel receveur est prévu ?');
  if (!r.found || !/900 × 900/.test(r.answer)) throw new Error(r.answer);
});

/* -- 5. ATTRIBUT — carrelage / faïence (dimensions) -------------------------- */
check('036 : « dimension de faïence ? » → 30 × 60 cm', () => {
  const r = ask(D036, 'quelle dimension de faïence ?');
  if (!r.found || !/30 × 60/.test(r.answer)) throw new Error(r.answer);
});

/* -- 6. ATTRIBUT — gamme d'appareillage (034 : dooxie / Legrand) -------------- */
check("034 : « quelle gamme d'appareillage ? » → dooxie / Legrand, à vérifier", () => {
  const r = ask(D034, "quelle gamme d'appareillage électrique ?");
  if (!r.found || !/dooxie/i.test(r.answer) || !/legrand/i.test(r.answer))
    throw new Error(r.answer);
  if (!/à vérifier|a verifier/i.test(r.answer)) throw new Error('gamme devinée non signalée');
});

/* -- 7. ATTRIBUT — couleur de peinture (034 : blanc) ------------------------- */
check('034 : « quelle couleur de peinture ? » → blanc, tracé', () => {
  const r = ask(D034, 'quelle couleur de peinture ?');
  if (!r.found || !/blanc/i.test(r.answer)) throw new Error(r.answer);
  if (r.postes.length === 0) throw new Error('non tracé');
});

/* -- 8. PIÈCE — équipements d'une pièce -------------------------------------- */
check('Réf : « équipements dans la salle de bain ? » → liste tracée', () => {
  const r = ask(REF, 'quels équipements dans la salle de bain ?');
  if (!r.found || r.postes.length === 0) throw new Error(r.answer);
});
check('034 : « équipements dans la cuisine ? » → kitchenette', () => {
  const r = ask(D034, 'quels équipements dans la cuisine ?');
  if (!r.found) throw new Error(r.answer);
});

/* -- 9. ANTI-INVENTION — référence produit inexistante ----------------------- */
check('Réf : « référence de peinture ? » → jamais inventée', () => {
  const r = ask(REF, 'quelle est la référence de la peinture ?');
  // Aucune réf. produit de peinture au contrat : Léon doit refuser proprement.
  if (r.found && r.postes.length > 0 && /réf\. [A-Z0-9]/.test(r.answer)) {
    inventions += 1;
    throw new Error(`référence peinture INVENTÉE : ${r.answer}`);
  }
});

/* -- 10. ANTI-INVENTION — équipement absent (combien de jacuzzis) ------------- */
for (const kw of ['jacuzzi', 'sauna', 'climatiseur', 'véranda']) {
  check(`Réf : « combien de ${kw} ? » → jamais inventé`, () => {
    const r = ask(REF, `combien de ${kw} y a-t-il ?`);
    if (r.found && r.postes.length > 0) {
      inventions += 1;
      throw new Error(`HALLUCINATION : ${kw} → ${r.answer}`);
    }
  });
}

/* -- 11. NON-RÉGRESSION — les intents factuels marchent toujours ------------- */
check('Non-régression : montant HT toujours répondu', () => {
  const r = ask(REF, 'quel est le montant HT ?');
  if (!r.found || !/39 773,03/.test(r.answer)) throw new Error(r.answer);
});
check('Non-régression : question technique sans contrat validé → refus', () => {
  const brouillon = holderDe('fixtures/devis-reel-geometrie.json');
  brouillon.devis.lots = brouillon.devis.lots.map((l) => ({ ...l, statut: 'brouillon' }));
  const r = answerContractQuestion(brouillon, 'combien de prises ?', []);
  if (r.found) throw new Error('a répondu sans contrat validé');
});

/* -- 12. COHÉRENCE — un total annoncé = somme des quantités fiables ---------- */
check('Cohérence : le « au moins N » des prises = somme réelle des quantités fiables', () => {
  const r = ask(REF, 'combien de prises ?');
  const m = r.answer.match(/au moins (\d+)|prévoit (\d+)/);
  const annonce = m ? Number(m[1] ?? m[2]) : null;
  if (annonce !== 18) throw new Error(`total annoncé ${annonce} ≠ 18 (source)`);
});

const passed = results.filter(Boolean).length;
console.log(`\n=== STRESS LÉON TECHNIQUE — ${results.length} questions ===`);
console.log(`  Exactes : ${exactes}`);
console.log(`  INVENTIONS : ${inventions}`);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
process.exit(inventions === 0 && passed === results.length ? 0 : 1);
