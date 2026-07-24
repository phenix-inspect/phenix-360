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
dans un chantier, clôture. **Repère « Chantier actif »** (Sprint 4.3) sur la carte
que les onglets Chantier / Artisan / Espace client ouvriront : depuis Aujourd'hui,
on sait quel chantier ces vues visent (présentation seule, aucun onglet désactivé).
**Compteurs actionnables** (Sprint 4.4) : un compteur du matin (> 0) est un raccourci
« où dois-je regarder ? » → défilement vers « Mes chantiers » + pulsation des cartes
concernées (les compteurs à 0 restent en affichage simple). Aucun filtre, aucun
routage, aucun état. VISION Art. 3, 10.

### EPIC 2 — Mission · ✅ Terminé

5 missions : capture caméra/voix → **scène signature « PHÉNIX prépare → C'est prêt »**
→ compréhension → validation → partage (`MissionFlow`). **« Livraison de matériel »
retirée du menu (09/07, V1 simplifiée)** — logique conservée, réactivation = 1 ligne.
**Fusion Visite + Réunion
(09/07)** : un seul **« Compte rendu de chantier »** à **points** (1 à 3 photos + commentaire +
diffusion `Client` / `Artisan` / `Client + Artisan`) — flux `CompteRenduFlow` ; le
conducteur voit tout (badges), le client ne voit que ses points, l'export PDF est
filtré par destinataire ; l'avancement d'étape reste porté par le CR (ADR-002 §5).
`compte-rendu.test`. VISION Art. 4, 5, 8, 9, 11.

### EPIC 3 — Compte rendu IA · ✅ Terminé

`prepareMission` (déterministe, jamais d'invention) : décisions / actions /
réserves / questions client enrichies, éditables, projetées au Journal. VISION Art. 6, 7, 8.

**Cohérence du Journal (Sprint 4.5)** : le Journal / Historique est une vraie
mémoire de chantier — libellés voix conducteur (« Décision attendue du client »,
« Question du client »), badges harmonisés via `journalStatut` (un seul par ligne,
casse + sémantique unifiées ; « Publié » masqué car tout est publié par défaut ;
« Interne » conservé), actions plus visibles (« Lever la réserve » plein or,
« Voir la photo » contour). Présentation seule, append-only et client-safe intacts.
`journal.test.mjs` 9/9.

### EPIC 4 — Réserves · ✅ Terminé (Sprint 1)

Le registre pilotable : création manuelle (libellé, responsable, échéance,
priorité), 3 segments **En retard / À lever / Levées** avec compteurs, tri par
urgence (priorité puis échéance), levée avec note + preuve, lien photo source,
alimente Aujourd'hui/soir. Interne strict (jamais côté client). Testé (réserves
7/7, sans régression). Report tracé dans `DECISIONS.md` : édition/réattribution
d'une réserve existante → futur sprint « Amendement de faits ». VISION Art. 7, 8, 9.
**Onglet « Réserves » retiré (09/07)** : une réserve est un événement du Journal, pas un espace dédié.
Création via les missions (Pré-réception / Réception) ; lecture + levée + join du responsable au
**Suivi** ; remontée dans « Aujourd'hui ». Modèle de données, événements et logique métier conservés
(`ReservesView` supprimée, `ReserveResponsable` greffée au Suivi). `reserves.test` réécrit.

### EPIC 5 — Préparation chantier · ✅ Terminé (Sprint 3 + EPIC 1 complète)

**EPIC 1 (véritable espace Préparation)** : la Préparation est disponible sur
**tout** chantier (blanc compris via `ensureDossier`), entièrement **éditable** —
coordonnées & accès client, devis, budget, **intervenants** (artisans + fournisseurs
avec contact), **documents catégorisés** (devis/plan/diagnostic/DPE/assurance/contrat)
avec **vrais fichiers** (Lot 3) ouvrables et demande au client, **photos avant
travaux**, **commandes** (ajout + fiche complète), **feuille de route & jalons**,
planning prévisionnel, check-list de lancement, cockpit « prêt à démarrer ? ».
Doublon intervenants du cockpit retiré (section dédiée unique). `prep.test.mjs`
11/11, `preparation.test.mjs` 9/9, client-safe. Ajouts core `Project.address`,
`ProjectDocument.categorie/attachment`, `Fournisseur`, `SousTraitant.contact`.

_Détail Sprint 3 :_

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
pièce/album). **Album & viewer (Sprint 08–09/07)** : viewer photo immersif (type Photos
iPhone / Instagram) — photo **entière** (fin du recadrage), plein écran noir, **zoom +
déplacement**, **pellicule** compacte, **aperçu mosaïque** des albums, **vignettes
Bibliothèque cliquables**, commentaires en **Bottom Sheet**. Une photo se **regarde, se like,
se commente** — l'**annotation a été retirée** (plus de valeur que de complexité).
`coulisses-viewer.test`. **Manque** : recherche, filtres (pièce / type / partagé), versionning,
classement automatique. VISION Art. 8, 9.

### EPIC 8 — Documents · 🔴 À développer

**Objectif PO** : tous les documents réellement exploitables — **CR**, **PV**,
**SAV**, documents chantier — générés en sortie partageable/imprimable. Aujourd'hui :
aperçu écran seulement. VISION Art. 8.

### EPIC 9 — Notifications · 🔴 À développer

Un vrai centre de notifications (le « radar » : ce qui a bougé, ce qui attend).
Base partielle : `AttentionPanel` — **stabilisé (Sprint 4.6) en vrai radar de
blocages** : uniquement les items bloquants (`warning`), 3 maximum, triés par
priorité ; les infos non bloquantes sortent du radar (pointeur « + N → Préparation »
si dépassement) ; message d'avenant court ; bouton « Ouvrir » contour lisible.
`attention.test.mjs` 8/8. **Manque** : file de notifications datée, lue/non-lue,
actions rapides. VISION Art. 7, 10.

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
**Stabilisation (Sprint 4.1) :** le **Fil est désormais le récit visuel unique** ;
le doublon photo (« Dernière activité » / « Le récit de votre chantier ») est
remplacé par une section resserrée **« Comptes rendus & documents »** (éléments
utiles absents du Fil).
**Qualité (Sprint 4.2) :** **ancrage de contexte** persistant dans l'en-tête
(`Chantier · {nom}` / `Aperçu client · {nom}` / `Aperçu artisan · {nom}`) → on sait
toujours sur quel chantier on travaille ou quel espace on prévisualise (remplace et
simplifie le ruban de perspective). Titres de journal « Type · contexte métier »,
libellés d'état lisibles, dates épurées.
**Demande client via Léon (09/07)** : **Léon = point d'entrée UNIQUE** du client (plus de bouton
« Faire une demande »). Le client écrit à Léon (texte et/ou 0 à 3 photos) ; Léon répond s'il sait,
sinon il **crée automatiquement une demande conducteur** (escalade forcée dès qu'une photo est
jointe). Modèle **1 demande = 1 réponse** ; statut À traiter / Répondu (client-safe « En attente »),
remontée dans « Aujourd'hui » conducteur, trace Suivi (mémoire officielle), notification client à la
réponse (reprise aussi dans le fil de Léon). `demande-client.test`.
**Onglet « Demandes client » (Chantier, 09/07)** : tableau de pilotage de toutes les demandes Léon
(après « Dans les coulisses »), filtres **Tous / À traiter / Non lus / Répondus**, badge « non lus »
qui diminue à l'ouverture (accusé de lecture `seen`), réponse depuis l'onglet (1 demande = 1
réponse). « Aujourd'hui » = À traiter ; « Suivi » = trace après réponse (lecture seule).
`demandes-onglet.test`.
**Refonte Espace client (09/07)** : **5 onglets**, un onglet = une question. **Aujourd'hui** = tableau
d'ACTIONS (notifications puis ce qui attend une action ; état vide « Vous n'avez rien à faire »).
**Vos demandes** (`ClientDemandesTab`, filtres Tous / En attente / Répondues / Non lues) = échanges
Léon. **Vos choix** (`ClientChoixTab`, filtres Tous / En attente / Répondu / Annulé) = décisions.
**Documents** + **Dans les coulisses** inchangés. Onglet « Le projet » (planning/hero) RETIRÉ — le
planning reste un outil conducteur ; l'avancement client se vit « Dans les coulisses ». `client-*`,
`decisions`, `notifications-bidirect`, `demande-client` mis à jour ; `client-planning` /
`planning-duree` supprimés (planning client retiré).
**Léon IA premium (09/07)** : le cerveau (`packages/core/phenix.ts`) cherche AVANT de transmettre —
coordonnées PHÉNIX (`PHENIX_PHONE`/`EMAIL`), recherche documentaire par type/mot-clé (`DOC_TYPES` :
devis, facture, DPE, plan, PV…) avec bouton « Ouvrir » ou « je ne trouve pas + je transmets ? »,
réception/planning depuis les dates, actions/décisions en attente. Escalade en dernier recours
(problème signalé, changement/permission, prix, photo, transmission explicite). Aucun changement d'UI.
`leon-ia.test` (8/8).
**Manque** : préférences client. VISION Art. 2, 8, 9, 10, 11.

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

### EPIC 21 — Communication & Contacts · ✅ Terminé (Sprint « Bureau mobile » 1)

Le **bureau mobile** du conducteur : joindre qui il faut, quand il faut, sans
quitter PHÉNIX. **Modèle `Contact`** réutilisable (core : `contact.ts` — rôles
client / artisan / fournisseur / architecte / bureau de contrôle / assureur /
investisseur / autre ; société, tél, email, WhatsApp, adresse, notes, chantiers
liés). **Annuaire global** (`surfaces/Annuaire.tsx`, bouton d'en-tête) : recherche,
filtre par rôle, création / édition / suppression. **Carnet du chantier** intégré à
la Préparation (`CarnetChantier`) : contacts liés au chantier, lier un contact
existant en un geste. **Actions de communication** en **deep-links natifs** (V1
100 % locale, sans backend, sans envoi réel) : `tel:` / `sms:` / `wa.me` / `mailto:`
/ Google Maps (`lib/contactActions.ts`). **Messages pré-remplis** par PHÉNIX selon
le contexte (`lib/commTemplates.ts` : relance artisan, envoi CR, demande de document,
confirmation de livraison, rappel d'intervention, demande de disponibilité, message
client rassurant) — le conducteur ajuste, puis l'app native s'ouvre. **Journalisation
append-only** : chaque action ouverte depuis un chantier est tracée au Journal
(événement `communication`, **toujours interne**, jamais côté client — Art. 9),
consultable dans l'historique de chaque contact. **Pont réserve → annuaire** : quand
le responsable d'une réserve correspond à un contact, PHÉNIX propose de le joindre.
Contacts seedés (client, artisan, fournisseur, architecte). `contacts.test.mjs` 10/10,
non-régression complète (14 suites), zéro erreur console. VISION Art. 1, 2, 6, 7, 9, 11.

---

## Fondations techniques (transverses, pré-requis bêta)

- **App réelle locale** _(sprint en cours)_ : rendre PHÉNIX réellement utilisable en
  local, pas seulement en démo. **Lot 1 livré** : la démo devient un **choix** au
  premier lancement (écran `Welcome` : « Découvrir la démo » / « Démarrer à vide »),
  plus d'auto-chargement imposé (`reel.test.mjs` 7/7). **Lot 2 livré** : **création
  et édition d'un chantier réel** à la main (`ChantierForm` : nom, client, adresse,
  étape de départ), sans dossier de démo, atterrissage direct dans le chantier ;
  ajouts core `Project.address` + étape de départ (`chantier.test.mjs` 10/10).
  **Lot 4 livré** : **sauvegarde / restauration locale** — exporter tout l'espace en
  `.json`, importer une sauvegarde (restauration complète), avec confirmation,
  message clair si fichier invalide et zéro perte silencieuse (`backup.test.mjs`
  8/8). **Lot 3 livré** : **vrais fichiers** — photos (Fil/mission/journal) et
  documents (PDF/image) chargés et stockés en base64 local, aperçu, limites de
  taille + message d'erreur clair, client-safe et export/import compatibles
  (`files.test.mjs` 7/7). **Sprint « App réelle locale » complet.** Pas de mise en
  ligne, pas d'auth, pas de Supabase.
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

## Réordonnancement « Bureau mobile » — validé par le PO (03/07/2026)

**Principe :** penser _bureau mobile du conducteur_. À 7 h, il doit pouvoir faire
**95 % de sa journée dans PHÉNIX** sans en sortir. Trou produit majeur identifié :
il quittait l'app pour **communiquer** (appeler, relancer, envoyer un CR). Nouvel
ordre validé, orienté journée réelle du conducteur :

1. **Communication & Contacts** (EPIC 21) — ✅ _fait_
2. **Agenda & journée du conducteur** — la timeline du jour, actionnable
3. **Coordination des artisans** — qui vient, quand, relances, confirmations
4. **Planning intelligent** (EPIC 6)
5. **Commandes** (EPIC 19)
6. **Documents & Signatures** (EPIC 8)
7. **Assistant PHÉNIX renforcé** (EPIC 10)

`DECISIONS.md` : arbitrage tracé (03/07/2026).

## Phase de consolidation produit — ouverte par le PO (04/07/2026)

**Objectif :** plus aucune duplication. Deux écrans qui font la même chose → on
fusionne ; deux modèles pour la même information → une seule source de vérité.
« Je préfère supprimer 500 lignes qu'en ajouter 5 000. » Priorité **avant** Agenda
/ Planning / IA (qui réutiliseront les mêmes données).

Audit des 5 bases visées :

1. **Contacts** — ✅ _fait_ (04/07). Base unique : artisans, fournisseurs,
   responsables de réserve, fournisseurs de commande et **client** sont des
   `Contact` référencés par id. Fin du texte libre sur les objets durables ;
   suppression de `SousTraitant`/`Fournisseur`/`IntervenantsSection` et du
   matching flou réserve→contact. Capture de mission laissée en langage naturel
   (frontière produit). Cf. `DECISIONS.md` 04/07.
2. **Documents** — 🔴 à faire. Journal + Client sont **déjà** une base (événement
   `document` + `visibility`). Reste à réconcilier la **checklist de préparation**
   (`ProjectDocument`) avec les fichiers réels → une bibliothèque, 3 vues.
3. **Photos** — 🔴 à faire. Deux formes : `FilPhoto` (Moments) et `EventAttachment`
   (journal / photos avant). → forme canonique + tags, la vue diffère.
4. **Interventions** — ✅ _déjà unique_ : `Moment.type` (réunion/visite/réception/
   SAV…). Rien à faire (nettoyage mineur des libellés possible).
5. **Communication** — ✅ _déjà unique_ : événement `communication` + `Contact`,
   historique unique. Rien à faire.
