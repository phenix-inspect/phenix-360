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
import type { CrAction, CrDecision, CrQuestion } from './event.js';

/**
 * Les missions de la V1 « Gestion du chantier ». Toutes sont des MomentType.
 * Décision produit (09/07/2026) : « Visite » et « Réunion » ont FUSIONNÉ en un
 * unique « Compte rendu de chantier » (une visite improvisée et une réunion
 * programmée produisent le même résultat — le conducteur ne choisit plus le bon
 * bouton, il raconte simplement ce qu'il vient de constater).
 */
export type MissionKind =
  'compte_rendu' | 'livraison' | 'prereception' | 'reception' | 'sav' | 'note';

export interface MissionDef {
  kind: MissionKind;
  label: string;
  description: string;
}

/**
 * Catalogue des missions PROPOSÉES dans « Nouvelle mission » (l'écran d'entrée
 * « Pourquoi êtes-vous là ? »). On garde ce menu extrêmement simple : uniquement
 * les missions réellement utilisées au quotidien — moins le conducteur réfléchit,
 * plus PHÉNIX est efficace.
 *
 * Décision produit (09/07/2026) : « Livraison de matériel » est RETIRÉE du menu
 * (trop spécifique pour la V1). Puis « SAV » et « Note / observation » sont à leur
 * tour RETIRÉES (peu de valeur au quotidien, elles alourdissaient le menu). Dans
 * les trois cas, la LOGIQUE MÉTIER reste intacte et isolée (`MissionKind` / labels
 * / `prepareMission` cases `livraison`, `sav`, `note`) : réactiver une mission =
 * ré-ajouter simplement son entrée ci-dessous. On ne supprime jamais le code —
 * on ne le retire que de l'interface.
 */
export const MISSIONS: MissionDef[] = [
  {
    kind: 'compte_rendu',
    label: 'Compte rendu de chantier',
    description: 'Photographier, commenter, diffuser — point par point',
  },
  {
    kind: 'prereception',
    label: 'Pré-réception',
    description: 'Vérifier l’exécution du contrat signé',
  },
  { kind: 'reception', label: 'Réception', description: 'Clôturer le chantier proprement' },
  // « SAV » et « Note / observation » RETIRÉES du menu (V1) — logique conservée
  // (type + labels + `prepareMission`), il suffit de ré-ajouter leur entrée ici :
  // { kind: 'sav', label: 'SAV', description: 'Traiter une intervention après travaux' },
  // { kind: 'note', label: 'Note / observation', description: 'Une trace rapide' },
];

export const MISSION_LABEL: Record<MissionKind, string> = {
  compte_rendu: 'Compte rendu de chantier',
  livraison: 'Livraison de matériel',
  prereception: 'Pré-réception',
  reception: 'Réception',
  sav: 'SAV',
  note: 'Note de chantier',
};

/** Titre du document projeté selon la mission. */
export const MISSION_DOC_TITLE: Record<MissionKind, string> = {
  compte_rendu: 'Compte rendu de chantier',
  livraison: 'Contrôle de livraison',
  prereception: 'Pré-réception',
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
  responsable?: string;
  echeance?: string;
}

export interface MissionPreparation {
  kind: MissionKind;
  docTitre: string;
  /** Le récit, découpé en observations propres. */
  observations: string[];
  decisions: CrDecision[];
  actions: CrAction[];
  reserves: MissionReserveDraft[];
  questionsClient: CrQuestion[];
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
const RX_QUESTION_CLIENT =
  /le client (demande|souhaite|veut|aimerait|se demande|questionne|s'interroge)/i;

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

  const actionsAll: CrAction[] = ph
    .filter((p) => RX_ACTION.test(p))
    .map((label) => ({ label: cap(label), priorite: 'normale' }));
  const reservesCue = ph.filter((p) => RX_RESERVE.test(p));
  const manquantsAll = ph.filter((p) => RX_MANQUANT.test(p)).map(cap);
  // Questions posées par le client (tournure « le client demande / souhaite… »).
  const questionsClient: CrQuestion[] = ph
    .filter((p) => RX_QUESTION_CLIENT.test(p))
    .map((p) => ({ libelle: cap(p), etat: 'ouverte' }));

  let decisions: CrDecision[] = [];
  let actions: CrAction[] = [];
  let reserves: MissionReserveDraft[] = [];
  let manquants: string[] = [];

  switch (input.kind) {
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
    questionsClient,
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
    questionsClient,
    manquants,
    presents,
    corps,
    texteClient,
  };
}

function bullets(items: string[]): string {
  return items.map((i) => `• ${i}`).join('\n');
}

const suffixe = (parts: (string | undefined)[]): string => {
  const s = parts.filter(Boolean).join(' · ');
  return s ? ` — ${s}` : '';
};

/** Corps du document interne (résumé lisible, alimente le Journal). */
export function buildCorps(p: {
  kind: MissionKind;
  docTitre: string;
  observations: string[];
  presents: string[];
  decisions: CrDecision[];
  actions: CrAction[];
  reserves: MissionReserveDraft[];
  questionsClient?: CrQuestion[];
  manquants: string[];
}): string {
  const parts: string[] = [];
  if (p.presents.length) parts.push(`Présents : ${p.presents.join(', ')}.`);
  if (p.observations.length) parts.push(p.observations.map((o) => `${o}.`).join(' '));
  if (p.decisions.length)
    parts.push(
      `Décisions :\n${bullets(
        p.decisions.map(
          (d) =>
            `${d.libelle}${suffixe([d.quiDecide, d.bloque ? 'bloque le chantier' : undefined])}`,
        ),
      )}`,
    );
  if (p.actions.length)
    parts.push(
      `Actions :\n${bullets(
        p.actions.map((a) => `${a.label}${suffixe([a.responsable, a.echeance])}`),
      )}`,
    );
  if (p.questionsClient?.length)
    parts.push(
      `Questions client :\n${bullets(p.questionsClient.map((q) => `${q.libelle} (${q.etat})`))}`,
    );
  if (p.manquants.length) parts.push(`Manquants / dommages :\n${bullets(p.manquants)}`);
  if (p.reserves.length)
    parts.push(
      `Points à reprendre :\n${bullets(
        p.reserves.map((r) => `${r.libelle}${suffixe([r.responsable, r.echeance])}`),
      )}`,
    );
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
      !RX_ACTION.test(o) &&
      !RX_DECISION.test(o) &&
      !RX_RESERVE.test(o) &&
      !RX_MANQUANT.test(o) &&
      !RX_QUESTION_CLIENT.test(o),
  );
  if (neutres.length === 0) return intro;
  const corps = neutres.map((o) => `${o}.`).join(' ');
  return `${intro} ${corps}`;
}
