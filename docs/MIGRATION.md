# PHÉNIX 360 — Migration démo → SaaS (localStorage → Supabase)

> Plan de migration **incrémental** (jamais de « big bang »). Chaque étape laisse
> l'application **fonctionnelle** et l'interface **inchangée** : seule
> l'architecture de données évolue. La démo (localStorage) reste le mode par
> défaut tant que Supabase n'est pas configuré et validé.

---

## 0. Pourquoi c'est faisable proprement

L'application parle déjà à un **port** (`Backend` = `ProjectRepository` +
`EventRepository`, 12 méthodes async) — pas directement au stockage. Deux
implémentations des mêmes ports coexistent :

| Implémentation                         | Fichier                              | État                                |
| -------------------------------------- | ------------------------------------ | ----------------------------------- |
| `InMemoryBackend` (démo, localStorage) | `packages/core/src/data/memory.ts`   | en production (démo)                |
| **`SupabaseBackend`** (SaaS)           | `packages/core/src/data/supabase.ts` | **écrit + testé (mock), à activer** |

Basculer = fournir `SupabaseBackend` à la place — sans toucher au produit, à
l'UI, ni aux parcours. Les mappers ligne↔domaine (`mappers.ts`) sont la frontière
unique snake_case ↔ camelCase.

---

## 1. Fait dans cet incrément (M1 — socle vérifié)

- **`SupabaseBackend`** implémente les 12 méthodes du port `Backend` via
  `@supabase/supabase-js` (import **type-only** : aucune dépendance runtime
  ajoutée au bundle démo). Même sémantique que la démo : génération du code
  chantier `AA-VV-NNN` à la création, `published_by/at` posés à la publication,
  `current_step` laissé au trigger SQL.
- **Mappers membres** (`mapMemberRow`, `toMemberInsert`) + type `MemberRow`.
- **Test** `apps/demo/e2e/supabase-backend.test.mjs` : 12 assertions sur un
  **client Supabase simulé** (requêtes émises + remap), dans le gate.
- ⚠️ **Non encore vérifié contre une vraie base** (Supabase injoignable en
  sandbox/CI) : colonnes réelles, RLS, auth. C'est l'objet de M2+.

L'app **n'est pas encore branchée** à Supabase : ce serait prématuré tant que
(a) le projet Supabase n'existe pas et (b) seuls projets/membres/événements sont
couverts (voir §3). La démo reste intacte et fonctionnelle.

---

## 2. L'unique action humaine indispensable

Créer le **projet Supabase** (région UE) et fournir `URL` + `anon key`. Personne
d'autre ne peut le faire (compte + facturation). Tout le reste est automatisable.
Voir le rapport de mission pour la marche à suivre exacte.

Une fois le projet créé, l'agent peut : appliquer les migrations, configurer les
variables d'environnement du build, activer et vérifier chaque tranche.

---

## 3. Écart de schéma à combler (avant activation)

Le schéma SQL actuel (`supabase/migrations/2026-06-28…`) date du Sprint 0 et est
**en retard** sur le produit. À aligner sur `packages/core` **avant** de brancher
l'app (une nouvelle migration, validée par le job CI `database`) :

- `project` : ajouter `code text` (unique) et `address text`.
- `project_status` : aligner sur core (`pas_commence, en_cours, pre_reception,
levee_reserves, cloture`) — l'enum actuel (`en_preparation, en_cours,
receptionne`) est obsolète.
- `member_role` : ajouter `sous_traitant` (l'artisan).
- `event_type` : ajouter `decision, reserve, levee, action, communication`
  (aujourd'hui seuls `compte_rendu, photo, document, demande`).
- `event_content_shape` (CHECK) : étendre aux nouveaux types.
- Vérifier que RLS (`event_select_client`) reste le miroir de
  `isVisibleToClient()` pour les nouveaux types visibles au client.

> Ces changements ne sont **pas** committés dans M1 : ils touchent des enums et
> une base réelle, et doivent être validés contre un vrai Postgres (CI + projet
> Supabase) pour éviter de casser le job `database` actuellement vert.

---

## 4. Séquence incrémentale (chaque étape = app fonctionnelle)

| #      | Tranche                           | Contenu                                                                                                                                                                                                                   | Vérifiable                    |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **M2** | **Comptes / Auth**                | Migration schéma (§3) appliquée ; auth Supabase (email magic-link) ; le point de vue (conducteur/client/artisan) **dérivé de l'appartenance réelle** (`project_member`), plus d'un onglet. Fallback démo si non connecté. | e2e auth réelle (projet créé) |
| **M3** | **Journal (colonne vertébrale)**  | Brancher `SupabaseBackend` pour projets/membres/événements derrière un drapeau `VITE_SUPABASE_URL`. Démo = défaut si absent. Vérifier création chantier + comptes rendus multi-utilisateurs.                              | e2e live                      |
| **M4** | **Satellites**                    | Migrer les ~17 clés localStorage hors-journal (Le Fil, dossiers/devis, contacts, réglages « Mon espace » client, accusés de lecture) vers des tables + rendre ces méthodes async.                                         | e2e par domaine               |
| **M5** | **Médias**                        | Photos/documents : des **data URLs base64 en localStorage** vers **Supabase Storage** (bucket `attachments/{project_id}/…`, déjà prévu). Les champs `bucket`/`storagePath` existent déjà.                                 | upload/download live          |
| **M6** | **Temps réel**                    | Remplacer/compléter le `BroadcastChannel` (multi-onglets) par **Supabase Realtime** : le client voit les mises à jour en direct.                                                                                          | e2e 2 sessions                |
| **M7** | **Écritures client (passerelle)** | La RLS interdit au client d'écrire le journal en direct : router ses actions (décisions, demandes) via `apps/gateway` (rôle de service, revalidation). Déployer la passerelle.                                            | tests gateway                 |
| **M8** | **Cutover + données**             | Migration optionnelle des données de démo ; désactivation du `PasswordGate` (remplacé par l'auth) ; bascule Supabase par défaut.                                                                                          | recette complète              |

Contrainte invariante à chaque étape : **`DemoSnapshot` et les signatures des
méthodes `demo.*` restent stables** → l'UI et les parcours ne changent pas
(`useSyncExternalStore` conservé ; sources de `build()`/`refresh()` échangées).

---

## 5. Ce qui ne change pas

- Le produit, l'UI, les parcours, les composants (ils ne consomment que
  `DemoSnapshot` + `demo.*`).
- Le mode démo : tant que `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` sont
  absents, l'app reste 100 % locale (utile pour les démos et les tests e2e).
- La règle de visibilité client : définie en TS (`isVisibleToClient`) **et**
  appliquée à la source par la RLS (miroir) — jamais le seul front.
