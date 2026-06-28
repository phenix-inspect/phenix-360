/**
 * PHÉNIX 360 — Moteur du bandeau intelligent : `nextClientAction`
 * ===========================================================================
 * Reçoit un projet + son journal, renvoie **UNE seule** action prioritaire pour
 * le client. Toute la logique du bandeau vit ici (jamais dans les composants) :
 * l'UI ne fait qu'afficher le résultat (titre + détail).
 *
 * Priorité (première règle satisfaite gagne) :
 *   1. décision en attente du client ;
 *   2. nouvelle photo disponible ;
 *   3. rien à faire.
 *
 * Extensible : ajouter une variante (ex. `signature_attendue`,
 * `intervention_demain`) = ajouter un type + une règle, sans toucher l'UI.
 */
import type { Project } from './project.js';
import type { Event, PhotoEvent } from './event.js';
import { isPhoto } from './event.js';
import type { Decision } from './decision.js';
import { clientFeed, pendingClientDecisions } from './views.js';

export type NextClientAction =
  | { kind: 'rien_a_faire'; title: string; detail: string }
  | { kind: 'decision_attendue'; title: string; detail: string; decision: Decision; total: number }
  | { kind: 'nouvelle_photo'; title: string; detail: string; event: PhotoEvent };

type Rule = (project: Project, events: Event[]) => NextClientAction | null;

const decisionRule: Rule = (_project, events) => {
  const pending = pendingClientDecisions(events);
  const next = pending[0];
  if (!next) return null;
  return {
    kind: 'decision_attendue',
    title: 'Une décision vous attend',
    detail: next.question,
    decision: next,
    total: pending.length,
  };
};

const newPhotoRule: Rule = (_project, events) => {
  const latest = clientFeed(events)[0];
  if (!latest || !isPhoto(latest)) return null;
  return {
    kind: 'nouvelle_photo',
    title: 'Nouvelle photo disponible',
    detail: latest.content.legende ?? 'Votre chantier a avancé.',
    event: latest,
  };
};

/** Ordre = priorité. Les premières règles l'emportent. */
const RULES: Rule[] = [decisionRule, newPhotoRule];

export function nextClientAction(project: Project, events: Event[]): NextClientAction {
  for (const rule of RULES) {
    const action = rule(project, events);
    if (action) return action;
  }
  return {
    kind: 'rien_a_faire',
    title: "Vous n'avez rien à faire",
    detail: 'Tout est à jour. Votre équipe PHÉNIX veille sur votre chantier.',
  };
}
