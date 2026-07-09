/**
 * PHÉNIX 360 — Planning CLIENT (lecture premium, rassurante, non technique)
 * ===========================================================================
 * Le client n'a pas besoin de suivre le chantier lot par lot. Il veut savoir OÙ
 * en est son projet. On ne lui montre donc que 5 GRANDS JALONS de cycle de vie
 * (jamais plomberie/peinture/électricité — le détail est réservé à Léon) :
 *   Projet validé · Préparation · Démarrage · Pré-réception · Réception
 *
 * Le planning ÉVOLUE tout seul selon le STATUT métier (source de vérité) :
 *  • avant le démarrage officiel (« pas commencé ») → AUCUNE date, seulement une
 *    estimation (« démarrage estimé : dans environ 6 semaines ») — aucune promesse ;
 *  • dès que le conducteur déclare « En cours » → bascule sur des DATES estimées
 *    (début officiel, pré-réception estimée, réception estimée).
 *
 * Sélecteur PUR. C'est une vision GLOBALE, jamais un planning d'exécution : le
 * client ne pourra pas dire « vous aviez prévu le carrelage mardi ».
 */
import { PROJECT_STATUSES, type ProjectStatus } from './project.js';
import { buildSmartPlanning, isAcompteDocument, type ProjectDossier } from './prepare.js';

/* -------------------------------------------------------------------------- *
 * PARTAGE CLIENT — 3 bloquants obligatoires avant d'ouvrir l'espace client
 * -------------------------------------------------------------------------- *
 * Règle métier : le dossier n'est PARTAGEABLE au client que si les 3 éléments
 * fondateurs sont validés — devis signé, acompte payé, ET date officielle de
 * démarrage fixée À LA MAIN par le conducteur (jamais celle du devis, qui est
 * administrative). Tant qu'un manque, l'espace client reste fermé. Les autres
 * points de préparation sont de simples ALERTES, jamais bloquants.
 */
export interface ClientShareBlocker {
  key: 'devis' | 'acompte' | 'demarrage';
  label: string;
  done: boolean;
}
export interface ClientShareReadiness {
  /** Les 3 bloquants sont validés → le dossier peut être partagé au client. */
  shareable: boolean;
  blockers: ClientShareBlocker[];
  /** Libellés des bloquants encore manquants. */
  missing: string[];
}

export function buildClientShareReadiness(dossier: ProjectDossier | null): ClientShareReadiness {
  const docs = dossier?.documents ?? [];
  const fourni = (re: RegExp): boolean =>
    docs.some((d) => re.test(d.label) && d.status === 'fourni');
  const devisSigne = Boolean(dossier?.devis) || fourni(/devis/i);
  // « Acompte reçu » : validé par tout document FOURNI classé « Acompte » (ou
  // reconnu au libellé) — un dépôt de preuve d'acompte suffit désormais.
  const acomptePaye = docs.some((d) => d.status === 'fourni' && isAcompteDocument(d));
  const demarrageFixe = Boolean(dossier?.infos.startDate);

  const blockers: ClientShareBlocker[] = [
    { key: 'devis', label: 'Devis signé', done: devisSigne },
    { key: 'acompte', label: 'Acompte payé', done: acomptePaye },
    { key: 'demarrage', label: 'Date officielle de démarrage', done: demarrageFixe },
  ];
  return {
    shareable: blockers.every((b) => b.done),
    blockers,
    missing: blockers.filter((b) => !b.done).map((b) => b.label),
  };
}

export type ClientMilestoneState = 'done' | 'current' | 'upcoming';

export interface ClientMilestone {
  key: 'valide' | 'preparation' | 'demarrage' | 'prereception' | 'reception';
  label: string;
  state: ClientMilestoneState;
  /** Date ISO (YYYY-MM-DD) affichée UNE FOIS le chantier démarré — sinon null. */
  date: string | null;
  /** Estimation textuelle avant démarrage (« dans environ 6 semaines ») — sinon null. */
  estimate: string | null;
}

export interface ClientPlanning {
  /** false = avant le démarrage officiel (estimations) ; true = démarré (dates). */
  started: boolean;
  /** Exactement 5 grands jalons, jamais les lots techniques. */
  milestones: ClientMilestone[];
  /** Phrase de contexte rassurante, jamais anxiogène. */
  message: string;
}

const DAY = 86_400_000;

const MESSAGE: Record<ProjectStatus, string> = {
  pas_commence: 'Le chantier est actuellement en préparation.',
  en_cours: 'Votre chantier suit son planning. Votre prochaine grande étape sera la pré-réception.',
  pre_reception: 'Votre chantier entre en phase de pré-réception.',
  levee_reserves: 'Les dernières réserves sont levées avant la réception.',
  cloture: 'Votre chantier est réceptionné. Merci de votre confiance.',
};

/** Estimation de démarrage (avant lancement), sans jamais promettre de date. */
function startEstimate(startDate: string | null, nowMs: number): string {
  if (!startDate) return 'à planifier';
  const days = Math.round((new Date(`${startDate}T00:00:00`).getTime() - nowMs) / DAY);
  if (days < 0) return 'à planifier';
  if (days <= 7) return 'très prochainement';
  const weeks = Math.round(days / 7);
  return `dans environ ${weeks} semaine${weeks > 1 ? 's' : ''}`;
}

/**
 * Compose les 5 grands jalons du client à partir du STATUT métier et du dossier.
 * Aucune date avant le démarrage ; dates estimées ensuite. Jamais de lot.
 */
export function buildClientPlanning(
  status: ProjectStatus,
  dossier: ProjectDossier | null,
  nowMs: number = Date.now(),
): ClientPlanning {
  const rank = Math.max(0, PROJECT_STATUSES.indexOf(status));
  const started = rank >= 1; // « En cours » ou au-delà

  const startDate = dossier?.infos.startDate ?? null;
  const planning = dossier ? buildSmartPlanning(dossier, nowMs) : null;
  // Réception et pré-réception sont DÉRIVÉES DE LA DURÉE (source de vérité,
  // calculées dans buildSmartPlanning) — jamais d'un écart figé ici.
  const receptionDate = planning?.endDate ?? null;
  const prereceptionDate = planning?.preReceptionDate ?? null;

  const milestones: ClientMilestone[] = [
    { key: 'valide', label: 'Projet validé', state: 'done', date: null, estimate: null },
    {
      key: 'preparation',
      label: 'Préparation',
      state: rank >= 1 ? 'done' : 'current',
      date: null,
      estimate: null,
    },
    {
      key: 'demarrage',
      label: 'Démarrage',
      state: rank >= 1 ? 'done' : 'upcoming',
      date: started ? startDate : null,
      estimate: started ? null : startEstimate(startDate, nowMs),
    },
    {
      key: 'prereception',
      label: 'Pré-réception',
      state: rank >= 3 ? 'done' : rank >= 1 ? 'current' : 'upcoming',
      date: started ? prereceptionDate : null,
      estimate: null,
    },
    {
      key: 'reception',
      label: 'Réception',
      state: rank >= 4 ? 'done' : rank >= 3 ? 'current' : 'upcoming',
      date: started ? receptionDate : null,
      estimate: null,
    },
  ];

  return { started, milestones, message: MESSAGE[status] };
}

/**
 * La PROCHAINE grande étape à RAPPELER au client (pour « Aujourd'hui ») : le jalon
 * « en cours » qui porte une date ou une estimation ; à défaut, le prochain jalon
 * non terminé qui en porte une. Null si rien de datable (rien à rappeler).
 */
export function nextClientMilestone(
  status: ProjectStatus,
  dossier: ProjectDossier | null,
  nowMs: number = Date.now(),
): ClientMilestone | null {
  const { milestones } = buildClientPlanning(status, dossier, nowMs);
  const hasInfo = (m: ClientMilestone): boolean => Boolean(m.date || m.estimate);
  return (
    milestones.find((m) => m.state === 'current' && hasInfo(m)) ??
    milestones.find((m) => m.state !== 'done' && hasInfo(m)) ??
    null
  );
}
