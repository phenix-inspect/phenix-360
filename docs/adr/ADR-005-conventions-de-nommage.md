# ADR-005 — Conventions de nommage (code, schéma, vocabulaire métier)

- **Statut :** Accepté (référence officielle)
- **Date :** 2026-06-28
- **Auteurs :** Fondateur + CTO PHÉNIX 360
- **Dépend de :** ADR-002 (modèle d'événement), ADR-004 (architecture & dépôt)
- **Portée :** Amende **ADR-004 §4** sur le nommage des tables. Fige les
  conventions de nommage de tout le code et du schéma. Contraignant.

---

## 1. Contexte

Le modèle canonique a été figé dans `@phenix360/core` **avant** le schéma SQL
(le produit dicte le schéma). Lors de la traduction en PostgreSQL, le SQL
esquissé en ADR-004 §4 employait `chantier` (français) là où core expose
`Project` (anglais). Il faut une règle unique, opposable, pour éviter toute
dérive future.

## 2. Décision

### 2.1 Identifiants techniques — anglais
Tables, colonnes, fonctions, index, types : **en anglais**. Le code (technique)
parle anglais ; seul le **vocabulaire métier** reste en français (§2.4).

### 2.2 Schéma SQL — `snake_case`
Tables et colonnes en `snake_case` : `project`, `project_member`, `event`,
`project_id`, `author_role`, `published_at`. Tables au **singulier** (`event`,
pas `events`).

### 2.3 Modèles TypeScript — `PascalCase` / `camelCase`
Types et interfaces en `PascalCase` (`Project`, `Event`, `EventAttachment`) ;
champs et fonctions en `camelCase` (`projectId`, `currentStep`, `isVisibleToClient`).
Les **clés du contenu `jsonb`** suivent le code : `camelCase` (`etapeConfirmee`,
`destinataire`).

### 2.4 Valeurs d'enum métier — français
Quand une valeur **est** un terme du vocabulaire PHÉNIX, elle reste **en
français** : `compte_rendu`, `photo`, `document`, `demande` ; `gros_oeuvre`,
`second_oeuvre`, `finitions`, `reception` ; `client`, `interne` ; `brouillon`,
`publie`, `ouverte`, `traitee`, `close` ; `compagnon`, `equipe`, `client`.
Format des valeurs : `snake_case` sans accent (portabilité / robustesse SQL).

### 2.5 Le produit/core dicte le schéma
La **source de vérité** est `@phenix360/core`. Le schéma Supabase en est une
**traduction**. En cas de divergence, **core fait foi** ; on corrige le schéma,
jamais l'inverse. (Ex. : `isVisibleToClient` définit la règle, la RLS la reflète.)

## 3. Correspondances (core ↔ SQL)

| core (PascalCase) | SQL (snake_case) |
|---|---|
| `Project` (≡ chantier) | `project` |
| `ProjectMember` | `project_member` |
| `Event` | `event` |
| `EventAttachment` | (intégré au `content` jsonb) |
| `projectId`, `authorRole`, `createdAt` | `project_id`, `author_role`, `created_at` |

## 4. Écart assumé avec ADR-004 §4

ADR-004 §4 montrait `chantier` et des colonnes mêlant français/anglais. **Cet
ADR l'amende** : le nommage technique est anglais (`project`…), les valeurs
métier restent françaises. Le reste d'ADR-004 est inchangé.

## 5. Conséquences

- Mapping core ↔ SQL trivial (snake_case ↔ camelCase), couche d'accès sans
  surprise.
- Le code reste lisible pour des contributeurs non francophones ; l'UI conserve
  un vocabulaire métier français cohérent avec les écrans.
- Tout nouveau type/table/colonne **doit** suivre ces règles, ou faire l'objet
  d'un ADR amendant celui-ci.

---

*ADR-005 — référence officielle. Amende ADR-004 §4 sur le nommage des tables.*
