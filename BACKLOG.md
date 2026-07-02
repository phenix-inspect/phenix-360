# PHÉNIX 360 — Backlog produit (vivant)

> Ce document vit. Il est mis à jour à **chaque sprint**. Il est confronté à
> `VISION.md` (constitution), guidé par `PRINCIPLES.md`, et ses arbitrages sont
> tracés dans `DECISIONS.md`.
>
> Objectif : une **V1 réellement utilisable**, assez solide pour une **bêta
> privée** avec de vrais conducteurs de travaux. Pas une démo, pas une maquette.

## Légende

- ✅ **Terminé** — fonctionnel, testé (gate + Playwright), sans régression.
- 🟡 **À compléter** — une base existe, il manque des morceaux pour être utilisable.
- 🔴 **À développer** — pas encore construit.

## Règle de sprint

1 Epic à la fois → développée **complètement** → testée → corrigée → sans
régression → poussée sur la PR. Gate obligatoire à chaque sprint : `typecheck`,
`lint`, `prettier`, `build`, Playwright, **zéro erreur console**.

---

## Epics

### EPIC 1 — Accueil conducteur · ✅ Terminé

Le point du matin (`AujourdhuiView`) : salutation, journée agrégée multi-chantiers,
compteurs (décisions/actions/réserves/clients/livraisons), cartes chantier, entrée
dans un chantier, clôture. VISION Art. 3, 10.

### EPIC 2 — Mission · ✅ Terminé

7 missions (`MissionFlow`) : capture caméra/voix → **scène signature « PHÉNIX
prépare → C'est prêt »** → compréhension → validation → partage. VISION Art. 4, 5, 11.

### EPIC 3 — Compte rendu IA · ✅ Terminé

`prepareMission` (déterministe, jamais d'invention) : décisions / actions /
réserves / questions client enrichies, éditables, projetées au Journal. VISION Art. 6, 7, 8.

### EPIC 4 — Réserves · ✅ Terminé (Sprint 1)

Le registre pilotable : création manuelle (libellé, responsable, échéance,
priorité), 3 segments **En retard / À lever / Levées** avec compteurs, tri par
urgence (priorité puis échéance), levée avec note + preuve, lien photo source,
alimente Aujourd'hui/soir. Interne strict (jamais côté client). Testé (réserves
7/7, sans régression). Report tracé dans `DECISIONS.md` : édition/réattribution
d'une réserve existante → futur sprint « Amendement de faits ». VISION Art. 7, 8, 9.

### EPIC 5 — Préparation chantier · 🟡 À compléter

Base : `DossierPanel` très riche (note de lancement PHÉNIX, devis + avenants,
feuille de route, planning en dates, commandes, propositions, documents,
questions). **Manque** : parcours de dépôt guidé plus robuste, édition du dossier,
états vides propres, cohérence des compteurs. VISION Art. 1, 7.

### EPIC 6 — Planning intelligent · 🟡 À compléter

Base : `buildPlanning`, `PlanningFrieze`, `GrandesEtapes`, `SmartPlanningView`.
**Manque** : replanification (décalage d'étape ↦ propagation), impact des
décisions/commandes en retard sur les dates, jalons. VISION Art. 3, 7.

### EPIC 7 — Bibliothèque · 🟡 À compléter

Base : `BibliothequeView` (le Fil par pièce/album). **Manque** : recherche,
filtres (pièce / type / partagé), sélection multiple, tri. VISION Art. 8, 9.

### EPIC 8 — Documents · 🔴 À développer

Générer les **sorties** métier (compte rendu, PV de réception, liste de réserves)
en document partageable/imprimable. Aujourd'hui : aperçu écran seulement. VISION Art. 8.

### EPIC 9 — Notifications · 🔴 À développer

Un vrai centre de notifications (le « radar » : ce qui a bougé, ce qui attend).
Base partielle : `AttentionPanel`. **Manque** : file de notifications datée,
lue/non-lue, actions rapides. VISION Art. 7, 10.

### EPIC 10 — Assistant IA · 🟡 À compléter

Base : concierge **Léon** côté client (réponses ancrées, escalade, reprise) +
copilote `buildChantierAttention` côté conducteur. **Manque** : plus d'insights
proactifs (silence client, intervention due, réserve → réception), mémoire. VISION Art. 7, 9.

### EPIC 11 — Mode Artisan · 🔴 À développer

Vue dédiée artisan : ses tâches, ses réserves à lever, ses livraisons — sans
l'interne du conducteur ni le client. VISION Art. 9.

### EPIC 12 — Mode Client · 🟡 À compléter

Base : `ClientView` riche (décision, Fil, concierge, client-safe strict).
**Manque** : historique client propre, notifications client, préférences. VISION Art. 9.

### EPIC 13 — Administration · 🔴 À développer

Back-office : gérer chantiers, membres, accès. Dépend de l'auth. VISION Art. 2.

### EPIC 14 — Authentification · 🔴 À développer

Comptes réels (conducteur / client / artisan), sessions, rôles. **Fondation de la
bêta** (aujourd'hui : conducteur unique, données locales). VISION Art. 2, 9.

### EPIC 15 — Gestion des entreprises · 🔴 À développer

Multi-entreprise (l'entreprise du conducteur, ses chantiers, ses membres). VISION Art. 2.

### EPIC 16 — Gestion des utilisateurs · 🔴 À développer

Inviter / gérer les membres d'un chantier et leurs rôles. VISION Art. 2, 9.

### EPIC 17 — Paramètres · 🔴 À développer

Préférences conducteur (profil, entreprise, notifications, thème). VISION Art. 11.

### EPIC 18 — Planning global · 🔴 À développer

Le planning **de tous les chantiers** d'un conducteur, sur une seule frise. VISION Art. 3.

### EPIC 19 — Commandes · 🟡 À compléter

Base : commandes dans le dossier + alertes (`buildOrderAlerts`). **Manque** :
cycle de vie éditable (à commander → commandée → livrée), lien avenant → commande. VISION Art. 7.

### EPIC 20 — Documents intelligents · 🔴 À développer

Lecture d'un devis/plan déposé → extraction structurée (lots, postes, montants).
Aujourd'hui : dossier saisi/seedé. VISION Art. 7.

---

## Fondations techniques (transverses, pré-requis bêta)

- **Persistance & backend réel** : aujourd'hui `localStorage` + backend en mémoire
  (mono-poste, mono-conducteur). Pré-requis d'une bêta multi-utilisateur → lié à
  EPIC 14/15/16. Décision d'architecture à tracer dans `DECISIONS.md` avant de coder.
- **Tests** : suites Playwright par Epic (parcours réels), zéro erreur console.

## Ordre de marche (proposé par le CTO)

Finir les 🟡 les plus proches du métier et du quotidien du conducteur avant les
🔴 d'infrastructure : **4 Réserves → 5 Préparation / 19 Commandes → 9 Notifications
→ 6 Planning → 8 Documents**, puis la fondation bêta (**14 Auth → 15/16 → 13 Admin**).
Cet ordre peut évoluer ; il est réévalué à chaque sprint.
