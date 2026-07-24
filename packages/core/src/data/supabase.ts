/**
 * PHÉNIX 360 — Adaptateur Supabase du port `Backend`
 * ---------------------------------------------------------------------------
 * SEUL endroit de core qui connaît Supabase (ADR-004 §2.5 r3). L'import du
 * client est **type only** : aucune dépendance runtime n'est tirée dans le
 * bundle — l'app fournit un `SupabaseClient` déjà construit (avec SES propres
 * URL/clé via variables d'environnement, r6). La RLS reste la garantie de
 * visibilité à la source ; cet adaptateur ne fait que traduire les ports en
 * requêtes et remapper les lignes via les mappers (frontière unique).
 *
 * Implémente les MÊMES 12 méthodes que `InMemoryBackend` : basculer de la démo
 * au SaaS = fournir cet adaptateur à la place, sans toucher au produit ni à
 * l'UI. Sémantique alignée sur l'implémentation mémoire :
 *   • `createProject` génère le code chantier définitif (compteur annuel global
 *     lu sur les codes déjà attribués) — même règle que la démo ;
 *   • le cache `project.current_step` est tenu côté BASE par le trigger
 *     `set_project_current_step` (miroir SQL de `currentStep()`), donc l'append
 *     n'a rien à recalculer ;
 *   • `appendEvent` pose `published_by/at` quand l'état est déjà « publie ».
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventId, ProjectId, UserId } from '../ids.js';
import type { DemandeResolution, Event, EventVisibility } from '../event.js';
import type { Project, ProjectMember } from '../project.js';
import { generateProjectCode } from '../project-code.js';
import type { Backend, NewEvent, NewMember, NewProject, ProjectPatch } from './repository.js';
import type { EventRow, MemberRow, ProjectRow } from './rows.js';
import {
  mapEventRow,
  mapMemberRow,
  mapProjectRow,
  toEventInsert,
  toMemberInsert,
} from './mappers.js';

const PROJECT = 'project';
const PROJECT_MEMBER = 'project_member';
const EVENT = 'event';

function fail(context: string, error: { message: string }): never {
  throw new Error(`[@phenix360/core] ${context}: ${error.message}`);
}

const nowIso = (): string => new Date().toISOString();

/**
 * Adaptateur Supabase implémentant le port `Backend` (ProjectRepository +
 * EventRepository). Le client est injecté (construit côté app avec l'URL/clé
 * publiques ; la RLS protège la donnée).
 */
export class SupabaseBackend implements Backend {
  constructor(private readonly client: SupabaseClient) {}

  /* --- Projets & membres ------------------------------------------------- */

  async createProject(input: NewProject): Promise<Project> {
    // Compteur annuel global : on lit les codes déjà attribués (comme la démo).
    const codesRes = await this.client.from(PROJECT).select('code');
    if (codesRes.error) fail('createProject/codes', codesRes.error);
    const existingCodes = ((codesRes.data ?? []) as { code: string | null }[])
      .map((r) => r.code ?? '')
      .filter(Boolean);
    const createdAt = nowIso();
    const insert = {
      code: generateProjectCode({ address: input.address ?? null, createdAt, existingCodes }),
      name: input.name,
      client_id: input.clientId ?? null,
      address: input.address ?? null,
      status: input.status ?? 'pas_commence',
      current_step: input.currentStep ?? null,
    };
    const res = await this.client.from(PROJECT).insert(insert).select().single();
    if (res.error) fail('createProject', res.error);
    return mapProjectRow(res.data as ProjectRow);
  }

  async getProject(id: ProjectId): Promise<Project | null> {
    const res = await this.client.from(PROJECT).select('*').eq('id', id).maybeSingle();
    if (res.error) fail('getProject', res.error);
    return res.data ? mapProjectRow(res.data as ProjectRow) : null;
  }

  async listProjects(): Promise<Project[]> {
    const res = await this.client
      .from(PROJECT)
      .select('*')
      .order('created_at', { ascending: false });
    if (res.error) fail('listProjects', res.error);
    return ((res.data ?? []) as ProjectRow[]).map(mapProjectRow);
  }

  async updateProject(id: ProjectId, patch: ProjectPatch): Promise<Project> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.address !== undefined) row.address = patch.address;
    if (patch.currentStep !== undefined) row.current_step = patch.currentStep;
    const res = await this.client.from(PROJECT).update(row).eq('id', id).select().single();
    if (res.error) fail('updateProject', res.error);
    return mapProjectRow(res.data as ProjectRow);
  }

  async deleteProject(id: ProjectId): Promise<void> {
    // Membres et événements tombent en cascade (FK `on delete cascade`).
    const res = await this.client.from(PROJECT).delete().eq('id', id);
    if (res.error) fail('deleteProject', res.error);
  }

  async listMembers(projectId: ProjectId): Promise<ProjectMember[]> {
    const res = await this.client.from(PROJECT_MEMBER).select('*').eq('project_id', projectId);
    if (res.error) fail('listMembers', res.error);
    return ((res.data ?? []) as MemberRow[]).map(mapMemberRow);
  }

  async addMember(input: NewMember): Promise<ProjectMember> {
    const res = await this.client
      .from(PROJECT_MEMBER)
      .insert(toMemberInsert(input))
      .select()
      .single();
    if (res.error) fail('addMember', res.error);
    return mapMemberRow(res.data as MemberRow);
  }

  /* --- Événements -------------------------------------------------------- */

  async listEvents(projectId: ProjectId): Promise<Event[]> {
    const res = await this.client
      .from(EVENT)
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (res.error) fail('listEvents', res.error);
    return ((res.data ?? []) as EventRow[]).map(mapEventRow);
  }

  async appendEvent(input: NewEvent): Promise<Event> {
    const insert = toEventInsert(input);
    if (input.state === 'publie') {
      insert.published_by = input.actor.userId;
      insert.published_at = nowIso();
    }
    const res = await this.client.from(EVENT).insert(insert).select().single();
    if (res.error) fail('appendEvent', res.error);
    // `project.current_step` est tenu par le trigger SQL `set_project_current_step`.
    return mapEventRow(res.data as EventRow);
  }

  async publishEvent(id: EventId, publishedBy: UserId): Promise<Event> {
    const res = await this.client
      .from(EVENT)
      .update({ state: 'publie', published_by: publishedBy, published_at: nowIso() })
      .eq('id', id)
      .select()
      .single();
    if (res.error) fail('publishEvent', res.error);
    return mapEventRow(res.data as EventRow);
  }

  async setEventVisibility(id: EventId, visibility: EventVisibility): Promise<Event> {
    const res = await this.client.from(EVENT).update({ visibility }).eq('id', id).select().single();
    if (res.error) fail('setEventVisibility', res.error);
    return mapEventRow(res.data as EventRow);
  }

  async resolveDemande(id: EventId, resolution: DemandeResolution): Promise<Event> {
    // On relit le contenu courant pour y fusionner la résolution (jsonb typé).
    const current = await this.client.from(EVENT).select('type, content').eq('id', id).single();
    if (current.error) fail('resolveDemande/fetch', current.error);
    const row = current.data as { type: string; content: Record<string, unknown> };
    if (row.type !== 'demande') throw new Error(`L'événement ${id} n'est pas une demande`);
    const content = { ...row.content, resolution };
    const res = await this.client
      .from(EVENT)
      .update({ content, state: 'traitee' })
      .eq('id', id)
      .select()
      .single();
    if (res.error) fail('resolveDemande', res.error);
    return mapEventRow(res.data as EventRow);
  }
}
