/**
 * PHÉNIX 360 — Le point du matin (« Aujourd'hui »)
 * ===========================================================================
 * Le conducteur pilote une JOURNÉE, pas un chantier (VISION.md Art. 3). Ce
 * sélecteur PUR agrège, à travers TOUS ses chantiers, ce qui mérite son
 * attention : réserves à lever, décisions attendues du client, questions
 * clients sans réponse, livraisons à venir. Aucune donnée inventée — tout est
 * lu des faits (le Journal) et du dossier (VISION.md Art. 7 & 8).
 */
import type { Project, ProjectStep } from './project.js';
import type { Event } from './event.js';
import type { ProjectDossier } from './prepare.js';
import {
  currentStep,
  pendingClientDecisions,
  questionsEnAttente,
  reservesOuvertes,
} from './views.js';

export interface ChantierResume {
  projectId: string;
  name: string;
  step: ProjectStep | null;
  reserves: number;
  decisions: number;
  questions: number;
  livraisons: number;
  /** Ce chantier réclame une action aujourd'hui. */
  urgent: boolean;
}

export interface DayBriefing {
  chantiers: ChantierResume[];
  totals: {
    chantiers: number;
    reserves: number;
    decisions: number;
    questions: number;
    livraisons: number;
  };
}

/** Livraisons attendues : commandes passées, pas encore reçues. */
function livraisonsAVenir(dossier: ProjectDossier | undefined): number {
  if (!dossier) return 0;
  return dossier.orders.filter((o) => o.statut === 'commandee').length;
}

/**
 * Compose le point du matin. Les chantiers qui réclament une action (décisions
 * ou questions clients, réserves ouvertes) remontent en tête.
 */
export function buildDayBriefing(input: {
  projects: Project[];
  eventsByProject: Record<string, Event[]>;
  dossiersByProject: Record<string, ProjectDossier | undefined>;
}): DayBriefing {
  const chantiers: ChantierResume[] = input.projects.map((p) => {
    const events = input.eventsByProject[p.id] ?? [];
    const dossier = input.dossiersByProject[p.id];
    const reserves = reservesOuvertes(events).length;
    const decisions = pendingClientDecisions(events).length;
    const questions = questionsEnAttente(events).length;
    const livraisons = livraisonsAVenir(dossier);
    return {
      projectId: p.id,
      name: p.name,
      step: currentStep(events) ?? p.currentStep ?? null,
      reserves,
      decisions,
      questions,
      livraisons,
      urgent: decisions > 0 || questions > 0 || reserves > 0,
    };
  });

  // Les chantiers urgents d'abord, puis par volume d'attention décroissant.
  const weight = (c: ChantierResume): number =>
    c.decisions * 100 + c.questions * 50 + c.reserves * 10 + c.livraisons;
  chantiers.sort((a, b) => weight(b) - weight(a));

  const totals = chantiers.reduce(
    (acc, c) => ({
      chantiers: acc.chantiers + 1,
      reserves: acc.reserves + c.reserves,
      decisions: acc.decisions + c.decisions,
      questions: acc.questions + c.questions,
      livraisons: acc.livraisons + c.livraisons,
    }),
    { chantiers: 0, reserves: 0, decisions: 0, questions: 0, livraisons: 0 },
  );

  return { chantiers, totals };
}
