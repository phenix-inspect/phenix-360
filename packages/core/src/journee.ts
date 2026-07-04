/**
 * PHÉNIX 360 — Le point du matin (« Aujourd'hui »)
 * ===========================================================================
 * Le conducteur pilote une JOURNÉE, pas un chantier (VISION.md Art. 3). Ce
 * sélecteur PUR agrège, à travers TOUS ses chantiers, ce qui mérite son
 * attention : réserves à lever, décisions attendues du client, questions
 * clients sans réponse, livraisons à venir. Aucune donnée inventée — tout est
 * lu des faits (le Journal) et du dossier (VISION.md Art. 7 & 8).
 */
import type { Project, ProjectStatus, ProjectStep } from './project.js';
import type { Event } from './event.js';
import { isAction, isCompteRendu, isDemande, isDocument, isLevee, isReserve } from './event.js';
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
  /** Statut métier (saisi) — propriété unique, source de vérité. */
  status: ProjectStatus;
  step: ProjectStep | null;
  reserves: number;
  decisions: number;
  questions: number;
  actions: number;
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
    actions: number;
    livraisons: number;
  };
}

/** Actions ouvertes (engagements « à faire ») d'un chantier. */
export function actionsOuvertes(events: Event[]): Event[] {
  return events.filter((e) => isAction(e) && e.content.statut === 'a_faire');
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
    const actions = actionsOuvertes(events).length;
    const livraisons = livraisonsAVenir(dossier);
    return {
      projectId: p.id,
      name: p.name,
      status: p.status,
      step: currentStep(events) ?? p.currentStep ?? null,
      reserves,
      decisions,
      questions,
      actions,
      livraisons,
      urgent: decisions > 0 || questions > 0 || reserves > 0 || actions > 0,
    };
  });

  // Les chantiers urgents d'abord, puis par volume d'attention décroissant.
  const weight = (c: ChantierResume): number =>
    c.decisions * 100 + c.questions * 50 + c.reserves * 10 + c.actions * 5 + c.livraisons;
  chantiers.sort((a, b) => weight(b) - weight(a));

  const totals = chantiers.reduce(
    (acc, c) => ({
      chantiers: acc.chantiers + 1,
      reserves: acc.reserves + c.reserves,
      decisions: acc.decisions + c.decisions,
      questions: acc.questions + c.questions,
      actions: acc.actions + c.actions,
      livraisons: acc.livraisons + c.livraisons,
    }),
    { chantiers: 0, reserves: 0, decisions: 0, questions: 0, actions: 0, livraisons: 0 },
  );

  return { chantiers, totals };
}

/* -------------------------------------------------------------------------- *
 * Le point du soir — « Clôturer ma journée »
 * -------------------------------------------------------------------------- *
 * À 18 h, le conducteur doit pouvoir rentrer la tête vide (VISION.md Art. 10).
 * PHÉNIX lui montre ce qu'il a fait aujourd'hui, ce qui reste ouvert, et ce
 * qu'il faut surveiller demain. Rien d'inventé : uniquement les faits (Art. 7).
 */
export interface EveningReview {
  /** Ce qui a été fait aujourd'hui (comptes rendus, réserves, réponses…). */
  faits: { label: string; count: number }[];
  totalFaits: number;
  /** Ce qui reste ouvert (à travers tous les chantiers). */
  reserves: number;
  decisions: number;
  questions: number;
  actions: number;
  livraisons: number;
  /** À surveiller demain — quelques lignes actionnables. */
  demain: string[];
}

function memeJour(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

const plur = (n: number, s: string): string => `${n} ${s}${n > 1 ? 's' : ''}`;

export function buildEveningReview(input: {
  projects: Project[];
  eventsByProject: Record<string, Event[]>;
  dossiersByProject: Record<string, ProjectDossier | undefined>;
  now?: number;
}): EveningReview {
  const now = input.now ?? Date.now();
  const all: Event[] = Object.values(input.eventsByProject).flat();

  const creesAujourdhui = all.filter((e) => memeJour(e.createdAt, now));
  const comptesRendus = creesAujourdhui.filter(isCompteRendu).length;
  const reservesOuvertesJour = creesAujourdhui.filter(isReserve).length;
  const actionsJour = creesAujourdhui.filter(isAction).length;
  const levees = creesAujourdhui.filter(isLevee).length;
  const documents = creesAujourdhui.filter(isDocument).length;
  const reponses = all.filter(
    (e) => isDemande(e) && e.content.resolution && memeJour(e.content.resolution.resolvedAt, now),
  ).length;

  const faits = [
    { label: comptesRendus > 1 ? 'comptes rendus' : 'compte rendu', count: comptesRendus },
    { label: reponses > 1 ? 'réponses clients' : 'réponse client', count: reponses },
    { label: actionsJour > 1 ? 'actions créées' : 'action créée', count: actionsJour },
    { label: levees > 1 ? 'réserves levées' : 'réserve levée', count: levees },
    {
      label: reservesOuvertesJour > 1 ? 'réserves ouvertes' : 'réserve ouverte',
      count: reservesOuvertesJour,
    },
    { label: documents > 1 ? 'documents' : 'document', count: documents },
  ].filter((f) => f.count > 0);
  const totalFaits = faits.reduce((s, f) => s + f.count, 0);

  const briefing = buildDayBriefing(input);
  const t = briefing.totals;

  // Réserves dont l'échéance approche (≤ 3 jours), tous chantiers.
  const bientot = now + 3 * 86_400_000;
  const reservesUrgentes = all.filter(
    (e) =>
      isReserve(e) &&
      e.content.echeance &&
      new Date(`${e.content.echeance}T00:00:00`).getTime() <= bientot &&
      !all.some((x) => isLevee(x) && x.content.reserveId === e.id),
  ).length;

  const demain: string[] = [];
  if (t.livraisons > 0) demain.push(`${plur(t.livraisons, 'livraison')} à contrôler`);
  if (t.actions > 0) demain.push(`${plur(t.actions, 'action')} à suivre`);
  if (t.decisions > 0) demain.push(`${plur(t.decisions, 'décision')} client à relancer`);
  if (reservesUrgentes > 0)
    demain.push(`${plur(reservesUrgentes, 'réserve')} à lever cette semaine`);

  return {
    faits,
    totalFaits,
    reserves: t.reserves,
    decisions: t.decisions,
    questions: t.questions,
    actions: t.actions,
    livraisons: t.livraisons,
    demain,
  };
}
