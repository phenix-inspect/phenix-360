-- PHÉNIX 360 — Coffre par utilisateur pour les « satellites » (M4)
-- ============================================================================
-- La colonne vertébrale (projets/membres/événements) vit déjà dans ses tables.
-- Restent les « satellites » du conducteur — préparation (dossier), carnet de
-- contacts, Le Fil, réglages « Mon espace », accusés de lecture — aujourd'hui en
-- localStorage. On les fait suivre le conducteur d'un appareil à l'autre via un
-- coffre clé→valeur STRICTEMENT PRIVÉ : chaque utilisateur ne voit QUE ses lignes
-- (RLS `user_id = auth.uid()`). Le contenu reste opaque côté base (une chaîne
-- JSON) — c'est un miroir durable du stockage local, pas un modèle métier.
--
-- Note : ce coffre est PAR UTILISATEUR (le conducteur). Le partage de ces
-- éléments avec le client viendra avec les invitations / la passerelle (M7).

create table if not exists app_kv (
  user_id    uuid not null references auth.users on delete cascade,
  k          text not null,
  v          text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);

alter table app_kv enable row level security;

-- L'utilisateur ne lit et n'écrit QUE ses propres clés.
drop policy if exists app_kv_select_own on app_kv;
create policy app_kv_select_own on app_kv
  for select to authenticated using (user_id = auth.uid());

drop policy if exists app_kv_insert_own on app_kv;
create policy app_kv_insert_own on app_kv
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists app_kv_update_own on app_kv;
create policy app_kv_update_own on app_kv
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists app_kv_delete_own on app_kv;
create policy app_kv_delete_own on app_kv
  for delete to authenticated using (user_id = auth.uid());
