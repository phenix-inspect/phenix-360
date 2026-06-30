/**
 * PHÉNIX 360 — Assistant (workflow figé, canonique)
 * ===========================================================================
 *   question → recherche dans le journal → recherche dans les documents →
 *   réponse SI le contexte suffit, SINON intention de création de demande.
 *
 * Règles non négociables (ADR-001) :
 *   • l'IA n'invente jamais : la synthèse part du SEUL contexte récupéré ;
 *   • elle ne répond jamais sans contexte : sans extrait pertinent → demande ;
 *   • elle n'est jamais auteur : elle propose une demande, ne l'écrit pas.
 *
 * La synthèse (LLM) est injectable (`synthesize`) : `mockSynthesize` par défaut
 * → aucune dépendance réseau pour la démo. Le fournisseur réel reste un détail
 * d'implémentation (le client ne sait jamais quel modèle répond).
 */
import type { EventId, IsoDateTime } from './ids.js';
import type { Event } from './event.js';
import { isDocument, isVisibleToClient } from './event.js';
import { currentStep } from './views.js';
import { PROJECT_STEP_LABEL } from './project.js';
import { ORDER_STATUS_LABEL, describeDecisionEvent, type Order } from './prepare.js';

export interface AssistantSource {
  type: string;
  excerpt: string;
  eventId?: EventId;
  createdAt?: IsoDateTime;
}

export type AssistantResult =
  | {
      kind: 'answer';
      assistant: 'PHÉNIX 360';
      message: string;
      answer: string;
      sources: AssistantSource[];
    }
  | {
      kind: 'demande_intent';
      assistant: 'PHÉNIX 360';
      message: string;
      demande: { question: string; destinataire: 'equipe' };
    };

/** Synthèse à partir du contexte uniquement (LLM réel ou mock). */
export type Synthesize = (question: string, sources: AssistantSource[]) => string | Promise<string>;

export const mockSynthesize: Synthesize = (_question, sources) =>
  'D’après le suivi de votre chantier :\n' +
  sources.map((s) => `- ${s.excerpt}`).join('\n') +
  '\n\n(Réponse établie uniquement à partir du journal du projet.)';

export interface AssistantInput {
  question: string;
  /** Journal complet du projet (la visibilité client est appliquée ici). */
  events: Event[];
  /** Commandes du projet — enrichissent la mémoire (matériaux, garanties…). */
  orders?: Order[];
  synthesize?: Synthesize;
  /** Garde-fou « jamais bloqué » : transmettre directement à l'équipe. */
  forceDemande?: boolean;
}

/* --- Récupération structurée (pure, sans dépendance) --------------------- */
const STOPWORDS = new Set([
  'les',
  'des',
  'une',
  'est',
  'vous',
  'avez',
  'quel',
  'quelle',
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
]);

const stripAccents = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const tokenize = (s: string): Set<string> =>
  new Set(
    stripAccents(s)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );

const excerptOf = (e: Event): string => {
  switch (e.type) {
    case 'compte_rendu':
      return e.content.texte;
    case 'demande':
      return e.content.question;
    case 'photo':
      return e.content.legende ?? 'Photo du chantier';
    case 'document':
      return e.content.libelle;
    case 'decision': {
      const d = describeDecisionEvent(e.content);
      return `${d.title} — ${d.description}`;
    }
    case 'reserve':
      return `Réserve n°${e.content.numero} : ${e.content.libelle}`;
  }
};

const orderExcerpt = (o: Order): string =>
  `${o.label}${o.fournisseur ? ` — ${o.fournisseur}` : ''}` +
  `${o.reference ? `, réf. ${o.reference}` : ''}` +
  `${o.garantie ? `, garantie ${o.garantie}` : ''} : ${ORDER_STATUS_LABEL[o.statut]}.`;

/** Construit le contexte à partir du journal visible au client + des commandes. */
export function retrieveContext(
  question: string,
  events: Event[],
  orders: Order[] = [],
): AssistantSource[] {
  const visible = events.filter(isVisibleToClient);
  const q = stripAccents(question).toLowerCase();
  const qTokens = tokenize(question);
  const sources: AssistantSource[] = [];

  // Mémoire des commandes (matériaux, fournisseurs, garanties, statuts).
  const scoredOrders = orders
    .map((o) => ({
      o,
      score: [...tokenize(`${o.label} ${o.fournisseur ?? ''} ${o.reference ?? ''}`)].filter((t) =>
        qTokens.has(t),
      ).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  for (const { o } of scoredOrders.slice(0, 3)) {
    sources.push({ type: 'commande', excerpt: orderExcerpt(o) });
  }

  // Intention « avancement » : lecture structurée de l'étape courante.
  if (['avanc', 'etape', 'ou en est', 'stade'].some((k) => q.includes(k))) {
    const step = currentStep(visible);
    if (step)
      sources.push({
        type: 'avancement',
        excerpt: `Étape en cours : ${PROJECT_STEP_LABEL[step]}.`,
      });
  }

  // Pertinence par recouvrement de mots-clés (journal + documents).
  const scored = visible
    .map((e) => ({ e, score: [...tokenize(excerptOf(e))].filter((t) => qTokens.has(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (isDocument(b.e) ? 1 : 0) - (isDocument(a.e) ? 1 : 0));

  for (const { e } of scored.slice(0, 3)) {
    sources.push({ eventId: e.id, type: e.type, createdAt: e.createdAt, excerpt: excerptOf(e) });
  }
  return sources;
}

function demandeIntent(question: string, message: string): AssistantResult {
  return {
    kind: 'demande_intent',
    assistant: 'PHÉNIX 360',
    message,
    demande: { question, destinataire: 'equipe' },
  };
}

export async function runAssistant(input: AssistantInput): Promise<AssistantResult> {
  const synthesize = input.synthesize ?? mockSynthesize;

  if (input.forceDemande) {
    return demandeIntent(input.question, 'Votre demande est transmise à l’équipe PHÉNIX.');
  }

  const sources = retrieveContext(input.question, input.events, input.orders);
  if (sources.length === 0) {
    return demandeIntent(
      input.question,
      'Je n’ai pas cette information dans le suivi du chantier. Je propose de transmettre votre demande à l’équipe PHÉNIX.',
    );
  }

  try {
    const answer = await synthesize(input.question, sources);
    return {
      kind: 'answer',
      assistant: 'PHÉNIX 360',
      message: 'Réponse établie à partir du journal du chantier.',
      answer,
      sources,
    };
  } catch {
    return demandeIntent(input.question, 'Je préfère transmettre votre demande à l’équipe PHÉNIX.');
  }
}
