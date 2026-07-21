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

## 1bis. Fait dans l'incrément M2–M3 (branchement colonne vertébrale)

- **Auth réelle** (`AuthGate`) + schéma appliqué sur le projet Supabase (UE) ;
  écriture prouvée en base (round-trip create/read/delete).
- **`SaaSBackend`** (`apps/demo/src/lib/saasBackend.ts`) : enveloppe write-through
  autour de `SupabaseBackend`. Lectures servies par un **cache mémoire hydraté**
  au login (synchrone pour l'UI, via `snapshot()` que `build()` consomme) ;
  écritures **durables** à Supabase puis répercutées au cache.
- **Store** : backend ACTIF échangeable (`connectSupabase`/`disconnectSupabase`) ;
  en SaaS, le **conducteur = l'utilisateur connecté** (auteur exigé par la RLS),
  rattaché à ses chantiers via la RPC sécurisée `app_add_self_as`.
- **Frontière assumée** : les identités fabriquées (client démo) et leurs
  écritures restent en **cache local** (aperçu) tant que le client n'a pas sa
  propre connexion (invitations / passerelle — M7). Résilience : une écriture
  durable qui échoue n'interrompt jamais la session (poursuite en cache + diag).
- **Tests** : `apps/demo/e2e/saas-backend.test.mjs` (9 assertions — hydrate,
  aiguillage durable/local, cache) ; démo 100 % inchangée (gate complet vert).

## 1ter. Fait dans l'incrément M4 (satellites → cloud, par utilisateur)

Les « satellites » du conducteur suivent désormais son compte d'un appareil à
l'autre, comme la colonne vertébrale :

- **Table `app_kv`** (RLS `user_id = auth.uid()`) : coffre clé→valeur PRIVÉ,
  contenu opaque (chaîne JSON) — miroir durable du stockage local, pas un modèle.
- **`CloudKv`** (`apps/demo/src/lib/cloudKv.ts`) : `loadAll()` (hydratation) +
  écritures best-effort **coalescées et sérialisées par clé** (dernière valeur
  gagnante, pas de course). Un échec réseau ne bloque jamais la session.
- **Store** : `safeSetItem`/`lsRemove` répercutent au cloud les clés satellites
  (`SYNCED_SATELLITE_KEYS`) ; `connectSupabase` purge le local puis **hydrate**
  depuis le coffre de l'utilisateur (sans réémettre ce qu'il vient de lire).
  Marqueurs purement locaux (cookies, baseline notifs, « initialisé ») exclus.
- **Frontière** : coffre PAR UTILISATEUR (le conducteur) — le partage de ces
  éléments avec le client suit avec les invitations / la passerelle (**M7**).
- **Tests** : `apps/demo/e2e/cloud-kv.test.mjs` (5 assertions — hydrate,
  tolérance, upsert/delete, coalescing). Démo inchangée (gate complet vert).

## 1quater. Fait dans l'incrément M7.1 (espace client — lien + code, lecture seule)

Premier temps de l'accès client : le client CONSULTE son chantier via un lien
`…/#/c/<projectId>` + un code, **sans compte**.

- **SQL** (`20260721100000_client_space.sql`, aussi dans install.sql) :
  `project_client_access` (code **haché** bcrypt, RLS sans policy) ;
  `set_client_access(project, code)` (conducteur interne) ;
  `client_space(project, code)` SECURITY DEFINER exécutable par `anon` — vérifie
  le code CÔTÉ SERVEUR et ne renvoie que les événements **visibles au client**
  (miroir exact de `isVisibleToClient` / `event_select_client`).
- **App** : route `#/c/<id>` dans `main.tsx` → page AUTONOME `ClientSpacePage`
  (aucun accès au store conducteur) : saisie du code, appel RPC, récit en lecture
  seule (avancement, photos, documents, décisions/demandes). Le conducteur
  obtient le **lien + code** dans « Mon espace » (`LienDeSuivi`, mode SaaS).
- **Store** : publie le code (`set_client_access`) à la création du chantier, au
  changement de code, et à l'affichage de « Mon espace » (best-effort).
- **Vérifié** sur PostgreSQL 16 (suite SQL : mauvais code refusé, bon code =
  3 événements visibles). Démo 100 % inchangée (gate complet vert).
- **Frontière** : LECTURE seule. Répondre / valider un choix (écriture client via
  RPC code-gardées) = tranche **M7.2**.

## 1quinquies. Fait dans l'incrément M7.2.1 (le client RÉPOND à une demande)

Premier geste d'écriture côté client, toujours sans compte :

- **SQL** (`20260721110000_client_respond.sql`, aussi dans install.sql) :
  `client_respond_demande(project, code, event, texte)` SECURITY DEFINER,
  exécutable par `anon` — vérifie le code, n'écrit QUE sur une demande du bon
  projet, `visibility='client'`, `destinataire='client'`, encore `ouverte`
  (pas de réécriture), pose `resolution` + `state='traitee'`, `author_id` NULL.
  Renvoie l'espace client à jour.
- **App** : la carte « Demande » de `ClientSpacePage` propose un formulaire de
  réponse (`DemandeResponder`) quand la demande est ouverte ; à l'envoi, l'espace
  se rafraîchit (la fonction renvoie l'état à jour). Le conducteur voit la réponse
  à sa prochaine ouverture (temps réel = M6).
- **Vérifié** sur PostgreSQL 16 (suite SQL : mauvais code refusé, réponse
  enregistrée + demande traitée, re-réponse refusée). Gate complet vert.
- **Suite** : valider un choix (décision) et écrire un message = M7.2.2/M7.2.3.

## 1sexies. Fait dans l'incrément M7.2.2 (le client VALIDE un choix)

Deuxième geste d'écriture côté client : valider un choix (carrelage, peinture…)
ou le confier à PHÉNIX — sans compte.

- **Frontière franchie proprement** : la page cliente autonome ne lit que le
  JOURNAL ; or la présentation d'un choix (options A–E, photos, contexte) vivait
  jusqu'ici dans le **dossier** (satellite conducteur), invisible au client.
  Décision : **porter la présentation au journal**, sur l'événement d'envoi
  `decision/envoyee` (part client-safe d'une `ClientSelection`).
- **Core** : `DecisionEventContent.choix` (nouveau champ OPTIONNEL : `titre`,
  `contexte`, `options`, `photos`) ; `buildDecisionContent` le porte sur
  `envoyee`/`renvoyee`. Purement additif — aucun consommateur existant cassé, les
  deux chemins d'envoi (`createClientDecision`, PHÉNIX Start) le portent d'office.
- **SQL** (`20260721120000_client_validate_choix.sql`, aussi dans install.sql) :
  `client_space` **redéfini** pour renvoyer aussi les événements `decision`
  client-safe (envoi + résolutions) ; `client_validate_choix(project, code,
event, option, message)` SECURITY DEFINER exécutable par `anon` — vérifie le
  code, refuse un choix déjà résolu (pas de réécriture), résout le libellé de
  l'option depuis la présentation portée, pose une TRACE `decision/validee` (ou
  `deleguee` si `option = '__phenix_delegate__'`), `author_id` NULL, visible
  client. Le conducteur la relit déjà du journal (`choixClientValides` /
  `choixClientValidesATraiter`) — aucune mécanique conducteur modifiée.
- **App** : `ClientSpacePage` regroupe les événements `decision` par sélection
  (`deriveChoix`) et rend « Vos choix » — options A–E (repère + image),
  contexte, photos, commentaire libre, « Valider mon choix » / « Je vous laisse
  choisir » ; choix résolu en lecture seule. Rafraîchi par la fonction serveur.
- **Vérifié** sur PostgreSQL 16 (suite SQL : mauvais code refusé, validation
  enregistrée avec libellé résolu, double validation refusée). Démo 100 %
  inchangée (gate complet vert).
- **Suite** : écrire un message libre (M7.2.3), puis médias vers Storage (M5),
  temps réel (M6).

## 1septies. Fait dans l'incrément M6 (temps réel — le conducteur voit sans recharger)

Jusqu'ici le cache conducteur ne se rafraîchissait qu'à l'hydratation (login /
rechargement complet). Quand le client répondait/validait depuis son espace, le
conducteur ne le voyait qu'après un ⌘R. M6 supprime ce rechargement.

- **App** : à la connexion (`connectSupabase`), le store ouvre un canal **Supabase
  Realtime** sur la table `event` (`subscribeRealtime`) ; chaque INSERT/UPDATE
  reçu est remappé (`mapEventRow`) puis fondu au cache
  (`SaaSBackend.ingestEvent` — upsert par id, ignore projet inconnu, no-op si
  identique) ; si le cache change, l'UI se rafraîchit. Coupé proprement à la
  déconnexion. Aucune incidence en démo (pas de temps réel local).
- **Sécurité** : Realtime applique la **RLS de l'abonné** — un conducteur ne
  reçoit que les événements de SES chantiers (miroir exact de la vue existante).
  Le temps réel n'ouvre AUCUNE donnée nouvelle, il accélère sa livraison.
- **SQL** (`20260721130000_realtime.sql`, aussi dans install.sql) : `event`
  inscrite à la publication `supabase_realtime` (gardé + idempotent) +
  `replica identity full` (les UPDATE portent toutes leurs colonnes dans le flux).
- **Tests** : `saas-backend.test.mjs` (13/13 — dont ingestEvent : ajout, mise à
  jour demande→traitée, no-op identique, projet inconnu ignoré). Suite SQL verte
  (le bloc publication est ignoré sur Postgres nu). Démo inchangée (gate complet).
- **Frontière** : `event` seule (le journal). L'étape courante d'un chantier est
  redérivée du flux d'événements côté cache. Les satellites (`app_kv`) et les
  médias suivront si besoin.
- **Durcissement** : le canal Realtime pose explicitement le **jeton d'auth** de
  l'utilisateur (`realtime.setAuth`) avant l'abonnement — garantit que la RLS
  `postgres_changes` s'évalue avec ses droits (et non `anon`).

## 1octies. Fait dans l'incrément M7.2.3 (le client ÉCRIT UN MESSAGE)

Troisième et dernier geste d'écriture côté client : envoyer un message libre
(question, remarque) au conducteur, sans compte.

- **SQL** (`20260721140000_client_message.sql`, aussi dans install.sql) :
  `client_message(project, code, texte)` SECURITY DEFINER exécutable par `anon` —
  vérifie le code, refuse un message vide, crée une `demande` adressée au
  conducteur (`destinataire='phenix'`, `author_id` NULL, `author_role='client'`,
  `ouverte`). `client_space` **redéfini** pour renvoyer aussi les messages du
  client (leurs demandes `destinataire='phenix'`, dès `ouverte`) — il voit son
  message ET la réponse.
- **Intégration** : le message est une demande client ordinaire ⇒ le conducteur
  la voit dans son onglet **« Demandes client »** + notification « Nouvelle
  demande client à traiter », y répond avec ses outils habituels
  (`resolveDemande`, RLS `event_update_internal`), et le temps réel (M6) la lui
  livre en direct. Aucune nouvelle machinerie conducteur.
- **App** : `ClientSpacePage` — composer « Écrire à votre conducteur »
  (`client_message`) + rendu des messages du client (« Votre message » + réponse
  du conducteur quand elle arrive).
- **Vérifié** sur PostgreSQL 16 (suite SQL : mauvais code refusé, message vide
  refusé, message créé et visible dans l'espace). Démo inchangée (gate complet).
- **Écritures client COMPLÈTES** : répondre (M7.2.1), valider un choix (M7.2.2),
  écrire un message (M7.2.3) — toutes par RPC code-gardées, jamais d'écriture
  directe (RLS). Suite : médias vers Storage (M5).

## 1nonies. Fait dans l'incrément M5 (médias → Supabase Storage)

Les photos/documents quittent le base64 du journal pour **Supabase Storage** —
journal plus léger, pas de limite de payload, chargements plus rapides.

- **Approche à UN seul point** (faible risque) : plutôt que de câbler l'upload
  dans chaque capture, on intercepte à l'écriture durable
  (`SaaSBackend.appendEvent` / `resolveDemande`) avec un **parcours générique**
  (`uploadMediaDeep`, `lib/mediaStore.ts`) qui remplace **tout data URL base64**
  du contenu par une **URL Storage publique**. Couvre TOUS les médias
  d'événements (photos de CR, documents, photos de réponse) — et donc tout ce que
  voit le client — sans connaître les formes de contenu.
- **Rétro-compatible + repli sûr** : en démo (pas de client) ou si un upload
  échoue, on garde le base64 — l'app se comporte comme avant, jamais d'écran
  cassé. Les composants d'affichage ne changent pas (`<img src>` reçoit une URL
  `https://` au lieu de `data:`). `openAttachment` ouvre une URL Storage
  directement ; `extractPhotos` accepte data URL **et** https.
- **SQL** (`20260721150000_storage_public.sql` + install.sql) : bucket
  `attachments` **PUBLIC** (lecture par URL). Sert l'app interne ET la page
  cliente anonyme sans fonction serveur. Chemins en UUID aléatoire
  (URL-capacité) ; écriture réservée aux membres internes.
- **Tests** : `saas-backend.test.mjs` 16/16 (image base64 → URL publique, médias
  imbriqués des points, aucun upload sans média). Démo inchangée (gate complet).
- **Vérification LIVE requise** (upload réel depuis le navigateur) — l'e2e ne
  couvre que la démo/base64. Réglage : re-jouer install.sql + rendre le bucket
  public.
- **Frontière** : couvre les médias du JOURNAL (événements). Le **Fil / coulisses**
  (satellite `app_kv`) reste en base64 = **M5 v2**.

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

| #         | Tranche                           | Contenu                                                                                                                                                                                                                   | Vérifiable                    |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **M2**    | **Comptes / Auth**                | Migration schéma (§3) appliquée ; auth Supabase (email magic-link) ; le point de vue (conducteur/client/artisan) **dérivé de l'appartenance réelle** (`project_member`), plus d'un onglet. Fallback démo si non connecté. | e2e auth réelle (projet créé) |
| **M3**    | **Journal (colonne vertébrale)**  | Brancher `SupabaseBackend` pour projets/membres/événements derrière un drapeau `VITE_SUPABASE_URL`. Démo = défaut si absent. Vérifier création chantier + comptes rendus multi-utilisateurs.                              | e2e live                      |
| **M4**    | **Satellites**                    | Migrer les ~17 clés localStorage hors-journal (Le Fil, dossiers/devis, contacts, réglages « Mon espace » client, accusés de lecture) vers des tables + rendre ces méthodes async.                                         | e2e par domaine               |
| **M5**    | **Médias**                        | Photos/documents : des **data URLs base64 en localStorage** vers **Supabase Storage** (bucket `attachments/{project_id}/…`, déjà prévu). Les champs `bucket`/`storagePath` existent déjà.                                 | upload/download live          |
| **M6** ✅ | **Temps réel**                    | Canal **Supabase Realtime** sur `event` : le conducteur voit les écritures du client (réponse, choix) SANS recharger. RLS appliquée à l'abonné. Voir §1septies.                                                           | fait (ingestEvent 13/13)      |
| **M7**    | **Écritures client (passerelle)** | La RLS interdit au client d'écrire le journal en direct : router ses actions (décisions, demandes) via `apps/gateway` (rôle de service, revalidation). Déployer la passerelle.                                            | tests gateway                 |
| **M8**    | **Cutover + données**             | Migration optionnelle des données de démo ; désactivation du `PasswordGate` (remplacé par l'auth) ; bascule Supabase par défaut.                                                                                          | recette complète              |

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
