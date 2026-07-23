/**
 * PHÉNIX — le cerveau de Léon (V3 : assistant de suivi de chantier premium)
 * ===========================================================================
 * Léon n'est PAS un chatbot. C'est un chef de projet numérique côté client, qui
 * donne l'impression de connaître le chantier ET PHÉNIX par cœur. Il ne répond
 * jamais au hasard : il RAISONNE avant de parler.
 *
 * Pipeline OBLIGATOIRE (jamais l'inverse) :
 *
 *   question
 *     → compréhension de l'intention        (classifyIntent)
 *     → classification vers UNE catégorie     (PhenixIntent)
 *     → recherche dans la BONNE source        (base de connaissances + journal)
 *     → évaluation du niveau de confiance      (haute / moyenne / faible)
 *     → réponse (empathique, avec action)      (reply / nav)
 *     → escalade conducteur UNIQUEMENT si nécessaire (escalate / proposeTransmit)
 *
 * Règles non négociables :
 *   • une ABSENCE de réponse (« je ne trouve pas ») est toujours préférable à une
 *     MAUVAISE réponse — jamais d'invention, jamais d'à-peu-près, jamais d'hallucination ;
 *   • jamais de MONTANT ni de CALCUL (les questions de prix escaladent) ;
 *   • jamais d'information interne (réserve n°, responsable, statut technique) ;
 *   • ton humain et rassurant (« Je viens de retrouver votre devis. »), jamais robotique.
 *
 * La base de connaissances (fiche PHÉNIX + fiche chantier) donne à Léon ce qu'il
 * « sait » sans fouiller les documents. La formulation reste déterministe
 * (remplaçable par un LLM sans toucher l'ancrage). Tout vit ici — aucune logique
 * dispersée.
 */
import type { Event } from './event.js';
import { isDocument, isVisibleToClient } from './event.js';
import {
  currentStep,
  demandeRepondue,
  demandesPourPhenix,
  leveeDeReserve,
  pendingClientDecisions,
  reserveEvents,
} from './views.js';
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
   * Fiche CHANTIER — ce que Léon « connaît » du bien sans chercher : l'adresse du
   * chantier (≠ adresse PHÉNIX), le nom du chantier, le client, l'état, les
   * artisans. Alimenté par le store (projet + annuaire).
   */
  chantierAddress?: string | null;
  chantierName?: string | null;
  clientName?: string | null;
  statutLabel?: string | null;
  artisans?: { nom: string; trade?: string }[];
  /**
   * Le client a joint des photos à son message. PHÉNIX ne « voit » pas les
   * images : dès qu'une photo accompagne la demande, l'œil humain du conducteur
   * est nécessaire → escalade automatique (jamais de réponse à l'aveugle).
   */
  hasPhotos?: boolean;
}

/* -------------------------------------------------------------------------- *
 * Base de connaissances PHÉNIX — la « donnée PHÉNIX » que Léon connaît par cœur
 * (source unique, configurable ici). Léon répond directement, sans jamais
 * escalader une simple demande de coordonnées.
 * -------------------------------------------------------------------------- */
export const PHENIX_NAME = 'PHÉNIX 360';
export const PHENIX_PHONE = '01 84 80 00 00';
export const PHENIX_EMAIL = 'contact@phenix360.fr';
export const PHENIX_ADDRESS = '24 rue de la République, 69002 Lyon';
export const PHENIX_SITE = 'www.phenix360.fr';
export const PHENIX_HORAIRES = 'du lundi au vendredi, de 8h30 à 18h30';

/* -------------------------------------------------------------------------- *
 * Utilitaires de langue (déterministes, tolérants aux fautes / synonymes)
 * -------------------------------------------------------------------------- */
const strip = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Apostrophes typographiques (\u2019 ` \u00b4) ramen\u00e9es \u00e0 l'apostrophe droite : le
    // client tape indiff\u00e9remment \u00ab s'appelle \u00bb ou \u00ab s\u2019appelle \u00bb.
    .replace(/[\u2019\u2018`\u00b4]/g, "'")
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
  /(transmet|transmettre|prevenir le conducteur|prévenir le conducteur|demande[rz]? (au|à|a) (mon )?conducteur|contacte[rz]? (le|mon) conducteur|passe[rz]? au conducteur|remonte[rz]? au conducteur|parler (a|à) (quelqu'un|un humain|une personne|un conseiller)|joindre (quelqu'un|un humain))/;

/**
 * Léon vient de PROPOSER de transmettre au conducteur (message précédent). Ces
 * motifs (comparés au message STRIPPÉ) reconnaissent cette proposition, pour
 * qu'un simple « oui » / « non » du client la CONFIRME ou la DÉCLINE — au lieu de
 * reboucler sur la même question.
 */
const OFFER_TRANSMIT_RX = /transmette votre demande a votre conducteur/;
/** Confirmation courte (comparée au message strippé, en début de saisie). */
const AFFIRM_RX =
  /^\s*(oui|ouais|ouep|si|yes|yep|ok|okay|d'accord|dacc?|volontiers|avec plaisir|je veux bien|vas[- ]?y|allez[- ]?y|envoie[zr]?|transmet(s|tez)?|s'il (te|vous) plait|stp|svp|carrement|bien sur|parfait|ca marche|ca me va)\b/;
/** Refus court d'une proposition de transmission. */
const DECLINE_RX =
  /^\s*(non|nan|no|nope|pas (la peine|besoin|maintenant|pour l'instant)|laisse tomber|c'est bon|ca ira|ca va|non merci|surtout pas)\b/;

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
  /(voir|montre|montrer|montrez|afficher|affiche|ouvrir|ouvre|savoir|connaitre|connaître|consulter|retrouver|ou est|où est|\bquand\b|\bquel(le|les|s)?\b|combien|c'est quoi|joindre|contacter|coordonnees|coordonnées)/;

/**
 * DEMANDE DE MODIFICATION d'un rendez-vous / d'une date / du planning (« je veux
 * déplacer la réception », « avancer la livraison », « reporter le rdv »). C'est
 * une décision humaine → conducteur, quelle que soit la tournure (« je veux… » n'est
 * pas dans REQUEST_RX exprès, pour ne pas escalader « je veux le devis »).
 */
const MODIFY_RX =
  /(deplac|déplac|decal|décal|avanc|repouss|report|reprogramm|changer (la|le|de|ma|mon)|modifier (la|le|ma|mon|mes)|annuler (la|le|ma|mon)).*(reception|réception|rdv|rendez-vous|\bdate\b|livraison|planning|visite|intervention|creneau|créneau)/;

/**
 * SIGNALEMENT D'UN PROBLÈME (fissure, fuite, malfaçon…) → l'œil humain du
 * conducteur est requis, on transmet immédiatement (jamais de réponse à côté).
 */
const PROBLEM_RX =
  // Un vrai humain signale un défaut avec des formes que le seul substantif ne
  // couvre pas : le VERBE (« la douche fuit », « ça fuit »), le mot NU (« j'ai un
  // souci », « y a un problème ») sans « je signale », et le vocabulaire concret
  // des malfaçons (traces, taches, rayures, décollé, gondolé, fissuré). Manquer
  // ces formes renvoyait le client vers un « je n'ai pas trouvé » glaçant alors
  // qu'il alertait sur un problème — exactement le moment où l'on perd sa confiance.
  /(fissur|felure|fêlure|infiltration|fuite|\bfuit\b|\bfuient\b|degat|dégât|malfacon|malfaçon|casse|cassé|cassee|cassée|abime|abîme|moisissure|inondation|gondol|décoll|decoll|\braye[e]?s?\b|rayure|\btrace|\btache|\btâche|\bpete[e]?s?\b|pété|\bsouci|probleme|problème|defaut|défaut|ne (marche|fonctionne|ferme|s'ouvre|s'allume) (pas|plus)|marche (pas|plus)|mal fini|mal fait|mal pose|mal posé)/;

/**
 * BESOIN LOGISTIQUE / ADMINISTRATIF qui requiert une action humaine (clés
 * perdues, rendez-vous, sinistre, résiliation…). Léon n'a pas la donnée et ne
 * peut pas agir seul → il transmet au conducteur (jamais une réponse à côté).
 */
const ADMIN_RX =
  /(plus (les |de |mes )?cle|perdu (les |mes )?cle|egare.*cle|égaré.*cle|prendre (un )?rendez-vous|prendre (un )?rdv|\brdv\b|resilier|résilier|resiliation|résiliation|sinistre|cambriol)/;

/**
 * DÉCISION GRAVE : le client veut TOUT arrêter / annuler le chantier. Jamais une
 * réponse automatique (« je n'ai pas trouvé ») — c'est le pire moment pour un
 * mur froid. On transmet immédiatement, avec chaleur, au conducteur (humain).
 */
const CANCEL_RX =
  /(tout (arreter|arrêter|annuler|stopper|plaquer|lacher|lâcher)|(arreter|arrêter|annuler|stopper|suspendre) (le|les|mon|ce) (chantier|travaux|projet)|on (arrete|arrête) tout|je (veux|voudrais|souhaite) (tout )?(arreter|arrêter|annuler|stopper)|j'arrete|j'arrête tout)/;

/**
 * IDENTITÉ : « qui es-tu ? », « vous êtes qui ? », « c'est quoi PHÉNIX ? ». Léon
 * SE CONNAÎT — un client qui demande à qui il parle mérite une présentation, pas
 * un « je n'ai pas trouvé cette information ». Réponse fixe (aucune donnée à lire).
 */
const IDENTITY_RX =
  /(qui (es-?tu|est-?tu|etes?[ -]vous|êtes?[ -]vous|c'est|es tu|est ce que je parle)|(tu es|vous etes|vous êtes|t'es) qui|(c'est|ces|c) quoi (leon|léon|phenix|phénix)|(leon|léon|phenix|phénix) c'est (quoi|qui)|a qui je parle|à qui je parle|tu sers a quoi|tu sers à quoi|tu peux faire quoi|que peux-?tu faire|qu'est-ce que tu (sais|peux) fai)/;

/** Le client veut nous joindre (téléphone / e-mail / coordonnées PHÉNIX). */
const CONTACT_PHONE_RX =
  /(numero|numéro|telephone|téléphone|\btel\b|coordonnees|coordonnées|comment (vous |t.)?(joindre|contacter|appeler)|(vous|t.) (joindre|contacter|appeler))/;
const CONTACT_MAIL_RX = /(mail|email|e-mail|courriel)/;

/** Horaires / site internet / nom de l'entreprise PHÉNIX. */
const PHENIX_INFO_RX =
  /(horaire|ouvert|ouvre|fermé|ferme(z|é)?|quand (vous |êtes-vous |etes-vous )?(ouvert|joignable|disponible)|site (internet|web|de phenix)|site phenix|adresse (internet|web)|votre site|sur internet)/;

/**
 * Une question d'ADRESSE POSTALE. Léon distingue deux adresses bien réelles et
 * jamais interchangeables : celle du CHANTIER (le bien en travaux, donnée du
 * dossier) et celle de l'ENTREPRISE PHÉNIX. « l'adresse du chantier » ≠ « votre
 * adresse ». On exclut l'adresse e-mail (traitée par le contact).
 */
const ADDRESS_RX =
  /(adres|ou se trouve|où se trouve|ou se situe|où se situe|ou est le|où est le|ou est mon|où est mon|ou sont vos|où sont vos|ou intervenez|où intervenez|localisation)/;
const CHANTIER_RX =
  /(chantier|travaux|appartement|logement|le bien|du bien|mon appart|maison|mon logement|ma maison|intervenez)/;
const PHENIX_REF_RX =
  /(phenix|phénix|entreprise|societe|société|bureau|siege|siège|agence|vos bureaux|chez vous)/;

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
 * (recherche de DERNIER RECOURS, quand aucune intention précise n'a été comprise)
 * -------------------------------------------------------------------------- */
interface KnowledgeFact {
  keys: string[];
  answer: string;
  clientLabel: string;
}

function commandeAnswer(o: Order): string {
  const liv = o.dateLivraisonReelle ?? o.dateLivraisonEstimee;
  if (o.statut === 'livree' || o.statut === 'posee' || o.statut === 'terminee')
    return `Bonne nouvelle : votre commande « ${o.label} » a bien été livrée${
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

/**
 * Étiquettes GÉNÉRIQUES de catégorie (présentes dans chaque fait d'un groupe) :
 * elles servent l'index des intentions, mais ne doivent PAS suffire à « matcher »
 * en recherche libre — sinon un simple mot commun (« commande », « photo ») ferait
 * remonter un fait au hasard. La recherche de dernier recours n'accepte qu'un
 * recouvrement sur un mot SPÉCIFIQUE (libellé, pièce, fournisseur…).
 */
const GENERIC_KEYS = new Set([
  'document',
  'commande',
  'choix',
  'photo',
  'photos',
  'etape',
  'planning',
  'contrat',
]);

/** Recherche ancrée : le fait le mieux recouvert sur un mot SPÉCIFIQUE, sinon rien. */
function searchKnowledge(q: string, facts: KnowledgeFact[]): KnowledgeFact | null {
  const qTokens = new Set(tokenize(q));
  let best: KnowledgeFact | null = null;
  let bestScore = 0;
  for (const f of facts) {
    const score = f.keys.filter((k) => !GENERIC_KEYS.has(k) && qTokens.has(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return bestScore >= 1 ? best : null;
}

/* -------------------------------------------------------------------------- *
 * Étape 1-2 du pipeline — compréhension + classification de l'intention
 * (déterministe, tolérante aux synonymes / fautes ; remplaçable par un LLM)
 * -------------------------------------------------------------------------- */
type PhenixIntent =
  | 'salutation'
  | 'remerciement'
  | 'contact'
  | 'phenix_infos'
  | 'adresse'
  | 'conducteur'
  | 'artisans'
  | 'todo'
  | 'choix_restants'
  | 'choix_valides'
  | 'documents_manquants'
  | 'demande_status'
  | 'avancement'
  | 'planning'
  | 'reception'
  | 'commande'
  | 'document'
  | 'reserve'
  | 'photo'
  | 'none';

function detectIntent(q: string): PhenixIntent {
  if (/^(bonjour|salut|hello|coucou|bonsoir|hey|yo)\b/.test(q) && q.length < 24)
    return 'salutation';
  if (/^(merci|super merci|merci beaucoup|nickel|parfait merci|top merci|c'est parfait)\b/.test(q))
    return 'remerciement';

  // Coordonnées PHÉNIX : téléphone / e-mail / « comment vous joindre » (jamais un
  // document, jamais une escalade — Léon connaît ses propres coordonnées).
  if (
    CONTACT_PHONE_RX.test(q) ||
    (CONTACT_MAIL_RX.test(q) && /(phenix|phénix|vous|vos|votre|equipe|équipe|conducteur)/.test(q))
  )
    return 'contact';

  // Horaires / site internet PHÉNIX.
  if (PHENIX_INFO_RX.test(q)) return 'phenix_infos';

  // Adresse postale : chantier ou entreprise PHÉNIX (jamais l'e-mail, déjà traité).
  // On ne déclenche que sur une vraie question d'adresse — « où est le devis ? »
  // (mot « où est » suivi d'un document) reste une question de document.
  if (ADDRESS_RX.test(q) && !CONTACT_MAIL_RX.test(q)) {
    if (/adres/.test(q) || CHANTIER_RX.test(q) || PHENIX_REF_RX.test(q)) return 'adresse';
  }

  // Le nom / l'identité de mon conducteur : information que Léon ne détient pas —
  // il ne l'invente pas, il propose de transmettre (jamais un numéro à la place).
  if (
    /(conducteur|chef de chantier|mon interlocuteur|mon responsable|referent|référent)/.test(q) &&
    /(nom|s'appelle|sappelle|qui est|qui suit|prenom|prénom|c'est qui|joindre directement|coordonnees|coordonnées)/.test(
      q,
    )
  )
    return 'conducteur';

  // Les artisans / l'équipe sur le chantier (identité, pas timing → planning).
  if (
    !/(quand|date|prevu|prévu)/.test(q) &&
    /(qui (est|sont|va|s'occupe|travaille|intervient|fait|gere|gère)|les artisans|mon artisan|quel (artisan|plombier|electricien|électricien|peintre|carreleur|menuisier|chauffagiste|macon|maçon)|l'equipe|l'équipe|equipe qui|qui c'est)/.test(
      q,
    )
  )
    return 'artisans';

  // Documents demandés au client (« que dois-je envoyer ? », « quels documents manquent ? »).
  if (
    /(document.*manque|manque.*document|documents? (a|à) (envoyer|fournir|transmettre)|documents? demand|que dois-?je (envoyer|fournir|transmettre)|quels? (documents?|papiers?|pieces?|pièces?) (manque|envoyer|fournir|transmettre))/.test(
      q,
    )
  )
    return 'documents_manquants';

  // Où en est MA DEMANDE (le ticket que le client a envoyé) — jamais « mon chantier ».
  if (
    /(demande|requete|requête|question)/.test(q) &&
    /(ou en est|où en est|statut|des nouvelles|une reponse|une réponse|repondu|répondu|avancement de|traitee|traitée|suivi de ma)/.test(
      q,
    ) &&
    !/chantier/.test(q)
  )
    return 'demande_status';

  // Qu'est-ce qu'il me reste à CHOISIR (choix client en attente).
  if (
    /(chois|choix|selection|sélection|option|ambiance)/.test(q) &&
    /(reste|restant|(a|à) faire|(a|à) valider|(a|à) choisir|dois-?je|en attente|manque)/.test(q)
  )
    return 'choix_restants';

  // Ai-je quelque chose à faire (décisions client en attente) ?
  if (
    /(dois-?je|je dois|dois faire|faire quelque chose|quelque chose (a|à) (faire|valider)|une action|que dois|rien (a|à) faire|(a|à) valider|action attendue|besoin de moi|reste (a|à) faire|me reste|reste-t-il (a|à) faire|quoi faire|que faire|qu'ai-je (a|à) faire|en attente de moi)/.test(
      q,
    )
  )
    return 'todo';

  // Mes choix DÉJÀ validés.
  if (
    /(ai-je (deja )?(choisi|valide)|mes choix|que j'ai (choisi|valide)|choix.*valide|deja valide|deja choisi)/.test(
      q,
    )
  )
    return 'choix_valides';

  // « Réception » / FIN DE CHANTIER comme QUESTION DE DATE (quand / prévue…),
  // sinon « réception » seule est un document (PV) → traité par 'document'.
  if (
    (/(reception|réception)/.test(q) &&
      /(\bquand\b|date|prevu|prévu|prochaine|c'est quand|ce sera quand|prevoir|prévoir)/.test(q)) ||
    (/\bquand\b/.test(q) &&
      /(termin|fini|finit|fin du chantier|fin des travaux|\bbout\b|remise des cle|remise des clé|\bcles?\b|\bclés?\b|\bpret\b|\bprêt\b|emmenag|emménag|\bfini\b)/.test(
        q,
      ))
  )
    return 'reception';

  // Timing d'une étape / d'un intervenant (« quand commence… », « quand intervient le plombier »).
  if (
    /(prochaine etape|prochaine phase|etape suivante|quand commence|quand debute|quand démarre|quand demarre|quand attaque|quand intervient|quand passe|quand vient|quand arrive.*(plombier|electricien|électricien|peintre|carreleur|artisan))/.test(
      q,
    )
  )
    return 'planning';

  if (
    /(command|livr|arrive|arrivee|expedi|colis|\brecu\b|\breçu\b|fournisseur|delai|délai)/.test(q)
  )
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
    /(ou en est|où en est|avanc|etape|planning|calendrier|frise|ca avance|ça avance|bientot|bientôt|termine avant|fini avant|c'est ou|c'est où|point sur)/.test(
      q,
    )
  )
    return 'avancement';

  // Un « quand » restant, sans aucun repère (ni réception, ni livraison, ni
  // étape, ni fin de chantier) : on n'INVENTE pas une échéance — on transmet.
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
 * Le cœur de PHÉNIX — le pipeline
 * -------------------------------------------------------------------------- */
export function askPhenix(input: PhenixInput): PhenixReply {
  const q = strip(input.question);
  const events = input.events;
  const dossier = input.dossier ?? null;
  // Ce que le client doit FAIRE : les décisions du journal (documents/questions
  // attendus) ET les CHOIX proposés (dossier, statut « propose ») — les deux
  // apparaissent comme des actions dans « Aujourd'hui », donc « ai-je quelque chose
  // à faire ? » doit les compter tous. Sans ça, Léon dirait « rien à faire » alors
  // qu'un choix est en attente (incohérent avec « quels choix en attente ? »).
  const decisionTodos = clientTodos(events);
  const choixTodos = (dossier?.selections ?? [])
    .filter((s) => s.statut === 'propose')
    .map((s) => ({ label: `valider votre choix « ${s.categorie} »`, effort: '≈ 2 minutes' }));
  const todos = [...decisionTodos, ...choixTodos];
  const nextTodo = todos[0];

  // --- Étape mémoire : intention + zone reportées du tour précédent. On ne
  // reporte l'INTENTION que pour une VRAIE relance de continuité (« et la cuisine ? »,
  // « et le salon ? ») : soit le message commence par un connecteur de suite, soit
  // il ne fait que désigner une pièce. Toute autre saisie (même courte, même du
  // charabia) porte son propre sujet — hériter d'une intention passée ferait
  // répondre à côté (une réponse assurée hors-sujet = une invention, le travers à
  // bannir). La zone, elle, se reporte toujours (elle précise, ne change pas de sujet).
  let intent = detectIntent(q);
  let zone = zoneOf(input.question);
  const isFollowUp =
    tokenize(q).length <= 2 && (/^(et|puis|aussi|ok|d'accord|dac)\b/.test(q) || zone !== null);
  if (input.history) {
    for (let i = input.history.length - 1; i >= 0; i--) {
      const h = input.history[i];
      if (!h || h.role !== 'client') continue;
      if (intent === 'none' && isFollowUp) {
        const past = detectIntent(strip(h.texte));
        if (past !== 'none' && past !== 'salutation' && past !== 'remerciement') intent = past;
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
  const escalate = (question: string = input.question): PhenixReply => ({
    kind: 'escalade',
    message:
      'Je vais transmettre votre demande à votre conducteur de travaux PHÉNIX. ' +
      'Vous serez notifié dès qu’une réponse sera disponible.',
    sources: [],
    escaladeQuestion: question.trim(),
  });
  /**
   * Confiance FAIBLE — Léon ne SAIT PAS répondre. Mieux vaut le dire honnêtement
   * que servir une réponse à côté (« une absence de réponse est préférable à une
   * mauvaise réponse »). Il n'invente rien : il l'admet avec un ton humain, puis
   * PROPOSE (sans l'imposer) de transmettre au conducteur. Le chat reste ouvert.
   */
  const cannotFind = (quoi = 'cette information'): PhenixReply =>
    reply(
      `Je n’ai malheureusement pas trouvé ${quoi} dans votre espace pour le moment. ` +
        'Voulez-vous que je transmette votre demande à votre conducteur ?',
      undefined,
      false,
    );

  // ---- Confirmation d'une proposition de transmission (mémoire du tour précédent).
  // Léon vient peut-être de PROPOSER de transmettre au conducteur (« Voulez-vous
  // que je transmette… ? »). Un « oui » CONFIRME → on escalade la QUESTION D'ORIGINE
  // (le dernier message du client), jamais le « oui » lui-même. Un « non » décline
  // poliment. Sans ça, « oui » retombait dans « je n'ai pas trouvé » → boucle infinie.
  const lastMsg = input.history?.[input.history.length - 1];
  if (lastMsg && lastMsg.role === 'phenix' && OFFER_TRANSMIT_RX.test(strip(lastMsg.texte))) {
    if (AFFIRM_RX.test(q)) {
      const origQ =
        [...(input.history ?? [])].reverse().find((h) => h.role === 'client')?.texte ??
        input.question;
      return escalate(origQ);
    }
    if (DECLINE_RX.test(q))
      return reply(
        'Très bien, je ne transmets rien pour l’instant. ' +
          'Dites-moi si je peux vous aider autrement 🙂',
        undefined,
        false,
      );
  }

  // ---- Garde-fous prioritaires (avant toute recherche) : ces cas sortent du
  // pipeline immédiatement, car aucune donnée du dossier ne doit être « cherchée ».

  // « Qui es-tu ? » : Léon se présente lui-même (info fixe) — jamais un « je n'ai
  // pas trouvé ». Placé AVANT les escalades pour ne pas transmettre une présentation.
  if (IDENTITY_RX.test(q))
    return reply(
      'Je suis Léon, votre assistant PHÉNIX 360 👋 Je réponds à vos questions sur ' +
        'votre chantier — avancement, documents, choix à valider, artisans — et je ' +
        'transmets à votre conducteur de travaux tout ce qui demande son intervention.',
      undefined,
      false,
    );
  // Une photo jointe = un point à REGARDER : PHÉNIX ne voit pas les images, donc
  // toute demande avec photo passe directement au conducteur (jamais à l'aveugle).
  if (input.hasPhotos) return escalate();
  // Décision grave (« je veux tout arrêter ») → transmission immédiate au conducteur.
  if (CANCEL_RX.test(q)) return escalate();
  // Le client demande EXPLICITEMENT une transmission (ou à parler à un humain).
  if (TRANSMIT_RX.test(q)) return escalate();
  // Signalement d'un problème (fissure, fuite, malfaçon…) → conducteur.
  if (PROBLEM_RX.test(q)) return escalate();
  // Besoin logistique / administratif (clés, RDV, sinistre…) → conducteur.
  if (ADMIN_RX.test(q)) return escalate();
  // Demande de MODIFICATION d'un rendez-vous / d'une date (« déplacer la
  // réception », « avancer la livraison ») → décision humaine → conducteur.
  if (MODIFY_RX.test(q)) return escalate();
  // Le client veut ENVOYER une photo : on ne le renvoie pas vers les coulisses —
  // on lui explique comment joindre sa photo (il la transmettra à son conducteur).
  if (/(envoy|joind|transmet|ajout|partag|mettre|montrer une).*(photo|image|cliche|cliché)/.test(q))
    return reply(
      'Vous pouvez joindre une photo directement à votre message, avec l’icône appareil photo ' +
        'ci-dessous. Je la transmettrai aussitôt à votre conducteur.',
      undefined,
      false,
    );
  // Demande d'ACTION / de changement / de permission (hors info & navigation) →
  // décision humaine → conducteur. « je voudrais VOIR le devis » reste traité seul.
  // Les intentions d'INFORMATION DIRECTE (coordonnées, adresse, artisans…) ne sont
  // jamais escaladées, même formulées en requête (« puis-je avoir votre numéro ? »).
  // Toute intention d'INFORMATION que Léon sait servir (un document, une date, une
  // photo, l'avancement…) ne s'escalade JAMAIS, même formulée en requête polie
  // sans verbe (« je voudrais le devis », « je souhaite ma facture »). Seules les
  // demandes d'ACTION (rendez-vous, changement) sans repère info partent au conducteur.
  const DIRECT_INFO =
    intent === 'contact' ||
    intent === 'phenix_infos' ||
    intent === 'adresse' ||
    intent === 'conducteur' ||
    intent === 'artisans' ||
    intent === 'document' ||
    intent === 'reception' ||
    intent === 'commande' ||
    intent === 'photo' ||
    intent === 'reserve' ||
    intent === 'planning' ||
    intent === 'avancement' ||
    intent === 'choix_valides';
  if (!DIRECT_INFO && REQUEST_RX.test(q) && !INFO_VERB_RX.test(q)) return escalate();
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

  // ---- Étapes 3-6 du pipeline : recherche dans la bonne source selon l'intention,
  // évaluation de la confiance, réponse (ou « je ne trouve pas » + proposition).
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

    case 'remerciement':
      return reply(
        'Avec plaisir 🙂 Je reste à votre disposition pour votre chantier — n’hésitez pas.',
        undefined,
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

    case 'phenix_infos': {
      const wantsSite = /(site|internet|web)/.test(q);
      if (wantsSite)
        return reply(
          `Vous retrouvez ${PHENIX_NAME} en ligne sur ${PHENIX_SITE}. Pour toute question, je reste disponible ici.`,
          'les coordonnées PHÉNIX',
          false,
        );
      return reply(
        `${PHENIX_NAME} est joignable ${PHENIX_HORAIRES}, au ${PHENIX_PHONE}. Et vous pouvez m'écrire ici à tout moment.`,
        'les coordonnées PHÉNIX',
        false,
      );
    }

    case 'adresse': {
      // Deux adresses distinctes, jamais confondues. Le CHANTIER l'emporte dès que
      // la question le désigne (« l'adresse du chantier », « où est le chantier »).
      const wantsChantier = CHANTIER_RX.test(q);
      const wantsPhenix = PHENIX_REF_RX.test(q) || /(votre|vos)\s+adres/.test(q);
      if (wantsChantier && !wantsPhenix) {
        if (input.chantierAddress)
          return reply(
            `L'adresse de votre chantier est : ${input.chantierAddress}.`,
            'votre chantier',
            false,
          );
        return cannotFind("l'adresse de votre chantier");
      }
      // « votre adresse », « adresse de PHÉNIX », ou adresse ambiguë → entreprise.
      return reply(
        `L'adresse de PHÉNIX est : ${PHENIX_ADDRESS} (téléphone : ${PHENIX_PHONE}).`,
        'les coordonnées PHÉNIX',
        false,
      );
    }

    case 'conducteur':
      // Léon ne détient pas l'identité nominative du conducteur : il ne l'invente
      // pas, il oriente vers la transmission (jamais un numéro à la place d'un nom).
      return reply(
        'Votre chantier est suivi par un conducteur de travaux PHÉNIX. Je ne peux pas ' +
          'vous communiquer son nom directement ici, mais écrivez-moi votre message : ' +
          'je le lui transmets aussitôt et vous serez notifié de sa réponse.',
        'votre suivi de chantier',
        false,
      );

    case 'artisans': {
      const artisans = input.artisans ?? [];
      if (artisans.length === 0)
        return reply(
          'Les artisans qui interviennent sur votre chantier sont coordonnés par votre conducteur PHÉNIX. ' +
            'Dites-moi ce que vous souhaitez savoir : je transmets si besoin.',
          'votre suivi de chantier',
          false,
        );
      const liste = artisans
        .map((a) => (a.trade ? `${a.nom} (${a.trade})` : a.nom))
        .slice(0, 6)
        .join(', ');
      return reply(
        `Sur votre chantier interviennent : ${liste}. Ils sont coordonnés par votre conducteur PHÉNIX.`,
        'votre chantier',
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

    case 'demande_status': {
      const demandes = demandesPourPhenix(events);
      if (demandes.length === 0)
        return reply(
          "Vous n'avez aucune demande en cours pour le moment. Dès que vous m'en adressez une, je la suis pour vous.",
          'vos demandes',
          false,
        );
      const derniere = demandes[0]!;
      if (demandeRepondue(derniere))
        return nav(
          'Votre dernière demande a reçu une réponse de votre conducteur. Vous la retrouvez dans « Vos demandes ».',
          'vos demandes',
          { kind: 'fil', label: 'Voir mes demandes' },
          false,
        );
      const enAttente = demandes.filter((d) => !demandeRepondue(d)).length;
      return reply(
        `Votre demande est bien transmise à votre conducteur (${enAttente} en attente de réponse). ` +
          'Vous serez notifié dès qu’une réponse sera disponible.',
        'vos demandes',
        false,
      );
    }

    case 'choix_restants': {
      const restants = (dossier?.selections ?? []).filter((s) => s.statut !== 'valide');
      if (restants.length === 0)
        return reply(
          'Tous vos choix sont validés — il ne vous reste rien à choisir pour le moment. Bravo !',
          'vos décisions',
          false,
        );
      const liste = restants
        .map((s) => s.categorie)
        .slice(0, 6)
        .join(', ');
      const pendingDecision = pendingClientDecisions(events).length > 0;
      return nav(
        `Il vous reste ${restants.length} choix à faire : ${liste}. Je peux vous ouvrir la première décision.`,
        'vos décisions en attente',
        { kind: 'decision', label: 'Voir mes choix' },
        pendingDecision && isCommand,
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
      const artisanNote =
        input.artisans && input.artisans.length > 0
          ? ` Votre équipe (${input.artisans
              .map((a) => a.trade ?? a.nom)
              .slice(0, 3)
              .join(', ')}) est à l'œuvre.`
          : '';
      return nav(
        empathie +
          `Votre chantier${suffix} en est à l'étape « ${PROJECT_STEP_LABEL[step]} ». Tout avance normalement — les dernières photos sont dans les coulisses.${artisanNote}`,
        'votre suivi de chantier',
        { kind: 'fil', label: 'Voir les coulisses' },
        isCommand,
      );
    }

    case 'planning': {
      const tasks = dossier?.planning ?? [];
      if (tasks.length === 0) return escalate();
      const today = new Date().toISOString().slice(0, 10);
      const qTokens = [...new Set(tokenize(q))];
      // « quand commence X » / « quand intervient le plombier » : tâche dont le
      // libellé recoupe la question — avec tolérance de radical (« plombier » ↔
      // « plomberie », « peintre » ↔ « peinture ») pour parler comme le client.
      const sharesRoot = (a: string, b: string): boolean => {
        const n = Math.min(5, a.length, b.length);
        return n >= 4 && a.slice(0, n) === b.slice(0, n);
      };
      const ciblee = tasks.find((t) =>
        tokenize(t.label).some((k) => qTokens.some((qt) => k === qt || sharesRoot(k, qt))),
      );
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
      // Générique (« quand la livraison ? ») : on ne répond avec certitude QUE s'il
      // n'y a qu'une seule livraison datée. Plusieurs livraisons → on ne devine pas
      // laquelle : on transmet plutôt que de citer une commande au hasard.
      const dated = orders.filter((x) => x.dateLivraisonReelle || x.dateLivraisonEstimee);
      if (dated.length === 1) return reply(commandeAnswer(dated[0]!), 'vos commandes');
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
          `Je viens de retrouver votre « ${d.libelle} ». Je peux vous l'ouvrir.`,
          'vos documents',
          { kind: 'document', ref: d.id, label: `Ouvrir « ${d.libelle} »` },
          false,
        );
      // Document précis introuvable : on l'explique, PUIS on propose de transmettre
      // (jamais d'escalade silencieuse — le chat reste ouvert et clair).
      // Élision « de/d' » selon l'initiale (voyelle ou h muet) + tournure neutre en
      // genre (« faire la demande ») : « d'assurance », « de facture », jamais « de assurance ».
      const deElide = (w: string): string =>
        /^[aâäàeéèêëhiîïoôöuùûü]/i.test(w) ? `d'${w}` : `de ${w}`;
      const notFound = (label: string): PhenixReply =>
        reply(
          `Je ne trouve pas ${deElide(label)} dans votre espace pour le moment. Voulez-vous que je fasse la demande à votre conducteur ?`,
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

      // Recherche libre par mot-clé (aucun type précis reconnu). On n'ouvre un
      // document QUE s'il recoupe réellement la question — jamais « le premier de
      // la liste » par défaut (ce serait répondre à côté). Sinon on l'admet.
      const qTokens = new Set(tokenize(q));
      const kw = docList.filter((d) => tokenize(d.hay).some((k) => qTokens.has(k)));
      if (kw.length >= 1) return openDoc(kw[0]!);
      if (docList.length === 0)
        return reply(
          "Vous n'avez pas encore de document dans votre espace. Dès qu'un document sera partagé, vous le retrouverez dans « Documents ».",
          'vos documents',
          false,
        );
      // Des documents existent mais aucun ne correspond à la demande : on le dit
      // et on oriente vers la bibliothèque plutôt que d'en ouvrir un au hasard.
      return reply(
        'Je ne vois pas de document correspondant précisément à votre demande. Vous ' +
          'retrouvez tous vos documents dans « Documents » — dites-moi lequel vous cherchez.',
        'vos documents',
        false,
      );
    }

    case 'reserve': {
      const reserves = reserveEvents(events);
      const sujet = 'le suivi qualité de votre chantier';
      if (reserves.length === 0)
        return reply("Aucun point de reprise n'est en attente sur votre chantier.", sujet);
      // On NE dit JAMAIS « tout est réglé » s'il reste des reprises ouvertes : on
      // distingue les reprises levées des reprises encore en cours.
      const levees = reserves.filter((r) => leveeDeReserve(r, events)).length;
      const ouvertes = reserves.length - levees;
      if (ouvertes === 0)
        return reply(
          empathie + 'Bonne nouvelle : toutes les reprises ont été réalisées et validées.',
          sujet,
        );
      if (levees > 0)
        return reply(
          empathie +
            `${levees} reprise${levees > 1 ? 's' : ''} déjà réalisée${levees > 1 ? 's' : ''} et ` +
            `validée${levees > 1 ? 's' : ''} ; ${ouvertes} encore en cours. Votre conducteur suit ` +
            `${ouvertes > 1 ? 'ces points' : 'ce point'} de près.`,
          sujet,
        );
      return escalate();
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
      // Dernier recours : recherche ancrée dans la connaissance projet (matériaux,
      // pièces, éléments précis…). Confiance suffisante SEULEMENT sur un mot
      // spécifique — sinon on ne répond pas au hasard.
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
      // Confiance faible : Léon l'admet et propose de transmettre. Il n'ouvre
      // jamais une demande dans le dos du client sur une question incomprise —
      // c'est le client qui choisit de transmettre.
      return cannotFind();
    }
  }
}
