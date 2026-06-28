-- PHÉNIX 360 — Seed minimal (données de démo, ADR-004 §3)
-- ============================================================================
-- Un chantier, deux utilisateurs (un compagnon Phénix, un client), et un
-- journal qui exerce les vues : CR publié (avancement), photo, décision en
-- attente du client, et un brouillon interne (invisible au client).
--
-- Idempotent : `on conflict do nothing`. Mots de passe de démo uniquement.

-- ----------------------------------------------------------------------------
-- Utilisateurs (auth) — pattern de seed local Supabase
-- ----------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'compagnon@phenix360.fr',
   crypt('phenix-demo', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Lucas (Phénix)"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'client@phenix360.fr',
   crypt('phenix-demo', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Mme Martin"}',
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Projet + membres
-- ----------------------------------------------------------------------------
insert into project (id, name, client_id, created_at)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rénovation Martin — Lyon 6e',
        '22222222-2222-2222-2222-222222222222', now() - interval '20 days')
on conflict (id) do nothing;

insert into project_member (project_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'compagnon'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'client')
on conflict (project_id, user_id) do nothing;

-- ----------------------------------------------------------------------------
-- Journal d'événements (contenu typé, clés camelCase = core)
-- ----------------------------------------------------------------------------
insert into event
  (id, project_id, type, author_id, author_role, visibility, state, capture_id,
   created_at, published_by, published_at, content)
values
  -- Saisie héros : 1 compte_rendu + 1 photo (même capture_id)
  ('e1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'compte_rendu', '11111111-1111-1111-1111-111111111111', 'compagnon', 'client', 'publie',
   'caca0001-0000-0000-0000-000000000001', now() - interval '6 days',
   '11111111-1111-1111-1111-111111111111', now() - interval '6 days',
   '{"texte":"Dalle coulée, séchage en cours. Démarrage cloisons la semaine prochaine.","etapeProposee":"gros_oeuvre","etapeConfirmee":"gros_oeuvre"}'),

  ('e2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'photo', '11111111-1111-1111-1111-111111111111', 'compagnon', 'client', 'publie',
   'caca0001-0000-0000-0000-000000000001', now() - interval '6 days',
   '11111111-1111-1111-1111-111111111111', now() - interval '6 days',
   '{"attachment":{"id":"att00001-0000-0000-0000-000000000001","kind":"photo","bucket":"attachments","storagePath":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/dalle.jpg","mimeType":"image/jpeg","createdAt":"2026-06-22T09:00:00Z"},"legende":"Dalle terminée","categorie":"gros_oeuvre","piece":"Séjour"}'),

  -- Décision en attente DU CLIENT (pilote le bandeau)
  ('e3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'demande', '11111111-1111-1111-1111-111111111111', 'compagnon', 'client', 'ouverte',
   null, now() - interval '2 days', null, null,
   '{"question":"Quel carrelage pour la salle de bain ? (2 options proposées)","destinataire":"client"}'),

  -- Brouillon interne : invisible au client
  ('e4444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'compte_rendu', '11111111-1111-1111-1111-111111111111', 'compagnon', 'interne', 'brouillon',
   null, now() - interval '1 day', null, null,
   '{"texte":"Note interne : prévoir reprise enduit angle nord."}')
on conflict (id) do nothing;
