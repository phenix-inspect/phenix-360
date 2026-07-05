/**
 * PHÉNIX 360 — Implémentation MÉMOIRE des ports d'accès (Mode Démo)
 * ---------------------------------------------------------------------------
 * Implémente `Backend` (ProjectRepository + EventRepository) sans infrastructure.
 * La persistance est déléguée à un `KeyValueStore` injectable : en mémoire par
 * défaut, ou (côté app) adossé à localStorage pour une démo multi-onglets.
 *
 * Passer en Supabase = fournir une autre implémentation des MÊMES ports ; le
 * produit, l'UI et la logique métier ne changent pas. Aucune logique métier
 * spécifique ici au-delà de l'entretien du cache d'avancement (miroir du
 * trigger SQL `set_project_current_step`).
 */
import {
  captureId as toCaptureId,
  eventId as toEventId,
  projectId as toProjectId,
  projectMemberId as toMemberId,
  type IsoDateTime,
  type EventId,
  type ProjectId,
  type UserId,
} from '../ids.js';
import type { DemandeResolution, Event } from '../event.js';
import type { Project, ProjectMember } from '../project.js';
import { currentStep } from '../views.js';
import type { Backend, NewEvent, NewMember, NewProject, ProjectPatch } from './repository.js';

export interface BackendState {
  projects: Project[];
  members: ProjectMember[];
  events: Event[];
}

const empty = (): BackendState => ({ projects: [], members: [], events: [] });

/** Persistance abstraite (mémoire ou localStorage côté app). */
export interface KeyValueStore {
  load(): BackendState | null;
  save(state: BackendState): void;
}

export class MemoryKeyValueStore implements KeyValueStore {
  private state: BackendState | null = null;
  load(): BackendState | null {
    return this.state;
  }
  save(state: BackendState): void {
    this.state = state;
  }
}

const now = (): IsoDateTime => new Date().toISOString();
const uuid = (): string => globalThis.crypto.randomUUID();

export class InMemoryBackend implements Backend {
  constructor(
    private readonly kv: KeyValueStore = new MemoryKeyValueStore(),
    seed?: BackendState,
  ) {
    if (seed && this.kv.load() === null) this.kv.save(seed);
  }

  // Lecture/écriture « read-through » : plusieurs instances partageant le même
  // KeyValueStore (ex. localStorage) voient les mêmes données.
  private read(): BackendState {
    return this.kv.load() ?? empty();
  }
  private write(state: BackendState): void {
    this.kv.save(state);
  }

  /* --- Projets & membres ------------------------------------------------- */
  async createProject(input: NewProject): Promise<Project> {
    const state = this.read();
    const project: Project = {
      id: toProjectId(uuid()),
      name: input.name,
      clientId: input.clientId ?? null,
      ...(input.address !== undefined ? { address: input.address } : {}),
      status: input.status ?? 'pas_commence',
      currentStep: input.currentStep ?? null,
      createdAt: now(),
    };
    state.projects.push(project);
    this.write(state);
    return project;
  }

  async getProject(id: ProjectId): Promise<Project | null> {
    return this.read().projects.find((p) => p.id === id) ?? null;
  }

  async listProjects(): Promise<Project[]> {
    return [...this.read().projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateProject(id: ProjectId, patch: ProjectPatch): Promise<Project> {
    const state = this.read();
    const project = state.projects.find((p) => p.id === id);
    if (!project) throw new Error(`Projet introuvable : ${id}`);
    if (patch.name !== undefined) project.name = patch.name;
    if (patch.status !== undefined) project.status = patch.status;
    if (patch.address !== undefined) project.address = patch.address;
    if (patch.currentStep !== undefined) project.currentStep = patch.currentStep;
    this.write(state);
    return project;
  }

  /** Supprime le projet et sa colonne vertébrale (membres + événements). Local, append-only ailleurs. */
  async deleteProject(id: ProjectId): Promise<void> {
    const state = this.read();
    state.projects = state.projects.filter((p) => p.id !== id);
    state.members = state.members.filter((m) => m.projectId !== id);
    state.events = state.events.filter((e) => e.projectId !== id);
    this.write(state);
  }

  async listMembers(projectId: ProjectId): Promise<ProjectMember[]> {
    return this.read().members.filter((m) => m.projectId === projectId);
  }

  async addMember(input: NewMember): Promise<ProjectMember> {
    const state = this.read();
    const member: ProjectMember = {
      id: toMemberId(uuid()),
      projectId: input.projectId,
      userId: input.userId,
      role: input.role,
      createdAt: now(),
    };
    state.members.push(member);
    this.write(state);
    return member;
  }

  /* --- Événements -------------------------------------------------------- */
  async listEvents(projectId: ProjectId): Promise<Event[]> {
    return this.read().events.filter((e) => e.projectId === projectId);
  }

  async appendEvent(input: NewEvent): Promise<Event> {
    const state = this.read();
    const published = input.state === 'publie';
    const event = {
      id: toEventId(uuid()),
      projectId: input.projectId,
      type: input.type,
      actor: input.actor,
      visibility: input.visibility,
      state: input.state,
      captureId: input.captureId ? toCaptureId(input.captureId) : null,
      createdAt: now(),
      publishedBy: published ? input.actor.userId : null,
      publishedAt: published ? now() : null,
      content: input.content,
    } as Event;
    state.events.push(event);
    this.refreshCurrentStep(state, input.projectId);
    this.write(state);
    return event;
  }

  async publishEvent(id: EventId, publishedBy: UserId): Promise<Event> {
    const state = this.read();
    const event = state.events.find((e) => e.id === id);
    if (!event) throw new Error(`Événement introuvable : ${id}`);
    event.state = 'publie';
    event.publishedBy = publishedBy;
    event.publishedAt = now();
    this.refreshCurrentStep(state, event.projectId);
    this.write(state);
    return event;
  }

  async resolveDemande(id: EventId, resolution: DemandeResolution): Promise<Event> {
    const state = this.read();
    const event = state.events.find((e) => e.id === id);
    if (!event) throw new Error(`Événement introuvable : ${id}`);
    if (event.type !== 'demande') throw new Error(`L'événement ${id} n'est pas une demande`);
    event.content = { ...event.content, resolution };
    event.state = 'traitee';
    this.write(state);
    return event;
  }

  /** Cache d'avancement = miroir du trigger SQL (ADR-002 §5). */
  private refreshCurrentStep(state: BackendState, projectId: ProjectId): void {
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;
    const events = state.events.filter((e) => e.projectId === projectId);
    // Un chantier ne « recule » jamais : si aucun compte rendu ne fixe encore
    // l'étape, on conserve l'étape de départ saisie à la création.
    project.currentStep = currentStep(events) ?? project.currentStep;
  }
}
