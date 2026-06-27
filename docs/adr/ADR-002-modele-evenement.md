# ADR-002 — Le modèle d'événement (enveloppe commune + contenu typé)

- **Statut :** Accepté (un point de design à confirmer, voir §7)
- **Date :** 2026-06-27
- **Auteurs :** Fondateur + CTO PHÉNIX 360
- **Dépend de :** ADR-001 (le projet = un journal d'événements unique)

---

## 1. Contexte

ADR-001 a fait du **journal d'événements** la colonne vertébrale : une saisie =
un événement écrit ; chaque module = une vue filtrée du journal. Reste à définir
**ce qu'est un événement**.

Orientation produit validée : **quelques grands types métier bien définis**, en
nombre très limité — ni événement universel (ingérable à l'exploitation), ni
multiplication des types (modèle fragmenté). Discipline retenue : un nouveau
besoin doit d'abord prouver qu'il est un vrai type, sinon il reste une variante.

## 2. Décision — enveloppe commune + contenu typé

Tout événement = **une enveloppe commune** (champs partagés par tous les types)
**+ un contenu typé** (la petite part spécifique au type). C'est ce qui donne des
types structurés **sans** fragmenter le modèle.

### 2.1 L'enveloppe (champs communs à TOUS les événements)

- **id** — identité unique de l'événement.
- **chantier** — le projet auquel il appartient.
- **type** — `compte-rendu` · `photo` · `document` · `demande`.
- **auteur + rôle** — qui a créé l'événement (équipe Phénix, client ;
  sous-traitant plus tard). L'IA n'est jamais auteur : elle rédige, l'humain
  valide et signe.
- **date** — horodatage. La chronologie EST la colonne vertébrale.
- **visibilité** — `client` (visible par le client) ou `interne` (Phénix seul).
- **état** — cycle de vie de l'événement (voir chaque type).
- **saisie** — identifiant de la saisie d'origine (voir §7).

### 2.2 Le contenu typé (spécifique à chaque type)

Seule la part qui ne rentre dans aucun autre type. Détail au §3.

## 3. Les 4 types de la V1

### `compte-rendu`
- **Contenu :** texte du compte-rendu (issu de la dictée, rédigé par l'IA),
  **avancement proposé** (%), avancement confirmé.
- **États :** `brouillon` → `publié`. Le passage à `publié` = la **validation**
  humaine (voir §4). Tant qu'il est `brouillon`, il n'est pas visible du client.
- **Visibilité :** `client` une fois publié (sauf note marquée `interne`).

### `photo`
- **Contenu :** le fichier image, une légende, un classement (catégorie /
  pièce). Mécanique « fichier » partagée avec `document`, sans duplication.
- **États :** publiée avec sa saisie (passe en `client` à la validation de la
  saisie). Pas de cycle de vie propre au-delà.
- **Vue dédiée :** la galerie d'avancement (≠ liste des documents).

### `document`
- **Contenu :** le fichier (PDF, plan…), un libellé, une catégorie.
- **États :** `publié` à l'ajout (par Phénix en V1).
- **Visibilité :** `client` ou `interne` selon le document.
- **Vue dédiée :** la liste des documents (future base du carnet numérique).

### `demande` (cf. ADR-001 §6)
- **Contenu :** la question/besoin du client (formulée via l'assistant), la
  **résolution** (réponse de Phénix, renseignée au traitement).
- **États :** `ouverte` → `traitée` → `close`. **Une demande = un besoin = une
  résolution** : pas de fil. La réponse n'est PAS un événement séparé, c'est la
  résolution portée par la demande, relayée au client par l'assistant.
- **Vue dédiée :** la liste des demandes à traiter (file de tâches Phénix, pas un
  inbox).

## 4. La validation est un ÉTAT, pas un type

Une validation n'est pas un contenu, c'est un acte sur un contenu : elle ne passe
aucune des 3 questions du test (§6). Elle est modélisée comme la **transition
d'état** `brouillon → publié`, avec « validé par / le » conservés sur
l'événement. Pourra être promue en événement plus tard *si* les validations de
matériaux exigent un historique multi-parties — pas avant.

## 5. L'avancement est un CHAMP, pas un type

L'avancement (%) est un champ du contenu `compte-rendu` : proposé par l'IA,
confirmé à la validation, jamais publié automatiquement (ADR-001 §3).
L'avancement courant du chantier = celui du dernier `compte-rendu` publié. Aucun
stockage séparé : c'est une simple lecture du journal.

## 6. Règle de gouvernance — le test du nouveau type

Tout nouveau besoin doit répondre **oui** à la plupart de ces questions pour
mériter un type ; sinon, c'est une **variante** (un champ ou une étiquette) :

1. Est-il **consulté dans sa propre vue** (écran / liste dédié) ?
2. Porte-t-il des **données qui ne rentrent dans aucun contenu existant** ?
3. A-t-il un **cycle de vie propre** (états au-delà de « publié ») ?

Candidats futurs à instruire avec ce test, pas avant d'en avoir besoin :
`SAV`, `facture`, `intervention`. Chacun devra le passer explicitement.

## 7. Point de design à confirmer — le regroupement par « saisie »

La boucle héros produit, en une action, **1 `compte-rendu` + N `photo`**. Comme
`photo` est un type à part entière (galerie), ce sont des événements distincts.
Pour que le fil affiche proprement « ce compte-rendu *et ses* photos » comme une
seule carte — tout en laissant la galerie agréger les photos dans le temps — je
propose un champ d'enveloppe **`saisie`** : tous les événements nés de la même
action de capture partagent le même identifiant de saisie.

C'est « une seule saisie, plusieurs bénéfices » rendu vrai **au niveau des
données** : une saisie → plusieurs événements → plusieurs vues, sans ressaisie.
Coût : un simple identifiant partagé, aucune hiérarchie.

**Alternative écartée :** mettre les photos *à l'intérieur* du compte-rendu
(pièces jointes). Rejetée car elle contredit la décision « photo = type avec sa
propre vue » (la galerie n'aurait plus d'objets de premier rang à lister).

**À confirmer :** adopter le champ `saisie` tel que décrit.

## 8. Décisions reportées
- Schéma de base de données concret (colonnes, index, stockage des fichiers).
- Stack technique et hébergement (UE / RGPD) — ADR dédié.
- Modèle de permissions fin par rôle (au-delà de `client` / `interne`).
