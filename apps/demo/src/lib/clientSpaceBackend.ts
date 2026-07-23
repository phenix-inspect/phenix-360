/**
 * PHÉNIX 360 — Backend « MODE CLIENT » (lien + code, sans compte)
 * ===========================================================================
 * But : faire du lien client (`#/c/<id>`) le JUMEAU exact de l'espace client
 * validé (`ClientView`). `ClientView` est bâti pour lire le store et écrire via
 * `demo.*` — il ne connaît RIEN du client_space. On lui présente donc un backend
 * qui implémente le MÊME port `Backend` que la démo / le SaaS, mais :
 *   • LECTURES → servies depuis le cache hydraté par la RPC `client_space` ;
 *   • ÉCRITURES du client → routées vers les RPC code-gardées
 *     (`client_respond_demande`, `client_validate_choix`, `client_message`), qui
 *     renvoient l'espace à jour → on rafraîchit le cache.
 * Ainsi `ClientView` s'affiche et fonctionne à l'identique, sans compte ni store
 * conducteur, et sans jamais écrire le journal en direct (RLS respectée).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  eventId as toEventId,
  mapEventRow,
  projectId as toProjectId,
  projectMemberId as toMemberId,
  userId as toUserId,
  PHENIX_DELEGATE_ID,
  type Backend,
  type BackendState,
  type CoupDeCoeur,
  type DemandeResolution,
  type Event,
  type EventId,
  type EventRow,
  type Message,
  type Moment,
  type NewEvent,
  type NewMember,
  type Project,
  type ProjectId,
  type ProjectMember,
  type ProjectStatus,
  type ProjectStep,
  type ProjectZone,
} from '@phenix360/core';
import { recordError } from './diagnostics';

/** Le Fil « Dans les coulisses » partagé au client (lecture seule). */
export interface ClientFil {
  moments: Moment[];
  coups: CoupDeCoeur[];
  messages: Message[];
  zones: ProjectZone[];
}

/** Forme brute renvoyée par la RPC `client_space`. */
export interface ClientSpaceRaw {
  project: {
    id: string;
    code: string | null;
    name: string;
    address: string | null;
    status: ProjectStatus;
    current_step: string | null;
    created_at: string;
  };
  events: EventRow[];
  /** Fil partagé au client (moments publiés + audience client) — cf. client_space. */
  fil?: Partial<ClientFil>;
}

const CLIENT_USER = toUserId('client-espace');

export class ClientSpaceBackend implements Backend {
  private state: BackendState;
  private fil: ClientFil;

  constructor(
    private readonly client: SupabaseClient,
    private readonly projectId: string,
    private readonly code: string,
    space: ClientSpaceRaw,
  ) {
    this.state = fromSpace(space);
    this.fil = filFromSpace(space);
  }

  snapshot(): BackendState {
    return {
      projects: [...this.state.projects],
      members: [...this.state.members],
      events: [...this.state.events],
    };
  }

  /** Le Fil « Dans les coulisses » partagé au client (lecture seule). */
  filSnapshot(): ClientFil {
    return {
      moments: [...this.fil.moments],
      coups: [...this.fil.coups],
      messages: [...this.fil.messages],
      zones: [...this.fil.zones],
    };
  }

  /* --- Lectures (depuis le cache) --------------------------------------- */
  async listProjects(): Promise<Project[]> {
    return [...this.state.projects];
  }
  async getProject(id: ProjectId): Promise<Project | null> {
    return this.state.projects.find((p) => p.id === id) ?? null;
  }
  async listMembers(projectId: ProjectId): Promise<ProjectMember[]> {
    return this.state.members.filter((m) => m.projectId === projectId);
  }
  async listEvents(projectId: ProjectId): Promise<Event[]> {
    return this.state.events.filter((e) => e.projectId === projectId);
  }

  /* --- Écritures du client → RPC code-gardées --------------------------- */

  /** Répondre à une demande du conducteur (texte). */
  async resolveDemande(id: EventId, resolution: DemandeResolution): Promise<Event> {
    await this.callRpc('client_respond_demande', {
      p_project: this.projectId,
      p_code: this.code,
      p_event: id,
      p_texte: resolution.texte,
    });
    return this.state.events.find((e) => e.id === id) ?? this.pseudoEvent(id);
  }

  /**
   * Répondre à une demande de DOCUMENT en joignant un fichier (durable). Crée un
   * événement `document` côté serveur ET résout la demande — via la RPC gardée.
   * Le fichier voyage en base64 (le client anonyme ne peut pas écrire Storage).
   */
  async respondDocument(
    demandeId: string,
    texte: string,
    doc: unknown,
    libelle?: string,
  ): Promise<void> {
    await this.callRpc('client_respond_document', {
      p_project: this.projectId,
      p_code: this.code,
      p_event: demandeId,
      p_texte: texte,
      p_doc: doc,
      p_libelle: libelle ?? null,
    });
  }

  /** ❤️ Le client aime / n'aime plus un moment des coulisses (bascule durable). */
  async coup(momentId: string): Promise<void> {
    await this.callRpc('client_coup', {
      p_project: this.projectId,
      p_code: this.code,
      p_moment: momentId,
    });
  }

  /** 💬 Le client laisse un message sous un moment (ou une photo si `photoId`). */
  async momentMessage(momentId: string, texte: string, photoId?: string | null): Promise<void> {
    await this.callRpc('client_moment_message', {
      p_project: this.projectId,
      p_code: this.code,
      p_moment: momentId,
      p_texte: texte,
      p_photo: photoId ?? null,
    });
  }

  /**
   * Le client crée un événement. Deux cas routés vers une RPC :
   *  • `decision` `validee`/`deleguee` → validation d'un choix ;
   *  • `demande` `destinataire='phenix'` → message libre au conducteur.
   * Le reste (aperçu documentaire éventuel) reste local (non durable).
   */
  async appendEvent(input: NewEvent): Promise<Event> {
    if (input.type === 'decision') {
      const c = input.content;
      if (c.kind === 'validee' || c.kind === 'deleguee') {
        const carrier = this.state.events.find(
          (e) =>
            e.type === 'decision' &&
            (e.content.kind === 'envoyee' || e.content.kind === 'renvoyee') &&
            e.content.selectionId === c.selectionId,
        );
        if (carrier) {
          await this.callRpc('client_validate_choix', {
            p_project: this.projectId,
            p_code: this.code,
            p_event: carrier.id,
            p_option:
              c.kind === 'deleguee' ? PHENIX_DELEGATE_ID : (c.optionId ?? PHENIX_DELEGATE_ID),
            p_message: c.message ?? null,
          });
        }
        return this.pseudoEvent(toEventId(crypto.randomUUID()));
      }
    }
    if (input.type === 'demande' && input.content.destinataire === 'phenix') {
      await this.callRpc('client_message', {
        p_project: this.projectId,
        p_code: this.code,
        p_texte: input.content.question,
      });
      return this.pseudoEvent(toEventId(crypto.randomUUID()));
    }
    // Aperçu local (ex. réponse documentaire) — non durable pour l'instant.
    const ev = localEvent(input);
    this.state.events.push(ev);
    return ev;
  }

  async publishEvent(id: EventId): Promise<Event> {
    return this.state.events.find((e) => e.id === id) ?? this.pseudoEvent(id);
  }
  async setEventVisibility(id: EventId): Promise<Event> {
    return this.state.events.find((e) => e.id === id) ?? this.pseudoEvent(id);
  }

  /* --- Non pertinents pour le client (jamais appelés par ClientView) ---- */
  async createProject(): Promise<Project> {
    throw new Error('mode client : création de projet non autorisée');
  }
  async updateProject(id: ProjectId): Promise<Project> {
    const p = this.state.projects.find((x) => x.id === id);
    if (!p) throw new Error('projet introuvable');
    return p;
  }
  async deleteProject(): Promise<void> {
    /* non autorisé côté client : no-op */
  }
  async addMember(input: NewMember): Promise<ProjectMember> {
    const m: ProjectMember = {
      id: toMemberId(crypto.randomUUID()),
      projectId: input.projectId,
      userId: input.userId,
      role: input.role,
      createdAt: new Date().toISOString(),
    };
    this.state.members.push(m);
    return m;
  }

  /* --- Interne ---------------------------------------------------------- */
  private async callRpc(name: string, params: Record<string, unknown>): Promise<void> {
    try {
      const res = await this.client.rpc(name, params);
      if (res.error) {
        recordError('error', `client ${name}: ${res.error.message}`);
        return;
      }
      if (res.data && (res.data as ClientSpaceRaw).project) {
        this.state = fromSpace(res.data as ClientSpaceRaw);
        this.fil = filFromSpace(res.data as ClientSpaceRaw);
      }
    } catch (e) {
      recordError('error', `client ${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private pseudoEvent(id: EventId): Event {
    return (
      this.state.events.find((e) => e.id === id) ??
      ({
        id,
        projectId: toProjectId(this.projectId),
        type: 'demande',
        actor: { userId: CLIENT_USER, role: 'client' },
        visibility: 'client',
        state: 'traitee',
        captureId: null,
        createdAt: new Date().toISOString(),
        publishedBy: null,
        publishedAt: null,
        content: { question: '', destinataire: 'phenix' },
      } as Event)
    );
  }

  /** Recharge l'espace (liveness / après action externe). Best-effort. */
  async refresh(): Promise<boolean> {
    const before = JSON.stringify(this.state.events) + JSON.stringify(this.fil);
    await this.callRpc('client_space', { p_project: this.projectId, p_code: this.code });
    return JSON.stringify(this.state.events) + JSON.stringify(this.fil) !== before;
  }
}

/** Mappe l'espace brut (RPC) en état backend (projet + membre client + journal). */
function fromSpace(space: ClientSpaceRaw): BackendState {
  const p = space.project;
  const project: Project = {
    id: toProjectId(p.id),
    code: p.code ?? '',
    name: p.name,
    clientId: CLIENT_USER,
    ...(p.address ? { address: p.address } : {}),
    status: p.status,
    currentStep: (p.current_step as ProjectStep | null) ?? null,
    createdAt: p.created_at,
  };
  const member: ProjectMember = {
    id: toMemberId(`client-${p.id}`),
    projectId: toProjectId(p.id),
    userId: CLIENT_USER,
    role: 'client',
    createdAt: p.created_at,
  };
  const events = (space.events ?? []).map(mapEventRow);
  return { projects: [project], members: [member], events };
}

/** Extrait le Fil partagé (déjà filtré côté serveur : moments publiés + client). */
function filFromSpace(space: ClientSpaceRaw): ClientFil {
  const f = space.fil ?? {};
  return {
    moments: f.moments ?? [],
    coups: f.coups ?? [],
    messages: f.messages ?? [],
    zones: f.zones ?? [],
  };
}

/** Événement d'aperçu local (non durable). */
function localEvent(input: NewEvent): Event {
  const published = input.state === 'publie';
  const nowIso = new Date().toISOString();
  return {
    id: toEventId(crypto.randomUUID()),
    projectId: input.projectId,
    type: input.type,
    actor: input.actor,
    visibility: input.visibility,
    state: input.state,
    captureId: input.captureId ?? null,
    createdAt: nowIso,
    publishedBy: published ? input.actor.userId : null,
    publishedAt: published ? nowIso : null,
    content: input.content,
  } as Event;
}
