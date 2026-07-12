/**
 * QUALIFICATION du moteur natif sur un CORPUS RÉEL et hétérogène (packages/core).
 * =============================================================================
 * Pur Node : on bundle `devis-geometry.ts`, puis pour CHAQUE devis réel du corpus
 * (`corpus/index.mjs`) on confronte la lecture du moteur à la VÉRITÉ ÉTABLIE À LA
 * MAIN et on mesure la batterie complète :
 *   prestations attendues / détectées · lignes oubliées · lignes inventées ·
 *   descriptions tronquées · montants incorrects · lots incorrects · options mal
 *   classées · exclusions mal classées · écarts HT / TVA / TTC.
 *
 * Les SEUILS D'ACCEPTATION sont vérifiés sur le corpus CRITIQUE (le test échoue si
 * un document régresse) : 0 prestation inventée, 0 oubliée, 0 tronquée, montants
 * exacts, lots exacts, options/exclusions bien classées, totaux lus = vérité, et
 * tout écart financier réel DÉTECTÉ (jamais masqué). Le harnais imprime enfin un
 * VERDICT DE READINESS honnête : on n'annonce « opérationnel » qu'une fois les
 * familles couvertes (natifs + scannés). Aujourd'hui, un seul devis réel est
 * disponible : le harnais grandit à mesure que le corpus est fourni.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORPUS, FAMILLES_CIBLES } from './corpus/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const pnpmDir = join(root, 'node_modules/.pnpm');
const esbuildPkg = readdirSync(pnpmDir).find((d) => /^esbuild@/.test(d));
if (!esbuildPkg) throw new Error('esbuild introuvable dans node_modules/.pnpm');
const ESBUILD = join(pnpmDir, esbuildPkg, 'node_modules/esbuild/bin/esbuild');
const outFile = join(mkdtempSync(join(tmpdir(), 'corpus-')), 'geo.mjs');
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
const { analyserDevisGeo } = await import(outFile);

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

const EUR = 0.01; // tolérance de comparaison des montants (au centime)
const has = (label, frag) => label.toLowerCase().includes(String(frag).toLowerCase());

/** Confronte une lecture du moteur à la vérité attendue → batterie de métriques. */
function mesurer(analyse, truth) {
  const fermes = analyse.devis ? analyse.devis.lots.flatMap((l) => l.postes).filter((p) => !p.option) : [];
  const optionsDetectees = analyse.options.length;
  const exclusionsDetectees = analyse.exclusions.length;

  // Appariement glouton attendu → prestation détectée (départage par montant).
  const restants = [...fermes];
  const oubliees = [];
  const tronquees = [];
  const montantsIncorrects = [];
  let apparies = 0;
  for (const att of truth.attendus ?? []) {
    const candidats = restants.filter((p) => has(p.label, att.cle));
    if (candidats.length === 0) {
      oubliees.push(att.cle);
      continue;
    }
    let pick = candidats[0];
    if (att.montantHT != null) {
      for (const c of candidats)
        if (Math.abs(c.montantHT - att.montantHT) < Math.abs(pick.montantHT - att.montantHT)) pick = c;
    }
    restants.splice(restants.indexOf(pick), 1);
    apparies += 1;
    if (att.montantHT != null && Math.abs(pick.montantHT - att.montantHT) > EUR)
      montantsIncorrects.push(`${att.cle}: attendu ${att.montantHT} obtenu ${pick.montantHT}`);
    if (att.doitContenir && !has(pick.label, att.doitContenir))
      tronquees.push(`${att.cle}: « ${att.doitContenir} » perdu`);
  }
  // Prestations détectées non rattachées à une vérité = potentiellement inventées.
  const inventees = truth.attendus ? restants.map((p) => p.label) : [];

  const r = analyse.reconciliation;
  const ttcReconstruit = r.totalTTCDeclare; // le moteur lit le TTC déclaré
  const ecartHT = r.ecartHT ?? (r.totalHTDeclare != null ? Math.abs(r.sommeLignesHT - r.totalHTDeclare) : 0);
  const tolerance = Math.max(1, (r.totalHTDeclare ?? 0) * 0.005);
  // Invariant : tout écart réel HORS tolérance doit être signalé (coherent=false).
  const ecartDetecte = ecartHT <= tolerance ? true : r.coherent === false;

  return {
    prestationsAttendues: truth.prestations,
    prestationsDetectees: fermes.length,
    oubliees,
    inventees,
    tronquees,
    montantsIncorrects,
    lotsAttendus: truth.lots,
    lotsDetectes: analyse.devis ? analyse.devis.lots.length : 0,
    optionsAttendues: truth.options,
    optionsDetectees,
    exclusionsAttendues: truth.exclusions,
    exclusionsDetectees,
    htDeclareLu: r.totalHTDeclare,
    htReconstruit: r.sommeLignesHT,
    ttcDeclareLu: ttcReconstruit,
    ecartHT,
    coherent: r.coherent,
    ecartDetecte,
    incertaines: fermes.filter((p) => p.verification !== 'verifie').length,
  };
}

/* ---- Exécution sur tout le corpus + impression du tableau de métriques ------ */
console.log(`\n===== CORPUS DE QUALIFICATION — ${CORPUS.length} document(s) =====`);
const mesures = [];
for (const entry of CORPUS) {
  // geomPath est relatif au dossier `corpus/` (là où vit le manifeste).
  const geom = JSON.parse(readFileSync(join(here, 'corpus', entry.geomPath), 'utf8'));
  const analyse = analyserDevisGeo(geom);
  const m = mesurer(analyse, entry.truth);
  mesures.push({ entry, m, fallback: analyse.fallbackTexte });
  console.log(`\n── ${entry.id}  [${entry.truth.source} · ${entry.truth.type}${entry.truth.critique ? ' · CRITIQUE' : ''}]`);
  console.log(`   prestations : attendues ${m.prestationsAttendues} · détectées ${m.prestationsDetectees}`);
  console.log(`   lignes oubliées ${m.oubliees.length} · inventées ${m.inventees.length} · tronquées ${m.tronquees.length}`);
  console.log(`   montants incorrects ${m.montantsIncorrects.length} · lots ${m.lotsDetectes}/${m.lotsAttendus}`);
  console.log(`   options ${m.optionsDetectees}/${m.optionsAttendues} · exclusions ${m.exclusionsDetectees}/${m.exclusionsAttendues}`);
  console.log(`   HT déclaré lu ${m.htDeclareLu} (vérité ${entry.truth.totalHT}) · Σ lignes ${m.htReconstruit} · écart ${m.ecartHT} · détecté ${m.ecartDetecte}`);
  console.log(`   TTC déclaré lu ${m.ttcDeclareLu} (vérité ${entry.truth.totalTTC}) · lignes incertaines signalées ${m.incertaines}`);
  if (m.oubliees.length) console.log(`   ⚠ oubliées: ${m.oubliees.join(' | ')}`);
  if (m.inventees.length) console.log(`   ⚠ inventées: ${m.inventees.join(' | ')}`);
  if (m.tronquees.length) console.log(`   ⚠ tronquées: ${m.tronquees.join(' | ')}`);
  if (m.montantsIncorrects.length) console.log(`   ⚠ montants: ${m.montantsIncorrects.join(' | ')}`);
}

/* ---- Seuils d'acceptation sur le corpus CRITIQUE ---------------------------- */
for (const { entry, m } of mesures.filter((x) => x.entry.truth.critique)) {
  const id = entry.id;
  check(`[${id}] 0 prestation inventée`, () => {
    if (m.inventees.length) throw new Error(m.inventees.join(' | '));
  });
  check(`[${id}] 0 prestation oubliée`, () => {
    if (m.oubliees.length) throw new Error(m.oubliees.join(' | '));
  });
  check(`[${id}] 0 description tronquée`, () => {
    if (m.tronquees.length) throw new Error(m.tronquees.join(' | '));
  });
  check(`[${id}] montants exacts`, () => {
    if (m.montantsIncorrects.length) throw new Error(m.montantsIncorrects.join(' | '));
  });
  check(`[${id}] lots exacts (${m.lotsAttendus})`, () => {
    if (m.lotsDetectes !== m.lotsAttendus)
      throw new Error(`détectés ${m.lotsDetectes}, attendus ${m.lotsAttendus}`);
  });
  check(`[${id}] options & exclusions bien classées`, () => {
    if (m.optionsDetectees !== m.optionsAttendues)
      throw new Error(`options ${m.optionsDetectees}/${m.optionsAttendues}`);
    if (m.exclusionsDetectees !== m.exclusionsAttendues)
      throw new Error(`exclusions ${m.exclusionsDetectees}/${m.exclusionsAttendues}`);
  });
  check(`[${id}] totaux déclarés lus = vérité (HT & TTC)`, () => {
    if (Math.abs((m.htDeclareLu ?? -1) - entry.truth.totalHT) > EUR)
      throw new Error(`HT lu ${m.htDeclareLu} ≠ ${entry.truth.totalHT}`);
    if (Math.abs((m.ttcDeclareLu ?? -1) - entry.truth.totalTTC) > EUR)
      throw new Error(`TTC lu ${m.ttcDeclareLu} ≠ ${entry.truth.totalTTC}`);
  });
  check(`[${id}] tout écart financier réel est DÉTECTÉ (jamais masqué)`, () => {
    if (!m.ecartDetecte) throw new Error(`écart ${m.ecartHT} non signalé (coherent=${m.coherent})`);
  });
}

/* ---- VERDICT DE READINESS (honnête, non asserté) ---------------------------- */
const critiques = mesures.filter((x) => x.entry.truth.critique);
const natifs = mesures.filter((x) => x.entry.truth.type === 'natif').length;
const scannes = mesures.filter((x) => x.entry.truth.type === 'scanne').length;
const zeroInvente = critiques.every((x) => x.m.inventees.length === 0);
const ecartsOk = critiques.every((x) => x.m.ecartDetecte);
console.log('\n===== VERDICT DE READINESS =====');
console.log(`  Documents réels             : ${CORPUS.length} (objectif ≥ 15)`);
console.log(`  Familles cibles             : ${FAMILLES_CIBLES.length} à couvrir`);
console.log(`  PDF natifs / scannés        : ${natifs} / ${scannes}`);
console.log(`  0 prestation inventée (crit): ${zeroInvente ? 'oui' : 'NON'}`);
console.log(`  100 % écarts détectés (crit): ${ecartsOk ? 'oui' : 'NON'}`);
const operationnel = CORPUS.length >= 15 && natifs > 0 && scannes > 0 && zeroInvente && ecartsOk;
console.log(
  `  → OPÉRATIONNEL : ${operationnel ? 'OUI' : 'NON — en attente du corpus complet (≥15 docs, natifs + scannés)'}`,
);

const passed = results.filter(Boolean).length;
console.log(`\n=== ${passed}/${results.length} PASS (qualification corpus) ===`);
process.exit(passed === results.length ? 0 : 1);
