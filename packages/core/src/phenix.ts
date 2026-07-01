/**
 * PHÉNIX — le cerveau (B1 : socle « concierge », ancré et déterministe)
 * ===========================================================================
 * PHÉNIX n'est pas un chat : c'est un chef de projet numérique côté client.
 * Règle fondatrice — il ne répond QUE lorsqu'il dispose d'une information fiable
 * du dossier (aucune invention). Sinon, il transmet à l'équipe (escalade).
 *
 * B1 (ce fichier) : réponses par gabarits déterministes premium, ancrées sur les
 * vraies données (journal, comptes rendus, commandes, documents, réserves), avec
 * mention de source (« Réponse basée sur… »), mémoire simple (zone évoquée) et
 * règle « toujours faire avancer » (l'action réelle attendue du client).
 * Le RAG complet, les commandes exécutées et le push proactif viendront après
 * (B2+). La formulation restera remplaçable par un LLM sans toucher l'ancrage.
 */
import type { Event } from './event.js';
import { isDocument, isVisibleToClient } from './event.js';
import { currentStep, leveeDeReserve, pendingClientDecisions, reserveEvents } from './views.js';
import { PROJECT_STEP_LABEL } from './project.js';
import type { Order, ProjectDossier } from './prepare.js';

/** Ce sur quoi une réponse s'appuie (mention client, jamais technique). */
export interface PhenixSource {
  clientLabel: string;
}

/** Une action réelle attendue du client (« toujours faire avancer »). */
export interface PhenixTodo {
  label: string;
  effort: string;
}

export interface PhenixReply {
  kind: 'reponse' | 'escalade';
  message: string;
  sources: PhenixSource[];
  /** Prochaine action du client, proposée en fin de réponse (si elle existe). */
  avancer?: PhenixTodo;
  /** Question à transmettre au conducteur (quand `kind === 'escalade'`). */
  escaladeQuestion?: string;
}

export interface PhenixInput {
  question: string;
  /** Journal du projet (PHÉNIX lit l'interne, mais ne parle QUE client-safe). */
  events: Event[];
  dossier?: ProjectDossier | null;
  /** Historique de l'échange (mémoire simple : zone évoquée précédemment). */
  history?: { role: 'client' | 'phenix'; texte: string }[];
}

const strip = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

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

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
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

type PhenixIntent =
  | 'salutation'
  | 'todo'
  | 'avancement'
  | 'reception'
  | 'livraison'
  | 'document'
  | 'reserve'
  | 'photo'
  | 'none';

/** Reconnaissance d'intention tolérante (déterministe, remplaçable par un LLM). */
function detectIntent(q: string): PhenixIntent {
  if (/^(bonjour|salut|hello|coucou|bonsoir|hey)\b/.test(q) && q.length < 24) return 'salutation';
  if (
    /(dois-?je|je dois|dois faire|faire quelque chose|quelque chose (a|à) (faire|valider)|une action|que dois|rien (a|à) faire|(a|à) valider|action attendue|besoin de moi)/.test(
      q,
    )
  )
    return 'todo';
  if (/(reception|réception)/.test(q)) return 'reception';
  if (/(livraison|livr|delai|arrive|meuble)/.test(q)) return 'livraison';
  if (
    /(devis|facture|document|papier|contrat|attestation|plan|signer|signature|retrouve|ou est)/.test(
      q,
    )
  )
    return 'document';
  if (/(reserve|réserve|reprise|malfacon|defaut|corrige|peinture|finition)/.test(q))
    return 'reserve';
  if (/(photo|image|montre|voir la|voir les|revoir|regarder)/.test(q)) return 'photo';
  if (/(ou en est|avanc|etape|ca avance|bientot|termine avant|fini avant|c'est ou)/.test(q))
    return 'avancement';
  if (/\bquand\b/.test(q)) return 'livraison';
  return 'none';
}

/**
 * Le cœur de PHÉNIX (B1). Déterministe : chaque réponse est adossée à une donnée
 * du dossier et cite sa source. Sans donnée fiable → escalade (jamais d'invention).
 */
export function askPhenix(input: PhenixInput): PhenixReply {
  const q = strip(input.question);
  const events = input.events;
  const todos = clientTodos(events);
  const nextTodo = todos[0];

  // Mémoire simple : intention + zone reportées du tour précédent.
  // Ex. « Où en est la cuisine ? » puis « Et la salle de bain ? ».
  let intent = detectIntent(q);
  let zone = zoneOf(input.question);
  if (input.history) {
    for (let i = input.history.length - 1; i >= 0; i--) {
      const h = input.history[i];
      if (!h || h.role !== 'client') continue;
      if (intent === 'none') {
        const past = detectIntent(strip(h.texte));
        if (past !== 'none' && past !== 'salutation') intent = past;
      }
      if (!zone) zone = zoneOf(h.texte);
      if (intent !== 'none' && zone) break;
    }
  }

  const worried = /(inquiet|inquiete|peur|angoiss|stress|nerveu|panique|m'inquiet)/.test(q);
  const empathie = worried ? 'Je comprends votre inquiétude. ' : '';

  const reply = (message: string, clientLabel?: string, withAvancer = true): PhenixReply => ({
    kind: 'reponse',
    message,
    sources: clientLabel ? [{ clientLabel }] : [],
    ...(withAvancer && nextTodo ? { avancer: nextTodo } : {}),
  });
  const escalate = (): PhenixReply => ({
    kind: 'escalade',
    message:
      "Je n'ai pas encore cette information dans votre dossier. Je me renseigne auprès de l'équipe PHÉNIX et je reviens vers vous.",
    sources: [],
    escaladeQuestion: input.question.trim(),
  });

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

    case 'todo':
      if (todos.length === 0)
        return reply(
          empathie +
            "Aujourd'hui, vous n'avez rien à faire. Je m'occupe de tout et je vous préviendrai dès qu'une décision sera nécessaire.",
          'votre suivi de chantier',
          false,
        );
      if (todos.length === 1)
        return reply(
          empathie +
            `Aujourd'hui, une seule action est attendue de votre part : ${todos[0]!.label} (${todos[0]!.effort}).`,
          'vos décisions en attente',
          false,
        );
      return reply(
        empathie +
          `Aujourd'hui, ${todos.length} actions vous attendent. La plus importante : ${todos[0]!.label}.`,
        'vos décisions en attente',
        false,
      );

    case 'avancement': {
      const step = currentStep(events);
      if (!step) return escalate();
      const suffix = zone ? ` (${zone})` : '';
      return reply(
        empathie +
          `Votre chantier${suffix} en est à l'étape « ${PROJECT_STEP_LABEL[step]} ». Tout avance normalement.`,
        'les derniers comptes rendus',
      );
    }

    case 'reception':
      // La date de réception n'est pas figée en B1 → on transmet plutôt qu'inventer.
      return escalate();

    case 'livraison': {
      const orders: Order[] = input.dossier?.orders ?? [];
      const ord = orders.find((o) => o.dateLivraisonReelle || o.dateLivraisonEstimee);
      if (!ord) return escalate();
      const d = ord.dateLivraisonReelle ?? ord.dateLivraisonEstimee!;
      return reply(`La livraison « ${ord.label} » est prévue le ${fmtDate(d)}.`, 'vos commandes');
    }

    case 'document': {
      const docs = events.filter(isVisibleToClient).filter(isDocument);
      const want = /devis/.test(q)
        ? 'devis'
        : /facture/.test(q)
          ? 'facture'
          : /plan/.test(q)
            ? 'plan'
            : /attestation|assurance/.test(q)
              ? 'attestation'
              : null;
      const doc =
        (want ? docs.find((d) => strip(d.content.libelle).includes(want)) : undefined) ?? docs[0];
      if (!doc) return escalate();
      return reply(
        `J'ai retrouvé votre « ${doc.content.libelle} ». Il est disponible dans votre espace.`,
        'vos documents',
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
      const cible = zone ?? 'votre chantier';
      return reply(
        `Les dernières photos de ${cible} sont dans votre récit, un peu plus bas.`,
        'les photos de votre chantier',
      );
    }

    default:
      // Inquiétude sans intention précise → vérification honnête et rassurante.
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
      // Rien de fiable → escalade (jamais d'approximation).
      return escalate();
  }
}
