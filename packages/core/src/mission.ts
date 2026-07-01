/**
 * PHÉNIX 360 — Gestion du chantier : la MISSION
 * ===========================================================================
 * Le conducteur ne « crée pas un document ». Il choisit une mission (pourquoi
 * il est là), il montre et il parle. PHÉNIX en PRÉPARE la sortie — de façon
 * DÉTERMINISTE (heuristique + confirmation humaine, jamais d'invention). Cette
 * préparation est la « charnière » entre la capture (le Moment) et les faits
 * (le Journal). Un LLM pourra remplacer `prepareMission` derrière la même
 * signature, sans toucher aux écrans.
 */
import type { MomentType } from './fil.js';

/** Les 7 missions de la V1 « Gestion du chantier ». Toutes sont des MomentType. */
export type MissionKind =
  'visite' | 'reunion' | 'livraison' | 'prereception' | 'reception' | 'sav' | 'note';

export interface MissionDef {
  kind: MissionKind;
  label: string;
  description: string;
}

/** Catalogue des missions (l'écran d'entrée « Pourquoi êtes-vous là ? »). */
export const MISSIONS: MissionDef[] = [
  {
    kind: 'visite',
    label: 'Visite de chantier',
    description: 'Faire le point, repérer ce qui avance',
  },
  { kind: 'reunion', label: 'Réunion de chantier', description: 'Présents, décisions, actions' },
  { kind: 'livraison', label: 'Livraison de matériel', description: 'Contrôler ce qui arrive' },
  { kind: 'prereception', label: 'Pré-réception', description: 'Lister les points à reprendre' },
  { kind: 'reception', label: 'Réception', description: 'Clôturer le chantier proprement' },
  { kind: 'sav', label: 'SAV', description: 'Traiter une intervention après travaux' },
  { kind: 'note', label: 'Note / observation', description: 'Une trace rapide' },
];

export const MISSION_LABEL: Record<MissionKind, string> = {
  visite: 'Visite de chantier',
  reunion: 'Réunion de chantier',
  livraison: 'Livraison de matériel',
  prereception: 'Pré-réception',
  reception: 'Réception',
  sav: 'SAV',
  note: 'Note de chantier',
};

/** Titre du document projeté selon la mission. */
export const MISSION_DOC_TITLE: Record<MissionKind, string> = {
  visite: 'Compte rendu de visite',
  reunion: 'Compte rendu de réunion',
  livraison: 'Contrôle de livraison',
  prereception: 'Liste des points à reprendre',
  reception: 'PV de réception',
  sav: 'Fiche SAV',
  note: 'Note de chantier',
};

/** Assure qu'un MissionKind est bien un MomentType (contrôle de compilation). */
export const missionMomentType = (kind: MissionKind): MomentType => kind;

/* -------------------------------------------------------------------------- *
 * Préparation d'une mission — ce que PHÉNIX propose à la validation
 * -------------------------------------------------------------------------- */
export interface MissionReserveDraft {
  libelle: string;
  photoId?: string;
}
export interface MissionActionDraft {
  label: string;
  responsable?: string;
}

export interface MissionPreparation {
  kind: MissionKind;
  docTitre: string;
  /** Le récit, découpé en observations propres. */
  observations: string[];
  decisions: string[];
  actions: MissionActionDraft[];
  reserves: MissionReserveDraft[];
  manquants: string[];
  presents: string[];
  /** Corps du document interne (résumé lisible pour le Journal). */
  corps: string;
  /** Voix client (client-safe) — jamais de réserve, responsable ni montant. */
  texteClient: string;
}

/* — Indices lexicaux (PHÉNIX ne propose QUE ce qui est littéralement détecté) — */
const RX_DECISION = /décid|on part sur|on retient|validé|valide|acté|convenu|choix|retenu/i;
const RX_ACTION =
  /il faut|à faire|relanc|prévoir|command|envoy|reprendre|refaire|à suivre|penser à|contacter|planifier|prévenir/i;
const RX_RESERVE =
  /réserve|à reprendre|pas conforme|non conforme|défaut|fissure|malfaçon|abîmé|abime|cassé|casse|rayé|raye|fuite|mal fix|manque|manqu/i;
const RX_MANQUANT =
  /manqu|absent|abîmé|abime|cassé|casse|endommag|rayé|raye|dommage|incomplet|manquant/i;

/** Découpe un récit libre en phrases nettoyées. */
export function phrases(recit: string): string[] {
  return recit
    .split(/[.\n!?;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function cap(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * PHÉNIX prépare la mission. Déterministe : à partir du récit, des présents et
 * des photos, il propose observations, décisions, actions, réserves, manquants —
 * puis un document interne et une voix client. La mission ORIENTE (ce qu'on
 * cherche) mais n'enferme pas (une visite peut faire naître des réserves).
 */
export function prepareMission(input: {
  kind: MissionKind;
  recit: string;
  presents: string[];
  photoIds: string[];
}): MissionPreparation {
  const ph = phrases(input.recit);
  const presents = input.presents.map((s) => s.trim()).filter(Boolean);
  const firstPhoto = input.photoIds[0];
  const asReserve = (libelle: string): MissionReserveDraft => ({
    libelle: cap(libelle),
    ...(firstPhoto ? { photoId: firstPhoto } : {}),
  });

  const decisionsAll = ph.filter((p) => RX_DECISION.test(p)).map(cap);
  const actionsAll = ph.filter((p) => RX_ACTION.test(p)).map((label) => ({ label: cap(label) }));
  const reservesCue = ph.filter((p) => RX_RESERVE.test(p));
  const manquantsAll = ph.filter((p) => RX_MANQUANT.test(p)).map(cap);

  let decisions: string[] = [];
  let actions: MissionActionDraft[] = [];
  let reserves: MissionReserveDraft[] = [];
  let manquants: string[] = [];

  switch (input.kind) {
    case 'reunion':
      decisions = decisionsAll;
      actions = actionsAll;
      reserves = reservesCue.map(asReserve);
      break;
    case 'visite':
      actions = actionsAll;
      reserves = reservesCue.map(asReserve);
      break;
    case 'livraison':
      manquants = manquantsAll;
      reserves = manquantsAll.map((m) => asReserve(`Manquant / dommage : ${m}`));
      break;
    case 'prereception':
      // Toute observation d'une pré-réception est un point à reprendre.
      reserves = ph.map(asReserve);
      break;
    case 'reception':
      reserves = reservesCue.map(asReserve);
      actions = actionsAll;
      break;
    case 'sav':
      actions = actionsAll;
      break;
    case 'note':
    default:
      break;
  }

  const docTitre = MISSION_DOC_TITLE[input.kind];
  const corps = buildCorps({
    kind: input.kind,
    docTitre,
    observations: ph,
    presents,
    decisions,
    actions,
    reserves,
    manquants,
  });
  const texteClient = buildRecapClient(input.kind, ph);

  return {
    kind: input.kind,
    docTitre,
    observations: ph,
    decisions,
    actions,
    reserves,
    manquants,
    presents,
    corps,
    texteClient,
  };
}

function bullets(items: string[]): string {
  return items.map((i) => `• ${i}`).join('\n');
}

/** Corps du document interne (résumé lisible, alimente le Journal). */
export function buildCorps(p: {
  kind: MissionKind;
  docTitre: string;
  observations: string[];
  presents: string[];
  decisions: string[];
  actions: MissionActionDraft[];
  reserves: MissionReserveDraft[];
  manquants: string[];
}): string {
  const parts: string[] = [];
  if (p.presents.length) parts.push(`Présents : ${p.presents.join(', ')}.`);
  if (p.observations.length) parts.push(p.observations.map((o) => `${o}.`).join(' '));
  if (p.decisions.length) parts.push(`Décisions :\n${bullets(p.decisions)}`);
  if (p.actions.length) parts.push(`Actions :\n${bullets(p.actions.map((a) => a.label))}`);
  if (p.manquants.length) parts.push(`Manquants / dommages :\n${bullets(p.manquants)}`);
  if (p.reserves.length)
    parts.push(`Points à reprendre :\n${bullets(p.reserves.map((r) => r.libelle))}`);
  if (parts.length === 0) parts.push('Rien à signaler.');
  return parts.join('\n\n');
}

/**
 * Voix client (client-safe) : reformulation SOBRE des observations. N'invente
 * rien ; n'expose jamais réserves, responsables, décisions internes ni montants.
 */
export function buildRecapClient(kind: MissionKind, observations: string[]): string {
  const intro =
    kind === 'reception'
      ? 'Une étape importante vient d’être franchie sur votre chantier.'
      : kind === 'livraison'
        ? 'Du matériel vient d’arriver sur votre chantier.'
        : 'Voici les dernières nouvelles de votre chantier.';
  // Client-safe strict : on ne garde que les observations NEUTRES (jamais une
  // action, une décision, une réserve ou un manquant — c'est de l'interne).
  const neutres = observations.filter(
    (o) =>
      !RX_ACTION.test(o) && !RX_DECISION.test(o) && !RX_RESERVE.test(o) && !RX_MANQUANT.test(o),
  );
  if (neutres.length === 0) return intro;
  const corps = neutres.map((o) => `${o}.`).join(' ');
  return `${intro} ${corps}`;
}
