/**
 * PHÉNIX 360 — Adaptateur Supabase du port `JournalRepository`
 * ---------------------------------------------------------------------------
 * SEUL endroit qui connaît Supabase (ADR-004 §2.5 r3). L'import est **type
 * only** : aucune dépendance runtime n'est tirée — l'app fournit le client
 * (créé avec ses propres clés/URL via variables d'environnement, r6).
 * La RLS reste la garantie de visibilité à la source.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProjectId } from '../ids.js';
import type { JournalRepository } from './repository.js';
import type { EventRow, ProjectRow } from './rows.js';
import { mapEventRow, mapProjectRow, toEventInsert } from './mappers.js';

const PROJECT = 'project';
const EVENT = 'event';

function fail(context: string, error: { message: string }): never {
  throw new Error(`[@phenix360/core] ${context}: ${error.message}`);
}

export function createSupabaseJournal(client: SupabaseClient): JournalRepository {
  return {
    async getProject(id) {
      const { data, error } = await client.from(PROJECT).select('*').eq('id', id).maybeSingle();
      if (error) fail('getProject', error);
      return data ? mapProjectRow(data as ProjectRow) : null;
    },

    async listProjects() {
      const { data, error } = await client
        .from(PROJECT)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) fail('listProjects', error);
      return ((data ?? []) as ProjectRow[]).map(mapProjectRow);
    },

    async listEvents(id: ProjectId) {
      const { data, error } = await client
        .from(EVENT)
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });
      if (error) fail('listEvents', error);
      return ((data ?? []) as EventRow[]).map(mapEventRow);
    },

    async appendEvent(input) {
      const { data, error } = await client
        .from(EVENT)
        .insert(toEventInsert(input))
        .select('*')
        .single();
      if (error) fail('appendEvent', error);
      return mapEventRow(data as EventRow);
    },
  };
}
