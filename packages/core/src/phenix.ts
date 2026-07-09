/**
 * PHÉNIX — le cerveau (B2 : connaissance projet, ancrée & client-safe)
 * ===========================================================================
 * PHÉNIX n'est pas un chat : c'est un chef de projet numérique côté client.
 * Règle fondatrice — il ne répond QUE lorsqu'il dispose d'une information fiable
 * du dossier (aucune invention). Sinon, il transmet à l'équipe (escalade).
 *
 * B2 : PHÉNIX connaît tout le dossier — devis / avenants, planning / étapes,
 * commandes / livraisons, documents, décisions, réserves (traduites), photos,
 * pièces / matériaux / dates. Chaque réponse cite sa source (« Réponse basée
 * sur… »). Règles non négociables :
 *   • jamais de MONTANT ni de CALCUL (les questions de prix escaladent) ;
 *   • jamais d'information interne (réserve n°, responsable, statut technique) ;
 *   • au moindre doute → escalade.
 * La formulation reste déterministe (remplaçable par un LLM sans toucher
 * l'ancrage). Aucune logique dispersée : tout vit ici.
 */
import type { Event } from './event.js';
import { isDocument, isVisibleToClient } from './event.js';
import { currentStep, leveeDeReserve, pendingClientDecisions, reserveEvents } from './views.js';
import { PROJECT_STEP_LABEL } from './project.js';
import type { ClientSelection, Order, ProjectDossier } from './prepare.js';
import type { Moment, ProjectZone } from './fil.js';

/** Ce sur quoi une réponse s'appuie (mention client, jamais technique). */
export interface PhenixSource {
  clientLabel: string;
}

/** Une action réelle attendue du client (« toujours faire avancer »). */
export interface PhenixTodo {
  label: string;
  effort: string;
}

/**
 * Une NAVIGATION que PHÉNIX propose ou exécute (B3). PHÉNIX ouvre / filtre /
 * affiche — il ne valide JAMAIS une décision à la place du client (l'action
 * `decision` ne fait qu'ouvrir l'écran concerné).
 */
export interface PhenixAction {
  kind: 'document' | 'photo' | 'fil' | 'decision' | 'etapes';
  /** Cible précise (id de document, id de moment…), selon le `kind`. */
  ref?: string;
  label: string;
}

export interface PhenixReply {
  kind: 'reponse' | 'escalade';
  message: string;
  sources: PhenixSource[];
  /** Prochaine action du client, proposée en fin de réponse (si elle existe). */
  avancer?: PhenixTodo;
  /** Navigation associée (bouton), le cas échéant. */
  action?: PhenixAction;
  /** Commande explicite (« ouvre… ») → l'UI exécute l'ouverture directement. */
  autoOpen?: boolean;
  /** Question à transmettre au conducteur (quand `kind === 'escalade'`). */
  escaladeQuestion?: string;
}

export interface PhenixInput {
  question: string;
  /** Journal du projet (PHÉNIX lit l'interne, mais ne parle QUE client-safe). */
  events: Event[];
  dossier?: ProjectDossier | null;
  /** Le Fil (pour répondre sur les photos par pièce). */
  moments?: Moment[];
  zones?: ProjectZone[];
  /** Historique de l'échange (mémoire simple : intention + zone du tour précédent). */
  history?: { role: 'client' | 'phenix'; texte: string }[];
  /**
   * Le client a joint des photos à son message. PHÉNIX ne « voit » pas les
   * images : dès qu'une photo accompagne la demande, l'œil humain du conducteur
   * est nécessaire → escalade automatique (jamais de réponse à l'aveugle).
   */
  hasPhotos?: boolean;
}

/* -------------------------------------------------------------------------- *
 * Utilitaires de langue (déterministes, tolérants)
 * -------------------------------------------------------------------------- */
const strip = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const STOP = new Set([
  'les',
  'des',
  'une',
  'est',
  'vous',
  'avez',
  'quel',
  'quelle',
  'quels',
  'pour',
  'dans',
  'avec',
  'sur',
  'par',
  'que',
  'qui',
  'votre',
  'vos',
  'nos',
  'ses',
  'mon',
  'mes',
  'est',
  'ce',
  'cette',
  'mon',
  'ma',
  'ok',
  'the',
  'and',
  'ou',
  'est',
  'elle',
  'ils',
  'sont',
  'pas',
  'plus',
  'moi',
  'nous',
  'ete',
  'etre',
  'fait',
  'faire',
  'the',
  'de',
  'du',
  'au',
  'aux',
  'le',
  'la',
  'un',
  'en',
  'a',
  'il',
  'je',
  'tu',
  'on',
  'se',
  'ne',
  'y',
  'deja',
  'encore',
  'bien',
]);

const tokenize = (s: string): string[] =>
  strip(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

/** Détection « question de prix » → jamais de montant/calcul (escalade). */
const PRICE_RX =
  /(combien|cout|coute|prix|montant|tarif|budget|euro|paiement|payer|reste a payer|facturation)/;

/**
 * Coordonnées PHÉNIX communiquées au client — la « donnée PHÉNIX » que Léon
 * connaît (source unique, configurable ici). Léon répond directement, sans
 * jamais escalader une simple demande de contact.
 */
export const PHENIX_PHONE = '01 84 80 00 00';
export const PHENIX_EMAIL = 'contact@phenix360.fr';

/**
 * Types de documents que Léon sait reconnaître et retrouver (par mot-clé). L'ordre
 * compte : les libellés les plus spécifiques d'abord (« facture finale » avant
 * « facture », « pré-réception » avant « réception »).
 */
const DOC_TYPES: { rx: RegExp; label: string }[] = [
  { rx: /avenant/, label: 'avenant' },
  { rx: /facture finale|facture de solde|solde/, label: 'facture finale' },
  { rx: /acompte/, label: 'acompte' },
  { rx: /facture/, label: 'facture' },
  { rx: /devis/, label: 'devis' },
  { rx: /assurance|attestation|decennale|décennale/, label: 'assurance' },
  { rx: /\bdpe\b|diagnostic|performance energetique|performance énergétique/, label: 'DPE' },
  { rx: /\bplans?\b/, label: 'plan' },
  { rx: /pre-?reception|pré-?réception/, label: 'pré-réception' },
  { rx: /\bpv\b|proces-?verbal|procès-?verbal|compte-?rendu|compte rendu/, label: 'compte rendu' },
  { rx: /reception|réception/, label: 'réception' },
  { rx: /\bsav\b|apres-?vente|après-?vente/, label: 'SAV' },
];

/** Le client demande explicitement de transmettre au conducteur → escalade directe. */
const TRANSMIT_RX =
  /(transmet|transmettre|prevenir le conducteur|prévenir le conducteur|demande[rz]? (au|à|a) (mon )?conducteur|contacte[rz]? (le|mon) conducteur|passe[rz]? au conducteur|remonte[rz]? au conducteur)/;

/**
 * Une DEMANDE D'ACTION / de permission / de changement (« peut-on décaler… »,
 * « je voudrais récupérer les clés… ») relève d'une décision humaine → conducteur.
 * On la distingue d'une simple demande d'INFORMATION ou de NAVIGATION (« je
 * voudrais voir le devis », « peut-on me montrer les photos ») que Léon sait
 * traiter seul.
 */
const REQUEST_RX =
  /(peut-?on|pourrait-?on|pourriez-vous|pouvez-vous|serait-il possible|est-il possible|est-ce possible|possible de|j'aimerais|je voudrais|je souhaite|puis-je|puis je)/;
const INFO_VERB_RX =
  /(voir|montre|montrer|montrez|afficher|affiche|ouvrir|ouvre|savoir|connaitre|connaître|consulter|retrouver|ou est|où est|\bquand\b|\bquel|\bquels|\bquelle|combien|c'est quoi)/;

/**
 * SIGNALEMENT D'UN PROBLÈME (fissure, fuite, malfaçon…) → l'œil humain du
 * conducteur est requis, on transmet immédiatement (jamais de réponse à côté).
 */
const PROBLEM_RX =
  /(fissure|felure|fêlure|infiltration|fuite|degat|dégât|malfacon|malfaçon|cassé|cassee|cassée|abime|abîme|moisissure|inondation|ne (marche|fonctionne) (pas|plus)|mal fini|mal fait|signale.*(probleme|problème|souci|defaut|défaut|malfacon|malfaçon))/;

/** Le client veut nous joindre (téléphone / e-mail / coordonnées PHÉNIX). */
const CONTACT_PHONE_RX =
  /(numero|numéro|telephone|téléphone|\btel\b|coordonnees|coordonnées|comment (vous |t.)?(joindre|contacter|appeler)|(vous|t.) (joindre|contacter|appeler))/;
const CONTACT_MAIL_RX = /(adresse )?(mail|email|e-mail|courriel)/;

const ZONES: { key: string; rx: RegExp }[] = [
  { key: 'la salle de bain', rx: /(salle de bain|sdb|douche|baignoire|lavabo)/ },
  { key: 'la cuisine', rx: /(cuisine|meuble|mobalpa)/ },
  { key: 'le séjour', rx: /(sejour|salon|piece de vie)/ },
  { key: 'la chambre', rx: /chambre/ },
  { key: 'la façade', rx: /(facade|exterieur)/ },
];

function zoneOf(text: string): string | null {
  const s = strip(text);
  for (const z of ZONES) if (z.rx.test(s)) return z.key;
  return null;
}

/** Les actions réellement attendues du client (décisions en attente au journal). */
export function clientTodos(events: Event[]): PhenixTodo[] {
  return pendingClientDecisions(events).map((d) => ({
    label: d.question
      .replace(/\s+/g, ' ')
      .replace(/[.…\s]+$/, '')
      .trim(),
    effort: '≈ 3 minutes',
  }));
}

/* -------------------------------------------------------------------------- *
 * projectKnowledge — index client-safe de faits vérifiés du dossier
 * -------------------------------------------------------------------------- */
interface KnowledgeFact {
  keys: string[];
  answer: string;
  clientLabel: string;
}

function commandeAnswer(o: Order): string {
  const liv = o.dateLivraisonReelle ?? o.dateLivraisonEstimee;
  if (o.statut === 'livree' || o.statut === 'posee' || o.statut === 'terminee')
    return `Votre commande « ${o.label} » a bien été livrée${
      o.dateLivraisonReelle ? ` le ${fmtDate(o.dateLivraisonReelle)}` : ''
    }.`;
  if (o.statut === 'commandee' || o.statut === 'en_preparation' || o.statut === 'expediee')
    return `Votre commande « ${o.label} » est passée${
      liv ? `, livraison prévue le ${fmtDate(liv)}` : ''
    }.`;
  return `La commande « ${o.label} » n'est pas encore passée ; votre conducteur la prépare.`;
}

function selectionAnswer(s: ClientSelection): string {
  if (s.statut === 'valide')
    return `Votre choix « ${s.categorie} » est validé${s.detail ? ` : ${s.detail}` : ''}.`;
  return `Le choix « ${s.categorie} » est encore à valider de votre côté.`;
}

/** Assemble les faits vérifiés (client-safe). Aucun montant, aucune donnée interne. */
function projectKnowledge(input: PhenixInput): KnowledgeFact[] {
  const facts: KnowledgeFact[] = [];
  const d = input.dossier;

  // Documents (journal, visibles client)
  for (const e of input.events.filter(isVisibleToClient).filter(isDocument)) {
    facts.push({
      keys: [...tokenize(e.content.libelle), 'document'],
      answer: `J'ai retrouvé votre « ${e.content.libelle} ». Il est disponible dans votre espace.`,
      clientLabel: 'vos documents',
    });
  }

  if (d) {
    // Commandes / livraisons
    for (const o of d.orders) {
      facts.push({
        keys: [...tokenize(`${o.label} ${o.fournisseur ?? ''} ${o.reference ?? ''}`), 'commande'],
        answer: commandeAnswer(o),
        clientLabel: 'vos commandes',
      });
    }
    // Choix client
    for (const s of d.selections) {
      facts.push({
        keys: [...tokenize(`${s.categorie} ${s.label} ${s.detail ?? ''}`), 'choix'],
        answer: selectionAnswer(s),
        clientLabel: 'vos décisions',
      });
    }
    // Planning / étapes (dates certaines)
    for (const t of d.planning) {
      facts.push({
        keys: [...tokenize(t.label), 'etape', 'planning'],
        answer: `L'étape « ${t.label} » est prévue autour du ${fmtDate(t.start)}.`,
        clientLabel: 'votre planning',
      });
    }
    // Devis / avenants (existence, jamais de montant)
    if (d.devis) {
      facts.push({
        keys: ['devis', 'contrat'],
        answer: "J'ai retrouvé votre devis signé. Je peux vous l'ouvrir.",
        clientLabel: 'votre devis',
      });
    }
    if (d.avenants && d.avenants.length > 0) {
      facts.push({
        keys: ['avenant', 'avenants', 'modification', 'modificatif'],
        answer: "Un avenant a été ajouté à votre devis initial. Je peux vous l'ouvrir.",
        clientLabel: 'votre devis',
      });
    }
  }

  // Photos par pièce (Le Fil)
  if (input.moments && input.moments.length > 0) {
    const zoneLabel = new Map((input.zones ?? []).map((z) => [z.id, z.label] as const));
    const byZone = new Map<string, number>();
    for (const m of input.moments) {
      const label = m.zoneId ? zoneLabel.get(m.zoneId) : undefined;
      if (label) byZone.set(label, (byZone.get(label) ?? 0) + m.photos.length);
    }
    for (const [label, count] of byZone) {
      facts.push({
        keys: [...tokenize(label), 'photo', 'photos'],
        answer: `Vous avez ${count} photo${count > 1 ? 's' : ''} de « ${label} » dans les coulisses de votre chantier.`,
        clientLabel: 'vos photos',
      });
    }
  }

  return facts;
}

/** Recherche ancrée : le fait le mieux recouvert, sinon rien (→ escalade). */
function searchKnowledge(q: string, facts: KnowledgeFact[]): KnowledgeFact | null {
  const qTokens = new Set(tokenize(q));
  let best: KnowledgeFact | null = null;
  let bestScore = 0;
  for (const f of facts) {
    const score = f.keys.filter((k) => qTokens.has(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return bestScore >= 1 ? best : null;
}

/* -------------------------------------------------------------------------- *
 * Reconnaissance d'intention (déterministe, remplaçable par un LLM)
 * -------------------------------------------------------------------------- */
type PhenixIntent =
  | 'salutation'
  | 'contact'
  | 'todo'
  | 'choix_valides'
  | 'documents_manquants'
  | 'avancement'
  | 'planning'
  | 'reception'
  | 'commande'
  | 'document'
  | 'reserve'
  | 'photo'
  | 'none';

function detectIntent(q: string): PhenixIntent {
  if (/^(bonjour|salut|hello|coucou|bonsoir|hey)\b/.test(q) && q.length < 24) return 'salutation';
  // Coordonnées PHÉNIX : téléphone / e-mail / « comment vous joindre » (jamais un
  // document, jamais une escalade — Léon connaît ses propres coordonnées).
  if (
    CONTACT_PHONE_RX.test(q) ||
    (CONTACT_MAIL_RX.test(q) && /(phenix|phénix|vous|equipe|équipe|conducteur)/.test(q))
  )
    return 'contact';
  // Documents demandés au client (« que dois-je envoyer ? », « quels documents manquent ? »).
  if (
    /(document.*manque|manque.*document|documents? (a|à) (envoyer|fournir|transmettre)|documents? demand|que dois-?je (envoyer|fournir|transmettre)|quels? (documents?|papiers?|pieces?|pièces?) (manque|envoyer|fournir|transmettre))/.test(
      q,
    )
  )
    return 'documents_manquants';
  if (
    /(dois-?je|je dois|dois faire|faire quelque chose|quelque chose (a|à) (faire|valider)|une action|que dois|rien (a|à) faire|(a|à) valider|action attendue|besoin de moi)/.test(
      q,
    )
  )
    return 'todo';
  if (
    /(ai-je (deja )?(choisi|valide)|mes choix|que j'ai (choisi|valide)|choix.*valide|deja valide|deja choisi)/.test(
      q,
    )
  )
    return 'choix_valides';
  // « Réception » comme QUESTION DE DATE (quand / prévue…), sinon c'est un
  // document (PV de réception) → traité par l'intention 'document'.
  if (
    /(reception|réception)/.test(q) &&
    /(\bquand\b|date|prevu|prévu|prochaine|c'est quand|ce sera quand|prevoir|prévoir)/.test(q)
  )
    return 'reception';
  if (
    /(prochaine etape|prochaine phase|etape suivante|quand commence|quand debute|quand demarre|quand attaque)/.test(
      q,
    )
  )
    return 'planning';
  if (/(command|livr|arrive|arrivee|expedi|colis|recu|fournisseur|delai)/.test(q))
    return 'commande';
  // Un TYPE de document reconnu (devis, facture, DPE, plan, PV, avenant…) ou un
  // mot documentaire → intention 'document'. Vient AVANT 'photo' pour que
  // « montre-moi le DPE » ne soit pas confondu avec une demande de photos.
  if (
    DOC_TYPES.some((t) => t.rx.test(q)) ||
    /(document|papier|contrat|signer|signature|retrouve|ou est|où est)/.test(q)
  )
    return 'document';
  if (/(reserve|réserve|reprise|malfacon|defaut|corrige|finition)/.test(q)) return 'reserve';
  if (/(photo|image|montre|voir la|voir les|revoir|regarder)/.test(q)) return 'photo';
  if (
    /(ou en est|avanc|etape|planning|calendrier|frise|ca avance|bientot|termine avant|fini avant|c'est ou)/.test(
      q,
    )
  )
    return 'avancement';
  if (/\bquand\b/.test(q)) return 'commande';
  return 'none';
}

/** Trouve la commande la plus proche des mots de la question. */
function matchOrder(q: string, orders: Order[]): Order | undefined {
  const qTokens = new Set(tokenize(q));
  let best: Order | undefined;
  let bestScore = 0;
  for (const o of orders) {
    const keys = tokenize(`${o.label} ${o.fournisseur ?? ''} ${o.reference ?? ''}`);
    const score = keys.filter((k) => qTokens.has(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return bestScore >= 1 ? best : undefined;
}

/* -------------------------------------------------------------------------- *
 * Le cœur de PHÉNIX
 * -------------------------------------------------------------------------- */
export function askPhenix(input: PhenixInput): PhenixReply {
  const q = strip(input.question);
  const events = input.events;
  const dossier = input.dossier ?? null;
  const todos = clientTodos(events);
  const nextTodo = todos[0];

  // Mémoire simple : intention + zone reportées du tour précédent. On ne
  // reporte l'INTENTION que pour une vraie relance courte (« et la cuisine ? ») :
  // une question longue porte son propre sujet — hériter d'une intention passée
  // ferait répondre à côté (une réponse assurée hors-sujet = une invention). La
  // zone, elle, se reporte toujours (elle ne fait que préciser une réponse).
  let intent = detectIntent(q);
  let zone = zoneOf(input.question);
  const isFollowUp = tokenize(q).length <= 3;
  if (input.history) {
    for (let i = input.history.length - 1; i >= 0; i--) {
      const h = input.history[i];
      if (!h || h.role !== 'client') continue;
      if (intent === 'none' && isFollowUp) {
        const past = detectIntent(strip(h.texte));
        if (past !== 'none' && past !== 'salutation') intent = past;
      }
      if (!zone) zone = zoneOf(h.texte);
      if (intent !== 'none' && zone) break;
    }
  }

  const worried = /(inquiet|inquiete|peur|angoiss|stress|nerveu|panique|m'inquiet)/.test(q);
  const empathie = worried ? 'Je comprends votre inquiétude. ' : '';
  // Commande explicite → PHÉNIX exécute l'ouverture (centre de navigation).
  const isCommand =
    /(ouvre|ouvrir|ouvrez|montre|montrer|montrez|affiche|affichez|emmene|emmène|va (sur|a|à)|conduis|fais voir|je veux voir|amene|amène)/.test(
      q,
    );

  const reply = (message: string, clientLabel?: string, withAvancer = true): PhenixReply => ({
    kind: 'reponse',
    message,
    sources: clientLabel ? [{ clientLabel }] : [],
    ...(withAvancer && nextTodo ? { avancer: nextTodo } : {}),
  });
  /** Réponse AVEC navigation (bouton ; exécutée d'emblée si commande). */
  const nav = (
    message: string,
    clientLabel: string,
    action: PhenixAction,
    autoOpen: boolean,
  ): PhenixReply => ({
    kind: 'reponse',
    message,
    sources: [{ clientLabel }],
    action,
    ...(autoOpen ? { autoOpen: true } : {}),
  });
  const escalate = (): PhenixReply => ({
    kind: 'escalade',
    message:
      'Je vais transmettre votre demande à votre conducteur de travaux PHÉNIX. ' +
      'Vous serez notifié dès qu’une réponse sera disponible.',
    sources: [],
    escaladeQuestion: input.question.trim(),
  });

  // Une photo jointe = un point à REGARDER : PHÉNIX ne voit pas les images, donc
  // toute demande avec photo passe directement au conducteur (jamais à l'aveugle).
  if (input.hasPhotos) return escalate();

  // Le client demande EXPLICITEMENT une transmission au conducteur → on transmet.
  if (TRANSMIT_RX.test(q)) return escalate();

  // Signalement d'un problème (fissure, fuite, malfaçon…) → conducteur.
  if (PROBLEM_RX.test(q)) return escalate();

  // Demande d'ACTION / de changement / de permission (hors info & navigation) →
  // décision humaine → conducteur. « je voudrais VOIR le devis » reste traité seul.
  if (REQUEST_RX.test(q) && !INFO_VERB_RX.test(q)) return escalate();

  // Garde-fou MONTANT : jamais de prix, de calcul ni d'estimation → on transmet.
  if (PRICE_RX.test(q)) return escalate();

  // Navigation « ouvre ma décision » : on OUVRE l'écran, on ne valide jamais.
  if (isCommand && /(decision|choix|valider)/.test(q)) {
    if (nextTodo)
      return nav(
        `Je vous ouvre votre prochaine décision : ${nextTodo.label}.`,
        'vos décisions en attente',
        { kind: 'decision', label: 'Ouvrir ma décision' },
        true,
      );
    return reply(
      "Vous n'avez aucune décision en attente aujourd'hui. Je veille sur votre chantier.",
      'vos décisions en attente',
      false,
    );
  }

  switch (intent) {
    case 'salutation':
      return nextTodo
        ? reply(
            `Bonjour 👋 Aujourd'hui, une action vous attend : ${nextTodo.label} (${nextTodo.effort}).`,
            'vos décisions en attente',
            false,
          )
        : reply(
            "Bonjour 👋 Aujourd'hui, vous n'avez rien à faire. Je veille sur votre chantier.",
            'votre suivi de chantier',
            false,
          );

    case 'contact': {
      const wantsMail =
        CONTACT_MAIL_RX.test(q) && !/(numero|numéro|telephone|téléphone|\btel\b|appeler)/.test(q);
      if (wantsMail)
        return reply(
          `Vous pouvez joindre PHÉNIX par e-mail à ${PHENIX_EMAIL}. Et vous pouvez toujours m'écrire ici : je transmets à votre conducteur si nécessaire.`,
          'les coordonnées PHÉNIX',
          false,
        );
      return reply(
        `Vous pouvez joindre PHÉNIX au ${PHENIX_PHONE} (e-mail : ${PHENIX_EMAIL}). Et vous pouvez toujours m'écrire ici : je transmets à votre conducteur si nécessaire.`,
        'les coordonnées PHÉNIX',
        false,
      );
    }

    case 'documents_manquants': {
      const reqs = pendingClientDecisions(events).filter((d) => d.attendu === 'document');
      if (reqs.length === 0)
        return reply(
          'Aucun document ne vous est demandé pour le moment : tout est à jour de votre côté.',
          'vos documents',
          false,
        );
      const list = reqs
        .map((d) =>
          d.question
            .replace(/\s+/g, ' ')
            .replace(/[.?…\s]+$/, '')
            .trim(),
        )
        .join(' ; ');
      return reply(
        `Il reste ${reqs.length} élément${reqs.length > 1 ? 's' : ''} à transmettre : ${list}. Vous pouvez l'envoyer depuis « Aujourd'hui ».`,
        'vos documents demandés',
        false,
      );
    }

    case 'todo':
      if (todos.length === 0)
        return reply(
          empathie +
            "Aujourd'hui, vous n'avez rien à faire. Je m'occupe de tout et je vous préviendrai dès qu'une décision sera nécessaire.",
          'votre suivi de chantier',
          false,
        );
      if (todos.length === 1)
        return nav(
          empathie +
            `Aujourd'hui, une seule action est attendue de votre part : ${todos[0]!.label} (${todos[0]!.effort}).`,
          'vos décisions en attente',
          { kind: 'decision', label: 'Ouvrir ma décision' },
          isCommand,
        );
      return nav(
        empathie +
          `Aujourd'hui, ${todos.length} actions vous attendent. La plus importante : ${todos[0]!.label}.`,
        'vos décisions en attente',
        { kind: 'decision', label: 'Ouvrir ma décision' },
        isCommand,
      );

    case 'choix_valides': {
      const valides = (dossier?.selections ?? []).filter((s) => s.statut === 'valide');
      // Question ciblée sur une catégorie précise ?
      const ciblee = (dossier?.selections ?? []).find((s) =>
        tokenize(`${s.categorie} ${s.label}`).some((k) => new Set(tokenize(q)).has(k)),
      );
      if (ciblee) return reply(selectionAnswer(ciblee), 'vos décisions');
      if (valides.length === 0)
        return reply("Vous n'avez pas encore validé de choix pour le moment.", 'vos décisions');
      return reply(
        `Vous avez validé : ${valides.map((s) => s.categorie).join(', ')}.`,
        'vos décisions',
      );
    }

    case 'avancement': {
      const step = currentStep(events);
      if (!step) return escalate();
      const suffix = zone ? ` (${zone})` : '';
      return nav(
        empathie +
          `Votre chantier${suffix} en est à l'étape « ${PROJECT_STEP_LABEL[step]} ». Tout avance normalement — les dernières photos sont dans les coulisses.`,
        'votre suivi de chantier',
        { kind: 'fil', label: 'Voir les coulisses' },
        isCommand,
      );
    }

    case 'planning': {
      const tasks = dossier?.planning ?? [];
      if (tasks.length === 0) return escalate();
      const today = new Date().toISOString().slice(0, 10);
      const qTokens = new Set(tokenize(q));
      // « quand commence X » : tâche dont le libellé recoupe la question.
      const ciblee = tasks.find((t) => tokenize(t.label).some((k) => qTokens.has(k)));
      if (ciblee)
        return reply(
          `L'étape « ${ciblee.label} » est prévue autour du ${fmtDate(ciblee.start)}.`,
          'votre planning',
          false,
        );
      // « prochaine étape » : première tâche qui démarre après aujourd'hui.
      const next = [...tasks]
        .sort((a, b) => a.start.localeCompare(b.start))
        .find((t) => t.start > today);
      if (next)
        return reply(
          `La prochaine étape est « ${next.label} », prévue autour du ${fmtDate(next.start)}.`,
          'votre planning',
          false,
        );
      return escalate();
    }

    case 'reception': {
      // On répond depuis les dates du planning quand elles existent (jamais une
      // date figée qu'on n'aurait pas) ; sinon seulement, on transmet.
      const tasks = dossier?.planning ?? [];
      const recep = tasks.find((t) =>
        /reception|réception|remise des cle|remise des clé|livraison finale|fin de chantier/.test(
          strip(t.label),
        ),
      );
      if (recep)
        return reply(
          `Votre réception est prévue autour du ${fmtDate(recep.start)}. La date exacte vous sera confirmée par votre conducteur.`,
          'votre planning',
          false,
        );
      const last = [...tasks].sort((a, b) => a.end.localeCompare(b.end)).at(-1);
      if (last)
        return reply(
          `La fin des travaux — et donc votre réception — est planifiée autour du ${fmtDate(last.end)}. Votre conducteur vous confirmera la date exacte le moment venu.`,
          'votre planning',
          false,
        );
      return escalate();
    }

    case 'commande': {
      const orders = dossier?.orders ?? [];
      if (orders.length === 0) return escalate();
      const o = matchOrder(q, orders);
      if (o) return reply(commandeAnswer(o), 'vos commandes');
      // Générique (« quand la livraison ») : première commande datée.
      const dated = orders.find((x) => x.dateLivraisonReelle || x.dateLivraisonEstimee);
      if (dated) return reply(commandeAnswer(dated), 'vos commandes');
      return escalate();
    }

    case 'document': {
      // Tout ce que le client peut CONSULTER : fichiers (devis, factures, plans,
      // attestations…) ET comptes rendus (PV de réception, fiche SAV…), avec un
      // libellé et un id pour l'ouvrir.
      type Doc = { id: string; libelle: string; hay: string };
      const docList: Doc[] = [];
      for (const e of events.filter(isVisibleToClient)) {
        if (isDocument(e))
          docList.push({ id: e.id, libelle: e.content.libelle, hay: strip(e.content.libelle) });
        else if (e.type === 'compte_rendu') {
          const titre = e.content.docTitre ?? 'Compte rendu de chantier';
          docList.push({
            id: e.id,
            libelle: titre,
            hay: strip(`${titre} ${e.content.missionKind ?? ''} compte rendu`),
          });
        }
      }

      // Un BOUTON, jamais une ouverture à l'aveugle : le client garde la main.
      const openDoc = (d: Doc): PhenixReply =>
        nav(
          `J'ai retrouvé votre « ${d.libelle} ». Je peux vous l'ouvrir.`,
          'vos documents',
          { kind: 'document', ref: d.id, label: `Ouvrir « ${d.libelle} »` },
          false,
        );
      // Document précis introuvable : on l'explique, PUIS on propose de transmettre
      // (jamais d'escalade silencieuse — le chat reste ouvert et clair).
      const notFound = (label: string): PhenixReply =>
        reply(
          `Je ne trouve pas de ${label} dans votre espace pour le moment. Voulez-vous que je le demande à votre conducteur ?`,
          'vos documents',
          false,
        );

      // Avenant : le devis porte les avenants → on ouvre le devis s'il existe.
      if (/avenant/.test(q) && dossier?.avenants && dossier.avenants.length > 0) {
        const devisDoc = docList.find((d) => d.hay.includes('devis'));
        if (devisDoc) return openDoc(devisDoc);
      }

      // Type de document reconnu (devis, facture, plan, assurance, DPE, PV…).
      const wanted = DOC_TYPES.find((t) => t.rx.test(q));
      if (wanted) {
        const hits = docList.filter((d) => wanted.rx.test(d.hay));
        if (hits.length === 1) return openDoc(hits[0]!);
        if (hits.length > 1) {
          const names = hits
            .slice(0, 4)
            .map((d) => `« ${d.libelle} »`)
            .join(', ');
          return nav(
            `J'ai trouvé ${hits.length} documents de type ${wanted.label} : ${names}. Je peux vous ouvrir « ${hits[0]!.libelle} » ; les autres sont dans « Documents ».`,
            'vos documents',
            { kind: 'document', ref: hits[0]!.id, label: `Ouvrir « ${hits[0]!.libelle} »` },
            false,
          );
        }
        return notFound(wanted.label);
      }

      // Recherche libre par mot-clé (aucun type précis reconnu).
      const qTokens = new Set(tokenize(q));
      const kw = docList.filter((d) => tokenize(d.hay).some((k) => qTokens.has(k)));
      if (kw.length >= 1) return openDoc(kw[0]!);
      const first = docList[0];
      if (first) return openDoc(first);
      return reply(
        "Vous n'avez pas encore de document dans votre espace. Dès qu'un document sera partagé, vous le retrouverez dans « Documents ».",
        'vos documents',
        false,
      );
    }

    case 'reserve': {
      const reserves = reserveEvents(events);
      const levees = reserves.filter((r) => leveeDeReserve(r, events));
      if (levees.length > 0)
        return reply(
          empathie + 'Bonne nouvelle : la reprise concernée a été réalisée et validée.',
          'le suivi qualité de votre chantier',
        );
      if (reserves.length > 0) return escalate();
      return reply(
        "Aucun point de reprise n'est en attente sur votre chantier.",
        'le suivi qualité de votre chantier',
      );
    }

    case 'photo': {
      // Ancré : si on connaît la pièce, on vérifie réellement les photos du Fil.
      if (zone && input.moments) {
        const zoneLabel = new Map((input.zones ?? []).map((z) => [z.id, z.label] as const));
        const target = strip(zone).replace(/^(la|le|les|l') /, '');
        const inZone = input.moments.filter((m) => {
          const label = m.zoneId ? zoneLabel.get(m.zoneId) : undefined;
          return label ? strip(label).includes(target) || target.includes(strip(label)) : false;
        });
        const count = inZone.reduce((n, m) => n + m.photos.length, 0);
        if (count > 0) {
          const latest = [...inZone].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;
          return nav(
            isCommand
              ? `Je vous ouvre les photos de ${zone}.`
              : `Vous avez ${count} photo${count > 1 ? 's' : ''} de ${zone} dans les coulisses de votre chantier.`,
            'vos photos',
            { kind: 'photo', ref: latest.id, label: `Voir les photos de ${zone}` },
            isCommand,
          );
        }
        return reply(
          `Je n'ai pas encore de photo de ${zone} dans les coulisses de votre chantier ; dès qu'il y en aura, elles y apparaîtront.`,
          'vos photos',
        );
      }
      return nav(
        isCommand
          ? 'Je vous ouvre les coulisses en photos de votre chantier.'
          : 'Les dernières photos de votre chantier sont dans les coulisses.',
        'vos photos',
        { kind: 'fil', label: 'Voir les coulisses' },
        isCommand,
      );
    }

    default: {
      // B2 : recherche ancrée dans la connaissance projet (matériaux, pièces,
      // éléments précis…). Si rien de sûr → escalade (jamais d'approximation).
      const fact = searchKnowledge(q, projectKnowledge(input));
      if (fact) return reply(fact.answer, fact.clientLabel);

      if (worried) {
        const step = currentStep(events);
        const base = step
          ? `Je viens de vérifier votre dossier : votre chantier avance normalement (étape « ${PROJECT_STEP_LABEL[step]} »).`
          : 'Je viens de vérifier votre dossier.';
        const tail = nextTodo
          ? ` Il reste une action de votre côté : ${nextTodo.label}.`
          : " Aujourd'hui, rien n'est attendu de votre part.";
        return {
          kind: 'reponse',
          message: 'Je comprends votre inquiétude. ' + base + tail,
          sources: [{ clientLabel: 'votre planning' }],
        };
      }
      return escalate();
    }
  }
}
