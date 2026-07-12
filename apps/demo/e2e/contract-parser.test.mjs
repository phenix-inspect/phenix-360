/**
 * Tests UNITAIRES du moteur d'analyse & vérification du devis (packages/core).
 * =============================================================================
 * Pur Node (aucun navigateur) : on bundle `contract.ts` via esbuild puis on
 * vérifie l'extraction STRUCTURÉE des postes (lots → postes chiffrés), l'état de
 * lecture par ligne (🟢 vérifié / 🟠 à vérifier / 🔴 non compris), la RÉCONCILIATION
 * des totaux, et le cycle de vie PAR LOT (statut global strict + lots exploitables).
 * Motif : « une mauvaise lecture est plus dangereuse qu'une absence de lecture ».
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
const {
  extractDevisContract,
  reconcileTotals,
  evaluerVerification,
  raisonVerification,
  contratValide,
  devisStatutGlobal,
  devisAvecLotsExploitables,
  lotsValidesCount,
  validatedDevis,
} = await import(outFile);

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
const postes = (devis) => devis.lots.flatMap((l) => l.postes);

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
  const { devis } = extractDevisContract(COHERENT);
  if (!devis) throw new Error('aucun devis structuré produit');
  eq(devis.lots.length, 3, 'nombre de lots');
  eq(postes(devis).length, 3, 'nombre de postes');
  const p = devis.lots[0].postes[0];
  eq(p.label, 'Installation de chantier, protection des sols', 'libellé poste');
  eq(p.quantite, 1, 'quantité');
  eq(p.unite, 'u', 'unité');
  eq(p.prixUnitaireHT, 850, 'prix unitaire');
  eq(p.montantHT, 850, 'montant HT');
  eq(p.tva, 10, 'TVA');
});

check('Chaque lot démarre en BROUILLON (à vérifier)', () => {
  const { devis } = extractDevisContract(COHERENT);
  for (const lot of devis.lots) eq(lot.statut, 'brouillon', `statut du lot « ${lot.label} »`);
});

check('Chaque ligne chiffrée est 🟢 vérifiée automatiquement', () => {
  const { devis } = extractDevisContract(COHERENT);
  for (const p of postes(devis)) eq(p.verification, 'verifie', `vérif de « ${p.label} »`);
});

check('evaluerVerification : montant absent → 🔴, forfait → 🟠, ligne pleine → 🟢', () => {
  eq(evaluerVerification({ montantHT: 0, tva: 0 }), 'non_compris', 'sans montant');
  eq(evaluerVerification({ montantHT: 100, tva: 0 }), 'a_verifier', 'sans TVA');
  eq(
    evaluerVerification({ montantHT: 2000, tva: 10, unite: 'forfait' }),
    'a_verifier',
    'forfait sans quantité',
  );
  eq(
    evaluerVerification({ montantHT: 850, tva: 10, quantite: 1, unite: 'u' }),
    'verifie',
    'ligne pleine',
  );
});

check('raisonVerification : explication déterministe pour les lignes non vertes', () => {
  if (raisonVerification({ montantHT: 850, tva: 10, quantite: 1 }) !== undefined)
    throw new Error('une ligne verte ne devrait pas avoir de raison');
  if (!/Montant non lu/.test(raisonVerification({ montantHT: 0, tva: 0 })))
    throw new Error('raison montant manquante');
  if (!/TVA/.test(raisonVerification({ montantHT: 100, tva: 0, quantite: 1 })))
    throw new Error('raison TVA manquante');
});

check('Réconciliation : COHÉRENT quand Σ lignes = total HT déclaré', () => {
  const { reconciliation } = extractDevisContract(COHERENT);
  eq(reconciliation.sommeLignesHT, 4000, 'somme des lignes');
  eq(reconciliation.totalHTDeclare, 4000, 'total HT déclaré');
  eq(reconciliation.ecartHT, 0, 'écart');
  eq(reconciliation.coherent, true, 'cohérence');
});

check('Réconciliation : INCOHÉRENCE détectée', () => {
  const bad = COHERENT.replace('Total net HT 4 000,00 €', 'Total net HT 9 166,67 €');
  const { reconciliation } = extractDevisContract(bad);
  eq(reconciliation.coherent, false, 'devrait être incohérent');
  if (!(reconciliation.ecartHT > 5000)) throw new Error('écart non calculé');
});

check('Ligne sans valeurs → 🔴 non compris + montant non inventé', () => {
  const partial = [
    '1 1. DEMOLITION 1 900,00 €',
    '1.1 Depose cuisine existante, carrelage et parquet',
    'Total net HT 1 900,00 €',
  ].join('\n');
  const { devis } = extractDevisContract(partial);
  const p = devis.lots[0].postes[0];
  eq(p.montantHT, 0, 'montant non inventé');
  eq(p.verification, 'non_compris', 'ligne non comprise');
});

check('Lot sans poste détaillé → poste forfaitaire 🟠 = total du lot', () => {
  const forfait = ['3 3. ELECTRICITE 5 802,78 €', 'Total net HT 5 802,78 €'].join('\n');
  const { devis } = extractDevisContract(forfait);
  eq(devis.lots.length, 1, 'un lot');
  const p = devis.lots[0].postes[0];
  eq(p.montantHT, 5802.78, 'montant forfait');
  eq(p.unite, 'forfait', 'unité forfait');
  eq(p.verification, 'a_verifier', 'forfait à vérifier');
});

check('Texte sans tableau exploitable → aucun devis (rien inventé)', () => {
  const { devis } = extractDevisContract('Bonjour, ceci n’est pas un devis.');
  if (devis) throw new Error('un devis a été fabriqué à tort');
});

check('reconcileTotals sans total déclaré → cohérent (pas de contradiction)', () => {
  const r = reconcileTotals(undefined, undefined, undefined);
  eq(r.coherent, true, 'cohérent par défaut');
  eq(r.sommeLignesHT, 0, 'somme vide');
});

check('Validation PAR LOT : statut global strict a_verifier → partiellement → valide', () => {
  const { devis } = extractDevisContract(COHERENT); // 3 lots en brouillon
  const holder = { devis };
  eq(devisStatutGlobal(holder), 'a_verifier', 'aucun lot validé');
  eq(contratValide(holder), false, 'pas encore validé');
  eq(devisAvecLotsExploitables(holder), false, 'aucun lot exploitable');
  eq(validatedDevis(holder), undefined, 'aucun devis exploitable');

  // On valide UN lot.
  devis.lots[0].statut = 'valide';
  eq(devisStatutGlobal(holder), 'partiellement_valide', 'un lot validé');
  eq(contratValide(holder), false, 'pas ENTIÈREMENT validé');
  eq(devisAvecLotsExploitables(holder), true, 'un lot exploitable');
  eq(lotsValidesCount(holder).valides, 1, '1 lot validé');
  eq(validatedDevis(holder).lots.length, 1, 'validatedDevis ne garde que le lot validé');

  // On valide TOUT.
  for (const l of devis.lots) l.statut = 'valide';
  eq(devisStatutGlobal(holder), 'valide', 'tous validés');
  eq(contratValide(holder), true, 'entièrement validé');
  eq(validatedDevis(holder).lots.length, 3, 'tous les lots exploitables');
});

check('Rétro-compat : lots SANS statut = données héritées → exploitables', () => {
  const legacy = {
    devis: {
      lots: [{ id: 'l1', label: 'X', postes: [{ id: 'p', label: 'x', montantHT: 10, tva: 10 }] }],
    },
  };
  eq(contratValide(legacy), true, 'devis hérité (sans statut) = validé');
  eq(validatedDevis(legacy).lots.length, 1, 'lot hérité exploitable');
  // Ancien brouillon global explicite → non exploitable.
  eq(contratValide({ ...legacy, devisStatut: 'brouillon' }), false, 'ancien brouillon global');
});

const passed = results.filter(Boolean).length;
console.log(`\n=== ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
