# ADR-004 — Architecture technique, dépôt et principes de développement

- **Statut :** Accepté (référence officielle du projet)
- **Date :** 2026-06-27
- **Auteurs :** Fondateur + CTO PHÉNIX 360
- **Dépend de :** ADR-001 (journal d'événements), ADR-002 (modèle d'événement),
  ADR-003 (stack, hébergement, IA)
- **Portée :** Cet ADR fige l'architecture d'implémentation de la V1. Tous les
  développements futurs doivent le respecter. Il fait repasser ADR-003 de
  « BROUILLON » à « Accepté » sur les points qu'il tranche (front, hébergement,
  passerelle).

---

## 0. Principe directeur — l'expérience prime sur la technique

**Règle non négociable, supérieure à toutes les autres décisions de cet ADR :**

> Si une décision technique entre en conflit avec l'expérience utilisateur,
> **c'est toujours l'expérience utilisateur qui gagne.**

PHÉNIX 360 n'est pas un logiciel de chantier. C'est une **expérience premium**.
La mission est double et indissociable :
1. faire gagner **énormément de temps** aux équipes PHÉNIX (interface dense,
   rapide, efficace) ;
2. offrir au client l'expérience la **plus fluide, la plus rassurante et la plus
   agréable** possible (univers lent, contemplatif, émotionnel).

Toute fonctionnalité, tout arbitrage technique, toute optimisation se juge à
cette aune. Une solution techniquement élégante mais qui dégrade le calme, la
fluidité ou la confiance est **refusée**.

---

## 1. Contexte — le code existant n'est pas PHÉNIX 360

Le dépôt contenait une application full-stack (« Phénix Inspect » / « Assistant
by Léon ») générée sur une plateforme tierce : audit de devis, MongoDB,
GPT-4o via une clé propriétaire, mascotte « Léon », thème sombre glassmorphism.

Ce produit **contredit structurellement** chaque fondation des ADR : base de
données (Mongo vs Postgres+RLS), IA (OpenAI propriétaire vs Mistral souverain
derrière passerelle), modèle de données (document gras vs journal d'événements),
design (sombre/mascotte vs clair/noir&or/Newsreader), hébergement.

**Décision :** **rebuild complet**, conforme aux ADR. Phénix Inspect n'est
**pas** un socle. On peut récupérer **uniquement des composants techniques
génériques** (primitives UI, patterns React) **si** cela a du sens — **aucune
architecture métier** n'est reprise. L'existant est archivé comme legacy.

---

## 2. Décisions d'architecture (verrouillées)

### 2.1 Architecture en 3 plans

```
PWA React (mobile-first)
  • App CLIENT (univers du propriétaire — rassurer)
  • App COMPAGNON (boucle terrain — faire gagner du temps)
  • Service worker : app-shell + file d'attente offline
        │  lecture/écriture            │  IA + actions privilégiées
        │  gouvernées par RLS          │
        ▼                              ▼
  SUPABASE (cœur)                 PASSERELLE FastAPI (mince)
  • Postgres = LE journal         • Passerelle IA (modèle masqué)
  • Auth (JWT, rôles)             • Publication / notifications
  • Storage (S3-compatible)       • OCR documents
  • RLS (client / interne)        • Orchestration assistant
  • Realtime (fil compagnon)             │
                                         ▼
                                  Mistral (juridiction UE)
                                  jamais appelé par le navigateur
```

### 2.2 Front — PWA Vite + React + TypeScript
- **Vite + React 19 + TypeScript** (CRA est abandonné). TypeScript obligatoire :
  le modèle d'événement typé doit l'être de bout en bout.
- **PWA** via `vite-plugin-pwa` (Workbox) : app-shell installable + **file
  d'attente offline** pour la capture terrain (caveat ADR-003 §2).
- **Tailwind** + un fichier **unique de tokens** dérivé du Design System
  (couleurs, typo, espacements, rayons, ombres du handoff §4).
- **Primitives shadcn/ui re-skinnées** (thème clair, noir & or). **lucide-react**
  pour les icônes (ligne 1.5–1.7). Fonts : **Newsreader · Hanken Grotesk ·
  JetBrains Mono**. Pas de mascotte, pas de glassmorphism.

### 2.3 Cœur de données — Supabase Cloud EU, portable
- **Supabase** : Postgres + Auth + Storage + Realtime + RLS.
- **V1 : Supabase Cloud, région UE** (priorité à la **vélocité** de
  développement ; zéro ops).
- **La visibilité `client`/`interne` et les rôles sont appliqués par RLS** au
  niveau base (ADR-003 §3) — jamais par le seul front.
- **Le client lit le journal directement depuis Supabase** (RLS = garantie à la
  source). Toute **écriture sensible** (publication, demande, réponse équipe)
  passe par la passerelle.

### 2.4 Passerelle IA — FastAPI, modèle masqué
- **FastAPI** (Python), service mince et séparé.
- **L'IA n'est jamais appelée depuis le navigateur.** 100 % des interactions IA
  passent par la passerelle.
- **Le client ne sait jamais quel modèle est utilisé.** L'assistant est
  « PHÉNIX 360 ». La passerelle répond d'abord par **récupération structurée**
  dans le journal et les documents ; elle n'interroge **éventuellement** Mistral
  que pour la synthèse, quand c'est nécessaire. Le fournisseur est un détail
  d'implémentation interchangeable (anti-lock-in ADR-003 §5).
- **Pas de base vectorielle en V1.** Pas de transcription/rédaction/classement
  automatiques (hors V1, cf. handoff §8/§9).
- Rappel ADR-001 : **l'IA propose, l'humain valide.**

### 2.5 Hébergement & portabilité — exigence de premier rang
On démarre sur Supabase Cloud EU **pour la vélocité**, mais l'architecture doit
rester **migrable vers un hébergement souverain (Scaleway / Hetzner) sans
refonte du code**. La stack Supabase étant open-source, la cible
self-host est le **même** logiciel : la migration est mécanique **si** on
respecte les règles de portabilité ci-dessous.

**Règles de portabilité (obligatoires) :**
1. **Tout est code et versionné.** Schéma, politiques RLS, fonctions, triggers,
   buckets : dans `supabase/migrations` et `supabase/policies`. **Aucune
   configuration cliquée dans le dashboard** qui ne soit reproductible par
   migration.
2. **Aucune fonctionnalité cloud-only.** On n'utilise que ce qui existe aussi
   dans la stack Supabase open-source.
3. **Accès données derrière une fine couche d'abstraction** (`packages/core`) —
   jamais d'appel Supabase éparpillé dans les écrans.
4. **Storage via API S3-compatible** : les fichiers doivent pouvoir basculer
   vers MinIO / Scaleway Object Storage sans changer le code applicatif.
5. **Auth = JWT standard, claims standard.** Pas de dépendance à un identifiant
   propriétaire non reproductible en self-host.
6. **Secrets et endpoints par variables d'environnement** : changer d'hôte =
   changer des variables, pas du code.
7. La passerelle **FastAPI est hébergée séparément** (conteneur), déployable
   indifféremment à côté de Supabase Cloud ou d'une infra souveraine.

---

## 3. Organisation du dépôt — monorepo

```
phenix-360/
├── apps/
│   ├── client/        # PWA Espace client (S0..S11)
│   ├── compagnon/     # PWA Interface PHÉNIX (C0..C7)
│   └── gateway/       # Passerelle FastAPI (IA, publication, notif, OCR)
├── packages/
│   ├── ui/            # Design System : tokens + composants partagés
│   ├── core/          # Types partagés (modèle d'événement) + accès données
│   └── config/        # presets ESLint / TS / Tailwind / tokens
├── supabase/
│   ├── migrations/    # Schéma SQL versionné (journal au centre)
│   ├── policies/      # Politiques RLS (revues, lisibles)
│   └── seed/          # Données de démo (remplacent les placeholders)
├── docs/
│   └── adr/           # ADR-001..004 — référence officielle
└── .github/workflows/ # CI : lint, tests, migrations, déploiement
```

- **Mono-repo** géré par **pnpm + Turborepo** (cache de build, petite équipe).
- **Deux apps** (client / compagnon) aux publics opposés, partageant
  `packages/ui` et `packages/core`.
- Les dossiers reflètent des **vues du journal**, jamais des silos (ADR-001).

---

## 4. Modèle de données — le journal au centre

Traduction directe d'ADR-002 en PostgreSQL : **une table `event` au centre**,
enveloppe commune + contenu typé (`jsonb`), validé côté code par type.

```sql
create type event_type   as enum ('compte_rendu','photo','document','demande');
create type event_state  as enum ('brouillon','publie','ouverte','traitee','close');
create type visibility   as enum ('client','interne');
create type author_role  as enum ('compagnon','equipe','client'); -- 'sous_traitant' plus tard

create table chantier (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  client_id     uuid references auth.users,   -- V1 : un client = un chantier
  etape_courante text,                         -- cache dérivé du dernier CR publié
  created_at    timestamptz default now()
);

create table event (                           -- ⬅ LA colonne vertébrale
  id           uuid primary key default gen_random_uuid(),
  chantier_id  uuid not null references chantier(id),
  type         event_type  not null,
  author_id    uuid references auth.users,     -- l'IA n'est JAMAIS auteur
  author_role  author_role not null,
  created_at   timestamptz not null default now(),
  visibility   visibility  not null default 'interne',
  state        event_state not null,
  saisie_id    uuid,                            -- regroupe 1 CR + N photos (ADR-002 §7)
  published_by uuid references auth.users,      -- validation = ÉTAT, pas type
  published_at timestamptz,
  content      jsonb not null                   -- contenu typé (validé app-side)
);

create index on event (chantier_id, created_at desc);
create index on event (chantier_id, type);
create index on event (saisie_id);

-- Interactions client (NE sont pas des événements du journal métier) :
create table moment_like (event_id uuid references event(id), user_id uuid, created_at timestamptz default now());
create table comment      (id uuid primary key default gen_random_uuid(), event_id uuid references event(id),
                           author_id uuid, author_role author_role, texte text, created_at timestamptz default now());
```

**Contenu typé (`content` JSONB) :**
- `compte_rendu` → `{ texte, etape_proposee, etape_confirmee }`
  étape ∈ `gros_oeuvre | second_oeuvre | finitions | reception` — **jamais un %**.
- `photo` → `{ storage_path, legende, categorie, piece }` (classement **manuel** V1).
- `document` → `{ storage_path, libelle, categorie }`.
- `demande` → `{ question, resolution }` (réponse portée par la demande, **pas un fil**).

**Les vues = des requêtes/`VIEW` filtrées, jamais des stockages séparés :**
galerie = `type='photo'` ; coffre = `type='document'` ; file de demandes =
`type='demande' and state='ouverte'` ; **avancement courant** = étape du dernier
`compte_rendu` publié.

**RLS (cœur sécurité) — exemple lecture client :**
```sql
alter table event enable row level security;
create policy client_read on event for select using (
  visibility = 'client'
  and state in ('publie','traitee','close')
  and chantier_id in (select id from chantier where client_id = auth.uid())
);
-- politiques séparées pour compagnon/équipe (accès complet à leurs chantiers)
```
La passerelle, si elle emploie le rôle de service (qui **bypass** la RLS),
**revalide** systématiquement les permissions : elle applique la visibilité, ne
la contourne pas.

---

## 5. Plan de développement — sprints (2 semaines)

Objectif : **une boucle, parfaitement** (ADR-001 §4).

- **Sprint 0 — Fondations (de-risking).** Mono-repo (pnpm/turbo), Supabase Cloud
  EU, schéma `event` + RLS + seed, couche d'accès portable (`packages/core`),
  tokens Design System + fonts + primitives shadcn re-skinnées, CI. **PoC
  service worker / file offline** + **PoC passerelle IA Mistral**. Sort les 2
  plus gros risques tôt.
- **Sprint 1 — Auth & squelettes.** Supabase Auth, rôles, splash de marque,
  navigation (tab bar client + barre compagnon), shell PWA installable.
- **Sprint 2 — Boucle compagnon (héros équipe).** C1→C6 : chantier → capture
  **manuelle** (texte + photos) → **écran de validation** (édition, sélecteur
  d'étape) → **publier** → fil à jour.
- **Sprint 3 — Lecture client (héros V1).** S1 Accueil (pouls + fil d'attention,
  **une seule priorité**), S2 Récit, S4 Photos, S6 Documents. **Notification à la
  publication.** → **démo bout-en-bout : « une saisie, plusieurs bénéfices ».**
- **Sprint 4 — Assistant & demandes.** S8 assistant (récupération structurée +
  synthèse, modèle masqué), bouton **« Transmettre à l'équipe »** (jamais
  bloqué), cycle `ouverte→traitée→close`, file équipe, **réponse signée relayée**.
- **Sprint 5 — L'émotion (différenciateur).** S3 Pièces + S5 comparateur
  avant/après, S9 Décision contextuelle, **Moments** (♥/💬), S10 carte de partage,
  S7 Demandes client. → **beta utilisateurs réels.**
- **Sprint 6 — Durcissement & mise en marché.** Accessibilité AA,
  **notification e-mail (canal primaire ; push en option ultérieure)**,
  perfs/skeletons, RGPD, observabilité, **ADR conformité** (RGPD + AI Act,
  échéance 2026-08-02). → **V1.**

---

## 6. Risques techniques

1. **🔴 Push iOS PWA** — la notification automatique est centrale, le web push
   iOS est fragile. **Mitigation : e-mail comme canal primaire/de secours.**
2. **🟠 Capture offline** sur chantier (file locale, sync, conflits, upload
   réseau faible) — PoC dès Sprint 0.
3. **🟠 Portabilité** — tenir la discipline « tout est code, rien de cloud-only »
   pour garantir la migration souveraine sans refonte.
4. **🟠 RLS + passerelle** — le rôle de service bypass la RLS ; discipline de
   revalidation obligatoire.
5. **🟡 Qualité IA Mistral** en français BTP — à éprouver tôt.
6. **🟡 Legacy Phénix Inspect** dans le dépôt — à isoler/archiver pour éviter la
   confusion.
7. **🟡 Fidélité Design System** hi-fi (carte de partage, comparateur,
   animations) — coût pixel-perfect réel.

---

## 7. Arbitrages tranchés (validés)

Les points laissés ouverts en revue ont été tranchés et sont désormais
contraignants au même titre que le reste de l'ADR :

1. **Contenu typé en JSONB pour la V1.** Respecte le principe du journal central
   (une seule table au centre) et reste réversible : promotion vers
   colonnes/tables dédiées possible plus tard *si* un type le justifie (test de
   gouvernance ADR-002 §6).
2. **Realtime client différé en V1.** Le client n'a pas besoin d'un flux live
   permanent ; un **rafraîchissement à l'ouverture** suffit, cohérent avec une
   expérience contemplative. **Realtime conservé côté compagnon** si utile (fil
   qui se met à jour pendant la documentation).
3. **Moments (♥ / 💬) = annotations, pas événements métier.** Modélisés dans des
   tables dédiées (`moment_like`, `comment`), volontairement **hors du journal
   principal** pour ne pas le polluer. Écart assumé avec « tout est événement »
   (ces interactions ne passent pas le test de gouvernance ADR-002 §6).
4. **Notification : e-mail = canal primaire en V1.** Fiable, indépendant des
   limites du web push (notamment iOS PWA). Les **push pourront être ajoutés
   plus tard** en complément, sans changer l'architecture.
5. **Deux apps distinctes** (interface PHÉNIX / espace client) **avec composants
   partagés** (`packages/ui`, `packages/core`). Publics et missions opposés ;
   socle commun mutualisé.

---

## 8. Conséquences

- Architecture alignée 1:1 sur ADR-001/002/003, avec deux contraintes promues au
  premier rang : **l'UX gagne toujours** et **portabilité sans lock-in**.
- V1 petite à construire (une boucle), vision long terme préservée par le journal.
- Coûts d'exploitation faibles ; souveraineté atteignable sans refonte.
- Discipline requise : tout passe par le journal ; tout est code ; aucune IA
  appelée hors passerelle ; rien de publié sans validation humaine.

---

*ADR-004 — référence officielle d'architecture PHÉNIX 360. Tout développement
futur doit s'y conformer ou faire l'objet d'un ADR amendant celui-ci.*
