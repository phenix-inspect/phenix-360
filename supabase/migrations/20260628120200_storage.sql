-- PHÉNIX 360 — Stockage des pièces jointes (photos / documents)
-- ============================================================================
-- Bucket privé `attachments`. Convention de clé S3-compatible (portabilité
-- ADR-004 §2.5 r4) : le PREMIER segment du chemin est l'ID du projet —
--   attachments/{project_id}/{...}
-- ce qui permet une RLS par projet réutilisable sur MinIO / Scaleway.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Lecture : tout membre du projet (le client lit ses propres fichiers).
create policy "attachments read members" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and app_is_member(((storage.foldername(name))[1])::uuid)
  );

-- Écriture : membres internes (compagnon/équipe). Le client n'upload pas en V1.
create policy "attachments write internal" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and app_is_internal(((storage.foldername(name))[1])::uuid)
  );
