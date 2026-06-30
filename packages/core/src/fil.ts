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

/* -------------------------------------------------------------------------- *
 * Moment — l'unité du Fil (une belle photo, ou un album)
 * -------------------------------------------------------------------------- */
export interface Moment {
  id: MomentId;
  projectId: ProjectId;
  authorId: UserId;
  authorRole: ActorRole;
  createdAt: IsoDateTime;
  publishedAt: IsoDateTime | null;
  state: 'brouillon' | 'publie';

  /** Le cœur du Moment : un titre simple (« Cuisine installée »). */
  title: string;
  /** Localisation dans le projet (affichée discrètement, filtrable plus tard). */
  zoneId?: ZoneId;
  /** Qui voit ce Moment (défaut : tout le monde). */
  visibleTo: AudienceGroup[];

  /** 1 photo en brique 1 ; le tableau est prêt pour l'album. */
  photos: FilPhoto[];
  coverPhotoId: FilPhotoId;

  /* — Réservés (déclarés, non exploités en brique 1) — */
  type?: 'realisation' | 'avant_apres';
  etapeImportante?: boolean;
  summary?: string;
}

/* -------------------------------------------------------------------------- *
 * Annotations — coup de cœur (geste unique) & messages (2 niveaux préparés)
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

/** Chapitre par défaut : le mois de création (« juin 2026 »). */
function defaultChapter(m: Moment): { key: string; label: string } {
  const d = new Date(m.createdAt);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return { key, label };
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
  type?: 'realisation' | 'avant_apres';
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
