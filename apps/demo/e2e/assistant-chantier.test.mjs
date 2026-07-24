/**
 * ASSISTANT CHANTIER — le copilote PRÉPARE, jamais ne décide (packages/core).
 * =============================================================================
 * Pur Node : on bundle le core, on prépare l'assistant pour CHAQUE devis OBAT du
 * corpus (contrat validé) et on vérifie les GARANTIES ABSOLUES :
 *   • blocage propre sans contrat validé ;
 *   • aucun matériel / quantité / référence inventé (tout tracé jusqu'au poste) ;
 *   • quantité absente → « Quantité à confirmer » ; référence absente → « … définir » ;
 *   • aucune action déclenchée : commandes en « À vérifier / Choix client », jamais
 *     « À commander / Commandé » ; choix au statut « À analyser », options vides ;
 *   • check-list / vigilances / documents / photos tracés et prudents ;
 *   • traçabilité jusqu'à la page du devis.
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
const outFile = join(mkdtempSync(join(tmpdir(), 'assist-')), 'core.mjs');
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
const {
  analyserDevis,
  preparerAssistantChantier,
  COMMANDE_STATUTS,
  CHECKLIST_STATUTS,
  CHOIX_STATUTS,
  PRESTATION_STATUT_LABEL,
  PRESTATION_STATUT_LABEL_CLIENT,
  PRESTATION_STATUT_SHORT,
  PRERECEPTION_SYNTHESE_LABEL,
  prereceptionReference,
} = await import(outFile);

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

const corpusDir = join(here, 'fixtures/corpus');
const fixtures = [
  ...readdirSync(corpusDir)
    .filter((f) => f.endsWith('.geom.json'))
    .map((f) => join(corpusDir, f)),
  join(here, 'fixtures/devis-reel-geometrie.json'),
];

const valider = (file) => {
  const a = analyserDevis(JSON.parse(readFileSync(file, 'utf8')));
  const holder = { devis: { lots: a.devis.lots.map((l) => ({ ...l, statut: 'valide' })) } };
  const src = new Map();
  for (const lot of a.devis.lots)
    for (const p of lot.postes) src.set(p.id, `${p.label} ${(p.detailsSource ?? []).join(' ')}`);
  return { plan: preparerAssistantChantier(holder, []), src, holder };
};

/* -- 1. BLOCAGE sans contrat validé ------------------------------------------ */
check('Blocage : aucun contrat validé → plan vide, contratValide=false', () => {
  const a = analyserDevis(
    JSON.parse(readFileSync(join(here, 'fixtures/devis-reel-geometrie.json'), 'utf8')),
  );
  const brouillon = { devis: { lots: a.devis.lots.map((l) => ({ ...l, statut: 'brouillon' })) } };
  const plan = preparerAssistantChantier(brouillon, []);
  if (plan.contratValide) throw new Error('a préparé sans contrat validé');
  if (plan.materiels.length || plan.commandes.length || plan.choix.length)
    throw new Error('plan non vide alors qu’aucun lot n’est validé');
});
check('Blocage : holder absent → plan vide', () => {
  const plan = preparerAssistantChantier(undefined, []);
  if (plan.contratValide || plan.resume.materiels !== 0) throw new Error('plan non vide');
});

/* -- 2. GARANTIES sur tout le corpus ---------------------------------------- */
let totalMateriels = 0;
for (const file of fixtures) {
  const nom = file.split('/').pop();
  const { plan, src } = valider(file);
  totalMateriels += plan.materiels.length;

  check(`[${nom}] aucun matériel inventé (extrait ⊂ poste d'origine)`, () => {
    for (const m of plan.materiels)
      for (const s of m.sources) {
        const source = src.get(s.prestationSourceId) ?? '';
        const frag = s.extraitSource.slice(0, 18);
        if (!source.includes(frag))
          throw new Error(`extrait « ${frag}… » étranger au poste ${s.prestationSourceId}`);
      }
  });

  check(`[${nom}] aucune quantité inventée (figure dans un extrait)`, () => {
    for (const m of plan.materiels) {
      if (m.quantité == null) continue;
      const virgule = String(m.quantité).replace('.', ',');
      const ok = m.sources.some(
        (s) => s.extraitSource.includes(String(m.quantité)) || s.extraitSource.includes(virgule),
      );
      if (!ok)
        throw new Error(`quantité ${m.quantité} de « ${m.désignation} » introuvable à la source`);
    }
  });

  check(`[${nom}] mentions prudentes (quantité/référence absentes signalées)`, () => {
    for (const m of plan.materiels) {
      if (m.quantité == null && !m.mentions.includes('Quantité à confirmer'))
        throw new Error(`« ${m.désignation} » sans quantité mais non signalé`);
      if (!m.référence && !m.mentions.includes('Référence à définir'))
        throw new Error(`« ${m.désignation} » sans référence mais non signalé`);
    }
  });

  check(`[${nom}] AUCUNE action déclenchée (commandes en brouillon)`, () => {
    for (const c of plan.commandes) {
      if (!COMMANDE_STATUTS.includes(c.statut))
        throw new Error(`statut commande invalide: ${c.statut}`);
      if (c.statut !== 'a_verifier' && c.statut !== 'choix_client')
        throw new Error(`commande déjà « ${c.statut} » — l'assistant ne doit rien lancer`);
    }
  });

  check(`[${nom}] choix client : brouillons « À analyser », options vides, jamais envoyés`, () => {
    for (const ch of plan.choix) {
      if (!CHOIX_STATUTS.includes(ch.statut))
        throw new Error(`statut choix invalide: ${ch.statut}`);
      if (ch.statut !== 'a_analyser') throw new Error(`choix déjà « ${ch.statut} »`);
      if (ch.options.length !== 0) throw new Error('options pré-remplies (invention)');
      if (ch.niveauConfiance !== 'À vérifier') throw new Error('choix présenté comme certain');
    }
  });

  check(`[${nom}] check-list tracée & statuts valides`, () => {
    for (const c of plan.checklist) {
      if (!CHECKLIST_STATUTS.includes(c.statut))
        throw new Error(`statut checklist invalide: ${c.statut}`);
      if (!c.origineLot || !c.raison) throw new Error('élément de check-list non tracé');
    }
  });

  check(`[${nom}] vigilances prudentes (À vérifier) & photos/phase valides`, () => {
    for (const v of plan.vigilances)
      if (v.niveauConfiance !== 'À vérifier') throw new Error('vigilance affirmée sans preuve');
    const phases = ['avant', 'pendant', 'avant_fermeture', 'apres', 'controle'];
    for (const p of plan.photos)
      if (!phases.includes(p.phase)) throw new Error(`phase photo invalide: ${p.phase}`);
  });

  check(`[${nom}] résumé cohérent avec les listes`, () => {
    const r = plan.resume;
    if (
      r.materiels !== plan.materiels.length ||
      r.commandes !== plan.commandes.length ||
      r.choix !== plan.choix.length ||
      r.vigilances !== plan.vigilances.length ||
      r.documents !== plan.documents.length ||
      r.photos !== plan.photos.length
    )
      throw new Error('résumé désaligné des listes');
  });
}

check('Le corpus a produit des matériels (assistant non vide)', () => {
  if (totalMateriels < 20) throw new Error(`trop peu de matériels détectés: ${totalMateriels}`);
});

/* -- 3. VÉRITÉ À LA MAIN — devis de référence -------------------------------- */
const REF = valider(join(here, 'fixtures/devis-reel-geometrie.json')).plan;
check('Réf : 18 prises détectées (quantité fiable, référence à définir)', () => {
  const prise = REF.materiels.find(
    (m) => m.désignation.toLowerCase().includes('prise de courant 2p+t') && m.quantité === 18,
  );
  if (!prise) throw new Error('matériel « 18 prises » absent');
  if (!prise.mentions.includes('Référence à définir'))
    throw new Error('référence prise non signalée comme à définir');
});
check('Réf : receveur détecté avec dimensions 800 × 800 mm', () => {
  const r = REF.materiels.find((m) => m.désignation.toLowerCase().includes('receveur'));
  if (!r || !/800 × 800/.test(r.dimensions ?? '')) throw new Error('receveur 800×800 absent');
});
check('Réf : le Consuel figure dans les documents à récupérer', () => {
  if (!REF.documents.some((d) => /consuel/i.test(d.libellé))) throw new Error('Consuel absent');
});
check('Réf : photo « réseaux avant fermeture » recommandée', () => {
  if (!REF.photos.some((p) => /avant fermeture/i.test(p.libellé)))
    throw new Error('photo réseaux avant fermeture absente');
});
check('Réf : check-list contient le contrôle d’étanchéité avant carrelage', () => {
  if (!REF.checklist.some((c) => /étanchéité/i.test(c.libellé)))
    throw new Error('contrôle étanchéité absent de la check-list');
});

/* -- 4. STATUTS PROFESSIONNELS de pré-réception ------------------------------ */
check('Statuts professionnels (conducteur/artisan)', () => {
  if (PRESTATION_STATUT_LABEL.fait !== 'Réceptionné sans réserve')
    throw new Error(PRESTATION_STATUT_LABEL.fait);
  if (PRESTATION_STATUT_LABEL.reserve !== 'Réceptionné avec réserve')
    throw new Error(PRESTATION_STATUT_LABEL.reserve);
  if (PRESTATION_STATUT_LABEL.non_fait !== 'Non réceptionné — à réaliser')
    throw new Error(PRESTATION_STATUT_LABEL.non_fait);
  if (PRESTATION_STATUT_LABEL.moins_value !== 'Retiré du périmètre — moins-value à prévoir')
    throw new Error(PRESTATION_STATUT_LABEL.moins_value);
});
check('Statut client : « moins-value » masquée (Retiré du périmètre)', () => {
  if (PRESTATION_STATUT_LABEL_CLIENT.moins_value !== 'Retiré du périmètre')
    throw new Error(PRESTATION_STATUT_LABEL_CLIENT.moins_value);
  if (/moins-value/i.test(PRESTATION_STATUT_LABEL_CLIENT.moins_value))
    throw new Error('notion interne « moins-value » visible côté client');
});
check('Libellés courts (boutons) & synthèse professionnels', () => {
  if (PRESTATION_STATUT_SHORT.reserve !== 'Avec réserve')
    throw new Error(PRESTATION_STATUT_SHORT.reserve);
  if (PRERECEPTION_SYNTHESE_LABEL.supprimees !== 'Retirées du périmètre')
    throw new Error(PRERECEPTION_SYNTHESE_LABEL.supprimees);
});
check('Référence stable PR-AAAAMMJJ-Vx', () => {
  if (prereceptionReference('2026-07-12T10:00:00.000Z', 2) !== 'PR-20260712-V2')
    throw new Error(prereceptionReference('2026-07-12T10:00:00.000Z', 2));
});

const passed = results.filter(Boolean).length;
console.log(`\n=== ASSISTANT CHANTIER — ${totalMateriels} matériels préparés ===`);
console.log(`=== ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
