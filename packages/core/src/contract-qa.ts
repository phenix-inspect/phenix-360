/**
 * PHÉNIX 360 — LÉON RÉPOND SUR LE CONTRAT VALIDÉ (Q&A factuel, zéro hallucination)
 * =============================================================================
 * Léon (côté conducteur) répond aux questions sur le chantier en s'appuyant
 * EXCLUSIVEMENT sur le CONTRAT VALIDÉ : `validatedDevis(dossier)` + avenants. Un
 * lot non validé n'alimente jamais une réponse. Déterministe : Léon n'INVENTE
 * JAMAIS. Quand l'information existe, il répond précisément (avec la traçabilité :
 * lot, page source). Quand elle n'existe pas, il le DIT et propose d'ouvrir le
 * devis. Module PUR (aucune I/O, aucun réseau, aucun LLM).
 */
import {
  avenantImpact,
  describeAvenantImpact,
  devisTotals,
  originLabel,
  type Avenant,
  type Devis,
  type DevisPoste,
} from './devis.js';
import { validatedDevis, type ContractHolder } from './contract.js';

/** Une prestation retrouvée, avec sa traçabilité jusqu'au devis. */
export interface PosteTrouve {
  posteId: string;
  lotLabel: string;
  label: string;
  montantHT: number;
  tva: number;
  quantite?: number;
  unite?: string;
  sourcePage?: number;
  origine: string;
}

/** La réponse de Léon : factuelle, tracée, jamais inventée. */
export interface ContractAnswer {
  /** L'information existe-t-elle dans le contrat validé ? */
  found: boolean;
  /** Réponse en langage naturel (conducteur). */
  answer: string;
  /** Postes qui étayent la réponse (traçabilité — jamais de donnée hors contrat). */
  postes: PosteTrouve[];
  /** Proposer d'ouvrir le devis original (PDF). */
  ouvrirDevis: boolean;
}

/* -------------------------------------------------------------------------- *
 * Normalisation & extraction
 * -------------------------------------------------------------------------- */
const strip = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const money = (n: number): string =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Tronque un libellé pour une réponse lisible (le poste complet reste tracé). */
const court = (s: string, n = 70): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, t.lastIndexOf(' ', n))}…`;
};

/** Mots vides / interrogatifs à ignorer pour isoler l'entité recherchée. */
const STOP = new Set(
  strip(
    'le la les un une des du de d au aux a à et ou est sont il elle on prevoit prevu prevue prevus ' +
      'compris comprise comprises inclus incluse inclues dans pour quel quelle quels quelles quoi que ' +
      'qu combien y a t il ce cette mon ma mes votre vos devis chantier contrat prestation prestations ' +
      'sur avec par en plus moins cher chere fait faite total montant quelle est ',
  ).split(' '),
);

/** Forme comparable d'un mot : minuscule sans accent, singulier approché (sans « s »). */
const racine = (w: string): string => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w);

/** Isole les mots « de contenu » d'une question (entités à chercher), par racine. */
function entites(question: string): string[] {
  return strip(question)
    .split(/[^a-z0-9²µ]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w))
    .map(racine);
}

/** Ensemble des MOTS (racines) d'un texte — pour un appariement par mot entier. */
function motsDe(text: string): Set<string> {
  return new Set(
    strip(text)
      .split(/[^a-z0-9²µ]+/)
      .filter(Boolean)
      .map(racine),
  );
}

/** Une entité de la question apparaît-elle comme MOT ENTIER dans le texte ? */
const contientEntite = (mots: string[], text: string): boolean => {
  const set = motsDe(text);
  return mots.some((m) => set.has(m));
};

/** Tous les postes FERMES du contrat validé, avec traçabilité. */
function postesValides(holder: ContractHolder): PosteTrouve[] {
  const devis = validatedDevis(holder);
  if (!devis) return [];
  const out: PosteTrouve[] = [];
  for (const lot of devis.lots) {
    for (const p of lot.postes) {
      if (p.option) continue;
      out.push({
        posteId: p.id,
        lotLabel: lot.label,
        label: p.label,
        montantHT: p.montantHT,
        tva: p.tva,
        quantite: p.quantite,
        unite: p.unite,
        sourcePage: p.sourcePage,
        origine: originLabel({ kind: 'initial' }),
      });
    }
  }
  return out;
}

/** Texte cherchable d'un poste (libellé + matériaux du sourceText). */
const hay = (p: DevisPoste): string => strip(`${p.label} ${p.sourceText ?? ''}`);

/* -------------------------------------------------------------------------- *
 * Le moteur de réponse
 * -------------------------------------------------------------------------- */
const RIEN_VALIDE: ContractAnswer = {
  found: false,
  answer:
    "Aucun lot du devis n'est encore validé. Validez le devis pour que je puisse répondre à partir du contrat.",
  postes: [],
  ouvrirDevis: true,
};

/**
 * Répond à une question du conducteur À PARTIR DU CONTRAT VALIDÉ. Jamais
 * d'invention : hors du contrat, Léon le dit et propose d'ouvrir le devis.
 */
export function answerContractQuestion(
  holder: ContractHolder | null | undefined,
  question: string,
  avenants: Avenant[] = [],
  exclusions: { texte: string; page?: number }[] = [],
): ContractAnswer {
  const devis = validatedDevis(holder ?? undefined);
  if (!devis) return RIEN_VALIDE;
  const q = strip(question);
  const postes = postesValides(holder!);
  const rawPostes = devis.lots.flatMap((l) => l.postes.filter((p) => !p.option));

  // 1) MONTANTS / TVA -------------------------------------------------------
  if (/(montant|total|combien.*(cout|coute|coutent)|prix|budget|ht|ttc|tva|taux)/.test(q)) {
    const t = devisTotals(devis);
    if (/\bttc\b|toutes taxes/.test(q))
      return fait(
        `Le montant total TTC du contrat validé est de ${money(t.ttc)}.`,
        postes.slice(0, 0),
      );
    if (/tva|taux/.test(q)) {
      const detail = t.parTaux
        .map((r) => `${r.taux} % sur ${money(r.ht)} (soit ${money(r.tva)})`)
        .join(' · ');
      return fait(`TVA du contrat validé : ${detail}. Total TVA ${money(t.tva)}.`, []);
    }
    // « montant HT », « total », « combien coûte le chantier »
    return fait(
      `Contrat validé : ${money(t.ht)} HT, soit ${money(t.ttc)} TTC (TVA ${money(t.tva)}).`,
      [],
    );
  }

  // 2) LOTS -----------------------------------------------------------------
  if (/(quels?|liste|combien).*(lots?|corps d etat)|^lots\b|les lots/.test(q)) {
    const labels = devis.lots.map((l) => l.label);
    return fait(
      `Le contrat validé compte ${labels.length} lot(s) : ${labels.join(' · ')}.`,
      postes.slice(0, 0),
    );
  }

  // 3) PRESTATION LA PLUS / LA MOINS CHÈRE ----------------------------------
  if (/(plus|moins)\s+(cher|chere|couteuse|elevee|importante)/.test(q)) {
    const actifs = rawPostes.filter((p) => p.montantHT !== 0);
    if (actifs.length === 0) return introuvable(question);
    const moins = /moins/.test(q);
    const cible = actifs.reduce((a, b) =>
      (moins ? b.montantHT < a.montantHT : b.montantHT > a.montantHT) ? b : a,
    );
    const pt = postes.find((p) => p.posteId === cible.id)!;
    return fait(
      `La prestation la ${moins ? 'moins' : 'plus'} chère du contrat validé est « ${court(pt.label)} » (lot ${pt.lotLabel}) à ${money(pt.montantHT)} HT.`,
      [pt],
    );
  }

  // 4) AVENANTS -------------------------------------------------------------
  if (/(avenant|modifi|change|ajout|supprim|remplac|moins value|plus value)/.test(q)) {
    if (avenants.length === 0)
      return {
        found: true,
        answer: "Aucun avenant n'a été ajouté : le contrat validé correspond au devis initial.",
        postes: [],
        ouvrirDevis: false,
      };
    const phrases = avenants.map((av, i) =>
      describeAvenantImpact(avenantImpact(holder?.devis, avenants.slice(0, i), av)),
    );
    return fait(`${avenants.length} avenant(s) : ${phrases.join(' ')}`, []);
  }

  // 5) EXCLUSIONS -----------------------------------------------------------
  if (
    /(exclu|pas inclus|hors devis|n est pas compris|pas compris|pas prevu)/.test(q) &&
    !aEntiteForte(q)
  ) {
    return {
      found: true,
      answer:
        "Le contrat validé ne liste pas d'exclusion parmi les lots validés. Les mentions « non incluses » du devis sont écartées du contrat — je peux ouvrir le devis pour les revoir.",
      postes: [],
      ouvrirDevis: true,
    };
  }

  // 6) RECHERCHE PAR ENTITÉ (« quel carrelage », « la peinture est-elle comprise »,
  //    « que prévoit le devis pour la cuisine », « combien de radiateurs ») --------
  const mots = entites(question);
  if (mots.length > 0) {
    // 6a) L'entité correspond-elle à une EXCLUSION ? (≥ 2 mots concordants → sûr).
    for (const ex of exclusions) {
      const set = motsDe(ex.texte);
      const communs = mots.filter((m) => set.has(m));
      if (communs.length >= 2) {
        return {
          found: true,
          answer: `Non — « ${communs.join(' ')} » est EXCLU du devis : « ${ex.texte} »${ex.page ? ` (p. ${ex.page})` : ''}. Ce n'est pas au contrat.`,
          postes: [],
          ouvrirDevis: true,
        };
      }
    }
    // 6b) L'entité correspond-elle à une PRESTATION (mot entier du LIBELLÉ, des
    //     MATÉRIAUX ou du LOT) ? On cherche large mais toujours par mot entier.
    const trouves = devis.lots.flatMap((lot) =>
      lot.postes
        .filter((p) => !p.option && contientEntite(mots, `${hay(p)} ${strip(lot.label)}`))
        .map((p) => p.id),
    );
    if (trouves.length > 0) {
      const pts = trouves
        .map((id) => postes.find((x) => x.posteId === id))
        .filter((x): x is PosteTrouve => x != null);
      const sujet = mots.join(' ');
      const liste = pts
        .slice(0, 6)
        .map(
          (p) =>
            `« ${court(p.label, 55)} » (lot ${p.lotLabel}, ${money(p.montantHT)} HT${p.sourcePage ? `, p. ${p.sourcePage}` : ''})`,
        )
        .join(' · ');
      const compte = pts.length > 6 ? ` (${pts.length} prestations au total)` : '';
      // Formulation prudente : on SURFACE ce que le contrat mentionne (traçable),
      // sans sur-affirmer — le conducteur lit la prestation citée.
      return fait(`Le contrat validé mentionne « ${sujet} » : ${liste}${compte}.`, pts);
    }
    return introuvable(question);
  }

  // 7) Rien de reconnu -----------------------------------------------------
  return {
    found: false,
    answer:
      'Je ne suis pas sûr de comprendre votre question. Je réponds à partir du contrat validé (prestations, lots, montants, TVA, avenants) — je peux aussi ouvrir le devis.',
    postes: [],
    ouvrirDevis: true,
  };
}

const fait = (answer: string, postes: PosteTrouve[]): ContractAnswer => ({
  found: true,
  answer,
  postes,
  ouvrirDevis: false,
});

const introuvable = (question: string): ContractAnswer => ({
  found: false,
  answer: `Je ne trouve pas « ${strip(question).slice(0, 60)} » dans le contrat validé. Je préfère ne rien inventer — je peux ouvrir le devis pour vérifier ensemble.`,
  postes: [],
  ouvrirDevis: true,
});

/** Une entité « forte » est présente (nom de prestation) → on ne répond pas générique. */
function aEntiteForte(q: string): boolean {
  return entites(q).length > 0;
}
