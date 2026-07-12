/**
 * CORPUS DE FIABILISATION du moteur natif de lecture des devis (packages/core).
 * =============================================================================
 * Pur Node (aucun navigateur) : on bundle `devis-geometry.ts` via esbuild, puis
 * on l'éprouve sur un CORPUS avec VÉRITÉ ATTENDUE et métriques :
 *
 *   1. Le VRAI devis (9 pages, 13 lots), géométrie réelle anonymisée. On vérifie
 *      les 3 bugs corrigés : descriptions complètes (non tronquées), exclusion
 *      « … N'EST PAS INCLUSE » écartée du contrat, ligne de ventilation TVA non
 *      inventée en prestation. Objectifs : 0 ligne inventée, 100 % des montants
 *      réconciliés, aucune option intégrée sans validation.
 *   2. Des cas SYNTHÉTIQUES construits à la main (mise en page générique) pour
 *      prouver que les règles sont génériques et non calées sur un seul devis :
 *      colonnes, description multi-lignes, exclusion, option, tableau TVA, pied
 *      de page répété.
 *
 * Motif : « une mauvaise lecture est plus dangereuse qu'une absence de lecture ».
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
if (!esbuildPkg) throw new Error('esbuild introuvable dans node_modules/.pnpm');
const ESBUILD = join(pnpmDir, esbuildPkg, 'node_modules/esbuild/bin/esbuild');

const outFile = join(mkdtempSync(join(tmpdir(), 'devis-geo-')), 'geo.mjs');
execFileSync(
  ESBUILD,
  [
    join(root, 'packages/core/src/devis-geometry.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${outFile}`,
    '--log-level=error',
  ],
  { cwd: root },
);
const { analyserDevisGeo, CONFIANCE_LABEL } = await import(outFile);

const results = [];
const check = (label, fn) => {
  try {
    fn();
    results.push(true);
    console.log('  OK ', label);
  } catch (e) {
    results.push(false);
    console.log('  XX ', label, '--', String(e?.message ?? e));
  }
};
const eq = (a, b, m) => {
  if (a !== b)
    throw new Error(`${m ?? ''} attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`);
};
const ok = (cond, m) => {
  if (!cond) throw new Error(m);
};
const postes = (devis) => devis.lots.flatMap((l) => l.postes);

/* ========================================================================== *
 * 1) LE VRAI DEVIS (géométrie réelle anonymisée) — vérité attendue
 * ========================================================================== */
const reel = JSON.parse(readFileSync(join(here, 'fixtures/devis-reel-geometrie.json'), 'utf8'));
const A = analyserDevisGeo(reel);

check('Devis réel : moteur natif utilisé (pas de repli texte)', () => {
  eq(A.fallbackTexte, false, 'fallbackTexte');
  ok(A.devis != null, 'un devis structuré est produit');
});

check('Devis réel : 13 lots et 21 prestations (aucune ligne inventée)', () => {
  eq(A.devis.lots.length, 13, 'nombre de lots');
  eq(postes(A.devis).length, 21, 'nombre de prestations');
  eq(A.metriques.postesConstruits, 21, 'métrique postes');
});

check('Bug corrigé n°1 : descriptions COMPLÈTES (multi-lignes reconstruites)', () => {
  const cloison = postes(A.devis).find((p) => /cloison de distribution/i.test(p.label));
  ok(cloison != null, 'poste cloison trouvé');
  // La description tenait sur ~4 lignes : elle doit être reconstituée en entier.
  ok(cloison.label.length > 90, `libellé exact trop court: ${cloison.label.length}`);
  ok(/comprenant/i.test(cloison.label), 'le corps de description « comprenant … » est perdu');
  ok(cloison.libelleCourt && cloison.libelleCourt.length <= 71, 'libellé court manquant/long');
  ok(
    cloison.libelleCourt.length < cloison.label.length,
    'le libellé court doit résumer le libellé exact',
  );
});

check('Bug corrigé n°2 : exclusion « N’EST PAS INCLUSE » écartée du contrat', () => {
  eq(A.exclusions.length, 1, 'une exclusion détectée');
  ok(/PORTE|INCLUSE|N['’]EST PAS/i.test(A.exclusions[0].texte), 'texte exclusion');
  // Aucune prestation ne doit reprendre l'exclusion.
  ok(
    !postes(A.devis).some((p) => /N['’]EST PAS INCLUSE|PORTE D['’]ENTREE/i.test(p.label)),
    'une exclusion a été prise pour une prestation',
  );
});

check('Bug corrigé n°3 : ventilation TVA NON inventée en prestation', () => {
  // La ligne « 5,5 % 3 859,00 € 212,25 € » ne doit jamais devenir un poste.
  ok(
    !postes(A.devis).some((p) => /3\s*859|212,25/.test(p.label) || p.montantHT === 212.25),
    'une ligne de ventilation TVA est devenue une prestation',
  );
});

check('Devis réel : montants 100 % réconciliés (HT et TTC)', () => {
  eq(A.reconciliation.sommeLignesHT, 39773.03, 'somme des lignes HT');
  eq(A.reconciliation.totalHTDeclare, 39773.03, 'total HT déclaré');
  eq(A.reconciliation.totalTTCDeclare, 43993.35, 'total TTC déclaré');
  eq(A.reconciliation.ecartHT, 0, 'écart HT');
  eq(A.reconciliation.coherent, true, 'cohérence');
});

check('Devis réel : contrôles de cohérence tous au vert', () => {
  const parId = Object.fromEntries(A.controles.map((c) => [c.id, c]));
  eq(parId['reconciliation-ht'].gravite, 'ok', 'montants');
  eq(parId['comptage-lignes'].gravite, 'ok', 'comptage');
  ok(parId['prix-orphelin'] == null, 'aucun prix orphelin attendu');
  ok(parId['qte-pu-montant'] == null, 'aucun écart quantité × prix attendu');
});

check('Devis réel : traçabilité (page source + confiance) sur chaque poste', () => {
  for (const p of postes(A.devis)) {
    ok(typeof p.sourcePage === 'number' && p.sourcePage >= 1, `page source manquante: ${p.label}`);
    ok(CONFIANCE_LABEL[p.verification] != null, `confiance illisible: ${p.verification}`);
  }
});

check('Devis réel : chaque lot démarre en BROUILLON (validation humaine requise)', () => {
  for (const lot of A.devis.lots) eq(lot.statut, 'brouillon', `statut lot ${lot.label}`);
});

/* ========================================================================== *
 * 2) CORPUS SYNTHÉTIQUE — prouve que les règles sont GÉNÉRIQUES
 * ========================================================================== */
// Colonnes (x gauche) reproduisant une mise en page de devis colonné quelconque.
const COL = { num: 24, des: 58, qte: 290, uni: 320, prix: 400, tva: 450, total: 528 };
let yCursor = 800;
/** Fabrique les mots d'une ligne à partir de cellules {num,des,qte,uni,prix,tva,total}. */
function ligne(cells) {
  const y = yCursor;
  yCursor -= 14;
  const toks = [];
  const put = (x, s) => {
    if (s != null && String(s).length) toks.push({ x, y, w: String(s).length * 5, str: String(s) });
  };
  put(COL.num, cells.num);
  put(COL.des, cells.des);
  put(COL.qte, cells.qte);
  put(COL.uni, cells.uni);
  put(COL.prix, cells.prix);
  put(COL.tva, cells.tva);
  put(COL.total, cells.total);
  return toks;
}
function page(page, rows) {
  yCursor = 800;
  return { page, width: 595, height: 842, tokens: rows.flatMap((r) => ligne(r)) };
}

const synth = [
  page(1, [
    { num: 'N°', des: 'DÉSIGNATION', qte: 'QTÉ', uni: 'U.', prix: 'PRIX U.', tva: 'TVA', total: 'TOTAL HT' },
    { num: '1', des: 'MAConnerIE', total: '1 500,00 €' },
    { num: '1.1', des: "Ouverture d'un mur porteur", qte: '1,00', uni: 'u', prix: '1 500,00 €', tva: '10,00 %', total: '1 500,00 €' },
    { des: 'comprenant étaiement, linteau et reprise' }, // complément multi-ligne
    { des: 'des enduits sur les deux faces' },
    { des: '- Linteau béton préfabriqué' }, // matériau (ignoré du contrat)
    { num: '2', des: 'PEINTURE', total: '2 000,00 €' },
    { num: '2.1', des: 'Peinture murs et plafonds', qte: '100,00', uni: 'm²', prix: '20,00 €', tva: '10,00 %', total: '2 000,00 €' },
    { num: '2.2', des: 'OPTION : rehausse teinte prestige', qte: '1,00', uni: 'u', prix: '300,00 €', tva: '10,00 %', total: '300,00 €' },
    { num: '2.3', des: "ATTENTION : le mobilier n'est pas inclus", qte: '1,00', uni: 'u', prix: '0,00 €', tva: '10,00 %', total: '0,00 €' },
  ]),
  page(2, [
    // Totaux + ventilation TVA + pied de page répété : rien ne doit devenir un poste.
    { des: 'Total net HT', prix: '', total: '3 500,00 €' },
    { des: 'Total TTC', total: '3 850,00 €' },
    { qte: '10 %', prix: '3 500,00 €', total: '350,00 €' }, // ventilation TVA
    { des: 'Phenix — RCS Nancy — Page 2 sur 2' }, // pied de page
  ]),
];
const S = analyserDevisGeo(synth);

check('Synthétique : moteur natif, 2 lots, 3 prestations (option incluse, exclusion exclue)', () => {
  eq(S.fallbackTexte, false, 'fallbackTexte');
  eq(S.devis.lots.length, 2, 'lots');
  // 2.1, 2.2 (option), 1.1 = 3 prestations ; 2.3 = exclusion.
  eq(postes(S.devis).length, 3, 'prestations');
  eq(S.exclusions.length, 1, 'exclusion écartée');
});

check('Synthétique : OPTION détectée et jamais intégrée sans validation', () => {
  eq(S.options.length, 1, 'une option');
  const opt = postes(S.devis).find((p) => p.option);
  ok(opt != null && /rehausse teinte/i.test(opt.label), 'poste option marqué');
  const ctrlOpt = S.controles.find((c) => c.id === 'options');
  ok(ctrlOpt != null, 'contrôle « options » présent');
});

check('Synthétique : complément multi-ligne rattaché, matériau ignoré', () => {
  const maco = postes(S.devis).find((p) => /mur porteur/i.test(p.label));
  ok(/comprenant étaiement/i.test(maco.label), 'complément non rattaché');
  ok(/deux faces/i.test(maco.label), '2e ligne de complément perdue');
  ok(!/Linteau béton/i.test(maco.label), 'un matériau a été intégré au libellé contractuel');
});

check('Synthétique : totaux / ventilation TVA / pied de page → aucune prestation', () => {
  ok(
    !postes(S.devis).some((p) => /total|RCS|Page 2/i.test(p.label) || p.montantHT === 350),
    'un bloc non contractuel est devenu une prestation',
  );
  eq(S.reconciliation.totalHTDeclare, 3500, 'total HT déclaré lu');
  // La somme RÉCONCILIÉE exclut l'option (300 €) : elle colle au total du vendeur.
  eq(S.reconciliation.sommeLignesHT, 3500, 'somme des lignes fermes (hors option)');
  eq(S.reconciliation.coherent, true, 'cohérent une fois l’option écartée');
});

check('Synthétique : PDF non colonné → repli sur le lecteur texte', () => {
  // Une page où tout est sur une seule colonne (x identique) : pas d'en-tête colonné.
  const plat = {
    page: 1,
    width: 595,
    height: 842,
    tokens: [
      { x: 50, y: 800, w: 200, str: 'Devis de rénovation' },
      { x: 50, y: 786, w: 200, str: '1.1 Peinture 1 000,00 €' },
    ],
  };
  const R = analyserDevisGeo([plat]);
  eq(R.fallbackTexte, true, 'doit demander le repli texte');
  ok(R.devis == null, 'aucun devis produit par la géométrie');
});

const passed = results.filter(Boolean).length;
console.log(`\n=== ${passed}/${results.length} PASS (corpus devis géométrie) ===`);
process.exit(passed === results.length ? 0 : 1);
