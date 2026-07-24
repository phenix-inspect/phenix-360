/**
 * CORPUS TECHNIQUE — la couche DÉRIVÉE ne trahit jamais le contrat (packages/core).
 * =============================================================================
 * Pur Node : on bundle le core, on dérive `detailsTechniques` de CHAQUE devis OBAT
 * du corpus, et on vérifie les GARANTIES DE SÉCURITÉ de la dérivation :
 *   • aucune quantité inventée   — toute `quantité` figure telle quelle dans son
 *                                  `extraitSource` (jamais recalculée) ;
 *   • aucune référence inventée  — toute `référence` figure dans son extrait ;
 *   • aucune fusion de prestations — l'extrait d'un détail provient EXACTEMENT du
 *                                  poste (label + sous-listes) auquel il est rattaché ;
 *   • ambiguïté signalée         — une quantité tronquée / absente ⇒ « À vérifier » ;
 *   • traçabilité                — chaque détail porte posteId + page + extrait.
 * Puis une VÉRITÉ ÉTABLIE À LA MAIN sur le devis de référence, 034 et 036
 * (radiateurs, prises, receveur, faïence, gamme, couleur, référence produit).
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
const outFile = join(mkdtempSync(join(tmpdir(), 'dt-')), 'core.mjs');
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
const { analyserDevis, deriverDetailsContrat, deriverDetailsPoste, agregerBesoins } = await import(
  outFile
);

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

/* -- Corpus : tous les devis OBAT géométriques + le devis de référence -------- */
const corpusDir = join(here, 'fixtures/corpus');
const fixtures = [
  ...readdirSync(corpusDir)
    .filter((f) => f.endsWith('.geom.json'))
    .map((f) => join(corpusDir, f)),
  join(here, 'fixtures/devis-reel-geometrie.json'),
];

const derive = (file) => {
  const a = analyserDevis(JSON.parse(readFileSync(file, 'utf8')));
  const src = new Map();
  for (const lot of a.devis.lots)
    for (const p of lot.postes) src.set(p.id, `${p.label} ${(p.detailsSource ?? []).join(' ')}`);
  return { a, details: deriverDetailsContrat(a.devis), src };
};

/* -- 1. GARANTIES DE SÉCURITÉ sur TOUT le corpus ------------------------------ */
let totalDetails = 0;
for (const file of fixtures) {
  const nom = file.split('/').pop();
  const { details, src } = derive(file);
  totalDetails += details.length;

  check(`[${nom}] aucune quantité inventée`, () => {
    for (const d of details) {
      if (d.quantité == null) continue;
      const virgule = String(d.quantité).replace('.', ',');
      if (!d.extraitSource.includes(String(d.quantité)) && !d.extraitSource.includes(virgule))
        throw new Error(`quantité ${d.quantité} absente de « ${d.extraitSource} »`);
    }
  });

  check(`[${nom}] aucune référence inventée`, () => {
    for (const d of details) {
      if (!d.référence) continue;
      const dansSource = d.extraitSource
        .replace(/\s/g, '')
        .toLowerCase()
        .includes(d.référence.replace(/\s/g, '').toLowerCase());
      if (!dansSource) throw new Error(`référence « ${d.référence} » absente de son extrait`);
    }
  });

  check(`[${nom}] aucune fusion : extrait ⊂ poste d'origine`, () => {
    for (const d of details) {
      const source = src.get(d.posteId) ?? '';
      // Le fragment de l'extrait doit provenir EXACTEMENT du poste rattaché.
      const frag = d.extraitSource.slice(0, 20);
      if (!source.includes(frag))
        throw new Error(`extrait « ${frag}… » étranger au poste ${d.posteId}`);
    }
  });

  check(`[${nom}] ambiguïté signalée (quantité tronquée ⇒ À vérifier)`, () => {
    for (const d of details) {
      const tronquee = /\(\s*[\d.,]+\s*$/.test(d.extraitSource) && !/\)\s*$/.test(d.extraitSource);
      if (tronquee && d.niveauConfiance !== 'À vérifier')
        throw new Error(`quantité tronquée non signalée : « ${d.extraitSource} »`);
    }
  });

  check(`[${nom}] traçabilité complète (poste + extrait)`, () => {
    for (const d of details) {
      if (!d.posteId || !d.lotLabel || !d.extraitSource.trim())
        throw new Error(`détail non tracé : ${JSON.stringify(d).slice(0, 80)}`);
      if (!['Fiable', 'À vérifier'].includes(d.niveauConfiance))
        throw new Error(`niveau de confiance invalide : ${d.niveauConfiance}`);
    }
  });
}

check('Le corpus a bien produit des détails (couche non vide)', () => {
  if (totalDetails < 200) throw new Error(`trop peu de détails dérivés : ${totalDetails}`);
});

/* -- 2. VÉRITÉ À LA MAIN — devis de référence (13 lots) ----------------------- */
const REF = derive(join(here, 'fixtures/devis-reel-geometrie.json')).details;
const trouver = (list, kw) => list.filter((d) => d.libellé.toLowerCase().includes(kw));

check('Réf : 18 prises de courant 2P+T (quantité fiable)', () => {
  const p = trouver(REF, 'prise de courant 2p+t').find((d) => d.quantité === 18);
  if (!p || p.unité !== 'u' || p.niveauConfiance !== 'Fiable') throw new Error('prise 18u absente');
});
check('Réf : 5 interrupteurs va-et-vient (quantité fiable)', () => {
  const p = trouver(REF, 'va-et-vient').find((d) => d.quantité === 5);
  if (!p || p.niveauConfiance !== 'Fiable') throw new Error('interrupteur 5u absent');
});
check('Réf : receveur de douche 800 × 800 mm (dimensions lues)', () => {
  const r = trouver(REF, 'receveur').find((d) => /800 × 800/.test(d.dimensions ?? ''));
  if (!r) throw new Error('receveur 800×800 absent');
  if (r.pièce !== 'Salle de bain') throw new Error(`pièce inattendue : ${r.pièce}`);
});
check('Réf : famille radiateur/chauffage présente (panneaux + sèche-serviettes)', () => {
  const rads = REF.filter((d) =>
    /panneau rayonnant|seche serviette|radiateur/.test(
      d.libellé.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
    ),
  );
  if (rads.length < 4) throw new Error(`radiateurs attendus ≥ 4, trouvé ${rads.length}`);
  // Aucun total inventé : aucune quantité « u » fiable n'est affirmée sur ces lignes.
  if (rads.some((d) => d.niveauConfiance === 'Fiable' && d.unité === 'u'))
    throw new Error("quantité radiateur inventée (aucune n'est chiffrée à la source)");
});
check('Réf : référence produit PR00064660 tracée', () => {
  const r = REF.find((d) => d.référence === 'PR00064660');
  if (!r) throw new Error('référence PR00064660 non extraite');
});

/* -- 3. VÉRITÉ À LA MAIN — 036 (faïence, receveur) ---------------------------- */
const D036 = derive(join(corpusDir, 'obat-37postes-036.geom.json')).details;
check('036 : faïence 30 × 60 cm (dimension de la description)', () => {
  const f = D036.find((d) => /30 × 60/.test(d.dimensions ?? ''));
  if (!f) throw new Error('faïence 30×60 absente');
});
check('036 : receveur 900 × 900 mm (sous-liste)', () => {
  const r = D036.find((d) => d.libellé.toLowerCase().includes('receveur'));
  if (!r || !/900 × 900/.test(r.dimensions ?? '')) throw new Error('receveur 900×900 absent');
});

/* -- 4. VÉRITÉ À LA MAIN — 034 (gamme / marque / couleur) --------------------- */
const D034 = derive(join(corpusDir, 'obat-remise-negative-034.geom.json')).details;
check('034 : gamme « dooxie » / marque « Legrand » (appareillage)', () => {
  const g = D034.find((d) => d.libellé.toLowerCase() === 'dooxie');
  if (!g || g.marque !== 'Legrand') throw new Error('gamme dooxie/Legrand absente');
  if (g.niveauConfiance !== 'À vérifier') throw new Error('gamme devinée doit être « À vérifier »');
});
check('034 : couleur « blanc » (peinture)', () => {
  const c = D034.find((d) => d.type === 'couleur' && d.couleur === 'blanc');
  if (!c) throw new Error('couleur blanc absente');
});

/* -- 5. Agrégation « besoins » : prépare sans inventer ------------------------ */
check('Besoins agrégés : prises additionnées seulement quand fiables', () => {
  const besoins = agregerBesoins(REF);
  const prise = besoins.find((b) => b.libellé.toLowerCase().includes('prise de courant 2p+t'));
  if (!prise || prise.quantitéTotale !== 18) throw new Error('agrégat prise ≠ 18');
  const rad = besoins.find((b) => /panneau rayonnant/.test(b.libellé.toLowerCase()));
  if (rad && rad.quantitéTotale != null) throw new Error("total radiateur inventé dans l'agrégat");
});

/* -- 6. Le libellé contractuel N'EST JAMAIS modifié par la dérivation --------- */
check('La dérivation ne touche pas le libellé contractuel', () => {
  const a = analyserDevis(
    JSON.parse(readFileSync(join(here, 'fixtures/devis-reel-geometrie.json'), 'utf8')),
  );
  for (const lot of a.devis.lots)
    for (const p of lot.postes) {
      const avant = p.label;
      deriverDetailsPoste(p, lot.label);
      if (p.label !== avant) throw new Error('libellé contractuel muté par la dérivation !');
    }
});

const passed = results.filter(Boolean).length;
console.log(`\n=== CORPUS TECHNIQUE — ${totalDetails} détails dérivés ===`);
console.log(`=== ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
