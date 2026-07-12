/**
 * Tests UNITAIRES du moteur de transcription contractuelle (packages/core).
 * =============================================================================
 * Pur Node (aucun navigateur) : on bundle `contract.ts` via esbuild puis on
 * vérifie l'extraction STRUCTURÉE des postes (lots → postes chiffrés), les
 * niveaux de confiance, et la RÉCONCILIATION des totaux (un écart doit être
 * détecté et empêcher toute validation aveugle). Motif : « une mauvaise
 * transcription est plus dangereuse qu'une absence de transcription ».
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const pnpmDir = join(root, 'node_modules/.pnpm');
const esbuildPkg = readdirSync(pnpmDir).find((d) => /^esbuild@/.test(d));
if (!esbuildPkg) throw new Error('esbuild introuvable dans node_modules/.pnpm');
const ESBUILD = join(pnpmDir, esbuildPkg, 'node_modules/esbuild/bin/esbuild');

const outFile = join(mkdtempSync(join(tmpdir(), 'contract-core-')), 'core.mjs');
execFileSync(
  ESBUILD,
  [
    join(root, 'packages/core/src/contract.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${outFile}`,
    '--log-level=error',
  ],
  { cwd: root },
);
const { extractDevisContract, reconcileTotals, contratValide, contratEnBrouillon } = await import(
  outFile
);

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
  if (a !== b) throw new Error(`${m ?? ''} attendu ${b}, obtenu ${a}`);
};

/** Devis « Phenix-amo » COHÉRENT (Σ lignes = Total net HT). */
const COHERENT = [
  'N° DÉSIGNATION QTÉ U. PRIX U. TVA TOTAL HT',
  '1 1. INSTALLATION / PREPARATION 850,00 €',
  '1.1 Installation de chantier, protection des sols',
  '1,00 u 850,00 € 10,00 % 850,00 €',
  '2 2. PLOMBERIE / SANITAIRE 2 000,00 €',
  '2.1 Remplacement receveur et robinetterie',
  '1,00 forfait 2 000,00 € 10,00 % 2 000,00 €',
  '3 3. PEINTURE 1 150,00 €',
  '3.1 Peinture murs et plafonds sejour',
  '50,00 m2 23,00 € 10,00 % 1 150,00 €',
  'Total net HT 4 000,00 €',
  'TVA 10,00 % 400,00 €',
  'Total TTC 4 400,00 €',
].join('\n');

check('Extrait les lots et postes STRUCTURÉS (pas de simples libellés)', () => {
  const { devis, postesCount } = extractDevisContract(COHERENT);
  if (!devis) throw new Error('aucun devis structuré produit');
  eq(devis.lots.length, 3, 'nombre de lots');
  eq(postesCount, 3, 'nombre de postes');
  const p = devis.lots[0].postes[0];
  eq(p.label, 'Installation de chantier, protection des sols', 'libellé poste');
  eq(p.quantite, 1, 'quantité');
  eq(p.unite, 'u', 'unité');
  eq(p.prixUnitaireHT, 850, 'prix unitaire');
  eq(p.montantHT, 850, 'montant HT');
  eq(p.tva, 10, 'TVA');
});

check('Chaque poste chiffré porte un niveau de confiance', () => {
  const { devis, confidence } = extractDevisContract(COHERENT);
  for (const lot of devis.lots)
    for (const poste of lot.postes)
      eq(poste.confidence, 'eleve', `confiance de « ${poste.label} »`);
  eq(confidence, 100, 'confiance globale');
});

check('Réconciliation des totaux : COHÉRENT quand Σ lignes = total HT déclaré', () => {
  const { reconciliation } = extractDevisContract(COHERENT);
  eq(reconciliation.sommeLignesHT, 4000, 'somme des lignes');
  eq(reconciliation.totalHTDeclare, 4000, 'total HT déclaré');
  eq(reconciliation.ecartHT, 0, 'écart');
  eq(reconciliation.coherent, true, 'cohérence');
});

check('Réconciliation : INCOHÉRENCE détectée (ne jamais valider en aveugle)', () => {
  // Même devis mais le total déclaré ne correspond pas à la somme des lignes.
  const bad = COHERENT.replace('Total net HT 4 000,00 €', 'Total net HT 9 166,67 €');
  const { reconciliation } = extractDevisContract(bad);
  eq(reconciliation.coherent, false, 'devrait être incohérent');
  if (!(reconciliation.ecartHT > 5000)) throw new Error('écart non calculé');
});

check('Poste sans valeurs lues → montant absent + confiance faible (jamais inventé)', () => {
  const partial = [
    '1 1. DEMOLITION 1 900,00 €',
    '1.1 Depose cuisine existante, carrelage et parquet',
    'Total net HT 1 900,00 €',
  ].join('\n');
  const { devis } = extractDevisContract(partial);
  const p = devis.lots[0].postes[0];
  eq(p.montantHT, 0, 'montant non inventé');
  eq(p.confidence, 'faible', 'confiance faible');
});

check('Lot sans poste détaillé → poste forfaitaire = total du lot', () => {
  const forfait = ['3 3. ELECTRICITE 5 802,78 €', 'Total net HT 5 802,78 €'].join('\n');
  const { devis } = extractDevisContract(forfait);
  eq(devis.lots.length, 1, 'un lot');
  const p = devis.lots[0].postes[0];
  eq(p.montantHT, 5802.78, 'montant forfait');
  eq(p.unite, 'forfait', 'unité forfait');
});

check('Texte sans tableau exploitable → aucun devis (rien inventé)', () => {
  const { devis, postesCount } = extractDevisContract('Bonjour, ceci n’est pas un devis.');
  if (devis) throw new Error('un devis a été fabriqué à tort');
  eq(postesCount, 0, 'aucun poste');
});

check('reconcileTotals sans total déclaré → cohérent (pas de contradiction)', () => {
  const r = reconcileTotals(undefined, undefined, undefined);
  eq(r.coherent, true, 'cohérent par défaut');
  eq(r.sommeLignesHT, 0, 'somme vide');
});

check('Gating : brouillon NON exploitable, validé exploitable, legacy (sans statut) validé', () => {
  const devis = { lots: [] };
  eq(contratValide({ devis, devisStatut: 'brouillon' }), false, 'brouillon non valide');
  eq(contratEnBrouillon({ devis, devisStatut: 'brouillon' }), true, 'brouillon détecté');
  eq(contratValide({ devis, devisStatut: 'valide' }), true, 'validé exploitable');
  eq(contratValide({ devis }), true, 'legacy (sans statut) exploitable');
  eq(contratValide({}), false, 'pas de devis → non exploitable');
});

const passed = results.filter(Boolean).length;
console.log(`\n=== ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
