/**
 * PHÉNIX 360 — Le Fil (espace de vie du chantier)
 * ===========================================================================
 * Le Fil n'est PAS un réseau social : c'est un espace de vie du chantier. On
 * emprunte l'ergonomie d'Instagram (colonne unique, grandes photos, défilement
 * fluide, ♡ coup de cœur, messages sous le moment) — JAMAIS sa philosophie
 * (pas d'algorithme, pas de course aux likes, pas de scroll infini). On raconte
 * l'histoire d'un chantier comme un bel album photo.
 *
 * Agrégat VOLONTAIREMENT DISTINCT du Journal (event.ts) : le Journal raconte le
 * pilotage, le Fil raconte l'évolution visuelle. Ces deux modules ne fusionnent
 * jamais. Le Fil est exclusivement consacré aux PHOTOS.
 *
 * Modèle PUR (types + sélecteurs) + ports. L'upload réel, le stockage et (plus
 * tard) la curation IA viennent derrière les ports SANS changer ce modèle ni
 * les écrans.
 *
 * Brique 1 (socle) : Moment mono-photo (tableau `photos` prêt pour l'album),
 * ♡ coup de cœur unique, messages de niveau 1, verrouillage dès interaction.
 * Champs réservés (type, etapeImportante, summary, photoId, parentId) déclarés
 * mais non exploités → les bricks suivantes n'imposeront aucune refonte.
 */
import type {
  CoupDeCoeurId,
  FilPhotoId,
  IsoDateTime,
  MessageId,
  MomentId,
  ProjectId,
  UserId,
  ZoneId,
} from './ids.js';
import type { ActorRole } from './actor.js';

/* -------------------------------------------------------------------------- *
 * Audiences — qui voit une publication (jamais binaire interne/client)
 * -------------------------------------------------------------------------- *
 * Déclaré dès le socle pour que les bricks suivantes (audiences avancées,
 * partage privé) s'y branchent sans refonte. PHÉNIX (le pilote) voit tout.
 */
export const AUDIENCE_GROUPS = ['phenix', 'artisans', 'client'] as const;
export type AudienceGroup = (typeof AUDIENCE_GROUPS)[number];

/** Audience par défaut d'un Moment : tout le monde (le conducteur affinera plus tard). */
export const DEFAULT_AUDIENCE: AudienceGroup[] = ['phenix', 'artisans', 'client'];

/**
 * Audience INTERNE — le Moment est **privé par défaut** (conducteur + artisans),
 * invisible au client tant qu'il n'est pas explicitement PARTAGÉ. C'est la règle
 * fondatrice « privé par défaut → Partager → Espace client » : le conducteur vit
 * son chantier en interne, puis choisit ce qu'il publie.
 */
export const INTERNAL_AUDIENCE: AudienceGroup[] = ['phenix', 'artisans'];

/** Audience d'un Moment partagé au client = interne + client. */
export const SHARED_AUDIENCE: AudienceGroup[] = ['phenix', 'artisans', 'client'];

/* -------------------------------------------------------------------------- *
 * Type de Moment — la NATURE de ce que le conducteur vit sur le chantier
 * -------------------------------------------------------------------------- *
 * Le Moment est la brique FONDAMENTALE : le conducteur ne « saisit » pas, il
 * crée un Moment de chantier. Son `type` détermine ce que PHÉNIX en génère (CR
 * de réunion, fiche de visite, bon de livraison…). Union volontairement fermée,
 * prête à accueillir pré-réception / réception / SAV dans les phases suivantes.
 */
export const MOMENT_TYPES = [
  'reunion',
  'visite',
  'livraison',
  'prereception',
  'reception',
  'sav',
  'note',
  'decision',
  'etape',
] as const;
export type MomentType = (typeof MOMENT_TYPES)[number];

export const MOMENT_TYPE_LABEL: Record<MomentType, string> = {
  reunion: 'Réunion de chantier',
  visite: 'Visite de chantier',
  livraison: 'Livraison',
  prereception: 'Pré-réception',
  reception: 'Réception',
  sav: 'SAV',
  note: 'Note de chantier',
  decision: 'Décision',
  etape: 'Étape franchie',
};

/** Libellé court (pour les puces / chips discrètes). */
export const MOMENT_TYPE_SHORT: Record<MomentType, string> = {
  reunion: 'Réunion',
  visite: 'Visite',
  livraison: 'Livraison',
  prereception: 'Pré-réception',
  reception: 'Réception',
  sav: 'SAV',
  note: 'Note',
  decision: 'Décision',
  etape: 'Étape',
};

/* -------------------------------------------------------------------------- *
 * Photo du Fil
 * -------------------------------------------------------------------------- */
export interface FilPhoto {
  id: FilPhotoId;
  /** Image affichable : dataURL en démo, URL signée en production. */
  imageUrl?: string;
  /** Stockage S3-compatible (portable). */
  bucket: string;
  storagePath: string;
  mimeType: string;
  width?: number;
  height?: number;
  legende?: string;
  /** Ordre dans l'album. */
  ordre: number;
  createdAt: IsoDateTime;
}

/** Une signature apposée sur un Moment (réservé — UI en phase réception). */
export interface MomentSignature {
  intervenant: string;
  role?: string;
  imageUrl?: string;
  signedAt: IsoDateTime;
}

/** Géolocalisation d'un Moment (réservé — capturé automatiquement plus tard). */
export interface MomentGeoloc {
  lat: number;
  lng: number;
  label?: string;
}

/* -------------------------------------------------------------------------- *
 * Moment — la BRIQUE FONDAMENTALE de PHÉNIX (un instant de chantier vécu)
 * -------------------------------------------------------------------------- *
 * Le conducteur ne remplit pas de formulaire : il crée un Moment. Tout le reste
 * (document, compte rendu, réserve, levée, historique, partage, réponse client)
 * en découle. Le Fil client n'est qu'une PROJECTION des Moments partagés — un
 * seul modèle, jamais deux. Interne par défaut (`INTERNAL_AUDIENCE`), publié au
 * client seulement s'il est explicitement partagé.
 */
export interface Moment {
  id: MomentId;
  projectId: ProjectId;
  authorId: UserId;
  authorRole: ActorRole;
  createdAt: IsoDateTime;
  publishedAt: IsoDateTime | null;
  state: 'brouillon' | 'publie';

  /**
   * Type de Moment — sa nature (réunion, visite, livraison…). Optionnel pour la
   * compatibilité des Moments déjà stockés ; `momentTypeOf` fournit le défaut.
   */
  type?: MomentType;

  /** Le cœur du Moment : un titre simple (« Cuisine installée »). */
  title: string;
  /** Observations libres du conducteur — le récit du Moment. */
  observations?: string;
  /** Intervenants présents (noms libres en V1). */
  intervenants?: string[];
  /** Localisation dans le projet (affichée discrètement, filtrable plus tard). */
  zoneId?: ZoneId;
  /** Qui voit ce Moment (interne par défaut ; + client une fois partagé). */
  visibleTo: AudienceGroup[];

  /** Les photos de la mission (le tableau est prêt pour l'album). Peut être vide
   *  (une note ou une réunion sans photo reste un Moment valide). */
  photos: FilPhoto[];
  coverPhotoId?: FilPhotoId;

  /* — Réservés (modèle prêt, UI en phases suivantes) — */
  meteo?: string;
  geoloc?: MomentGeoloc;
  signatures?: MomentSignature[];
  etapeImportante?: boolean;
  summary?: string;
}

/* -------------------------------------------------------------------------- *
 * Interactions — coup de cœur (geste unique) & messages (2 niveaux préparés)
 * -------------------------------------------------------------------------- */

/** ♡ Coup de cœur : un seul geste d'appréciation, par personne et par Moment. */
export interface CoupDeCoeur {
  id: CoupDeCoeurId;
  momentId: MomentId;
  userId: UserId;
  userRole: ActorRole;
  createdAt: IsoDateTime;
}

/**
 * Message déposé sous un Moment. `photoId` = null en brique 1 (niveau 1 : tout
 * le Moment) ; le champ existe déjà pour le niveau 2 (une photo précise) à
 * venir. `parentId` réservé pour les réponses.
 */
export interface Message {
  id: MessageId;
  momentId: MomentId;
  photoId: FilPhotoId | null;
  parentId: MessageId | null;
  authorId: UserId;
  authorRole: ActorRole;
  texte: string;
  createdAt: IsoDateTime;
}

/* -------------------------------------------------------------------------- *
 * Zone — localisation d'un projet (Cuisine, Salle de bain, Façade…)
 * -------------------------------------------------------------------------- */
export interface ProjectZone {
  id: ZoneId;
  projectId: ProjectId;
  label: string;
  ordre: number;
}

/* -------------------------------------------------------------------------- *
 * Port média — l'upload réel vit derrière ce port
 * -------------------------------------------------------------------------- *
 * En démo : downscale canvas → dataURL (aucun réseau). En production : upload
 * S3-compatible → URL signée. Même contrat, mêmes écrans.
 */
export interface UploadedMedia {
  imageUrl: string;
  bucket: string;
  storagePath: string;
  mimeType: string;
  width: number;
  height: number;
}
export type MediaUploader = (file: File) => Promise<UploadedMedia>;

/* -------------------------------------------------------------------------- *
 * Sélecteurs purs
 * -------------------------------------------------------------------------- */

/** Couverture d'un Moment (photo de couverture, sinon la première). */
export function momentCover(moment: Moment): FilPhoto | undefined {
  return moment.photos.find((p) => p.id === moment.coverPhotoId) ?? moment.photos[0];
}

/**
 * Un Moment est VERROUILLÉ dès qu'il a reçu une interaction (≥ 1 coup de cœur
 * OU ≥ 1 message) : on ne remplace plus ses photos ni son contenu. Le Fil
 * devient une mémoire fiable. (Corrections de texte / compléments : bricks
 * suivantes.) Sélecteur pur — source unique de la règle.
 */
export function momentVerrouille(id: MomentId, coups: CoupDeCoeur[], messages: Message[]): boolean {
  return coups.some((c) => c.momentId === id) || messages.some((m) => m.momentId === id);
}

/** Le client voit-il ce Moment ? (audience + publié). */
export function momentVisiblePour(moment: Moment, viewer: AudienceGroup): boolean {
  return moment.state === 'publie' && moment.visibleTo.includes(viewer);
}

/** Type effectif d'un Moment (défaut : note) — source unique du défaut. */
export function momentTypeOf(moment: Moment): MomentType {
  return moment.type ?? 'note';
}

/**
 * Types de Moment « de travail » : ils GÉNÈRENT un livrable (compte rendu, PV de
 * pré-réception / réception, bon de livraison, fiche SAV…) et vivent dans le Suivi,
 * les Comptes rendus et les Documents — JAMAIS dans « Dans les coulisses ».
 */
export const MOMENT_TYPES_TRAVAIL: readonly MomentType[] = [
  'reunion',
  'visite',
  'livraison',
  'prereception',
  'reception',
  'sav',
  'note',
  'decision',
];

/**
 * Un Moment appartient-il à « Dans les coulisses » ? Décision produit : cet espace
 * est l'ALBUM PHOTO/VIDÉO du chantier (la brique plaisir), pas un historique. Un
 * moment « coulisses » porte au moins une photo ET n'a AUCUNE vocation documentaire
 * (les missions vivent ailleurs). C'est le SEUL contenu du Fil.
 */
export function estMomentCoulisses(moment: Moment): boolean {
  return moment.photos.length > 0 && !MOMENT_TYPES_TRAVAIL.includes(momentTypeOf(moment));
}

/** Ne conserve que les moments « coulisses » (albums photo) — filtre du Fil. */
export function momentsCoulisses(moments: Moment[]): Moment[] {
  return moments.filter(estMomentCoulisses);
}

/** Nombre maximum de photos dans UN album (un seul moment) — cf. composer. */
export const MAX_ALBUM_PHOTOS = 10;

/**
 * Ce Moment est-il PARTAGÉ au client ? Règle unique : publié + audience client.
 * Le Fil client = l'ensemble des Moments pour lesquels ceci est vrai.
 */
export function momentPartageClient(moment: Moment): boolean {
  return momentVisiblePour(moment, 'client');
}

/** Mois d'une date : clé triable (« 2026-06 ») + libellé (« juin 2026 »). */
export function moisDeDate(date: IsoDateTime): { key: string; label: string } {
  const d = new Date(date);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return { key, label };
}

/** Chapitre par défaut : le mois de création (« juin 2026 »). */
function defaultChapter(m: Moment): { key: string; label: string } {
  return moisDeDate(m.createdAt);
}

/** Une entrée du Fil : un séparateur de chapitre, ou un Moment. */
export type FilEntry =
  { kind: 'chapitre'; key: string; label: string } | { kind: 'moment'; moment: Moment };

/**
 * Le Fil du chantier : une chronologie FLUIDE mais FINIE (récent → ancien),
 * en colonne unique, avec des séparateurs de chapitre DISCRETS. Aucun
 * algorithme, aucun tri de popularité — l'ordre est transparent (la date).
 * `chapterOf` est injectable : par défaut le mois, demain « par phase » sans
 * refonte. Sélecteur pur (la logique vit ici, jamais dans l'UI).
 */
export function filDuChantier(
  moments: Moment[],
  opts: {
    viewer?: AudienceGroup;
    chapterOf?: (m: Moment) => { key: string; label: string };
  } = {},
): FilEntry[] {
  const viewer = opts.viewer;
  const chapterOf = opts.chapterOf ?? defaultChapter;

  const visibles = (viewer ? moments.filter((m) => momentVisiblePour(m, viewer)) : moments)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const entries: FilEntry[] = [];
  let currentKey: string | null = null;
  for (const moment of visibles) {
    const ch = chapterOf(moment);
    if (ch.key !== currentKey) {
      entries.push({ kind: 'chapitre', key: ch.key, label: ch.label });
      currentKey = ch.key;
    }
    entries.push({ kind: 'moment', moment });
  }
  return entries;
}

/** Coups de cœur d'un Moment. */
export function coupsDeCoeurDuMoment(id: MomentId, coups: CoupDeCoeur[]): CoupDeCoeur[] {
  return coups.filter((c) => c.momentId === id);
}

/** Cet utilisateur a-t-il déjà mis un coup de cœur sur ce Moment ? */
export function aMisCoupDeCoeur(id: MomentId, userId: UserId, coups: CoupDeCoeur[]): boolean {
  return coups.some((c) => c.momentId === id && c.userId === userId);
}

/** Messages d'un Moment (niveau 1 = photoId null), anciens d'abord. */
export function messagesDuMoment(id: MomentId, messages: Message[]): Message[] {
  return messages
    .filter((m) => m.momentId === id && m.photoId === null)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

/** Messages attachés à une PHOTO précise (niveau 2), anciens d'abord. */
export function messagesDePhoto(photoId: FilPhotoId, messages: Message[]): Message[] {
  return messages
    .filter((m) => m.photoId === photoId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

/** Nombre de messages par photo (repères discrets dans la galerie). */
export function comptesMessagesParPhoto(messages: Message[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of messages) {
    if (m.photoId) counts.set(m.photoId, (counts.get(m.photoId) ?? 0) + 1);
  }
  return counts;
}

/* -------------------------------------------------------------------------- *
 * Bibliothèque d'images — UNE AUTRE VUE sur les mêmes médias
 * -------------------------------------------------------------------------- *
 * « 1 partage = 2 vues » : Le Fil raconte l'histoire (chronologie), la
 * Bibliothèque permet de retrouver une image (classement). AUCUNE duplication :
 * la Bibliothèque est purement DÉRIVÉE des Moments (même source de données).
 *
 * L'entrée porte déjà toutes les dimensions de classement à venir (pièce, date,
 * auteur, type, étape, favoris) → les filtres des prochaines bricks se
 * brancheront sans refonte du modèle ni du store.
 */
export interface BibliothequeImage {
  photo: FilPhoto;
  /** Moment d'origine (la Bibliothèque renvoie toujours vers le Fil). */
  momentId: MomentId;
  title: string;
  /** Dimensions de filtrage (préparées pour les prochaines bricks). */
  zoneId?: ZoneId;
  date: IsoDateTime;
  authorId: UserId;
  authorRole: ActorRole;
  type?: MomentType;
  etapeImportante?: boolean;
}

/**
 * Toutes les images du projet, à plat, récent → ancien. Vue secondaire dérivée
 * des Moments (jamais un second stockage). Sélecteur pur — prêt à recevoir des
 * filtres (pièce / date / auteur / type / étape / favoris) sans refonte.
 */
export function bibliothequeImages(
  moments: Moment[],
  opts: { viewer?: AudienceGroup } = {},
): BibliothequeImage[] {
  const viewer = opts.viewer;
  const visibles = viewer ? moments.filter((m) => momentVisiblePour(m, viewer)) : moments;
  const images: BibliothequeImage[] = [];
  for (const m of visibles) {
    for (const photo of m.photos) {
      images.push({
        photo,
        momentId: m.id,
        title: m.title,
        zoneId: m.zoneId,
        date: m.createdAt,
        authorId: m.authorId,
        authorRole: m.authorRole,
        type: m.type,
        etapeImportante: m.etapeImportante,
      });
    }
  }
  return images.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/* ----------------------- filtres simples (brique courante) ----------------- */

/** Filtres de la Bibliothèque (V1 : pièce, mois, coups de cœur). */
export interface BibliothequeFilters {
  zoneId?: ZoneId;
  /** Clé de mois « YYYY-MM » (cf. moisDeDate). */
  mois?: string;
  avecCoupDeCoeur?: boolean;
}

/**
 * Applique les filtres à la Bibliothèque. Sélecteur PUR. « avec coup de cœur »
 * = le Moment d'origine a reçu une appréciation (ensemble d'ids fourni par
 * l'appelant, pour rester sans dépendance). Prêt à accueillir d'autres filtres
 * (auteur, type, étape) sans refonte.
 */
export function filtrerBibliotheque(
  images: BibliothequeImage[],
  filters: BibliothequeFilters,
  momentsAimes: ReadonlySet<string>,
): BibliothequeImage[] {
  return images.filter((img) => {
    if (filters.zoneId && img.zoneId !== filters.zoneId) return false;
    if (filters.mois && moisDeDate(img.date).key !== filters.mois) return false;
    if (filters.avecCoupDeCoeur && !momentsAimes.has(img.momentId)) return false;
    return true;
  });
}

/** Mois présents dans une liste d'images (récent → ancien), pour les facettes. */
export function moisDisponibles(images: BibliothequeImage[]): { key: string; label: string }[] {
  const map = new Map<string, string>();
  for (const img of images) {
    const m = moisDeDate(img.date);
    if (!map.has(m.key)) map.set(m.key, m.label);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, label]) => ({ key, label }));
}

/** Pièces (zoneId) présentes dans une liste d'images, pour les facettes. */
export function zonesDisponibles(images: BibliothequeImage[]): Set<string> {
  const set = new Set<string>();
  for (const img of images) if (img.zoneId) set.add(img.zoneId);
  return set;
}
