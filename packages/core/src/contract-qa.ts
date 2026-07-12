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
import { deriverDetailsContrat, type DetailTechnique } from './details-techniques.js';

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

  // 5b) QUESTIONS TECHNIQUES (dérivées du contrat, jamais inventées) : combien de
  //     radiateurs / prises / interrupteurs, quelle gamme, quel receveur, quel
  //     carrelage, quelle peinture, équipements d'une pièce… Toujours tracé,
  //     l'ambiguïté est signalée, on propose d'ouvrir le devis.
  const tech = repondreTechnique(q, deriverDetailsContrat(devis), postes);
  if (tech) return tech;

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

/* ========================================================================== *
 * QUESTIONS TECHNIQUES — réponses DÉRIVÉES du contrat (details-techniques)
 * ========================================================================== */
/** Un CONCEPT interrogeable et les libellés techniques qui le matérialisent. */
interface ConceptTech {
  /** Mots de la question qui déclenchent ce concept. */
  mots: string[];
  /** Fragments (racines) cherchés dans le libellé des détails techniques. */
  cles: string[];
  /** Nom lisible pour la réponse. */
  nom: string;
}

const CONCEPTS_TECH: ConceptTech[] = [
  {
    mots: ['radiateur', 'chauffage', 'chauffe', 'rayonnant', 'convecteur', 'seche-serviette'],
    cles: ['radiateur', 'panneau rayonnant', 'seche serviette', 'convecteur'],
    nom: 'radiateur / émetteur de chauffage',
  },
  { mots: ['prise'], cles: ['prise'], nom: 'prise' },
  {
    mots: ['interrupteur', 'va-et-vient', 'vaetvient', 'appareillage'],
    cles: ['interrupteur', 'appareillage'],
    nom: 'interrupteur / appareillage',
  },
  { mots: ['disjoncteur'], cles: ['disjoncteur'], nom: 'disjoncteur' },
  { mots: ['receveur', 'bac'], cles: ['receveur'], nom: 'receveur de douche' },
  { mots: ['vasque', 'lavabo'], cles: ['vasque', 'lavabo'], nom: 'vasque / lavabo' },
  {
    mots: ['mitigeur', 'melangeur', 'robinet', 'robinetterie'],
    cles: ['mitigeur', 'melangeur', 'robinet'],
    nom: 'robinetterie',
  },
  { mots: ['carrelage', 'faience'], cles: ['carrelage', 'faience'], nom: 'carrelage / faïence' },
  { mots: ['peinture'], cles: ['peinture'], nom: 'peinture' },
  {
    mots: ['vmc', 'ventilation', 'bouche', 'extracteur'],
    cles: ['vmc', 'bouche', 'extracteur'],
    nom: 'ventilation',
  },
];

/** Le détail correspond-il au concept (par mot-clé de libellé) ? */
const detailMatch = (d: DetailTechnique, cles: string[]): boolean => {
  const lib = strip(d.libellé);
  return cles.some((k) => lib.includes(k));
};

/** Citation d'un détail avec sa traçabilité (poste, page) et son extrait. */
function citer(d: DetailTechnique, posteLabel?: string): string {
  const qte = d.quantité != null ? `${d.quantité}${d.unité ? ` ${d.unité}` : ''}` : null;
  const attrs = [
    qte ? `quantité ${qte}` : null,
    d.dimensions ? `dim. ${d.dimensions}` : null,
    d.couleur ? `couleur ${d.couleur}` : null,
    d.marque ? `marque ${d.marque}` : null,
    d.référence ? `réf. ${d.référence}` : null,
  ].filter(Boolean);
  const flag = d.niveauConfiance === 'À vérifier' ? ' ⚠️ à vérifier' : '';
  const src = posteLabel ? `poste « ${court(posteLabel, 40)} »` : `poste ${d.posteId}`;
  const page = d.sourcePage ? `, p. ${d.sourcePage}` : '';
  return `« ${court(d.libellé, 48)} »${attrs.length ? ` (${attrs.join(', ')})` : ''} — ${src}${page}${flag}`;
}

/** Postes distincts qui étayent une liste de détails (traçabilité). */
function postesDe(details: DetailTechnique[], postes: PosteTrouve[]): PosteTrouve[] {
  const ids = new Set(details.map((d) => d.posteId));
  return postes.filter((p) => ids.has(p.posteId));
}

/**
 * Répond aux questions TECHNIQUES à partir des détails DÉRIVÉS du contrat validé.
 * Renvoie `null` si la question n'est pas technique (l'appelant poursuit).
 * JAMAIS d'invention : quantité tronquée / absente ⇒ signalée « à vérifier ».
 */
function repondreTechnique(
  q: string,
  details: DetailTechnique[],
  postes: PosteTrouve[],
): ContractAnswer | null {
  if (details.length === 0) return null;
  const labelDe = (id: string): string | undefined => postes.find((p) => p.posteId === id)?.label;
  /** Le poste PORTE-T-IL le concept (dans son libellé contractuel) ? */
  const posteCle = (id: string, cles: string[]): boolean => {
    const lab = strip(labelDe(id) ?? '');
    return cles.some((k) => lab.includes(k));
  };

  // Concepts explicitement nommés dans la question. On matche par MOT ENTIER
  // (racine) pour un mot simple — « comprise » ne doit PAS déclencher « prise » —
  // et par sous-chaîne pour les expressions (« va-et-vient », « panneau rayonnant »).
  const qMots = motsDe(q);
  const concepts = CONCEPTS_TECH.filter((c) =>
    c.mots.some((m) => (/[ -]/.test(m) ? q.includes(m) : qMots.has(racine(m)))),
  );
  const clesQ = concepts.flatMap((c) => c.cles);
  /** Un détail relève-t-il du concept (par son libellé OU par le libellé de son poste) ? */
  const relève = (d: DetailTechnique): boolean =>
    concepts.length === 0 || detailMatch(d, clesQ) || posteCle(d.posteId, clesQ);

  // (A) Attribut « gamme / appareillage » : on remonte les gammes/marques dérivées.
  if (/\bgamme\b|appareillage/.test(q) && !/\bcombien\b/.test(q)) {
    const gammes = details.filter((d) => (d.type === 'gamme' || d.type === 'marque') && relève(d));
    if (gammes.length === 0)
      return introuvableTech(
        concepts.length
          ? `Le contrat validé ne nomme pas explicitement de gamme / marque pour ${concepts.map((c) => c.nom).join(' / ')}.`
          : "Aucune gamme / marque n'est explicitement nommée dans le contrat validé.",
      );
    const items = gammes.slice(0, 8).map((d) => citer(d, labelDe(d.posteId)));
    return {
      found: true,
      answer: `Gamme(s) / marque(s) lues dans le contrat validé (dérivées, à confirmer sur le devis) : ${items.join(' · ')}.`,
      postes: postesDe(gammes, postes),
      ouvrirDevis: true,
    };
  }

  // (B) Attribut « couleur / teinte » (peinture…).
  if (/couleur|teinte/.test(q) && !/\bcombien\b/.test(q)) {
    const couleurs = details.filter((d) => d.couleur && relève(d));
    if (couleurs.length === 0)
      return introuvableTech(
        concepts.length
          ? `Le contrat validé ne précise pas de couleur / teinte pour ${concepts.map((c) => c.nom).join(' / ')} (souvent « à définir »).`
          : "Aucune couleur / teinte n'est précisée dans le contrat validé (souvent « à définir »).",
      );
    const items = couleurs.slice(0, 8).map((d) => citer(d, labelDe(d.posteId)));
    return {
      found: true,
      answer: `Couleur(s) / teinte(s) au contrat validé : ${items.join(' · ')}.`,
      postes: postesDe(couleurs, postes),
      ouvrirDevis: true,
    };
  }

  // (C) Attribut « référence produit ».
  if (/reference|\brefs?\b|\breferences\b/.test(q) && !/\bcombien\b/.test(q)) {
    const refs = details.filter((d) => d.référence && relève(d));
    if (refs.length === 0)
      return introuvableTech(
        concepts.length
          ? `Le contrat validé ne porte pas de référence produit explicite pour ${concepts.map((c) => c.nom).join(' / ')}. Je préfère ne pas en inventer.`
          : "Aucune référence produit explicite n'est lisible dans le contrat validé.",
      );
    const items = refs.slice(0, 8).map((d) => citer(d, labelDe(d.posteId)));
    return {
      found: true,
      answer: `Référence(s) produit lues au contrat validé : ${items.join(' · ')}.`,
      postes: postesDe(refs, postes),
      ouvrirDevis: true,
    };
  }

  // Concept nécessaire pour les questions de comptage / d'attribut d'équipement.
  if (concepts.length === 0) {
    // Question « pièce » : équipements / matériaux d'une cuisine, salle de bain…
    const piece = pieceDeQuestion(q);
    if (piece && /(equipement|materiau|contient|prevu|dans|comprend)/.test(q)) {
      const dansPiece = details.filter(
        (d) => d.pièce === piece && (d.type === 'équipement' || d.type === 'matériau'),
      );
      if (dansPiece.length === 0) return null;
      const equipements = dansPiece.filter((d) => d.type === 'équipement');
      const liste = (equipements.length ? equipements : dansPiece).slice(0, 10);
      const items = liste.map((d) => citer(d, labelDe(d.posteId)));
      const reste =
        dansPiece.length > liste.length ? ` (+${dansPiece.length - liste.length} autres)` : '';
      return {
        found: true,
        answer: `Dans « ${piece} », le contrat validé prévoit notamment : ${items.join(' · ')}${reste}. (Lecture dérivée des sous-listes — à confirmer sur le devis.)`,
        postes: postesDe(dansPiece, postes),
        ouvrirDevis: true,
      };
    }
    return null;
  }

  const nom = concepts.map((c) => c.nom).join(' / ');
  const compter = /\bcombien\b|\bnombre\b/.test(q);

  // (D) COMPTAGE : on dénombre les ÉQUIPEMENTS/MATÉRIAUX nommés comme le concept
  //     (puces de matériaux) — jamais les faits dérivés du libellé.
  if (compter) {
    const matches = details.filter(
      (d) => (d.type === 'équipement' || d.type === 'matériau') && detailMatch(d, clesQ),
    );
    if (matches.length === 0)
      return introuvableTech(
        `Je ne trouve aucun ${nom} détaillé dans le contrat validé. Je préfère ne rien inventer.`,
      );

    const fiables = matches.filter(
      (d) => d.quantité != null && d.niveauConfiance === 'Fiable' && estComptable(d.unité),
    );
    const somme = fiables.reduce((s, d) => s + (d.quantité ?? 0), 0);
    const incertains = matches.filter((d) => !fiables.includes(d));
    const items = matches.slice(0, 8).map((d) => citer(d, labelDe(d.posteId)));
    let phrase: string;
    if (somme > 0 && incertains.length === 0) {
      phrase = `Le contrat validé prévoit ${somme} ${nom}(s). Détail : ${items.join(' · ')}.`;
    } else if (somme > 0) {
      phrase = `Le contrat validé prévoit au moins ${somme} ${nom}(s) avec quantité certaine ; ${incertains.length} ligne(s) sans quantité lisible restent à vérifier sur le devis. Détail : ${items.join(' · ')}.`;
    } else {
      phrase = `Le contrat validé liste ${matches.length} élément(s) de type ${nom}, mais sans quantité chiffrée lisible ligne par ligne — je ne veux pas inventer de total. Détail : ${items.join(' · ')}. Je peux ouvrir le devis pour compter avec vous.`;
    }
    return {
      found: true,
      answer: phrase,
      postes: postesDe(matches, postes),
      ouvrirDevis: true,
    };
  }

  // (E) ATTRIBUT d'un équipement / ouvrage (« quel receveur », « quelle dimension
  //     de faïence »). On rassemble : les puces nommées comme le concept (qui
  //     portent leurs propres dimensions/réf) ET les faits dérivés du LIBELLÉ du
  //     poste concerné (dimension d'un receveur/faïence donnée en prose).
  const direct = details.filter(
    (d) => (d.type === 'équipement' || d.type === 'matériau') && detailMatch(d, clesQ),
  );
  const surLibelle = details.filter((d) => d.type === 'dimension' && posteCle(d.posteId, clesQ));
  const seen = new Set<DetailTechnique>();
  const matches = [...direct, ...surLibelle].filter((d) => (seen.has(d) ? false : seen.add(d)));
  if (matches.length === 0)
    return introuvableTech(
      `Je ne trouve aucun ${nom} détaillé dans le contrat validé. Je préfère ne rien inventer.`,
    );
  const items = matches.slice(0, 8).map((d) => citer(d, labelDe(d.posteId)));
  return {
    found: true,
    answer: `Au contrat validé, ${nom} : ${items.join(' · ')}. (Détail dérivé — à confirmer sur le devis.)`,
    postes: postesDe(matches, postes),
    ouvrirDevis: true,
  };
}

/** Unité dénombrable pour un « combien » (u, pce, ens). */
const estComptable = (u?: string): boolean => u === 'u' || u === 'pce' || u === 'ens';

/** Réponse technique « introuvable » — honnête, propose d'ouvrir le devis. */
const introuvableTech = (answer: string): ContractAnswer => ({
  found: false,
  answer: `${answer} Je peux ouvrir le devis pour vérifier ensemble.`,
  postes: [],
  ouvrirDevis: true,
});

/** Pièce nommée dans la question (cuisine, salle de bain, chambre…). */
function pieceDeQuestion(q: string): string | undefined {
  if (/salle de bain|salle d eau|sdb/.test(q)) return 'Salle de bain';
  if (/cuisine|kitchenette/.test(q)) return 'Cuisine';
  if (/\bwc\b|toilette/.test(q)) return 'WC';
  if (/chambre/.test(q)) return 'Chambre';
  if (/sejour|salon/.test(q)) return 'Séjour';
  if (/plafond/.test(q)) return 'Plafond';
  if (/terrasse/.test(q)) return 'Terrasse';
  return undefined;
}
