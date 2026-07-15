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
