-- PHÉNIX 360 — Médias vers Storage (M5) : bucket `attachments` PUBLIC
-- ============================================================================
-- Les photos/documents quittent le base64 du journal pour Supabase Storage. Le
-- bucket devient PUBLIC (lecture par URL) : il sert à la fois l'app interne
-- (authentifiée) et la page cliente ANONYME (lien+code) sans fonction serveur.
--
-- Sécurité : les chemins sont des UUID aléatoires (URL-capacité) — seules les
-- personnes à qui l'URL est transmise (via une réponse déjà gardée par la RLS /
-- le code d'accès) peuvent l'ouvrir. L'ÉCRITURE reste réservée aux membres
-- INTERNES du chantier. Réversible (bucket privé + URLs signées) si durcissement.

-- Le bucket existe déjà (migration storage initiale) : on le passe en public.
update storage.buckets set public = true where id = 'attachments';
-- Filet (si absent) : on le crée public.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update set public = true;

-- La lecture publique est portée par le bucket : on retire la policy select
-- (membres) devenue inutile. L'écriture interne reste (inchangée).
drop policy if exists "attachments read members" on storage.objects;
