-- PHÉNIX 360 — Stubs pour tester le schéma sur PostgreSQL nu (sans Supabase)
-- ============================================================================
-- Reproduisent le strict nécessaire fourni par Supabase : rôles, schémas
-- auth/storage, auth.uid() (pilotée par la GUC `app.user_id`) et un stub de
-- storage.foldername. Garde la CI légère ; la CLI Supabase viendra quand on
-- aura besoin de comportements Supabase spécifiques.
-- Idempotent (rôles au niveau cluster) → réexécutable sur un cluster réutilisé.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end
$$;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  instance_id            uuid,
  id                     uuid primary key,
  aud                    varchar(255),
  role                   varchar(255),
  email                  varchar(255),
  encrypted_password     varchar(255),
  email_confirmed_at     timestamptz,
  raw_app_meta_data      jsonb,
  raw_user_meta_data     jsonb,
  created_at             timestamptz,
  updated_at             timestamptz,
  confirmation_token     varchar(255),
  email_change           varchar(255),
  email_change_token_new varchar(255),
  recovery_token         varchar(255)
);

-- auth.uid() lit la GUC de session `app.user_id` (positionnée par le test RLS).
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create table if not exists storage.buckets (id text primary key, name text, public boolean);
create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text,
  name      text
);

create or replace function storage.foldername(n text) returns text[] language sql immutable as $$
  select (string_to_array(n, '/'))[1:greatest(array_length(string_to_array(n, '/'), 1) - 1, 0)]
$$;
