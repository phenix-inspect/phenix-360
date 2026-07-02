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

### EPIC 5 — Préparation chantier · ✅ Terminé (Sprint 3)

Le **bureau de préparation** : cockpit `PreparationCockpit` en tête de l'onglet
Préparation, alimenté par le sélecteur pur `buildPreparation` (déterministe,
aucune IA). Répond en 30 s à « ce chantier peut-il démarrer ? ». Enchaînement :
**verdict** (Prêt / Presque / Pas encore, avec score), **budget** (prévisionnel
éditable, engagé = commandes passées, restant), **check-list de lancement** (vérifs
automatiques dérivées et points manuels du conducteur), **points bloquants**,
**intervenants** (sous-traitants retenus éditables et fournisseurs), **prochaines
dates**. Le détail complet du dossier (devis, planning, commandes, documents,
choix…) reste conservé dessous. Ajouts modèle : `sousTraitants`, `checklist`,
`budgetPrevisionnel`. Client-safe. Playwright préparation 9/9, sans régression.
VISION Art. 1, 3, 7, 11.

### EPIC 6 — Planning intelligent · 🟡 À compléter

Base : `buildPlanning`, `PlanningFrieze`, `GrandesEtapes`, `SmartPlanningView`.
**Objectif PO** : un vrai planning, pas seulement des dates — vue intelligente :
**interventions**, **dépendances**, **retards**, **conflits**, **alertes**.
**Manque** : replanification (décalage ↦ propagation), dépendances entre étapes,
détection de conflits, impact des décisions/commandes en retard. VISION Art. 3, 7.

### EPIC 7 — Bibliothèque · 🟡 À compléter

**Objectif PO** : une vraie **GED** — classement automatique, recherche,
**versionning**, assistance IA au rangement. Base : `BibliothequeView` (le Fil par
pièce/album). **Manque** : recherche, filtres (pièce / type / partagé),
versionning, classement automatique. VISION Art. 8, 9.

### EPIC 8 — Documents · 🔴 À développer

**Objectif PO** : tous les documents réellement exploitables — **CR**, **PV**,
**SAV**, documents chantier — générés en sortie partageable/imprimable. Aujourd'hui :
aperçu écran seulement. VISION Art. 8.

### EPIC 9 — Notifications · 🔴 À développer

Un vrai centre de notifications (le « radar » : ce qui a bougé, ce qui attend).
Base partielle : `AttentionPanel`. **Manque** : file de notifications datée,
lue/non-lue, actions rapides. VISION Art. 7, 10.

### EPIC 10 — Assistant IA · 🟡 À compléter — **reporté après les fondations métier**

Base : concierge **Léon** côté client (réponses ancrées, escalade, reprise) +
copilote `buildChantierAttention` côté conducteur. **Décision PO (02/07/2026)** :
on n'investit pas massivement l'IA tant que le métier n'est pas complet — l'IA
amplifie un logiciel déjà excellent, elle ne masque pas un manque. Reprise après
les EPICs 11/5/6/19/8/7/9/Admin. VISION Art. 7, 9.

### EPIC 11 — Mode Artisan · ✅ Terminé (Sprint 2)

L'espace du sous-traitant sur un chantier (`ArtisanView`, 4ᵉ onglet « Artisan ») :
sélecteur d'identité (artisans du chantier), **mon planning** (où en est le
chantier), **mes interventions** (réserves + actions qui me sont attribuées) avec
**« Signaler terminé »** (signalement au conducteur, canal `destinataire:
'conducteur'`, surfacé au journal), **partager une photo/mot** d'avancement, et
**les infos partagées** du chantier. Nouveau rôle `sous_traitant`. Tout ce que
l'artisan écrit est **interne → jamais côté client** (garanti par
`isVisibleToClient`, testé). Playwright artisan 8/8, sans régression. VISION Art. 9
(chacun ne voit que ce qui lui est destiné), Art. 2 (acteurs du chantier).

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

**Objectif PO** : un vrai **module commandes** — suivi, **réception**,
**manquants**, **retards**, **impact sur le planning**. Base : commandes du
dossier + alertes (`buildOrderAlerts`). **Manque** : cycle de vie éditable
(à commander → commandée → livrée), réception avec manquants, lien avenant →
commande, impact planning. VISION Art. 7.

### EPIC 20 — Documents intelligents · 🔴 À développer

Lecture d'un devis/plan déposé → extraction structurée (lots, postes, montants).
Aujourd'hui : dossier saisi/seedé. VISION Art. 7.

---

## Fondations techniques (transverses, pré-requis bêta)

- **Persistance & backend réel** : aujourd'hui `localStorage` + backend en mémoire
  (mono-poste, mono-conducteur). Pré-requis d'une bêta multi-utilisateur → lié à
  EPIC 14/15/16. Décision d'architecture à tracer dans `DECISIONS.md` avant de coder.
- **Tests** : suites Playwright par Epic (parcours réels), zéro erreur console.

## Ordre de marche V1 — figé par le PO (02/07/2026)

**Principe :** terminer le MÉTIER avant d'investir l'IA. « Une IA à 70 % dans une
application à 100 % plutôt qu'une IA à 100 % dans une application à 70 %. » L'IA
sera l'accélérateur, jamais la béquille — elle ne doit jamais masquer un manque
fonctionnel.

Priorités de construction, dans l'ordre :

1. **EPIC 11 — Mode Artisan** _(Sprint 2, en cours)_
2. **EPIC 5 — Préparation chantier** (vrai bureau de préparation)
3. **EPIC 6 — Planning intelligent** (interventions, dépendances, retards, conflits)
4. **EPIC 19 — Commandes** (vrai module : suivi, réception, manquants, retards)
5. **EPIC 8 — Documents** (CR, PV, SAV, documents chantier exploitables)
6. **EPIC 7 — Bibliothèque** (vraie GED : classement, recherche, versionning)
7. **EPIC 9 — Notifications** (centre : priorités, lecture, historique)
8. **EPIC 13/15/16/17 — Administration** (entreprises, utilisateurs, rôles, paramètres)
   avec la fondation **EPIC 14 — Authentification**.

**Puis seulement**, une fois ces briques terminées : **EPIC 10 — Assistant IA**
(copilote), qui aura alors énormément de matière pour devenir réellement utile.
`DECISIONS.md` : investissement IA reporté après les fondations métier (02/07/2026).
