/**
 * PHÉNIX 360 — Backend SaaS (write-through Supabase + cache mémoire)
 * ===========================================================================
 * Implémente le MÊME port `Backend` que `InMemoryBackend` : le store et l'UI ne
 * voient aucune différence (mêmes 12 méthodes, `DemoSnapshot` inchangé). La seule
 * chose qui change, c'est OÙ vit la vérité.
 *
 * Principe (write-through) :
 *   • LECTURES → servies depuis un cache mémoire hydraté au démarrage depuis
 *     Supabase (synchrone pour l'UI, via `snapshot()` que `build()` consomme).
 *   • ÉCRITURES → envoyées à Supabase (source durable), puis répercutées dans le
 *     cache. La donnée du conducteur connecté survit ainsi au rechargement et se
 *     retrouve sur un autre appareil.
 *
 * Frontière de cette tranche (M3 — colonne vertébrale) :
 *   • Le CONDUCTEUR est l'utilisateur réellement connecté (`selfUserId`). Il
 *     s'attache à SES chantiers via la fonction sécurisée `app_add_self_as`
 *     (contourne l'anomalie RLS d'insertion directe) — durable.
 *   • Les identités FABRIQUÉES en démo (le « client » incarné localement) et les
 *     actions écrites en leur nom restent en cache LOCAL (aperçu) : elles seront
 *     durcies quand le client aura sa propre connexion (invitations / passerelle,
 *     missions ultérieures). On ne les pousse pas à Supabase (la RLS les
 *     refuserait, à juste titre : ce ne sont pas de vrais comptes).
 *   • Résilience (même philosophie que le miroir mémoire du store) : si une
 *     écriture durable échoue (réseau), la session CONTINUE en cache et on trace
 *     un diagnostic — jamais d'écran cassé, jamais pire que la démo.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  currentStep,
  projectMemberId as toMemberId,
  SupabaseBackend,
  type Backend,
  type BackendState,
  type DemandeResolution,
  type Event,
  type EventId,
  type EventVisibility,
  type NewEvent,
  type NewMember,
  type NewProject,
  type Project,
  type ProjectId,
  type ProjectMember,
  type ProjectPatch,
  type UserId,
} from '@phenix360/core';
import { recordError } from './diagnostics';
import { uploadMediaDeep } from './mediaStore';

const empty = (): BackendState => ({ projects: [], members: [], events: [] });
const uuid = (): string => globalThis.crypto.randomUUID();
const now = (): string => new Date().toISOString();

export class SaaSBackend implements Backend {
  private readonly remote: SupabaseBackend;
  private state: BackendState = empty();
  /** Événements réellement persistés à Supabase (les autres = aperçu local). */
  private readonly durableEvents = new Set<string>();

  constructor(
    private readonly client: SupabaseClient,
    /** Identité RÉELLE de l'utilisateur connecté (le conducteur). */
    private readonly selfUserId: string,
  ) {
    this.remote = new SupabaseBackend(client);
  }

  /**
   * Snapshot synchrone pour `build()` : l'UI lit ici, jamais le réseau. Copie
   * défensive (l'appelant ne doit pas muter le cache).
   */
  snapshot(): BackendState {
    return {
      projects: [...this.state.projects],
      members: [...this.state.members],
      events: [...this.state.events],
    };
  }

  /**
   * Hydrate le cache depuis Supabase : les chantiers visibles (RLS), leurs
   * membres et leur journal. Appelé une fois à la connexion. Tolérant : en cas
   * d'échec réseau, on démarre sur un cache vide (l'app reste utilisable) et on
   * trace le diagnostic — plutôt qu'un écran blanc.
   */
  async hydrate(): Promise<void> {
    let projects: Project[];
    try {
      projects = await this.remote.listProjects();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      recordError('error', `SaaS hydrate (projets): ${msg}`);
      this.state = empty();
      return;
    }
    // Résilience PAR PROJET : un projet qui échoue (réseau, RLS, mapping) est
    // ignoré sans faire perdre les autres — jamais « zéro chantier » sur un aléa.
    const members: ProjectMember[] = [];
    const events: Event[] = [];
    const loaded: Project[] = [];
    for (const p of projects) {
      try {
        const [ms, es] = await Promise.all([
          this.remote.listMembers(p.id),
          this.remote.listEvents(p.id),
        ]);
        members.push(...ms);
        events.push(...es);
        for (const e of es) this.durableEvents.add(e.id);
        loaded.push(p);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        recordError('error', `SaaS hydrate (chantier ${p.id}): ${msg}`);
      }
    }
    this.state = { projects: loaded, members, events };
  }

  /**
   * TEMPS RÉEL (M6) : applique au cache un événement reçu d'un AUTRE appareil
   * (p. ex. la réponse du client à une question, ou sa validation de choix).
   * Upsert par id — remplace si présent, ajoute sinon — puis recalcule l'étape
   * courante. On IGNORE un événement d'un projet absent du cache (il sera pris à
   * la prochaine hydratation) et un doublon strictement identique (évite un rendu
   * inutile). Retourne `true` si le cache a réellement changé (⇒ rafraîchir l'UI).
   */
  ingestEvent(event: Event): boolean {
    // Projet inconnu du cache : on n'introduit pas d'événement orphelin.
    if (!this.state.projects.some((p) => p.id === event.projectId)) return false;
    const i = this.state.events.findIndex((e) => e.id === event.id);
    if (i >= 0) {
      if (JSON.stringify(this.state.events[i]) === JSON.stringify(event)) return false;
      this.state.events[i] = event;
    } else {
      this.state.events.push(event);
    }
    this.durableEvents.add(event.id);
    this.refreshCurrentStep(event.projectId);
    return true;
  }

  /* --- Projets & membres ------------------------------------------------- */

  async createProject(input: NewProject): Promise<Project> {
    const project = await this.remote.createProject(input);
    this.state.projects.push(project);
    return project;
  }

  async getProject(id: ProjectId): Promise<Project | null> {
    return this.state.projects.find((p) => p.id === id) ?? null;
  }

  async listProjects(): Promise<Project[]> {
    return [...this.state.projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateProject(id: ProjectId, patch: ProjectPatch): Promise<Project> {
    const cached = this.state.projects.find((p) => p.id === id);
    if (!cached) throw new Error(`Projet introuvable : ${id}`);
    // Durable d'abord ; en cas d'échec réseau, on applique quand même au cache.
    try {
      const updated = await this.remote.updateProject(id, patch);
      Object.assign(cached, updated);
      // `mapProjectRow` OMET une adresse vidée (spread conditionnel) : `Object.assign`
      // ne l'écraserait donc pas → on applique explicitement les champs vidables.
      if (patch.address !== undefined) cached.address = patch.address || undefined;
      return cached;
    } catch (e) {
      this.recordBestEffort('updateProject', e);
      if (patch.name !== undefined) cached.name = patch.name;
      if (patch.status !== undefined) cached.status = patch.status;
      if (patch.address !== undefined) cached.address = patch.address || undefined;
      if (patch.currentStep !== undefined) cached.currentStep = patch.currentStep;
      return cached;
    }
  }

  async deleteProject(id: ProjectId): Promise<void> {
    try {
      await this.remote.deleteProject(id);
    } catch (e) {
      this.recordBestEffort('deleteProject', e);
    }
    this.state.projects = this.state.projects.filter((p) => p.id !== id);
    this.state.members = this.state.members.filter((m) => m.projectId !== id);
    this.state.events = this.state.events.filter((e) => e.projectId !== id);
  }

  async listMembers(projectId: ProjectId): Promise<ProjectMember[]> {
    return this.state.members.filter((m) => m.projectId === projectId);
  }

  async addMember(input: NewMember): Promise<ProjectMember> {
    // Le conducteur s'attache à SON chantier via la fonction sécurisée (durable).
    if (input.userId === this.selfUserId) {
      const res = await this.client.rpc('app_add_self_as', {
        p_project: input.projectId,
        p_role: input.role,
      });
      if (res.error) this.recordBestEffort('app_add_self_as', { message: res.error.message });
    }
    // Toujours répercuté au cache (l'UI/les rôles fonctionnent à l'identique) ;
    // les identités fabriquées (client démo) restent purement locales pour l'instant.
    const member: ProjectMember = {
      id: toMemberId(uuid()),
      projectId: input.projectId,
      userId: input.userId,
      role: input.role,
      createdAt: now(),
    };
    this.state.members.push(member);
    return member;
  }

  /* --- Événements -------------------------------------------------------- */

  async listEvents(projectId: ProjectId): Promise<Event[]> {
    return this.state.events.filter((e) => e.projectId === projectId);
  }

  async appendEvent(input: NewEvent): Promise<Event> {
    // Écriture durable seulement si l'AUTEUR est l'utilisateur connecté (la RLS
    // exige `author_id = auth.uid()` + membre interne). Sinon : aperçu local.
    if (input.actor.userId === this.selfUserId) {
      try {
        // M5 : sortir les médias base64 du journal → Storage (URL publique).
        const withMedia = {
          ...input,
          content: await uploadMediaDeep(this.client, input.projectId, input.content),
        } as NewEvent;
        const event = await this.remote.appendEvent(withMedia);
        this.state.events.push(event);
        this.durableEvents.add(event.id);
        this.refreshCurrentStep(input.projectId);
        return event;
      } catch (e) {
        this.recordBestEffort('appendEvent', e);
      }
    }
    const event = this.localEvent(input);
    this.state.events.push(event);
    this.refreshCurrentStep(input.projectId);
    return event;
  }

  async publishEvent(id: EventId, publishedBy: UserId): Promise<Event> {
    const event = this.state.events.find((e) => e.id === id);
    if (!event) throw new Error(`Événement introuvable : ${id}`);
    if (this.durableEvents.has(id)) {
      try {
        const updated = await this.remote.publishEvent(id, publishedBy);
        Object.assign(event, updated);
        this.refreshCurrentStep(event.projectId);
        return event;
      } catch (e) {
        this.recordBestEffort('publishEvent', e);
      }
    }
    event.state = 'publie';
    event.publishedBy = publishedBy;
    event.publishedAt = now();
    this.refreshCurrentStep(event.projectId);
    return event;
  }

  async setEventVisibility(id: EventId, visibility: EventVisibility): Promise<Event> {
    const event = this.state.events.find((e) => e.id === id);
    if (!event) throw new Error(`Événement introuvable : ${id}`);
    if (this.durableEvents.has(id)) {
      try {
        const updated = await this.remote.setEventVisibility(id, visibility);
        Object.assign(event, updated);
        return event;
      } catch (e) {
        this.recordBestEffort('setEventVisibility', e);
      }
    }
    event.visibility = visibility;
    return event;
  }

  async resolveDemande(id: EventId, resolution: DemandeResolution): Promise<Event> {
    const event = this.state.events.find((e) => e.id === id);
    if (!event) throw new Error(`Événement introuvable : ${id}`);
    if (event.type !== 'demande') throw new Error(`L'événement ${id} n'est pas une demande`);
    if (this.durableEvents.has(id)) {
      try {
        // M5 : les photos de la réponse (base64) partent vers Storage.
        const stored = await uploadMediaDeep(this.client, event.projectId, resolution);
        const updated = await this.remote.resolveDemande(id, stored);
        Object.assign(event, updated);
        return event;
      } catch (e) {
        this.recordBestEffort('resolveDemande', e);
      }
    }
    event.content = { ...event.content, resolution };
    event.state = 'traitee';
    return event;
  }

  /* --- Interne ----------------------------------------------------------- */

  /** Événement d'APERÇU local (auteur non connecté / écriture durable indispo). */
  private localEvent(input: NewEvent): Event {
    const published = input.state === 'publie';
    return {
      id: uuid(),
      projectId: input.projectId,
      type: input.type,
      actor: input.actor,
      visibility: input.visibility,
      state: input.state,
      captureId: input.captureId ?? null,
      createdAt: now(),
      publishedBy: published ? input.actor.userId : null,
      publishedAt: published ? now() : null,
      content: input.content,
    } as Event;
  }

  /** Miroir du trigger SQL `set_project_current_step` (mêmes règles que la démo). */
  private refreshCurrentStep(projectId: ProjectId): void {
    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) return;
    const events = this.state.events.filter((e) => e.projectId === projectId);
    project.currentStep = currentStep(events) ?? project.currentStep;
  }

  private recordBestEffort(context: string, error: unknown): void {
    const msg =
      error instanceof Error
        ? error.message
        : String((error as { message?: string })?.message ?? error);
    recordError('error', `SaaS ${context} (poursuite en cache): ${msg}`);
  }
}
