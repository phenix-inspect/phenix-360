/**
 * PHÉNIX 360 — Store du Mode Démo
 * ---------------------------------------------------------------------------
 * Réactif, mais SANS logique métier : il ne fait qu'orchestrer les ports
 * `@phenix360/core` (InMemoryBackend) et exposer un snapshot à React. Passer en
 * Supabase = remplacer le backend par un adaptateur des mêmes ports, sans
 * toucher aux surfaces ni à la logique (qui vit dans core).
 *
 * Persistance : localStorage (démo multi-onglets) + BroadcastChannel pour la
 * synchro instantanée entre onglets/fenêtres. Les « noms » (people) et le projet
 * actif sont des détails de démo, hors modèle core.
 */
import { useSyncExternalStore } from 'react';
import {
  INTERNAL_AUDIENCE,
  SHARED_AUDIENCE,
  InMemoryBackend,
  ensureProjectCodes,
  PROJECT_STATUS_LABEL,
  deriveProjectStatus,
  answerContractQuestion,
  type ContractAnswer,
  askPhenix as corePhenix,
  attachmentId as toAttachmentId,
  buildDecisionContent,
  choixClientValides,
  coupDeCoeurId as toCoupId,
  decisionVisibility,
  defaultLaunchChecklist,
  eventId as toEventId,
  estMomentCoulisses,
  isVisibleToClient,
  MAX_ALBUM_PHOTOS,
  realAnalyzeDossier,
  type AnalyzeInput,
  type DossierAnalyzer,
  type EventVisibility,
  filPhotoId as toFilPhotoId,
  messageId as toMessageId,
  momentId as toMomentId,
  momentPartageClient,
  nextReserveNumero,
  userId as toUserId,
  type Backend,
  type BackendState,
  type CommCanal,
  type Contact,
  type ClientSelection,
  type CompteRenduPhoto,
  type CompteRenduPoint,
  type CoupDeCoeur,
  type CrAudience,
  type DecisionEvent,
  type Diffusion,
  type DemandeResolution,
  type SelectionOption,
  type ActionPriorite,
  type Event,
  type EventActor,
  type EventAttachment,
  type EventId,
  type FilPhoto,
  type KeyValueStore,
  type Message,
  type Moment,
  type MomentType,
  type NewEvent,
  type NewMember,
  type NewProject,
  type PhenixAction,
  type PhenixSource,
  type PhenixTodo,
  type PrepDocCategory,
  type PrereceptionData,
  prereceptionDocTitle,
  type ReceptionData,
  receptionDocTitle,
  reconcileTotals,
  evaluerVerification,
  type Devis,
  type Project,
  type ProjectDocument,
  type ProjectDossier,
  type ProjectId,
  type ProjectPatch,
  type ProjectStep,
  type ProjectProposal,
  type ProjectZone,
  type UploadedMedia,
  type UserId,
  type ZoneId,
} from '@phenix360/core';
import { buildDemoSeed } from './seed';
import {
  downloadAttachment,
  downloadPdfDocument,
  openAttachment,
  openHtmlDocument,
  openUnavailableDocument,
} from './lib/document';
import {
  buildDocumentHtml,
  generatedDocumentTitle,
  type DocumentContext,
} from './lib/generatedDocument';
import { buildDocumentPdf } from './lib/pdfEngine';
import { readDocumentAttachment } from './lib/upload';
import { SaaSBackend } from './lib/saasBackend';
import type { SupabaseClient } from '@supabase/supabase-js';

const STATE_KEY = 'phenix-demo:state:v1';
const PEOPLE_KEY = 'phenix-demo:people:v1';
const ACTIVE_KEY = 'phenix-demo:active:v1';
const DOSSIERS_KEY = 'phenix-demo:dossiers:v1';
const SEEDED_KEY = 'phenix-demo:seeded:v1';
// Le Fil — agrégat distinct du Journal (persisté à part, par projet).
const FIL_MOMENTS_KEY = 'phenix-demo:fil-moments:v1';
const FIL_COUPS_KEY = 'phenix-demo:fil-coups:v1';
const FIL_MESSAGES_KEY = 'phenix-demo:fil-messages:v1';
const FIL_ZONES_KEY = 'phenix-demo:fil-zones:v1';
// PHÉNIX (conversation client) — agrégat léger, distinct du Journal.
const PHENIX_CONV_KEY = 'phenix-demo:phenix-conv:v1';
// Gestion du chantier — journal des partages (simulation / aperçu, hors Journal).
const SHARES_KEY = 'phenix-demo:shares:v1';
// Annuaire du conducteur (contacts) — global, réutilisable entre chantiers.
const CONTACTS_KEY = 'phenix-demo:contacts:v1';
// État « lu » des Moments, par RÔLE (device-local) : ce que CE poste a consulté.
// Ce n'est pas un fait du Journal (qui reste l'unique source de vérité) mais un
// simple accusé de lecture qui éteint les notifications une fois consultées.
const SEEN_KEY = 'phenix-demo:seen:v1';
// Choix client validés « pris en compte » par le conducteur (device-local) :
// `decisionEventId → ISO`. Éteint la notification « choix à traiter » une fois
// l'action engagée (commande, artisan, planning). Accusé, pas un fait métier.
const CHOIX_TRAITES_KEY = 'phenix-demo:choix-traites:v1';
// Repère « notifications » (device-local) : les faits ANTÉRIEURS à cette date ne
// génèrent pas de notification (sinon la démo croulerait sous l'historique seedé).
// Seules les actions POSTÉRIEURES (session en cours) notifient l'autre partie.
const NOTIF_BASELINE_KEY = 'phenix-demo:notif-baseline:v1';
// « Mon espace » côté client (par chantier) : code d'accès, personnes invitées,
// préférences de notification. Réglages du client, distincts du dossier métier.
const CLIENT_SETTINGS_KEY = 'phenix-demo:client-settings:v1';
// Consentement cookies (device-local, global) : une fois accepté, le bandeau ne
// réapparaît plus. V1 : cookies nécessaires uniquement, pas de CMP.
const COOKIE_CONSENT_KEY = 'phenix-demo:cookie-consent:v1';

/** Une entrée du journal des partages (aperçu / journalisation, pas d'envoi réel). */
export interface ShareLog {
  id: string;
  missionEventId: string;
  audiences: string[];
  at: string;
}

/** Un message du fil de conversation PHÉNIX (côté client). */
export interface PhenixMessage {
  id: string;
  role: 'client' | 'phenix';
  texte: string;
  at: string;
  kind?: 'reponse' | 'escalade';
  sources?: PhenixSource[];
  avancer?: PhenixTodo;
  /** Navigation associée (bouton dans le fil). */
  action?: PhenixAction;
  /** Commande explicite → l'UI ouvre d'emblée (TRANSITOIRE, jamais persisté). */
  autoOpen?: boolean;
  /** Si escaladée : l'événement `demande` créé au Journal (pour la reprise). */
  demandeRef?: string;
  /** Photos jointes par le client à SON message (0 à 3). */
  photos?: CompteRenduPhoto[];
}

/** Cible de navigation posée par PHÉNIX (consommée par l'Espace client). */
export interface ClientTarget {
  kind: 'document' | 'decision' | 'etapes' | 'fil';
  ref?: string;
}

/** Une personne invitée par le client à suivre son chantier (« Mon espace »). */
export interface ClientInvitee {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  role: string;
  statut: 'invite' | 'actif';
  createdAt: string;
}

/** Les cinq préférences de notification simples (« Mon espace »). */
export interface ClientNotifPrefs {
  photos: boolean;
  documents: boolean;
  reponse: boolean;
  decision: boolean;
  rappelReception: boolean;
}
export type ClientNotifPrefKey = keyof ClientNotifPrefs;

/**
 * Réglages « Mon espace » du client, par chantier : son code d'accès, les
 * personnes qu'il a invitées, ses préférences de notification. Réglages du
 * client (device-local en démo), distincts du dossier métier du conducteur.
 */
export interface ClientSettings {
  accessCode: string;
  invitees: ClientInvitee[];
  notifPrefs: ClientNotifPrefs;
}

/** Code d'accès par défaut d'un chantier (masqué, modifiable par le client). */
const DEFAULT_ACCESS_CODE = 'phenix2026';
function defaultClientSettings(): ClientSettings {
  return {
    accessCode: DEFAULT_ACCESS_CODE,
    invitees: [],
    notifPrefs: {
      photos: true,
      documents: true,
      reponse: true,
      decision: true,
      rappelReception: true,
    },
  };
}

/**
 * Accusés de lecture des Moments, par rôle : `role → momentId → ISO consulté`.
 * Un message de l'AUTRE partie est « non lu » tant que le rôle n'a pas consulté
 * le Moment depuis. Purement local (accusé de réception), jamais un fait métier.
 */
export type SeenState = Record<string, Record<string, string>>;

/**
 * Cible transitoire : ouvrir un Moment précis dans le Récit (depuis une
 * notification), le mettre en évidence et poser le curseur dans la réponse.
 * `role` cible le bon Récit en vue Côte à côte (conducteur vs client).
 */
export interface MomentFocus {
  momentId: string;
  role: string;
}

const emptyState = (): BackendState => ({ projects: [], members: [], events: [] });

/**
 * MIROIR MÉMOIRE de l'espace de travail. Le Mode Démo garde sa vérité en MÉMOIRE
 * VIVE ; localStorage n'est qu'un cache de confort (survie au rechargement).
 * Quand le quota est atteint (utilisateur qui a beaucoup testé, photos
 * accumulées), `setItem` lève `QuotaExceededError`. Sans miroir, le backend est
 * « read-through » localStorage : une écriture qui échoue = donnée PERDUE (au
 * `refresh` suivant, `build()` relit localStorage sans la nouveauté → la demande
 * disparaît, le fil s'efface, aucune notification conducteur). Avec le miroir, la
 * lecture voit d'abord ce qu'on a écrit en mémoire : la session reste PLEINEMENT
 * fonctionnelle même quota plein — seule la survie au rechargement dégrade. Ne
 * masque rien (avertissement console explicite).
 */
const memMirror = new Map<string, string>();

/**
 * L'écriture localStorage a-t-elle échoué au moins une fois (quota saturé) ? La
 * session reste fonctionnelle (miroir mémoire), mais le travail pourrait ne pas
 * survivre à un rechargement. On l'expose dans le snapshot pour AVERTIR
 * l'utilisateur — sans ce signal visible, la perte serait silencieuse (le pire
 * appel au support : « mes photos ont disparu »). Drapeau collant : une fois vrai,
 * il le reste pour la session (le quota ne se libère pas tout seul).
 */
let storageSaturated = false;

function lsGet(key: string): string | null {
  if (memMirror.has(key)) return memMirror.get(key) ?? null;
  try {
    // Lecture best-effort : sur certains navigateurs (mode privé strict, stockage
    // désactivé), `getItem` lui-même LÈVE (SecurityError). Sans ce garde, la
    // construction de l'état échouait au démarrage → écran blanc.
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  // Vérité en mémoire — TOUJOURS. localStorage ensuite, best-effort.
  memMirror.set(key, value);
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    storageSaturated = true;
    console.warn(
      `[phenix-demo] Persistance impossible pour « ${key} » (quota localStorage ?). ` +
        `La session continue en mémoire ; la donnée peut ne pas survivre au rechargement.`,
      e,
    );
    return false;
  }
}

function lsRemove(key: string): void {
  memMirror.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    /* rien à faire : la clé mémoire est déjà retirée */
  }
}

/**
 * Vide le miroir mémoire : à appeler quand une AUTRE onglet a modifié le stockage
 * (message `channel`), pour que `build()` relise la vérité de localStorage plutôt
 * qu'un cache mémoire devenu périmé.
 */
function clearMemMirror(): void {
  memMirror.clear();
}

/**
 * Parse JSON TOLÉRANT : une clé corrompue (dérive de schéma, valeur tronquée par
 * un crash, édition manuelle) ne doit JAMAIS faire écran blanc au démarrage — on
 * dégrade proprement vers la valeur par défaut plutôt que de laisser `JSON.parse`
 * lever pendant l'évaluation du module.
 */
function parseJsonSafe<T>(raw: string | null, fallback: T, key: string): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`PHÉNIX 360 — donnée « ${key} » illisible, ignorée (valeur par défaut).`);
    return fallback;
  }
}

class LocalStorageKeyValueStore implements KeyValueStore {
  load(): BackendState | null {
    return parseJsonSafe<BackendState | null>(lsGet(STATE_KEY), null, STATE_KEY);
  }
  save(state: BackendState): void {
    safeSetItem(STATE_KEY, JSON.stringify(state));
  }
}

function readJson<T>(key: string, fallback: T): T {
  return parseJsonSafe(lsGet(key), fallback, key);
}

/**
 * Crée ou met à jour le CONTACT qui incarne le client d'un chantier (source
 * unique de ses coordonnées, VISION Art. 6). L'identité qui pilote le client-safe
 * reste `Project.clientId` ; ce contact la rend éditable en un seul endroit et
 * joignable depuis le Carnet. Persiste dans CONTACTS_KEY (pas de refresh ici :
 * l'appelant rafraîchit).
 */
function upsertClientContact(input: {
  projectId: string;
  clientId: UserId;
  nom: string;
  phone?: string;
  email?: string;
  address?: string;
}): void {
  const list = readJson<Contact[]>(CONTACTS_KEY, []);
  const existing = list.find((c) => c.userId === input.clientId);
  if (existing) {
    existing.nom = input.nom;
    if (input.phone) existing.phone = input.phone;
    if (input.email) existing.email = input.email;
    if (input.address) existing.address = input.address;
    if (!existing.projectIds.includes(input.projectId)) existing.projectIds.push(input.projectId);
  } else {
    list.push({
      id: crypto.randomUUID(),
      nom: input.nom,
      role: 'client',
      userId: input.clientId,
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.address ? { address: input.address } : {}),
      projectIds: [input.projectId],
      createdAt: new Date().toISOString(),
    });
  }
  safeSetItem(CONTACTS_KEY, JSON.stringify(list));
}

/** Snapshot exposé à React (immuable entre deux changements). */
export interface DemoSnapshot extends BackendState {
  /** userId → nom affichable (détail de démo, hors core). */
  people: Record<string, string>;
  activeProjectId: ProjectId | null;
  /** projectId → dossier préparé par PHÉNIX Start (hors colonne vertébrale). */
  dossiers: Record<string, ProjectDossier>;
  /** Le Fil (par projet) — agrégat distinct du Journal. */
  fil: {
    moments: Record<string, Moment[]>;
    coups: Record<string, CoupDeCoeur[]>;
    messages: Record<string, Message[]>;
    zones: Record<string, ProjectZone[]>;
  };
  /** Conversation PHÉNIX (par projet) — fil client, distinct du Journal. */
  phenix: Record<string, PhenixMessage[]>;
  /** Journal des partages (par projet) — aperçu / simulation, hors Journal. */
  shares: Record<string, ShareLog[]>;
  /** Annuaire du conducteur — contacts globaux, réutilisables entre chantiers. */
  contacts: Contact[];
  /** Cible transitoire : ouvrir une photo précise du Fil (lien retour). */
  filTarget: { momentId: string; photoId?: string } | null;
  /** Cible transitoire : ouvrir un Moment précis du Récit (depuis une notification). */
  momentFocus: MomentFocus | null;
  /** Cible transitoire : navigation PHÉNIX dans l'Espace client. */
  clientTarget: ClientTarget | null;
  /** Accusés de lecture des Moments, par rôle (éteint les notifications). */
  seen: SeenState;
  /** Choix client validés « pris en compte » : `decisionEventId → ISO`. */
  choixTraites: Record<string, string>;
  /** Réglages « Mon espace » du client, par chantier (code, invités, notifs). */
  clientSettings: Record<string, ClientSettings>;
  /** Consentement cookies (device-local) : le bandeau ne réapparaît plus après. */
  cookieConsent: boolean;
  /**
   * L'espace de travail est-il initialisé ? `false` au tout premier lancement :
   * on propose alors un CHOIX (découvrir la démo / démarrer à vide) plutôt que
   * d'imposer la démo. Passe à `true` dès qu'un choix est fait.
   */
  seeded: boolean;
  /**
   * Le stockage local est-il saturé (une écriture a échoué) ? Vrai ⇒ la session
   * reste active mais le travail pourrait ne pas survivre à un rechargement. L'UI
   * l'affiche pour que l'utilisateur agisse (libérer de l'espace) — jamais silencieux.
   */
  storageSaturated: boolean;
}

const kv = new LocalStorageKeyValueStore();
/**
 * Backend ACTIF (port `Backend`). Par défaut : mémoire adossée à localStorage
 * (démo / e2e — comportement d'origine, mode par défaut). En mode SaaS (Supabase
 * configuré ET utilisateur connecté), `connectSupabase()` le remplace par
 * `SaaSBackend` (write-through cloud). Le reste du store ne voit AUCUNE différence :
 * il parle au port, pas au stockage.
 */
let backend: Backend = new InMemoryBackend(kv);
/**
 * Backend SaaS courant, s'il est branché : sa source de vérité colonne vertébrale
 * (projets/membres/événements) est un cache hydraté depuis Supabase, exposé à
 * `build()` de façon synchrone via `snapshot()`. `null` en mode démo.
 */
let saasBackend: SaaSBackend | null = null;
/**
 * Identité RÉELLE du conducteur connecté (mode SaaS) : c'est LUI qui crée et
 * signe les chantiers/comptes rendus (auteur = `auth.uid()`, exigé par la RLS).
 * `null` en démo (identités fabriquées localement).
 */
let saasUserId: UserId | null = null;
const channel = new BroadcastChannel('phenix-demo');
const listeners = new Set<() => void>();

// Cibles transitoires (en mémoire) : lien retour « Voir la photo » + navigation
// PHÉNIX. Déclarées AVANT build() (elles y sont lues) pour éviter tout TDZ.
let filTarget: { momentId: string; photoId?: string } | null = null;
let momentFocus: MomentFocus | null = null;
let clientTarget: ClientTarget | null = null;
// PORT D'ANALYSE (unique) — LECTURE RÉELLE du devis (`realAnalyzeDossier`) :
// PHÉNIX lit le texte réellement extrait des PDF, sans rien inventer. Un vrai
// LLM/OCR pourra le remplacer via `setDossierAnalyzer`, SANS toucher aux écrans.
let dossierAnalyzer: DossierAnalyzer = realAnalyzeDossier;

/**
 * Migration douce : les chantiers créés AVANT la check-list standard n'ont pas de
 * champ `checklist`. On le backfill avec la check-list PHÉNIX (le conducteur n'a
 * jamais une liste vide). On NE TOUCHE PAS à un tableau vide : le conducteur a pu
 * retirer volontairement tous les points. Idempotent.
 */
function migrateDossierChecklists(): void {
  if (typeof localStorage === 'undefined') return;
  const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
  let changed = false;
  for (const d of Object.values(dossiers)) {
    if (d.checklist === undefined) {
      d.checklist = defaultLaunchChecklist();
      changed = true;
    }
  }
  if (changed) safeSetItem(DOSSIERS_KEY, JSON.stringify(dossiers));
}

/**
 * Migration douce : les chantiers créés AVANT le code chantier `AA-VV-NNN` n'en
 * ont pas. On l'attribue de façon déterministe (ordre chronologique), en
 * préservant les codes déjà valides (définitifs). Idempotent.
 */
function migrateProjectCodes(): void {
  if (typeof localStorage === 'undefined') return;
  const state = kv.load();
  if (!state) return;
  const projects = ensureProjectCodes(state.projects);
  const changed = projects.some((p, i) => p !== state.projects[i]);
  if (changed) kv.save({ ...state, projects });
}

/**
 * Repère « notifications » : posé au tout premier chargement (ou à la migration
 * d'un poste existant). Les faits antérieurs (historique seedé) ne notifient pas ;
 * seules les actions de la session en cours le font.
 */
function ensureNotifBaseline(): void {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(NOTIF_BASELINE_KEY) === null)
    safeSetItem(NOTIF_BASELINE_KEY, JSON.stringify(new Date().toISOString()));
}

migrateDossierChecklists();
migrateProjectCodes();
ensureNotifBaseline();
let snapshot: DemoSnapshot = build();

/**
 * Snapshot SYNCHRONE de la colonne vertébrale (projets/membres/événements) pour
 * `build()`. Démo : localStorage. SaaS : le cache mémoire du `SaaSBackend`
 * (hydraté depuis Supabase). Les « satellites » (people, dossiers, Fil…) restent
 * locaux pour cette tranche (migration progressive, cf. MIGRATION.md M4).
 */
function coreState(): BackendState {
  return saasBackend ? saasBackend.snapshot() : (kv.load() ?? emptyState());
}

function build(): DemoSnapshot {
  return {
    ...coreState(),
    people: readJson<Record<string, string>>(PEOPLE_KEY, {}),
    activeProjectId: readJson<ProjectId | null>(ACTIVE_KEY, null),
    dossiers: readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {}),
    fil: {
      moments: readJson<Record<string, Moment[]>>(FIL_MOMENTS_KEY, {}),
      coups: readJson<Record<string, CoupDeCoeur[]>>(FIL_COUPS_KEY, {}),
      messages: readJson<Record<string, Message[]>>(FIL_MESSAGES_KEY, {}),
      zones: readJson<Record<string, ProjectZone[]>>(FIL_ZONES_KEY, {}),
    },
    phenix: readJson<Record<string, PhenixMessage[]>>(PHENIX_CONV_KEY, {}),
    shares: readJson<Record<string, ShareLog[]>>(SHARES_KEY, {}),
    contacts: readJson<Contact[]>(CONTACTS_KEY, []),
    filTarget,
    momentFocus,
    clientTarget,
    seen: readJson<SeenState>(SEEN_KEY, {}),
    choixTraites: readJson<Record<string, string>>(CHOIX_TRAITES_KEY, {}),
    clientSettings: readJson<Record<string, ClientSettings>>(CLIENT_SETTINGS_KEY, {}),
    cookieConsent:
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(COOKIE_CONSENT_KEY) !== null
        : false,
    // En SaaS, l'espace de travail EST le cloud (pas d'écran « découvrir la
    // démo / démarrer à vide ») : on considère l'espace initialisé d'emblée.
    seeded: saasBackend
      ? true
      : typeof localStorage !== 'undefined'
        ? localStorage.getItem(SEEDED_KEY) !== null
        : true,
    storageSaturated,
  };
}

/**
 * Toutes les clés qui composent l'espace de travail local (hors marqueur
 * d'initialisation `SEEDED_KEY`). Source unique pour vider, exporter et
 * restaurer : chantiers/journal (`STATE_KEY`), noms, projet actif, dossiers,
 * épingles, tout le Fil, la conversation PHÉNIX et le journal des partages.
 */
const WORKSPACE_KEYS = [
  STATE_KEY,
  PEOPLE_KEY,
  ACTIVE_KEY,
  DOSSIERS_KEY,
  FIL_MOMENTS_KEY,
  FIL_COUPS_KEY,
  FIL_MESSAGES_KEY,
  FIL_ZONES_KEY,
  PHENIX_CONV_KEY,
  SHARES_KEY,
  CONTACTS_KEY,
  SEEN_KEY,
  CHOIX_TRAITES_KEY,
  CLIENT_SETTINGS_KEY,
] as const;

/** Marqueur du format de sauvegarde (pour reconnaître un fichier valide). */
const BACKUP_APP = 'phenix-360';
const BACKUP_VERSION = 1;

/** Vide TOUT l'espace de travail (toutes les clés) et le marque initialisé. */
function clearWorkspace(): void {
  for (const key of WORKSPACE_KEYS) lsRemove(key);
  safeSetItem(SEEDED_KEY, '1');
}

function refresh(): void {
  snapshot = build();
  for (const l of listeners) l();
}

function broadcast(): void {
  channel.postMessage('changed');
}

// Un AUTRE onglet a modifié le stockage : on jette le miroir mémoire (devenu
// potentiellement périmé) pour que `build()` relise la vérité de localStorage.
channel.onmessage = () => {
  clearMemMirror();
  refresh();
};

async function mutate<T>(p: Promise<T>): Promise<T> {
  const r = await p;
  refresh();
  broadcast();
  return r;
}

export const demo = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): DemoSnapshot {
    return snapshot;
  },

  /**
   * Branche la colonne vertébrale sur Supabase (mode SaaS). Idempotent : si déjà
   * connecté pour ce même utilisateur, ne refait rien. Hydrate le cache depuis le
   * cloud AVANT de basculer, puis rafraîchit l'UI. Tolérant : si l'hydratation
   * échoue, on reste en démo locale (jamais d'écran cassé). À appeler une fois la
   * session Supabase connue (cf. AuthGate).
   */
  async connectSupabase(client: SupabaseClient, userId: string): Promise<void> {
    const uid = toUserId(userId);
    if (saasBackend && saasUserId === uid) return;
    try {
      const sb = new SaaSBackend(client, userId);
      await sb.hydrate();
      saasBackend = sb;
      backend = sb;
      saasUserId = uid;
    } catch (e) {
      // Échec inattendu : on ne casse pas l'app, on reste sur le backend local.
      console.warn('[phenix] connexion Supabase impossible, mode local conservé', e);
    }
    refresh();
    // Pas de broadcast : chaque onglet a sa propre session / son propre cache.
  },
  /** Débranche Supabase (déconnexion) : retour au backend local (démo). */
  disconnectSupabase(): void {
    saasBackend = null;
    saasUserId = null;
    backend = new InMemoryBackend(kv);
    refresh();
  },
  /** Vrai si la colonne vertébrale est actuellement servie par Supabase. */
  isSaaS(): boolean {
    return saasBackend !== null;
  },

  // Identités de démo (noms) — hors modèle core.
  setPerson(userId: UserId, name: string): void {
    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    people[userId] = name;
    safeSetItem(PEOPLE_KEY, JSON.stringify(people));
    refresh();
    broadcast();
  },
  setActiveProject(id: ProjectId | null): void {
    safeSetItem(ACTIVE_KEY, JSON.stringify(id));
    refresh();
    broadcast();
  },

  /** Demande l'ouverture d'une photo précise du Fil (lien retour depuis le Journal). */
  openFilPhoto(momentId: string, photoId?: string): void {
    filTarget = { momentId, ...(photoId ? { photoId } : {}) };
    refresh();
  },
  /** Cible consommée par la galerie. */
  clearFilTarget(): void {
    filTarget = null;
    refresh();
  },

  /**
   * Ouvre un Moment précis du Récit depuis une notification : le Récit défile
   * jusqu'à lui, le met en évidence et pose le curseur dans la réponse. `role`
   * cible le bon Récit (conducteur / client) en vue Côte à côte.
   */
  focusMoment(momentId: string, role: string): void {
    momentFocus = { momentId, role };
    refresh();
  },
  /** Cible consommée par le Récit. */
  clearMomentFocus(): void {
    momentFocus = null;
    refresh();
  },
  /**
   * Marque un Moment comme LU par un rôle (accusé de lecture local) : éteint la
   * notification correspondante sans exiger de réponse. « Consulter suffit ».
   */
  markMomentSeen(role: string, momentId: string): void {
    demo.markSeen(role, [momentId]);
  },

  /**
   * Ouvre un document pour consultation. DEUX catégories, jamais confondues :
   *
   *   • DOCUMENT IMPORTÉ (`type === 'document'`) — un vrai fichier déposé (PDF,
   *     image…). On ouvre TOUJOURS le FICHIER D'ORIGINE, jamais une page HTML de
   *     remplacement. Si le fichier n'est plus récupérable → message clair
   *     (« Le document n'est plus disponible. »), jamais une fausse page.
   *   • DOCUMENT GÉNÉRÉ par PHÉNIX (`type === 'compte_rendu'` : compte rendu, PV de
   *     réception, liste de points à reprendre…) — PHÉNIX le rend en HTML autonome.
   *
   * Fonctionne côté conducteur comme côté client (le partage gouverne DÉJÀ où le
   * document apparaît — ici on ne fait qu'ouvrir).
   */
  openDocument(event: Event, audience: CrAudience = 'conducteur'): void {
    if (event.type === 'document') {
      if (event.content.attachment.dataUrl) openAttachment(event.content.attachment);
      else openUnavailableDocument();
      return;
    }
    openHtmlDocument(buildDocumentHtml(event, docContextFor(snapshot, event), audience));
  },

  /**
   * TÉLÉCHARGE un document (symétrique de `openDocument`) : un document IMPORTÉ →
   * le fichier d'origine (ou message clair s'il a disparu) ; un document GÉNÉRÉ par
   * PHÉNIX → un VRAI PDF (moteur PDF unique, `application/pdf`) — jamais du HTML.
   */
  downloadDocument(event: Event, audience: CrAudience = 'conducteur'): void {
    if (event.type === 'document') {
      if (event.content.attachment.dataUrl) downloadAttachment(event.content.attachment);
      else openUnavailableDocument();
      return;
    }
    // Document GÉNÉRÉ → VRAI PDF (moteur unique), jamais du HTML.
    downloadPdfDocument(
      buildDocumentPdf(event, docContextFor(snapshot, event), audience),
      generatedDocumentTitle(event),
    );
  },

  /**
   * Change la VISIBILITÉ d'un document (interne ↔ visible client) directement sur
   * son événement `document`. Le client le voit apparaître / disparaître aussitôt.
   */
  async setDocumentVisibility(eventId: string, visibility: EventVisibility): Promise<void> {
    await backend.setEventVisibility(toEventId(eventId), visibility);
    refresh();
    broadcast();
  },

  /**
   * Accusé de lecture GÉNÉRIQUE : marque un ou plusieurs identifiants (Moment,
   * événement, coup de cœur…) comme LUS par un rôle → éteint la/les notification(s)
   * correspondante(s). Une notification consultée disparaît.
   */
  markSeen(role: string, ids: string[]): void {
    if (ids.length === 0) return;
    const seen = readJson<SeenState>(SEEN_KEY, {});
    const forRole = seen[role] ?? {};
    const now = new Date().toISOString();
    for (const id of ids) forRole[id] = now;
    seen[role] = forRole;
    safeSetItem(SEEN_KEY, JSON.stringify(seen));
    refresh();
    broadcast();
  },
  /**
   * Le CLIENT a OUVERT un choix (il l'a consulté depuis son espace). On le trace
   * via `seen['client'][selectionId]` : côté conducteur, le statut du choix passe
   * de « Non lu » à « En attente de réponse » (tant qu'il n'a pas validé).
   */
  markChoixOpenedByClient(selectionIds: string[]): void {
    demo.markSeen('client', selectionIds);
  },

  /**
   * Marque un choix client validé comme PRIS EN COMPTE par le conducteur : il a
   * lancé l'action (commande, artisan, planning). Éteint la notification.
   */
  markChoixTraite(decisionEventId: string): void {
    const map = readJson<Record<string, string>>(CHOIX_TRAITES_KEY, {});
    map[decisionEventId] = new Date().toISOString();
    safeSetItem(CHOIX_TRAITES_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /** PHÉNIX ouvre un écran de l'Espace client (navigation). */
  openClientTarget(kind: ClientTarget['kind'], ref?: string): void {
    clientTarget = { kind, ...(ref ? { ref } : {}) };
    refresh();
  },
  /** Cible consommée par l'Espace client. */
  clearClientTarget(): void {
    clientTarget = null;
    refresh();
  },

  // ---- « Mon espace » client : accès, invités, préférences, cookies ----------
  /** Écrit (ou fusionne) les réglages « Mon espace » d'un chantier. */
  _writeClientSettings(projectId: ProjectId, patch: Partial<ClientSettings>): void {
    const all = readJson<Record<string, ClientSettings>>(CLIENT_SETTINGS_KEY, {});
    const current = all[projectId] ?? defaultClientSettings();
    all[projectId] = { ...current, ...patch };
    safeSetItem(CLIENT_SETTINGS_KEY, JSON.stringify(all));
    refresh();
    broadcast();
  },
  /** Le client change son code d'accès (min. 6 caractères, obligatoire). */
  setClientAccessCode(projectId: ProjectId, code: string): void {
    demo._writeClientSettings(projectId, { accessCode: code });
  },
  /** Le client invite une personne de confiance à suivre son chantier. */
  inviteClientPerson(
    projectId: ProjectId,
    input: { prenom: string; nom: string; email: string; role: string },
  ): void {
    const all = readJson<Record<string, ClientSettings>>(CLIENT_SETTINGS_KEY, {});
    const current = all[projectId] ?? defaultClientSettings();
    const invitee: ClientInvitee = {
      id: crypto.randomUUID(),
      prenom: input.prenom.trim(),
      nom: input.nom.trim(),
      email: input.email.trim(),
      role: input.role.trim(),
      statut: 'invite',
      createdAt: new Date().toISOString(),
    };
    demo._writeClientSettings(projectId, { invitees: [...current.invitees, invitee] });
  },
  /** Le client retire l'accès d'une personne invitée. */
  removeClientInvitee(projectId: ProjectId, inviteeId: string): void {
    const all = readJson<Record<string, ClientSettings>>(CLIENT_SETTINGS_KEY, {});
    const current = all[projectId] ?? defaultClientSettings();
    demo._writeClientSettings(projectId, {
      invitees: current.invitees.filter((i) => i.id !== inviteeId),
    });
  },
  /** Le client bascule une préférence de notification. */
  setClientNotifPref(projectId: ProjectId, key: ClientNotifPrefKey, value: boolean): void {
    const all = readJson<Record<string, ClientSettings>>(CLIENT_SETTINGS_KEY, {});
    const current = all[projectId] ?? defaultClientSettings();
    demo._writeClientSettings(projectId, {
      notifPrefs: { ...current.notifPrefs, [key]: value },
    });
  },
  /** Le client accepte les cookies nécessaires — le bandeau ne réapparaît plus. */
  acceptCookies(): void {
    if (typeof localStorage !== 'undefined')
      safeSetItem(COOKIE_CONSENT_KEY, new Date().toISOString());
    refresh();
    broadcast();
  },

  // Ports core (le produit passe par là).
  createProject: (input: NewProject) => mutate(backend.createProject(input)),
  updateProject: (id: ProjectId, patch: ProjectPatch) => mutate(backend.updateProject(id, patch)),
  addMember: (input: NewMember) => mutate(backend.addMember(input)),
  appendEvent: (input: NewEvent) => mutate(backend.appendEvent(input)),
  publishEvent: (id: EventId, by: UserId) => mutate(backend.publishEvent(id, by)),
  resolveDemande: (id: EventId, resolution: DemandeResolution) =>
    mutate(backend.resolveDemande(id, resolution)),

  /**
   * Réponse du client à une demande de DOCUMENT. Le document est l'élément
   * principal : s'il joint un fichier, on crée un événement `document` (visible
   * client, publié) — enregistré au projet, présent dans « Documents » des DEUX
   * côtés, sans jamais le retélécharger/réimporter. Le commentaire est facultatif.
   * Trois cas : commentaire seul, document seul, document + commentaire.
   */
  async resolveDocumentDemande(
    demandeId: EventId,
    input: {
      projectId: ProjectId;
      actor: EventActor;
      texte?: string;
      attachment?: EventAttachment;
      libelle?: string;
      categorie?: string;
    },
  ): Promise<void> {
    let docEventId: EventId | undefined;
    if (input.attachment) {
      const ev = await backend.appendEvent({
        projectId: input.projectId,
        actor: input.actor,
        type: 'document',
        // Visible client : le document apparaît dans « Documents » des deux côtés.
        visibility: 'client',
        state: 'publie',
        content: {
          attachment: input.attachment,
          libelle: input.libelle?.trim() || input.attachment.fileName || 'Document',
          ...(input.categorie ? { categorie: input.categorie } : {}),
        },
      });
      docEventId = ev.id;
    }
    await backend.resolveDemande(demandeId, {
      texte: input.texte?.trim() ?? '',
      resolvedBy: input.actor.userId,
      resolvedAt: new Date().toISOString(),
      ...(docEventId ? { docEventId } : {}),
    });
    refresh();
    broadcast();
  },

  /**
   * Le conducteur RÉPOND à une demande du client (texte obligatoire + 0 à 3
   * photos). 1 demande = 1 réponse : `resolveDemande` porte la réponse et passe la
   * demande à « traitee » — elle quitte « Aujourd'hui », reste tracée au Suivi, et
   * une notification part au client.
   */
  async repondreDemandeClient(
    demandeId: EventId,
    actor: EventActor,
    input: {
      texte: string;
      photos?: { imageUrl?: string; bucket?: string; storagePath?: string }[];
    },
  ): Promise<void> {
    const photos: CompteRenduPhoto[] = (input.photos ?? []).map((ph) => ({
      ...(ph.imageUrl ? { imageUrl: ph.imageUrl } : {}),
      ...(ph.bucket ? { bucket: ph.bucket } : {}),
      ...(ph.storagePath ? { storagePath: ph.storagePath } : {}),
    }));
    await backend.resolveDemande(demandeId, {
      texte: input.texte.trim(),
      resolvedBy: actor.userId,
      resolvedAt: new Date().toISOString(),
      ...(photos.length ? { photos } : {}),
    });
    refresh();
    broadcast();
  },

  /**
   * Crée le projet À PARTIR de la proposition validée par l'humain (PHÉNIX
   * Start). « PHÉNIX prépare, vous validez » : rien n'est créé avant cet appel.
   * Passe par les ports core (projet, membres, événements) ; le dossier préparé
   * est persisté à part (hors colonne vertébrale).
   */
  /**
   * PORT D'ANALYSE unique : LECTURE RÉELLE du devis (`realAnalyzeDossier`), aucune
   * donnée inventée ; remplaçable par un vrai LLM/OCR via `setDossierAnalyzer` sans
   * changer les écrans.
   */
  analyzeDossier(input: AnalyzeInput): Promise<ProjectProposal> {
    return Promise.resolve(dossierAnalyzer(input));
  },
  setDossierAnalyzer(fn: DossierAnalyzer): void {
    dossierAnalyzer = fn;
  },

  async createFromProposal(
    proposal: ProjectProposal,
    photosAvantTravaux: UploadedMedia[] = [],
    /** Fichier ORIGINAL du devis (archivé tel quel, ouvrable — source officielle). */
    devisFile?: File,
  ): Promise<ProjectId> {
    const clientId = toUserId(crypto.randomUUID());
    // En SaaS, le conducteur est l'utilisateur RÉELLEMENT connecté (auteur exigé
    // par la RLS). En démo, une identité fabriquée suffit.
    const compaId = saasUserId ?? toUserId(crypto.randomUUID());
    const project = await backend.createProject({
      name: proposal.projectName,
      status: 'pas_commence',
      // En SaaS, la colonne `client_id` référence un VRAI compte (auth.users) : on
      // n'y met pas une identité fabriquée (le client sera rattaché à l'invitation,
      // M7). Le `clientId` local sert quand même aux satellites (nom, contact, rôle).
      clientId: saasUserId ? null : clientId,
      // L'adresse (issue du devis) sert à dériver le code ville VV du code chantier.
      ...(proposal.dossier.infos.address ? { address: proposal.dossier.infos.address } : {}),
    });
    await backend.addMember({ projectId: project.id, userId: compaId, role: 'compagnon' });
    await backend.addMember({ projectId: project.id, userId: clientId, role: 'client' });

    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    people[compaId] = 'Mickaël';
    people[clientId] = proposal.dossier.infos.clientName ?? 'Client';
    safeSetItem(PEOPLE_KEY, JSON.stringify(people));
    // Le client devient un CONTACT (source unique de ses coordonnées).
    upsertClientContact({
      projectId: project.id,
      clientId,
      nom: proposal.dossier.infos.clientName ?? 'Client',
      ...(proposal.dossier.infos.phone ? { phone: proposal.dossier.infos.phone } : {}),
      ...(proposal.dossier.infos.email ? { email: proposal.dossier.infos.email } : {}),
      ...(proposal.dossier.infos.address ? { address: proposal.dossier.infos.address } : {}),
    });

    const compaActor: EventActor = { userId: compaId, role: 'compagnon', displayName: 'Mickaël' };

    // Le devis signé est la pièce fondatrice : il ouvre le journal du chantier.
    // On ARCHIVE le fichier ORIGINAL tel quel (source officielle, ouvrable à tout
    // moment) — jamais une pièce jointe factice. Sans fichier réel (texte collé),
    // on n'invente aucun document.
    const devisAttachment = devisFile && (await readDocumentAttachment(project.id, devisFile));
    if (devisAttachment && devisAttachment.ok) {
      await backend.appendEvent({
        projectId: project.id,
        actor: compaActor,
        type: 'document',
        visibility: 'client',
        state: 'publie',
        content: { attachment: devisAttachment.value, libelle: 'Devis signé' },
      });
    }

    await backend.appendEvent({
      projectId: project.id,
      actor: compaActor,
      type: 'compte_rendu',
      visibility: 'interne',
      state: 'publie',
      content: {
        texte: `Dossier analysé et préparé par PHÉNIX Start — ${proposal.dossier.roadmap.length} étapes, ${proposal.dossier.orders.length} commandes, ${proposal.dossier.selections.length} choix client.`,
      },
    });

    // Choix proposés au client → « décision envoyée au client » tracée au journal
    // (événement structuré, source unique ; le client validera depuis son espace).
    for (const sel of proposal.dossier.selections) {
      if (sel.statut === 'propose') {
        await backend.appendEvent({
          projectId: project.id,
          actor: compaActor,
          type: 'decision',
          visibility: decisionVisibility('envoyee'),
          state: 'publie',
          content: buildDecisionContent({
            kind: 'envoyee',
            origin: 'phenix',
            selection: sel,
            statutApres: 'propose',
          }),
        });
      }
    }

    // Documents « demandés au client » → une demande apparaît dans l'espace client.
    for (const doc of proposal.dossier.documents) {
      if (doc.status === 'demande_client') {
        await backend.appendEvent({
          projectId: project.id,
          actor: compaActor,
          type: 'demande',
          visibility: 'client',
          state: 'ouverte',
          content: {
            question: `Pour préparer votre chantier, pouvez-vous nous transmettre : ${doc.label} ?`,
            destinataire: 'client',
          },
        });
      }
    }

    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    dossiers[project.id] = proposal.dossier;
    safeSetItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    safeSetItem(ACTIVE_KEY, JSON.stringify(project.id));
    // Photos déposées → un album « Avant travaux » dans les coulisses (partagé au
    // client) : l'état des lieux d'origine, en images. C'est un moment PHOTO
    // (type album par défaut), pas un moment de travail.
    if (photosAvantTravaux.length > 0) {
      demo.addMoment({
        projectId: project.id,
        actor: compaActor,
        title: 'Avant travaux',
        medias: photosAvantTravaux,
        legende: 'État des lieux avant le démarrage du chantier',
        shareWithClient: true,
      });
    }
    refresh();
    broadcast();
    return project.id;
  },

  /**
   * Crée un CHANTIER RÉEL à la main (Lot 2 — App réelle locale) : nom, client,
   * adresse, étape de départ. Pas de dossier de démo, pas de tunnel — un vrai
   * chantier vide, prêt à recevoir comptes rendus / photos / réserves. On atterrit
   * directement dedans (projet actif). VISION Art. 2.
   */
  async createChantier(input: {
    name: string;
    clientName?: string;
    address?: string;
    startStep?: ProjectStep;
  }): Promise<ProjectId> {
    const name = input.name.trim();
    const clientId = toUserId(crypto.randomUUID());
    // En SaaS, le conducteur est l'utilisateur RÉELLEMENT connecté (auteur exigé
    // par la RLS). En démo, une identité fabriquée suffit.
    const compaId = saasUserId ?? toUserId(crypto.randomUUID());
    const address = input.address?.trim();
    const project = await backend.createProject({
      name,
      status: 'pas_commence',
      // En SaaS, `client_id` référence un vrai compte : pas d'identité fabriquée
      // (rattachement du client à l'invitation, M7). Le `clientId` local reste
      // utilisé pour les satellites (nom affichable, contact, rôle).
      clientId: saasUserId ? null : clientId,
      ...(address ? { address } : {}),
      ...(input.startStep ? { currentStep: input.startStep } : {}),
    });
    await backend.addMember({ projectId: project.id, userId: compaId, role: 'compagnon' });
    await backend.addMember({ projectId: project.id, userId: clientId, role: 'client' });

    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    people[compaId] = 'Mickaël';
    people[clientId] = input.clientName?.trim() || 'Client';
    safeSetItem(PEOPLE_KEY, JSON.stringify(people));
    // Le client devient un CONTACT (source unique de ses coordonnées).
    upsertClientContact({
      projectId: project.id,
      clientId,
      nom: input.clientName?.trim() || 'Client',
      ...(address ? { address } : {}),
    });
    safeSetItem(ACTIVE_KEY, JSON.stringify(project.id));
    refresh();
    broadcast();
    return project.id;
  },

  /** Modifie les infos d'un chantier réel (nom, client, adresse, étape). */
  async updateChantier(
    projectId: ProjectId,
    input: { name?: string; clientName?: string; address?: string; startStep?: ProjectStep },
  ): Promise<void> {
    const patch: ProjectPatch = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.address !== undefined) patch.address = input.address.trim();
    if (input.startStep !== undefined) patch.currentStep = input.startStep;
    if (Object.keys(patch).length > 0) await backend.updateProject(projectId, patch);

    if (input.clientName !== undefined) {
      const clientId = snapshot.projects.find((p) => p.id === projectId)?.clientId;
      if (clientId) {
        const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
        people[clientId] = input.clientName.trim() || 'Client';
        safeSetItem(PEOPLE_KEY, JSON.stringify(people));
        // Source unique : on synchronise le contact « client ».
        upsertClientContact({
          projectId,
          clientId,
          nom: input.clientName.trim() || 'Client',
          ...(input.address !== undefined ? { address: input.address.trim() } : {}),
        });
      }
    }
    refresh();
    broadcast();
  },

  /**
   * SUPPRIME un chantier et TOUTES ses données locales (100 % local, aucun
   * backend). Retire le projet, ses membres et ses événements (colonne
   * vertébrale) puis toutes les données rattachées par `projectId` (dossier,
   * pins, Fil, conversation PHÉNIX, partages), les marqueurs device-local
   * (choix traités, accusés de lecture des Moments) et les identités devenues
   * orphelines. Les CONTACTS restent globaux : on retire seulement le lien vers
   * ce chantier ; un contact référencé ailleurs n'est jamais supprimé. Si le
   * chantier supprimé était actif, on bascule vers un autre (ou l'état vide).
   */
  async deleteChantier(id: ProjectId): Promise<void> {
    const before = kv.load() ?? emptyState();
    // À collecter AVANT suppression (pour nettoyer les données dérivées).
    const eventIds = new Set<string>(
      before.events.filter((e) => e.projectId === id).map((e) => e.id),
    );
    const memberUserIds = before.members.filter((m) => m.projectId === id).map((m) => m.userId);
    const filMoments = readJson<Record<string, Moment[]>>(FIL_MOMENTS_KEY, {});
    const momentIds = new Set<string>((filMoments[id] ?? []).map((m) => m.id));

    // 1) Colonne vertébrale : projet + membres + événements.
    await backend.deleteProject(id);

    // 2) Toutes les données rattachées par projectId (une entrée par projet).
    for (const key of [
      DOSSIERS_KEY,
      FIL_MOMENTS_KEY,
      FIL_COUPS_KEY,
      FIL_MESSAGES_KEY,
      FIL_ZONES_KEY,
      PHENIX_CONV_KEY,
      SHARES_KEY,
    ]) {
      const obj = readJson<Record<string, unknown>>(key, {});
      if (id in obj) {
        delete obj[id];
        safeSetItem(key, JSON.stringify(obj));
      }
    }

    // 3) Choix client « pris en compte » : entrées liées aux événements du projet.
    const choix = readJson<Record<string, string>>(CHOIX_TRAITES_KEY, {});
    let choixChanged = false;
    for (const k of Object.keys(choix))
      if (eventIds.has(k)) {
        delete choix[k];
        choixChanged = true;
      }
    if (choixChanged) safeSetItem(CHOIX_TRAITES_KEY, JSON.stringify(choix));

    // 4) Accusés de lecture des Moments (par rôle) pour les Moments du projet.
    const seen = readJson<SeenState>(SEEN_KEY, {});
    let seenChanged = false;
    for (const role of Object.keys(seen))
      for (const mid of Object.keys(seen[role] ?? {}))
        if (momentIds.has(mid)) {
          delete seen[role]![mid];
          seenChanged = true;
        }
    if (seenChanged) safeSetItem(SEEN_KEY, JSON.stringify(seen));

    // 5) Identités (noms) devenues orphelines : plus référencées par aucun membre.
    const after = kv.load() ?? emptyState();
    const stillUsed = new Set(after.members.map((m) => m.userId));
    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    let peopleChanged = false;
    for (const uid of memberUserIds)
      if (!stillUsed.has(uid) && uid in people) {
        delete people[uid];
        peopleChanged = true;
      }
    if (peopleChanged) safeSetItem(PEOPLE_KEY, JSON.stringify(people));

    // 6) Contacts : on retire le LIEN vers ce chantier ; on ne supprime le
    // contact que s'il n'est plus rattaché à aucun autre chantier (jamais un
    // contact global encore utilisé ailleurs).
    const contacts = readJson<Contact[]>(CONTACTS_KEY, []);
    const nextContacts = contacts.flatMap((c) => {
      if (!c.projectIds.includes(id)) return [c];
      const projectIds = c.projectIds.filter((pid) => pid !== id);
      return projectIds.length > 0 ? [{ ...c, projectIds }] : [];
    });
    safeSetItem(CONTACTS_KEY, JSON.stringify(nextContacts));

    // 7) Chantier actif : bascule vers un autre chantier, ou l'état vide.
    const active = readJson<ProjectId | null>(ACTIVE_KEY, null);
    if (active === id) {
      const next = after.projects[0]?.id ?? null;
      safeSetItem(ACTIVE_KEY, JSON.stringify(next));
    }

    refresh();
    broadcast();
  },

  /**
   * Garantit qu'un chantier a un DOSSIER de préparation (EPIC 1). Un chantier
   * créé à la main n'en a pas : on en crée un vide, amorcé depuis ses infos
   * (client, adresse) et la feuille de route standard. Idempotent.
   */
  ensureDossier(project: Project): void {
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    if (dossiers[project.id]) return;
    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    const clientName = project.clientId ? (people[project.clientId] ?? '') : '';
    dossiers[project.id] = {
      infos: {
        ...(clientName ? { clientName } : {}),
        ...(project.address ? { address: project.address } : {}),
      },
      // Pas de feuille de route GÉNÉRIQUE fabriquée : les étapes contractuelles
      // proviendront du devis analysé et validé. Tant qu'aucun contrat n'est
      // validé, on n'affiche aucune prestation simulée (règle produit 12/07/2026).
      roadmap: [],
      planning: [],
      orders: [],
      selections: [],
      documents: [],
      questions: [],
      checklist: defaultLaunchChecklist(),
      sources: [],
      createdAt: new Date().toISOString(),
    };
    safeSetItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    refresh();
    broadcast();
  },

  /* ------------------------- Annuaire & communication -------------------- */

  /**
   * Garantit qu'un chantier a un CONTACT « client » (source unique de ses
   * coordonnées). Idempotent — pour les chantiers importés/anciens sans contact
   * client. Renvoie l'id du contact.
   */
  ensureClientContact(project: Project): string {
    const clientId = project.clientId;
    if (!clientId) return '';
    const existing = readJson<Contact[]>(CONTACTS_KEY, []).find((c) => c.userId === clientId);
    if (existing) return existing.id;
    const infos = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {})[project.id]?.infos;
    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    upsertClientContact({
      projectId: project.id,
      clientId,
      nom: people[clientId] || infos?.clientName || 'Client',
      ...(infos?.phone ? { phone: infos.phone } : {}),
      ...(infos?.email ? { email: infos.email } : {}),
      ...((infos?.address ?? project.address)
        ? { address: infos?.address ?? project.address }
        : {}),
    });
    refresh();
    broadcast();
    return readJson<Contact[]>(CONTACTS_KEY, []).find((c) => c.userId === clientId)!.id;
  },

  /** Ajoute ou met à jour un contact de l'annuaire (upsert par id). */
  saveContact(contact: Contact): void {
    const list = readJson<Contact[]>(CONTACTS_KEY, []);
    const idx = list.findIndex((c) => c.id === contact.id);
    if (idx >= 0) list[idx] = contact;
    else list.push(contact);
    safeSetItem(CONTACTS_KEY, JSON.stringify(list));
    // Le contact est la SOURCE UNIQUE : on rafraîchit les instantanés dénormalisés
    // qui le référencent (nom de fournisseur mis en cache sur les commandes du
    // dossier — mutable). Les événements (réserves) sont append-only : leur nom
    // figé reste, mais l'affichage résout toujours le nom vivant via l'id.
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    let touched = false;
    for (const d of Object.values(dossiers)) {
      for (const o of d.orders) {
        if (o.fournisseurContactId === contact.id && o.fournisseur !== contact.nom) {
          o.fournisseur = contact.nom;
          touched = true;
        }
      }
    }
    if (touched) safeSetItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    // Si ce contact incarne le client d'un chantier, on tient à jour son nom
    // affichable (people) — un seul endroit d'édition (VISION Art. 6).
    if (contact.userId) {
      const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
      if (people[contact.userId] !== contact.nom) {
        people[contact.userId] = contact.nom;
        safeSetItem(PEOPLE_KEY, JSON.stringify(people));
      }
    }
    refresh();
    broadcast();
  },

  /** Supprime un contact de l'annuaire. */
  deleteContact(id: string): void {
    const list = readJson<Contact[]>(CONTACTS_KEY, []).filter((c) => c.id !== id);
    safeSetItem(CONTACTS_KEY, JSON.stringify(list));
    refresh();
    broadcast();
  },

  /** Lie / délie un contact à un chantier (toggle). */
  toggleContactProject(id: string, projectId: string): void {
    const list = readJson<Contact[]>(CONTACTS_KEY, []).map((c) => {
      if (c.id !== id) return c;
      const has = c.projectIds.includes(projectId);
      return {
        ...c,
        projectIds: has
          ? c.projectIds.filter((p) => p !== projectId)
          : [...c.projectIds, projectId],
      };
    });
    safeSetItem(CONTACTS_KEY, JSON.stringify(list));
    refresh();
    broadcast();
  },

  /**
   * Trace une COMMUNICATION lancée depuis PHÉNIX (l'app native s'ouvre à côté).
   * Append-only au Journal du chantier, TOUJOURS interne (jamais côté client,
   * VISION Art. 9). Sans chantier (annuaire global d'un contact non lié), on
   * n'écrit pas au Journal — l'app native s'ouvre quand même.
   */
  async logCommunication(
    projectId: ProjectId | null,
    input: {
      canal: CommCanal;
      contactNom: string;
      contactId?: string;
      role?: string;
      sujet?: string;
    },
  ): Promise<void> {
    if (!projectId) return;
    const member = snapshot.members.find(
      (m) => m.projectId === projectId && m.role === 'compagnon',
    );
    const uid = member?.userId ?? toUserId('compagnon-demo');
    const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
    const actor: EventActor = {
      userId: uid,
      role: 'compagnon',
      displayName: people[uid] ?? 'Mickaël',
    };
    await backend.appendEvent({
      projectId,
      actor,
      type: 'communication',
      visibility: 'interne',
      state: 'publie',
      content: {
        canal: input.canal,
        contactNom: input.contactNom,
        ...(input.contactId ? { contactId: input.contactId } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.sujet ? { sujet: input.sujet } : {}),
      },
    });
    refresh();
    broadcast();
  },

  /**
   * Dépose un DOCUMENT de préparation. Le FICHIER rejoint la base UNIQUE (un
   * événement `document` du Journal = la bibliothèque `vault`), INTERNE par
   * défaut (client-safe) ; la checklist du dossier ne fait que POINTER vers lui
   * (`eventId`). Sans fichier, on ajoute une simple entrée « à fournir » (suivi
   * d'obtention). Fini le silo : un document préparé remonte au Journal.
   */
  async addPrepDocument(
    projectId: ProjectId,
    input: {
      label: string;
      categorie?: PrepDocCategory;
      attachment?: EventAttachment;
      /** Visibilité du document dans le Journal — INTERNE par défaut (anti-fuite). */
      visibility?: EventVisibility;
    },
  ): Promise<void> {
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    const dossier = dossiers[projectId];
    if (!dossier) return;
    let eventId: string | undefined;
    if (input.attachment) {
      const member = snapshot.members.find(
        (m) => m.projectId === projectId && m.role === 'compagnon',
      );
      const uid = member?.userId ?? toUserId('compagnon-demo');
      const people = readJson<Record<string, string>>(PEOPLE_KEY, {});
      const actor: EventActor = {
        userId: uid,
        role: 'compagnon',
        displayName: people[uid] ?? 'Mickaël',
      };
      const ev = await backend.appendEvent({
        projectId,
        actor,
        type: 'document',
        // Privé par défaut : un document ne part au client que sur choix explicite.
        visibility: input.visibility ?? 'interne',
        state: 'publie',
        content: {
          attachment: input.attachment,
          libelle: input.label,
          ...(input.categorie ? { categorie: input.categorie } : {}),
        },
      });
      eventId = ev.id;
    }
    const doc: ProjectDocument = {
      id: crypto.randomUUID(),
      label: input.label,
      ...(input.categorie ? { categorie: input.categorie } : {}),
      status: input.attachment ? 'fourni' : 'a_fournir',
      ...(eventId ? { eventId } : {}),
    };
    dossier.documents = [...dossier.documents, doc];
    dossiers[projectId] = dossier;
    safeSetItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    refresh();
    broadcast();
  },

  /**
   * Change la VISIBILITÉ d'un document de préparation (interne ↔ visible client).
   * Agit sur l'événement `document` du Journal (base unique) : le client le voit
   * apparaître / disparaître immédiatement. Sans fichier (donc sans événement),
   * il n'y a rien à partager — l'appel est sans effet.
   */
  async setPrepDocumentVisibility(
    projectId: ProjectId,
    docId: string,
    visibility: EventVisibility,
  ): Promise<void> {
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    const doc = dossiers[projectId]?.documents.find((d) => d.id === docId);
    if (!doc?.eventId) return;
    await backend.setEventVisibility(toEventId(doc.eventId), visibility);
    refresh();
    broadcast();
  },

  /** Met à jour le dossier préparé d'un projet (éditions ultérieures). */
  saveDossier(projectId: ProjectId, dossier: ProjectDossier): void {
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    dossiers[projectId] = dossier;
    safeSetItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    refresh();
    broadcast();
  },

  /**
   * Enregistre les CORRECTIONS de l'analyse du devis et recalcule l'état de
   * lecture de chaque ligne (corriger une ligne la fait passer au vert) + la
   * vérification des totaux. Le statut de validation de chaque lot est conservé.
   */
  saveDevisAnalyse(projectId: ProjectId, devis: Devis): void {
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    const dossier = dossiers[projectId];
    if (!dossier) return;
    const normalized: Devis = {
      ...devis,
      lots: devis.lots.map((l) => ({
        ...l,
        postes: l.postes.map((p) => ({ ...p, verification: evaluerVerification(p) })),
      })),
    };
    const reconciliation = reconcileTotals(
      normalized,
      dossier.reconciliation?.totalHTDeclare,
      dossier.reconciliation?.totalTTCDeclare,
    );
    dossiers[projectId] = { ...dossier, devis: normalized, reconciliation };
    safeSetItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    refresh();
    broadcast();
  },

  /**
   * VALIDE un LOT : le conducteur l'a vérifié face à l'original. Le lot devient
   * exploitable en aval (prestations, pré-réception, budget) INDÉPENDAMMENT des
   * autres. Décision HUMAINE — aucune automatisation ne valide à sa place.
   */
  validateLot(projectId: ProjectId, lotId: string): void {
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    const dossier = dossiers[projectId];
    if (!dossier?.devis) return;
    const lots = dossier.devis.lots.map((l) =>
      l.id === lotId ? { ...l, statut: 'valide' as const } : l,
    );
    dossiers[projectId] = { ...dossier, devis: { ...dossier.devis, lots } };
    safeSetItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    refresh();
    broadcast();
  },

  /** VALIDE TOUS les lots d'un coup (« Tout valider »). */
  validateAllLots(projectId: ProjectId): void {
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    const dossier = dossiers[projectId];
    if (!dossier?.devis) return;
    const lots = dossier.devis.lots.map((l) => ({ ...l, statut: 'valide' as const }));
    dossiers[projectId] = { ...dossier, devis: { ...dossier.devis, lots } };
    safeSetItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    refresh();
    broadcast();
  },

  /**
   * Crée une DÉCISION CLIENT depuis « Nouvelle mission » : un choix PROPOSÉ
   * (titre + contexte + photos + options, la délégation PHÉNIX est offerte
   * d'office par la galerie). Réutilise le modèle existant — une `ClientSelection`
   * dans le dossier (donc `ensureDossier`) alimente « Une décision vous attend » ;
   * une trace `decision`/`envoyee` (interne) est ajoutée au Journal (append-only).
   */
  async createClientDecision(
    project: Project,
    actor: EventActor,
    input: { titre: string; contexte?: string; photos?: string[]; options: SelectionOption[] },
  ): Promise<void> {
    demo.ensureDossier(project);
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    const dossier = dossiers[project.id];
    if (!dossier) return;
    const selection: ClientSelection = {
      id: crypto.randomUUID(),
      categorie: input.titre,
      label: input.titre,
      statut: 'propose',
      ...(input.contexte ? { contexte: input.contexte } : {}),
      ...(input.photos && input.photos.length > 0 ? { photos: input.photos } : {}),
      options: input.options,
    };
    dossiers[project.id] = { ...dossier, selections: [...dossier.selections, selection] };
    safeSetItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    const content = buildDecisionContent({
      kind: 'envoyee',
      origin: 'conducteur',
      selection,
      statutApres: 'propose',
    });
    await backend.appendEvent({
      projectId: project.id,
      actor,
      type: 'decision',
      visibility: decisionVisibility('envoyee'),
      state: 'publie',
      content,
    });
    refresh();
    broadcast();
  },

  /* ------------------------------- Le Fil -------------------------------- */

  /**
   * Crée un MOMENT de chantier — le geste unique du conducteur. Le Moment est
   * INTERNE par défaut (`INTERNAL_AUDIENCE`) : il n'apparaît dans l'espace client
   * que si `shareWithClient` est vrai (ou plus tard via `shareMoment`). Une OU
   * plusieurs photos (album) : `medias` dans l'ordre, `coverIndex` = couverture.
   * `observations` = le récit libre ; `intervenants` = qui était présent.
   */
  addMoment(input: {
    projectId: ProjectId;
    actor: EventActor;
    title: string;
    medias: UploadedMedia[];
    coverIndex?: number;
    zoneId?: ZoneId;
    legende?: string;
    type?: MomentType;
    observations?: string;
    intervenants?: string[];
    shareWithClient?: boolean;
  }): void {
    if (input.medias.length === 0) return;
    // Un album = 10 photos MAXIMUM (garde-fou : on tronque au besoin).
    const medias = input.medias.slice(0, MAX_ALBUM_PHOTOS);
    const now = new Date().toISOString();
    const coverIdx = Math.min(Math.max(input.coverIndex ?? 0, 0), medias.length - 1);
    const legende = input.legende?.trim();
    const observations = input.observations?.trim();
    const intervenants = (input.intervenants ?? []).map((s) => s.trim()).filter(Boolean);
    const photos: FilPhoto[] = medias.map((m, i) => ({
      id: toFilPhotoId(crypto.randomUUID()),
      imageUrl: m.imageUrl,
      bucket: m.bucket,
      storagePath: m.storagePath,
      mimeType: m.mimeType,
      width: m.width,
      height: m.height,
      ...(i === coverIdx && legende ? { legende } : {}),
      ordre: i,
      createdAt: now,
    }));
    const moment: Moment = {
      id: toMomentId(crypto.randomUUID()),
      projectId: input.projectId,
      authorId: input.actor.userId,
      authorRole: input.actor.role,
      createdAt: now,
      publishedAt: now,
      state: 'publie',
      // Album « coulisses » (photo) par défaut — jamais un type documentaire.
      type: input.type ?? 'etape',
      title: input.title.trim(),
      visibleTo: input.shareWithClient ? SHARED_AUDIENCE : INTERNAL_AUDIENCE,
      photos,
      coverPhotoId: photos[coverIdx]!.id,
      ...(observations ? { observations } : {}),
      ...(intervenants.length ? { intervenants } : {}),
      ...(input.zoneId ? { zoneId: input.zoneId } : {}),
    };
    const map = readJson<Record<string, Moment[]>>(FIL_MOMENTS_KEY, {});
    map[input.projectId] = [...(map[input.projectId] ?? []), moment];
    safeSetItem(FIL_MOMENTS_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /**
   * PARTAGER un Moment avec le client (ou le repasser en interne). « Partager »
   * est une ACTION, jamais un nouvel objet : on bascule seulement l'audience du
   * Moment. Une fois partagé, il apparaît dans le Fil client (projection).
   */
  shareMoment(projectId: ProjectId, momentId: string, shared = true): void {
    const map = readJson<Record<string, Moment[]>>(FIL_MOMENTS_KEY, {});
    map[projectId] = (map[projectId] ?? []).map((m) =>
      m.id === momentId ? { ...m, visibleTo: shared ? SHARED_AUDIENCE : INTERNAL_AUDIENCE } : m,
    );
    safeSetItem(FIL_MOMENTS_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /** Supprime un Moment (l'UI ne l'autorise que tant qu'il n'est pas verrouillé). */
  deleteMoment(projectId: ProjectId, momentId: string): void {
    const map = readJson<Record<string, Moment[]>>(FIL_MOMENTS_KEY, {});
    map[projectId] = (map[projectId] ?? []).filter((m) => m.id !== momentId);
    safeSetItem(FIL_MOMENTS_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /** Bascule le ♡ coup de cœur d'un utilisateur sur un Moment. */
  toggleCoupDeCoeur(projectId: ProjectId, momentId: string, actor: EventActor): void {
    const map = readJson<Record<string, CoupDeCoeur[]>>(FIL_COUPS_KEY, {});
    const current = map[projectId] ?? [];
    const existing = current.find((c) => c.momentId === momentId && c.userId === actor.userId);
    map[projectId] = existing
      ? current.filter((c) => c.id !== existing.id)
      : [
          ...current,
          {
            id: toCoupId(crypto.randomUUID()),
            momentId: momentId as CoupDeCoeur['momentId'],
            userId: actor.userId,
            userRole: actor.role,
            createdAt: new Date().toISOString(),
          },
        ];
    safeSetItem(FIL_COUPS_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /**
   * Laisse un message sous un Moment. `photoId` null = message du Moment
   * (niveau 1) ; renseigné = message attaché à une PHOTO précise (niveau 2).
   */
  addMessage(
    projectId: ProjectId,
    momentId: string,
    actor: EventActor,
    texte: string,
    photoId: string | null = null,
  ): void {
    const trimmed = texte.trim();
    if (!trimmed) return;
    const map = readJson<Record<string, Message[]>>(FIL_MESSAGES_KEY, {});
    const message: Message = {
      id: toMessageId(crypto.randomUUID()),
      momentId: momentId as Message['momentId'],
      photoId: photoId as Message['photoId'],
      parentId: null,
      authorId: actor.userId,
      authorRole: actor.role,
      texte: trimmed,
      createdAt: new Date().toISOString(),
    };
    map[projectId] = [...(map[projectId] ?? []), message];
    safeSetItem(FIL_MESSAGES_KEY, JSON.stringify(map));
    refresh();
    broadcast();
  },

  /**
   * Création MANUELLE d'une réserve par le conducteur (registre pilotable) :
   * interne, ouverte, numérotée par projet. Append-only : elle rejoint le Journal,
   * la lentille Réserves la lit, Aujourd'hui/soir la comptent (VISION Art. 7, 8, 9).
   */
  async createReserve(
    projectId: ProjectId,
    actor: EventActor,
    input: {
      libelle: string;
      responsableContactId?: string;
      echeance?: string;
      priorite?: ActionPriorite;
    },
  ): Promise<void> {
    const libelle = input.libelle.trim();
    if (!libelle) return;
    const projectEvents = snapshot.events.filter((e) => e.projectId === projectId);
    // Le responsable est un CONTACT (source unique) ; on fige son nom au moment
    // de la création (instantané append-only, jamais ressaisi).
    const contact = input.responsableContactId
      ? snapshot.contacts.find((c) => c.id === input.responsableContactId)
      : undefined;
    const echeance = input.echeance?.trim();
    await backend.appendEvent({
      projectId,
      actor,
      type: 'reserve',
      visibility: 'interne',
      state: 'ouverte',
      content: {
        numero: nextReserveNumero(projectEvents),
        libelle,
        ...(contact ? { responsableContactId: contact.id, responsable: contact.nom } : {}),
        ...(echeance ? { echeance } : {}),
        ...(input.priorite ? { priorite: input.priorite } : {}),
      },
    });
    refresh();
    broadcast();
  },

  /* --------------------------- Mode Artisan ------------------------------- */

  /**
   * L'artisan SIGNALE au conducteur une intervention terminée (« à valider »).
   * Canal distinct des questions client (`destinataire: 'conducteur'`), toujours
   * INTERNE : jamais exposé au client (VISION Art. 9). Le conducteur le voit dans
   * son journal / le radar, puis valide (ex. lève la réserve).
   */
  async artisanSignal(projectId: ProjectId, actor: EventActor, libelle: string): Promise<void> {
    const question = libelle.trim();
    if (!question) return;
    await backend.appendEvent({
      projectId,
      actor,
      type: 'demande',
      visibility: 'interne',
      state: 'ouverte',
      content: { question, destinataire: 'conducteur' },
    });
    refresh();
    broadcast();
  },

  /**
   * L'artisan PARTAGE une photo (et un mot en légende) de son avancement. Photo
   * interne (visible de l'équipe, jamais du client tant qu'elle n'est pas
   * repartagée). Réutilise le même modèle de pièce jointe que le reste du Fil.
   */
  async artisanPhoto(
    projectId: ProjectId,
    actor: EventActor,
    input: { legende?: string; piece?: string },
  ): Promise<void> {
    const legende = input.legende?.trim();
    const piece = input.piece?.trim();
    await backend.appendEvent({
      projectId,
      actor,
      type: 'photo',
      visibility: 'interne',
      state: 'publie',
      content: {
        attachment: {
          id: toAttachmentId(crypto.randomUUID()),
          kind: 'photo',
          bucket: 'demo',
          storagePath: `${projectId}/${crypto.randomUUID()}.jpg`,
          mimeType: 'image/jpeg',
          createdAt: new Date().toISOString(),
        },
        ...(legende ? { legende } : {}),
        ...(piece ? { piece } : {}),
      },
    });
    refresh();
    broadcast();
  },

  /**
   * LEVÉE d'une réserve (append-only). On n'efface ni ne modifie jamais la
   * réserve : on AJOUTE au Journal un événement `levee` qui pointe vers elle,
   * avec une note et une photo de preuve facultatives. L'auteur et la date de
   * levée sont portés par l'enveloppe. Le statut « levée » se LIT ensuite
   * (présence de cet événement) — la réserve garde son origine intacte.
   */
  async leverReserve(
    projectId: ProjectId,
    reserveEventId: string,
    actor: EventActor,
    options: { note?: string; preuve?: UploadedMedia } = {},
  ): Promise<void> {
    const reserve = snapshot.events.find((e) => e.id === reserveEventId && e.type === 'reserve');
    if (!reserve || reserve.type !== 'reserve') return;
    // Idempotence : une réserve déjà levée ne se relève pas.
    const dejaLevee = snapshot.events.some(
      (e) => e.type === 'levee' && e.content.reserveId === reserveEventId,
    );
    if (dejaLevee) return;

    const note = options.note?.trim();
    const m = options.preuve;
    const preuve = m
      ? {
          imageUrl: m.imageUrl,
          bucket: m.bucket,
          storagePath: m.storagePath,
          mimeType: m.mimeType,
          ...(m.width != null ? { width: m.width } : {}),
          ...(m.height != null ? { height: m.height } : {}),
        }
      : undefined;

    await backend.appendEvent({
      projectId,
      actor,
      type: 'levee',
      visibility: 'interne',
      state: 'publie',
      content: {
        reserveId: reserveEventId,
        reserveNumero: reserve.content.numero,
        ...(note ? { note } : {}),
        ...(preuve ? { preuve } : {}),
      },
    });
    refresh();
    broadcast();
  },

  /* ------------------------- Gestion du chantier ------------------------- */

  /**
   * COMPTE RENDU DE CHANTIER (mission fusionnée visite + réunion, 09/07/2026).
   * Une suite de POINTS : chaque point = 1 photo + 1 commentaire + 1 cible de
   * diffusion (client / artisan / les deux). La visibilité de l'événement est
   * DÉRIVÉE des points : `client` s'il existe au moins un point destiné au client
   * (client ou les deux) — le client ne verra que CES points ; sinon `interne`
   * (points purement artisan, invisibles au client). Optionnellement, le conducteur
   * confirme l'étape → l'avancement reste porté par le compte rendu (ADR-002 §5).
   */
  async createCompteRendu(
    projectId: ProjectId,
    actor: EventActor,
    input: {
      points: {
        photos: { imageUrl?: string; bucket?: string; storagePath?: string }[];
        comment: string;
        diffusion: Diffusion;
      }[];
      etapeConfirmee?: ProjectStep;
    },
  ): Promise<{ compteRenduId: string }> {
    const points: CompteRenduPoint[] = input.points.map((p) => ({
      photos: p.photos.map((ph) => ({
        ...(ph.imageUrl ? { imageUrl: ph.imageUrl } : {}),
        ...(ph.bucket ? { bucket: ph.bucket } : {}),
        ...(ph.storagePath ? { storagePath: ph.storagePath } : {}),
      })),
      comment: p.comment.trim(),
      diffusion: p.diffusion,
    }));
    const visibleClient = points.some((p) => p.diffusion !== 'artisan');
    const ev = await backend.appendEvent({
      projectId,
      actor,
      type: 'compte_rendu',
      visibility: visibleClient ? 'client' : 'interne',
      state: 'publie',
      content: {
        texte: '',
        missionKind: 'compte_rendu',
        docTitre: 'Compte rendu de chantier',
        points,
        ...(input.etapeConfirmee ? { etapeConfirmee: input.etapeConfirmee } : {}),
      },
    });
    refresh();
    broadcast();
    return { compteRenduId: ev.id };
  },

  /**
   * PRÉ-VISUALISATION d'une pré-réception — le document EXACTEMENT tel que le
   * destinataire le recevra, SANS rien persister ni diffuser. Sert l'écran de
   * validation : le conducteur ouvre la version client / artisan (brouillon)
   * avant de décider. Aucun événement n'est créé — rien ne quitte PHÉNIX.
   */
  previewPrereception(
    projectId: ProjectId,
    actor: EventActor,
    data: PrereceptionData,
    audience: CrAudience,
  ): void {
    const presents = data.presents.map((s) => s.trim()).filter(Boolean);
    const now = new Date().toISOString();
    // Événement SYNTHÉTIQUE (jamais journalisé) : seul le rendu nous intéresse.
    const preview = {
      id: toEventId('preview'),
      projectId,
      type: 'compte_rendu',
      actor,
      visibility: 'client',
      state: 'brouillon',
      captureId: null,
      createdAt: now,
      publishedBy: null,
      publishedAt: null,
      content: {
        texte: '',
        missionKind: 'prereception',
        docTitre: prereceptionDocTitle(data.version),
        ...(presents.length ? { presents } : {}),
        prereception: { ...data, presents },
      },
    } as Event;
    openHtmlDocument(
      buildDocumentHtml(preview, docContextFor(snapshot, preview, actor.userId), audience),
    );
  },

  /**
   * VALIDER ET ENVOYER une pré-réception (VISION Art. 8, 9) — le SEUL moment où le
   * document contractuel quitte PHÉNIX. Le conducteur reste juridiquement maître :
   * tant qu'il n'a pas validé, RIEN n'est créé (le client et les artisans ne
   * voient rien, aucune notification). À la validation, on émet UN événement
   * `compte_rendu` PUBLIÉ (visible du client) — d'où sont dérivés les deux
   * documents (client / artisan) par destinataire, sans double saisie. Le document
   * publié est APPEND-ONLY : non modifiable. Une correction crée une NOUVELLE
   * version (V2) — jamais de modification silencieuse d'un document déjà transmis.
   * La version client atterrit dans l'Espace client (+ notification) ; la version
   * artisan reste côté conducteur, à transmettre aux artisans concernés.
   */
  async createPrereception(
    projectId: ProjectId,
    actor: EventActor,
    input: PrereceptionData,
  ): Promise<{ prereceptionId: string; version: number }> {
    const presents = input.presents.map((s) => s.trim()).filter(Boolean);
    // Version = nombre de pré-réceptions déjà validées pour ce chantier + 1.
    const version =
      snapshot.events.filter(
        (e) =>
          e.projectId === projectId && e.type === 'compte_rendu' && Boolean(e.content.prereception),
      ).length + 1;
    const ev = await backend.appendEvent({
      projectId,
      actor,
      type: 'compte_rendu',
      visibility: 'client',
      state: 'publie',
      content: {
        texte: '',
        missionKind: 'prereception',
        docTitre: prereceptionDocTitle(version),
        ...(presents.length ? { presents } : {}),
        prereception: { ...input, presents, version },
      },
    });
    refresh();
    broadcast();
    return { prereceptionId: ev.id, version };
  },

  /**
   * PRÉVISUALISER une réception (brouillon) — rend le PV EXACTEMENT tel que le
   * client le recevra, SANS rien persister ni diffuser. Le conducteur vérifie le
   * document avant de valider. Aucun événement n'est créé.
   */
  previewReception(projectId: ProjectId, actor: EventActor, data: ReceptionData): void {
    const now = new Date().toISOString();
    const preview = {
      id: toEventId('preview'),
      projectId,
      type: 'compte_rendu',
      actor,
      visibility: 'client',
      state: 'brouillon',
      captureId: null,
      createdAt: now,
      publishedBy: null,
      publishedAt: null,
      content: {
        texte: '',
        missionKind: 'reception',
        docTitre: receptionDocTitle(data.version),
        reception: data,
      },
    } as Event;
    openHtmlDocument(
      buildDocumentHtml(preview, docContextFor(snapshot, preview, actor.userId), 'client'),
    );
  },

  /**
   * VALIDER ET DIFFUSER une RÉCEPTION (dernière étape contractuelle). La Réception
   * repart de la Pré-réception validée : elle ne recrée aucune prestation, elle
   * atteste que TOUTES les réserves ont été levées. À la validation : on émet UN
   * événement `compte_rendu` PUBLIÉ (visible du client, notifié), on confirme
   * l'étape « Réception », et le chantier passe automatiquement en CLÔTURÉ
   * (archivable). Le document publié est APPEND-ONLY — une correction crée une
   * nouvelle version.
   */
  async createReception(
    projectId: ProjectId,
    actor: EventActor,
    input: ReceptionData,
  ): Promise<{ receptionId: string; version: number }> {
    // Version = nombre de réceptions déjà validées pour ce chantier + 1.
    const version =
      snapshot.events.filter(
        (e) =>
          e.projectId === projectId && e.type === 'compte_rendu' && Boolean(e.content.reception),
      ).length + 1;
    const ev = await backend.appendEvent({
      projectId,
      actor,
      type: 'compte_rendu',
      visibility: 'client',
      state: 'publie',
      content: {
        texte: '',
        missionKind: 'reception',
        docTitre: receptionDocTitle(version),
        etapeConfirmee: 'reception',
        reception: { ...input, version },
      },
    });
    // Clôture automatique : une réception validée termine le chantier (archivable).
    await backend.updateProject(projectId, { status: 'cloture' });
    refresh();
    broadcast();
    return { receptionId: ev.id, version };
  },

  /**
   * PARTAGER une mission. « Partager » est une ACTION, jamais un objet. Vers le
   * CLIENT : on émet une projection CLIENT-SAFE (la voix client) + on partage les
   * photos ; jamais de réserve, responsable ni donnée interne. Vers les autres
   * audiences (artisan, architecte, BC, MOE, investisseur) : simulation /
   * journalisation / aperçu (pas d'envoi mail réel, pas de signature réelle).
   */
  async shareMission(
    projectId: ProjectId,
    actor: EventActor,
    input: {
      missionEventId: string;
      momentId: string;
      audiences: string[];
      texteClient: string;
      docTitre: string;
    },
  ): Promise<void> {
    if (input.audiences.includes('client')) {
      // Projection CLIENT-SAFE : uniquement un compte rendu en voix client. Le
      // Moment (photos + récit brut interne) N'EST JAMAIS partagé tel quel — il
      // contient des observations internes (actions, réserves) qui ne doivent
      // pas fuiter. Le client ne voit que ce texte reformulé et neutre.
      await backend.appendEvent({
        projectId,
        actor,
        type: 'compte_rendu',
        visibility: 'client',
        state: 'publie',
        content: {
          texte: input.texteClient,
          docTitre: input.docTitre,
        },
      });
    }

    // Journalisation du partage (aperçu / simulation) pour toutes les audiences.
    const shares = readJson<Record<string, ShareLog[]>>(SHARES_KEY, {});
    shares[projectId] = [
      ...(shares[projectId] ?? []),
      {
        id: crypto.randomUUID(),
        missionEventId: input.missionEventId,
        audiences: input.audiences,
        at: new Date().toISOString(),
      },
    ];
    safeSetItem(SHARES_KEY, JSON.stringify(shares));
    refresh();
    broadcast();
  },

  /**
   * PHÉNIX répond au client (B1). Le fil de conversation est un agrégat léger
   * (hors Journal). PHÉNIX ne répond QUE s'il a une donnée fiable ; sinon il
   * escalade en créant une demande (`destinataire: 'phenix'`) au Journal, qui
   * remonte côté conducteur (« Répondre au client » / le radar).
   */
  /**
   * LÉON CÔTÉ CONDUCTEUR : répond aux questions sur le chantier À PARTIR DU CONTRAT
   * VALIDÉ uniquement (`validatedDevis` + avenants + exclusions). Déterministe, ne
   * s'appuie sur aucune autre source, n'invente jamais. La seule source de vérité.
   */
  askContrat(projectId: ProjectId, question: string): ContractAnswer {
    const dossiers = readJson<Record<string, ProjectDossier>>(DOSSIERS_KEY, {});
    const dossier = dossiers[projectId];
    return answerContractQuestion(
      dossier,
      question,
      dossier?.avenants ?? [],
      dossier?.analyse?.exclusions ?? [],
    );
  },

  async askPhenix(
    projectId: ProjectId,
    actor: EventActor,
    question: string,
    photosInput: { imageUrl?: string; bucket?: string; storagePath?: string }[] = [],
  ): Promise<PhenixMessage | null> {
    const texte = question.trim();
    const photos: CompteRenduPhoto[] = photosInput.map((ph) => ({
      ...(ph.imageUrl ? { imageUrl: ph.imageUrl } : {}),
      ...(ph.bucket ? { bucket: ph.bucket } : {}),
      ...(ph.storagePath ? { storagePath: ph.storagePath } : {}),
    }));
    // Léon accepte un message texte ET/OU des photos : au moins l'un des deux.
    if (!texte && photos.length === 0) return null;
    const now = new Date().toISOString();
    const conv = readJson<Record<string, PhenixMessage[]>>(PHENIX_CONV_KEY, {});
    const list = conv[projectId] ?? [];

    const events = snapshot.events.filter((e) => e.projectId === projectId);
    const dossier = snapshot.dossiers[projectId] ?? null;
    // Fiche CHANTIER que Léon « connaît » : adresse du bien (≠ adresse PHÉNIX),
    // nom du chantier, client, état, artisans (annuaire). Il répond directement,
    // sans confondre les sources ni escalader une simple question de contexte.
    const project = snapshot.projects.find((p) => p.id === projectId);
    const chantierAddress = project?.address ?? null;
    const chantierName = project?.name ?? null;
    // Statut RÉEL dérivé des faits (source unique) — Léon ne cite jamais un statut
    // manuel qui contredirait les événements du chantier.
    const statutLabel = project ? PROJECT_STATUS_LABEL[deriveProjectStatus(project, events)] : null;
    const clientName =
      snapshot.contacts.find((c) => c.role === 'client' && c.projectIds.includes(projectId))?.nom ??
      null;
    const artisans = snapshot.contacts
      .filter((c) => c.role === 'artisan' && c.projectIds.includes(projectId))
      .map((c) => ({ nom: c.nom, ...(c.trade ? { trade: c.trade } : {}) }));
    // PHÉNIX est le concierge du CLIENT : il ne connaît que les Moments partagés
    // (jamais l'interne). Le Fil client est une projection — la règle est unique.
    const moments = (snapshot.fil.moments[projectId] ?? []).filter(momentPartageClient);
    const zones = snapshot.fil.zones[projectId] ?? [];
    const history = list.map((m) => ({ role: m.role, texte: m.texte }));
    // Une photo jointe force l'escalade (Léon ne voit pas les images) : c'est le
    // conducteur qui regarde. `hasPhotos` porte cette décision côté core.
    const reply = corePhenix({
      question: texte,
      events,
      dossier,
      moments,
      zones,
      history,
      chantierAddress,
      chantierName,
      clientName,
      statutLabel,
      artisans,
      hasPhotos: photos.length > 0,
    });

    // Escalade : Léon crée D'ABORD la demande conducteur (texte du client + photos
    // + date + auteur, statut « À traiter ») — source UNIQUE des photos. Le client
    // ne crée jamais de ticket. On crée l'événement AVANT d'écrire le fil pour que
    // les messages puissent le référencer (`demandeRef`) et afficher les photos
    // depuis lui, sans dupliquer un gros payload base64 dans la conversation.
    let demandeRef: string | undefined;
    if (reply.kind === 'escalade') {
      const event = await backend.appendEvent({
        projectId,
        actor,
        type: 'demande',
        visibility: 'client',
        state: 'ouverte',
        content: {
          question: reply.escaladeQuestion || 'Photos transmises',
          destinataire: 'phenix',
          ...(photos.length ? { photos } : {}),
        },
      });
      demandeRef = event.id;
    }

    // Le fil de conversation est LÉGER (texte + réf) : les photos vivent dans la
    // demande, jamais recopiées ici — sinon le blob de conversation gonfle et peut
    // saturer le quota localStorage (chat figé, demande perdue). `safeSetItem`
    // rend l'écriture best-effort : la session ne casse jamais sur un quota plein.
    const clientMsg: PhenixMessage = {
      id: crypto.randomUUID(),
      role: 'client',
      texte,
      at: now,
      ...(demandeRef ? { demandeRef } : {}),
    };
    const phenixMsg: PhenixMessage = {
      id: crypto.randomUUID(),
      role: 'phenix',
      texte: reply.message,
      at: now,
      kind: reply.kind,
      ...(reply.sources.length ? { sources: reply.sources } : {}),
      ...(reply.avancer ? { avancer: reply.avancer } : {}),
      ...(reply.action ? { action: reply.action } : {}),
      ...(demandeRef ? { demandeRef } : {}),
    };

    conv[projectId] = [...list, clientMsg, phenixMsg];
    safeSetItem(PHENIX_CONV_KEY, JSON.stringify(conv));

    refresh();
    broadcast();
    // On renvoie le message (avec `autoOpen` TRANSITOIRE — jamais persisté) pour
    // que l'UI exécute l'ouverture des commandes explicites.
    return { ...phenixMsg, ...(reply.autoOpen ? { autoOpen: true } : {}) };
  },

  /** Charge le chantier de démonstration (jeu de données vivant). */
  loadDemo(): void {
    const { state, people, activeProjectId, dossiers, contacts, fil } = buildDemoSeed();
    kv.save(state);
    safeSetItem(PEOPLE_KEY, JSON.stringify(people));
    safeSetItem(ACTIVE_KEY, JSON.stringify(activeProjectId));
    safeSetItem(DOSSIERS_KEY, JSON.stringify(dossiers));
    safeSetItem(CONTACTS_KEY, JSON.stringify(contacts));
    safeSetItem(FIL_MOMENTS_KEY, JSON.stringify(fil.moments));
    safeSetItem(FIL_COUPS_KEY, JSON.stringify(fil.coups));
    safeSetItem(FIL_MESSAGES_KEY, JSON.stringify(fil.messages));
    safeSetItem(FIL_ZONES_KEY, JSON.stringify(fil.zones));
    lsRemove(PHENIX_CONV_KEY);
    lsRemove(SHARES_KEY);
    // Nouvelle démo = ardoise de notifications propre : l'historique seedé ne
    // notifie pas ; seules les actions à venir le feront.
    safeSetItem(NOTIF_BASELINE_KEY, JSON.stringify(new Date().toISOString()));
    safeSetItem(SEEDED_KEY, '1');
    refresh();
    broadcast();
  },

  /** Repart de zéro (états vides élégants) — sans réamorcer la démo. */
  reset(): void {
    clearWorkspace();
    refresh();
    broadcast();
  },

  /**
   * Démarrer à vide au premier lancement : un espace de travail propre, prêt
   * pour de VRAIS chantiers (pas la démo). Marque l'espace initialisé.
   */
  startBlank(): void {
    clearWorkspace();
    refresh();
    broadcast();
  },

  /**
   * SAUVEGARDE (Lot 4) : sérialise tout l'espace de travail local en une chaîne
   * JSON lisible. Le fichier contient chantiers/journal, missions, réserves,
   * actions, tout le Fil (photos localStorage comprises), les dossiers, les
   * paramètres (noms, projet actif) et les conversations PHÉNIX.
   */
  exportWorkspace(): string {
    const data: Record<string, unknown> = {};
    for (const key of WORKSPACE_KEYS) {
      const raw = lsGet(key);
      if (raw === null) continue;
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
    return JSON.stringify(
      { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data },
      null,
      2,
    );
  },

  /**
   * RESTAURATION (Lot 4) : remplace INTÉGRALEMENT l'espace de travail par une
   * sauvegarde. Validation stricte AVANT toute écriture — en cas de fichier
   * invalide, rien n'est modifié (aucune perte silencieuse). Sur succès, l'état
   * courant est entièrement remplacé (les clés absentes de la sauvegarde sont
   * retirées) : ce qui est restauré est exactement le contenu du fichier.
   */
  importWorkspace(json: string): { ok: true } | { ok: false; error: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, error: 'Fichier illisible : ce n’est pas un JSON valide.' };
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, error: 'Fichier invalide : structure inattendue.' };
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.app !== BACKUP_APP) {
      return { ok: false, error: 'Ce fichier n’est pas une sauvegarde PHÉNIX 360.' };
    }
    if (typeof obj.data !== 'object' || obj.data === null) {
      return { ok: false, error: 'Sauvegarde invalide : données manquantes.' };
    }
    const data = obj.data as Record<string, unknown>;
    // Restauration COMPLÈTE : on remplace l'espace par la sauvegarde.
    for (const key of WORKSPACE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        safeSetItem(key, JSON.stringify(data[key]));
      } else {
        lsRemove(key);
      }
    }
    safeSetItem(SEEDED_KEY, '1');
    // Remplacement COMPLET : le miroir mémoire (états d'avant l'import) n'a plus
    // lieu d'être — on le vide pour que `build()` relise la sauvegarde restaurée.
    clearMemMirror();
    refresh();
    broadcast();
    return { ok: true };
  },
};

// Au tout premier lancement, on N'IMPOSE PAS la démo : l'application propose un
// choix (découvrir la démo / démarrer à vide). Le marqueur `SEEDED_KEY` reste
// donc absent tant qu'aucun choix n'a été fait (cf. `snapshot.seeded`).

export function useDemo(): DemoSnapshot {
  return useSyncExternalStore(demo.subscribe, demo.getSnapshot, demo.getSnapshot);
}

/** Nom affichable d'un utilisateur (fallback générique). */
export function nameOf(snap: DemoSnapshot, userId: string | null | undefined): string {
  if (!userId) return 'PHÉNIX';
  return snap.people[userId] ?? 'PHÉNIX';
}

/**
 * Contexte d'en-tête d'un document généré : identité complète du chantier
 * (nom, adresse, client) + auteur. L'adresse et le client alimentent l'en-tête
 * du PV de pré-réception (traçabilité contractuelle).
 */
function docContextFor(
  snap: DemoSnapshot,
  event: Event,
  authorUserId?: string | null,
): DocumentContext {
  const project = snap.projects.find((p) => p.id === event.projectId);
  const clientName = project?.clientId ? snap.people[project.clientId] : undefined;
  return {
    projectName: project?.name ?? 'Chantier',
    ...(project?.code ? { projectCode: project.code } : {}),
    authorName: nameOf(snap, authorUserId ?? event.actor.userId),
    ...(project?.address ? { address: project.address } : {}),
    ...(clientName ? { clientName } : {}),
  };
}

/** Dossier préparé d'un projet (s'il a été créé via PHÉNIX Start). */
export function dossierOf(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): ProjectDossier | null {
  if (!projectId) return null;
  return snap.dossiers[projectId] ?? null;
}

/** Réglages « Mon espace » d'un chantier (valeurs par défaut si jamais réglé). */
export function clientSettingsOf(snap: DemoSnapshot, projectId: string): ClientSettings {
  return snap.clientSettings[projectId] ?? defaultClientSettings();
}

/** Le fil de conversation PHÉNIX d'un projet (côté client). */
export function conversationOf(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): PhenixMessage[] {
  if (!projectId) return [];
  return snap.phenix[projectId] ?? [];
}

/** Contacts de l'annuaire liés à un chantier. */
export function contactsOf(snap: DemoSnapshot, projectId: string | null | undefined): Contact[] {
  if (!projectId) return [];
  return snap.contacts.filter((c) => c.projectIds.includes(projectId));
}

/** Le CONTACT qui incarne le client d'un chantier (source unique de ses coordonnées). */
export function clientContactOf(
  snap: DemoSnapshot,
  clientId: string | null | undefined,
): Contact | undefined {
  if (!clientId) return undefined;
  return snap.contacts.find((c) => c.userId === clientId);
}

/** Historique des communications tracées vers un contact (tous chantiers, récentes d'abord). */
export function communicationsOf(snap: DemoSnapshot, contactId: string): Event[] {
  return snap.events
    .filter((e) => e.type === 'communication' && e.content.contactId === contactId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Dernier message de chaque Moment (source unique des « en attente »). */
function lastMessagePerMoment(messages: Message[]): Map<string, Message> {
  const byMoment = new Map<string, Message[]>();
  for (const m of messages) {
    const arr = byMoment.get(m.momentId) ?? [];
    arr.push(m);
    byMoment.set(m.momentId, arr);
  }
  const last = new Map<string, Message>();
  for (const [id, arr] of byMoment) {
    const l = [...arr].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
    if (l) last.set(id, l);
  }
  return last;
}

/** Le Moment `id` a-t-il été consulté par `role` depuis son dernier message ? */
function momentSeenSince(snap: DemoSnapshot, role: string, id: string, last: Message): boolean {
  const at = snap.seen[role]?.[id];
  return at !== undefined && at >= last.createdAt;
}

/**
 * Moments dont le DERNIER message est du CLIENT — en attente d'une réponse du
 * CONDUCTEUR (« la balle est dans son camp »). Signalé dans Aujourd'hui + sur le
 * Moment. S'éteint de DEUX façons : le conducteur RÉPOND (son message devient le
 * dernier) OU il CONSULTE le Moment (accusé de lecture `seen['compagnon']`).
 */
export function pendingClientMoments(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): Set<string> {
  const pending = new Set<string>();
  if (!projectId) return pending;
  for (const [id, last] of lastMessagePerMoment(snap.fil.messages[projectId] ?? []))
    if (last.authorRole === 'client' && !momentSeenSince(snap, 'compagnon', id, last))
      pending.add(id);
  return pending;
}

/** Nombre de moments en attente d'une réponse du conducteur (commentaires clients). */
export function pendingClientCommentCount(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): number {
  return pendingClientMoments(snap, projectId).size;
}

/**
 * SYMÉTRIQUE côté client : moments PARTAGÉS au client dont le dernier message est
 * de l'ÉQUIPE (conducteur). C'est un mot du conducteur que le client n'a pas
 * encore vu/traité → on le notifie dans son espace. Répondre (côté client) vide
 * l'état. Ne concerne que les moments visibles du client (jamais l'interne).
 */
export function pendingTeamMoments(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): Set<string> {
  const pending = new Set<string>();
  if (!projectId) return pending;
  const shared = new Set<string>(
    (snap.fil.moments[projectId] ?? []).filter(momentPartageClient).map((m) => m.id),
  );
  for (const [id, last] of lastMessagePerMoment(snap.fil.messages[projectId] ?? []))
    if (
      shared.has(id) &&
      last.authorRole !== 'client' &&
      !momentSeenSince(snap, 'client', id, last)
    )
      pending.add(id);
  return pending;
}

/** Nombre de moments avec un message d'équipe en attente côté client. */
export function pendingTeamMessageCount(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): number {
  return pendingTeamMoments(snap, projectId).size;
}

/**
 * Le Moment le plus RÉCENT parmi un ensemble (dernier message le plus tardif) :
 * la cible qu'une notification ouvre quand plusieurs sont en attente (« ouvrir
 * la plus récente »). Le compteur, lui, montre le nombre total.
 */
function mostRecentMoment(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
  ids: Set<string>,
): string | undefined {
  if (!projectId || ids.size === 0) return undefined;
  const last = lastMessagePerMoment(snap.fil.messages[projectId] ?? []);
  let bestId: string | undefined;
  let bestAt = '';
  for (const id of ids) {
    const at = last.get(id)?.createdAt ?? '';
    if (at >= bestAt) {
      bestAt = at;
      bestId = id;
    }
  }
  return bestId;
}

/** Le commentaire client le plus récent en attente (cible de la notification conducteur). */
export function mostRecentPendingClientMoment(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): string | undefined {
  return mostRecentMoment(snap, projectId, pendingClientMoments(snap, projectId));
}

/** Le message d'équipe le plus récent en attente (cible de la notification client). */
export function mostRecentPendingTeamMoment(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): string | undefined {
  return mostRecentMoment(snap, projectId, pendingTeamMoments(snap, projectId));
}

/* -------------------------------------------------------------------------- *
 * NOTIFICATIONS BIDIRECTIONNELLES — le chantier, espace privé conducteur ⇆ client
 * -------------------------------------------------------------------------- *
 * Toute action importante d'une partie notifie l'autre, DANS son écran d'accueil
 * (« Aujourd'hui » côté conducteur, l'Espace client côté client) — jamais un
 * nouvel écran. Une notification est DÉRIVÉE des faits (événements, moments,
 * coups de cœur) : rien de nouveau n'est persisté. Elle s'éteint dès qu'on la
 * consulte (accusé de lecture `seen[role]`), et l'historique antérieur au repère
 * `notifBaseline` ne notifie jamais. Client-safe : chaque camp ne voit QUE ce qui
 * le concerne.
 */
export interface AppNotification {
  /** Identifiant stable (clé React + accusé de lecture). */
  id: string;
  icon: string;
  text: string;
  createdAt: string;
  /** Faits à marquer LUS quand on ouvre la notification (souvent 1, photos → n). */
  seenKeys: string[];
  projectId: string;
  /** Conducteur : onglet du chantier à ouvrir (+ Moment à cibler le cas échéant). */
  tab?: string;
  momentId?: string;
  /** Client : onglet de l'espace à ouvrir (aujourdhui / projet / coulisses / documents). */
  clientTab?: 'aujourdhui' | 'demandes' | 'choix' | 'coulisses' | 'documents';
  /** Client : section à faire défiler dans l'onglet (+ éventuel basculement de vue). */
  clientSection?: string;
  clientView?: 'fil' | 'bibliotheque';
}

function notifBaseline(): string {
  return readJson<string | null>(NOTIF_BASELINE_KEY, null) ?? '';
}

const byDateDesc = (a: AppNotification, b: AppNotification): number =>
  a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;

/**
 * Notifications du CONDUCTEUR pour un chantier : ce que le CLIENT a fait
 * (❤️ sur une publication, commentaire, réponse/validation d'une décision).
 */
export function conductorNotifications(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): AppNotification[] {
  if (!projectId) return [];
  const base = notifBaseline();
  const seen = snap.seen['compagnon'] ?? {};
  const clientId = snap.projects.find((p) => p.id === projectId)?.clientId;
  const clientName = clientId ? nameOf(snap, clientId) : 'Votre client';
  const out: AppNotification[] = [];

  // ❤️ du client sur une publication.
  for (const c of snap.fil.coups[projectId] ?? [])
    if (c.userRole === 'client' && c.createdAt > base && !seen[c.id])
      out.push({
        id: `coup-${c.id}`,
        icon: '❤️',
        text: `${clientName} a aimé une publication`,
        createdAt: c.createdAt,
        seenKeys: [c.id],
        projectId,
        tab: 'fil',
        momentId: c.momentId,
      });

  // 💬 Commentaire du client (dernier message d'un Moment = client, non consulté).
  for (const id of pendingClientMoments(snap, projectId))
    out.push({
      id: `comment-${id}`,
      icon: '💬',
      text: `${clientName} a commenté une publication`,
      createdAt: lastMessageAt(snap, projectId, id),
      seenKeys: [id],
      projectId,
      tab: 'fil',
      momentId: id,
    });

  // ✅ Décision validée / déléguée par le client.
  for (const e of snap.events)
    if (
      e.projectId === projectId &&
      e.type === 'decision' &&
      (e.content.kind === 'validee' || e.content.kind === 'deleguee') &&
      e.content.origin === 'client' &&
      e.createdAt > base &&
      !seen[e.id]
    )
      out.push({
        id: `decision-${e.id}`,
        icon: '✅',
        text: `Décision validée par le client`,
        createdAt: e.createdAt,
        seenKeys: [e.id],
        projectId,
        tab: 'suivi',
      });

  // 📎 Réponse du client à une demande de DOCUMENT (document joint et/ou message).
  for (const e of snap.events) {
    if (e.projectId !== projectId || e.type !== 'demande') continue;
    const c = e.content;
    if (c.destinataire !== 'client' || c.attendu !== 'document' || !c.resolution) continue;
    if (c.resolution.resolvedAt <= base || seen[e.id]) continue;
    const doc = c.resolution.docEventId
      ? snap.events.find((x) => x.id === c.resolution?.docEventId && x.type === 'document')
      : undefined;
    const libelle = doc?.type === 'document' ? doc.content.libelle : undefined;
    out.push({
      id: `docreq-${e.id}`,
      icon: '📎',
      text: libelle
        ? `${clientName} a envoyé : ${libelle}`
        : `${clientName} a répondu à votre demande de document`,
      createdAt: c.resolution.resolvedAt,
      seenKeys: [e.id],
      projectId,
      // Le document reçu est classé dans « Documents » ; sinon, la demande au Suivi.
      tab: doc ? 'documents' : 'suivi',
    });
  }

  // 📩 Nouvelle demande du client (posée à Léon, escaladée au conducteur) : tant
  // qu'elle est OUVERTE, elle doit sauter aux yeux dans « Aujourd'hui ». C'est le
  // signal « Nouvelle demande client à traiter » attendu côté conducteur.
  for (const e of snap.events) {
    if (e.projectId !== projectId || e.type !== 'demande') continue;
    const c = e.content;
    if (c.destinataire !== 'phenix' || e.state !== 'ouverte' || e.actor.role !== 'client') continue;
    if (e.createdAt <= base || seen[e.id]) continue;
    out.push({
      id: `demande-client-${e.id}`,
      icon: '📩',
      text: `Nouvelle demande client à traiter`,
      createdAt: e.createdAt,
      seenKeys: [e.id],
      projectId,
      tab: 'suivi',
    });
  }

  return out.sort(byDateDesc);
}

/** Date du dernier message d'un Moment (pour dater la notification « commentaire »). */
function lastMessageAt(snap: DemoSnapshot, projectId: string, momentId: string): string {
  return lastMessagePerMoment(snap.fil.messages[projectId] ?? []).get(momentId)?.createdAt ?? '';
}

/**
 * Notifications du CLIENT pour un chantier : ce que le CONDUCTEUR a publié
 * (nouvelle publication / photos, nouveau document partagé). Uniquement du contenu
 * VISIBLE client — jamais l'interne.
 */
export function clientNotifications(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): AppNotification[] {
  if (!projectId) return [];
  const base = notifBaseline();
  const seen = snap.seen['client'] ?? {};
  const out: AppNotification[] = [];
  // Préférences de notification du client (« Mon espace ») : une catégorie
  // désactivée n'apparaît plus dans « Aujourd'hui ». Par défaut, tout est activé.
  const prefs = snap.clientSettings[projectId]?.notifPrefs;
  const allow = (k: ClientNotifPrefKey): boolean => !prefs || prefs[k] !== false;

  // 📷 Nouvelles photos partagées dans les coulisses (album = UN seul moment →
  // UNE seule notification, jamais une par photo). Uniquement les albums photo.
  if (allow('photos'))
    for (const m of snap.fil.moments[projectId] ?? [])
      if (estMomentCoulisses(m) && momentPartageClient(m) && m.createdAt > base && !seen[m.id])
        out.push({
          id: `moment-${m.id}`,
          icon: '📷',
          text: `Nouvelles photos ajoutées dans les coulisses`,
          createdAt: m.createdAt,
          seenKeys: [m.id],
          projectId,
          clientTab: 'coulisses',
          clientSection: 'section-fil',
          clientView: 'fil',
        });

  for (const e of snap.events) {
    // Visibilité CLIENT via le moteur unique (jamais une règle recopiée).
    if (e.projectId !== projectId || !isVisibleToClient(e)) continue;
    if (e.createdAt <= base || seen[e.id]) continue;
    // 💬 Nouveau compte rendu de l'équipe → il vit dans l'onglet DOCUMENTS.
    if (e.type === 'compte_rendu' && allow('documents'))
      out.push({
        id: `cr-${e.id}`,
        icon: '💬',
        text: e.content.reception
          ? `Votre réception de chantier est disponible`
          : e.content.prereception
            ? `Votre pré-réception est disponible`
            : `Nouveau compte rendu de votre équipe`,
        createdAt: e.createdAt,
        seenKeys: [e.id],
        projectId,
        clientTab: 'documents',
        clientSection: 'section-documents',
      });
    // 📄 Nouveau document partagé PAR L'ÉQUIPE → onglet DOCUMENTS. On ignore les
    // documents que le CLIENT a lui-même envoyés (il ne se notifie pas lui-même).
    else if (e.type === 'document' && e.actor.role !== 'client' && allow('documents'))
      out.push({
        id: `doc-${e.id}`,
        icon: '📄',
        text: `Nouveau document partagé : ${e.content.libelle}`,
        createdAt: e.createdAt,
        seenKeys: [e.id],
        projectId,
        clientTab: 'documents',
        clientSection: 'section-documents',
      });
  }

  // 💬 Le conducteur a RÉPONDU à une demande du client (question → réponse). La
  // demande est passée à `traitee` (hors de la boucle « publie » ci-dessus) → on
  // la traite à part. La réponse vit dans « Vos demandes » (onglet Aujourd'hui).
  for (const e of snap.events) {
    if (!allow('reponse')) break;
    if (e.projectId !== projectId || e.type !== 'demande') continue;
    const c = e.content;
    if (c.destinataire !== 'phenix' || !c.resolution) continue;
    if (c.resolution.resolvedAt <= base || seen[e.id]) continue;
    out.push({
      id: `demande-reponse-${e.id}`,
      icon: '💬',
      text: `PHÉNIX a répondu à votre demande`,
      createdAt: c.resolution.resolvedAt,
      seenKeys: [e.id],
      projectId,
      // La réponse se lit dans l'onglet « Vos demandes ».
      clientTab: 'demandes',
      clientSection: 'client-demandes',
    });
  }

  // 🎨 Un CHOIX vient d'être proposé au client (« Demande de choix » du conducteur)
  // et n'a pas encore été OUVERT. La clé de lecture est l'id de la SÉLECTION :
  // ouvrir la notification (ou la décision) marque le choix « ouvert » → le
  // conducteur voit son statut passer de « Non lu » à « En attente ». Disparaît
  // dès que le client l'ouvre, et l'action reste dans « Aujourd'hui » tant qu'il
  // n'a pas validé.
  const dossierNotif = allow('decision') ? snap.dossiers[projectId] : undefined;
  if (dossierNotif) {
    const proposeById = new Map(
      dossierNotif.selections.filter((s) => s.statut === 'propose').map((s) => [s.id, s] as const),
    );
    for (const e of snap.events) {
      if (e.projectId !== projectId || e.type !== 'decision') continue;
      if (e.content.kind !== 'envoyee' || e.createdAt <= base) continue;
      const sel = proposeById.get(e.content.selectionId);
      if (!sel || seen[sel.id]) continue;
      out.push({
        id: `choix-${sel.id}`,
        icon: '🎨',
        text: `Un choix vous attend : ${sel.categorie}`,
        createdAt: e.createdAt,
        seenKeys: [sel.id],
        projectId,
        clientTab: 'choix',
        clientSection: 'section-choix',
      });
    }
  }

  return out.sort(byDateDesc);
}

/**
 * Choix client validés que le CONDUCTEUR doit encore prendre en compte : les
 * choix validés du chantier, moins ceux déjà marqués « pris en compte » (accusé
 * local). Symétrique des décisions « en attente » — ici, c'est à lui d'agir.
 */
export function choixClientValidesATraiter(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): DecisionEvent[] {
  if (!projectId) return [];
  const events = snap.events.filter((e) => e.projectId === projectId);
  return choixClientValides(events).filter((e) => snap.choixTraites[e.id] === undefined);
}

/** Le Fil d'un projet (moments + coups de cœur + messages + zones). */
export function filOf(
  snap: DemoSnapshot,
  projectId: string | null | undefined,
): {
  moments: Moment[];
  coups: CoupDeCoeur[];
  messages: Message[];
  zones: ProjectZone[];
} {
  if (!projectId) return { moments: [], coups: [], messages: [], zones: [] };
  return {
    moments: snap.fil.moments[projectId] ?? [],
    coups: snap.fil.coups[projectId] ?? [],
    messages: snap.fil.messages[projectId] ?? [],
    zones: snap.fil.zones[projectId] ?? [],
  };
}
