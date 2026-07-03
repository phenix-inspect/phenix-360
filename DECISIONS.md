# PHÉNIX 360 — Journal des arbitrages produit

Le registre des décisions. **Append-only** : on ajoute, on ne réécrit pas. Chaque
entrée : la décision, le pourquoi, les alternatives rejetées, l'impact. Sert de
mémoire unique quand le produit grandira.

Format :

```
JJ/MM/AAAA
Décision : …
Pourquoi : …
Alternatives rejetées : …
Impact : …
```

---

## 02/07/2026 — Les missions sont conservées

**Décision :** on garde le choix d'une mission (un tap) comme entrée principale.
**Pourquoi :** elle donne un contexte fiable à PHÉNIX et évite une IA qui doit
tout deviner.
**Alternatives rejetées :** capture sans mission (l'IA infère le contexte).
**Impact :** une capture rapide reste disponible pour les imprévus (Art. 4).

## 02/07/2026 — L'application s'ouvre sur le conducteur et sur la journée

**Décision :** l'accueil est « Aujourd'hui » (tous chantiers) ; le conducteur est
l'utilisateur principal.
**Pourquoi :** un conducteur pilote une journée et plusieurs chantiers, pas un
projet unique ; il ne doit pas être invité dans sa propre appli.
**Alternatives rejetées :** ouverture sur l'espace client ; modèle mono-chantier.
**Impact :** nouvelle porte d'entrée transversale ; le chantier devient un
second niveau (Art. 2 & 3).

## 02/07/2026 — Le fait est la colonne vertébrale ; tout le reste est projection

**Décision :** le Journal de faits (append-only) est l'unique source de vérité ;
CR, PV, réserves, fil client, historique en sont des projections.
**Pourquoi :** un seul chemin d'écriture, aucune duplication, aucune refonte.
**Alternatives rejetées :** documents/réserves/modules comme objets autonomes.
**Impact :** on recadre l'existant au lieu de le refondre (Art. 8).

## 02/07/2026 — Capture zéro-tap reportée en V2

**Décision :** on n'essaie pas de deviner automatiquement chantier + mission +
document en V1.
**Pourquoi :** deviner sans erreur n'est pas fiable aujourd'hui ; un tap
d'intention est acceptable et rend PHÉNIX fiable.
**Alternatives rejetées :** entrée entièrement inférée par l'IA dès la V1.
**Impact :** le tap d'intention est conservé ; l'inférence viendra plus tard.

## 02/07/2026 — Gouvernance : toute PR cite les articles de VISION.md

**Décision :** aucune Pull Request n'est validée si elle ne cite explicitement le
ou les articles de `VISION.md` qu'elle respecte.
**Pourquoi :** empêcher la dérive produit à mesure que le code grandit ; garder
une référence unique pour toute décision.
**Alternatives rejetées :** discipline informelle laissée au jugement de chacun.
**Impact :** chaque PR devra référencer la constitution ; les écarts sont
refusés (Art. de gouvernance de `VISION.md`).

## 02/07/2026 — Réserves : édition/réattribution reportée (amendement append-only)

**Décision :** en V1, une réserve se crée (manuellement ou depuis une photo) puis
se lève. Réattribuer le responsable ou repousser l'échéance d'une réserve
existante n'est PAS développé dans ce sprint.
**Pourquoi :** le Journal est append-only (Art. 8) — « éditer » un fait suppose un
mécanisme d'AMENDEMENT (un événement ajouté qui corrige, comme la levée pointe
vers la réserve). C'est une brique transverse (elle servira aussi actions,
décisions, commandes) : elle mérite d'être conçue proprement, pas bricolée pour
les seules réserves. La création fixe déjà responsable + échéance + priorité,
donc l'absence d'édition ne bloque pas l'usage.
**Alternatives rejetées :** muter la réserve en place (violerait l'append-only) ;
un patch ad hoc réservé aux réserves.
**Impact :** un futur sprint « Amendement de faits » ajoutera l'édition à réserves,
actions, décisions et commandes d'un coup. Noté au backlog.

## 02/07/2026 — Terminer le métier avant d'investir l'IA

**Décision :** l'ordre de construction V1 privilégie les fondations MÉTIER
(Artisan, Préparation, Planning, Commandes, Documents, Bibliothèque, Notifications,
Administration) AVANT tout investissement massif dans le copilote IA (EPIC 10).
**Pourquoi (PO) :** « une IA à 70 % dans une application à 100 % plutôt qu'une IA à
100 % dans une application à 70 % ». L'IA est un accélérateur, pas une béquille :
elle ne doit jamais masquer un manque fonctionnel, et elle aura bien plus de
matière une fois le métier complet.
**Alternatives rejetées :** enchaîner les sprints IA (copilote proactif) tout de suite.
**Impact :** `BACKLOG.md` réordonné (Ordre de marche V1 figé). EPIC 11 Mode Artisan
devient le Sprint 2. EPIC 10 repris après les fondations.

## 02/07/2026 — Mode Artisan : rôle `sous_traitant`, identité par sélecteur, canal dédié

**Décision :** (1) ajout du rôle d'acteur `sous_traitant` (l'artisan est un auteur
d'événements de plein droit). (2) En l'absence d'authentification (EPIC 14),
l'identité de l'artisan est choisie par un **sélecteur** (les artisans du
chantier, dérivés des responsables de réserves/actions et des intervenants). (3)
Le canal artisan → conducteur (« Signaler terminé / à valider ») est une `demande`
avec `destinataire: 'conducteur'`, **toujours en visibilité interne** — donc
jamais visible du client (`isVisibleToClient` retourne faux dès que `visibility
!== 'client'`).
**Pourquoi :** livrer un Mode Artisan complet et client-safe sans attendre l'auth ;
modéliser proprement le rôle plutôt que de le simuler ; séparer le canal artisan
du canal client (`destinataire: 'phenix'`) pour ne pas polluer « Répondre au
client ».
**Alternatives rejetées :** faire signer l'artisan comme `equipe` (moins juste) ;
un flag ad hoc au lieu d'un vrai canal `demande`.
**Impact / suites :** un **inbox conducteur dédié** aux signalements artisans
(`signalementsArtisan`) et l'**authentification** (identités réelles) restent à
faire (EPIC 9/14). La persistance du « signalé » entre sessions viendra avec la
brique d'amendement de faits.

## 02/07/2026 — Bureau de préparation : synthèse déterministe, budget simple

**Décision :** l'EPIC 5 ajoute un cockpit de préparation alimenté par un sélecteur
PUR `buildPreparation(dossier)` (aucune IA). Le **budget engagé = montant des
commandes déjà passées** (`ORDER_PLACED`) ; le prévisionnel par défaut = total TTC
du devis consolidé (devis + avenants), surchargeable par le conducteur ; restant =
prévisionnel − engagé. La **check-list de lancement** mêle des vérifications
AUTOMATIQUES (dérivées : devis, plans, assurance, budget, date, planning,
décisions, commandes) et des points MANUELS du conducteur. Le verdict « Prêt /
Presque / Pas encore » découle de la check-list (un bloquant ⇒ pas prêt).
**Pourquoi (PO) :** rester simple et déterministe pour cette V1 — pas de
comptabilité avancée, pas de factures, pas de marge chantier ; le cockpit doit
être lisible en 30 secondes.
**Alternatives rejetées :** budget « engagé » incluant main-d'œuvre / factures /
marge (repoussé) ; réécrire l'onglet Préparation existant (on l'a conservé sous le
cockpit — zéro régression).
**Impact / suites :** le **cycle de vie éditable des commandes** (à commander →
commandée → livrée, réception, manquants) reste l'EPIC 19 ; la préparation le LIT
seulement. Nouveaux champs dossier `sousTraitants` / `checklist` /
`budgetPrevisionnel`.

## 03/07/2026 — Stabilisation : le Fil est le récit unique ; rubans de perspective

**Décision :** sprint de stabilisation (aucune nouvelle brique). (1) **Dédoublonnage
Espace client** — le **Fil** devient le récit visuel unique du chantier ; le bloc
« Dernière activité » / « Le récit de votre chantier » (qui rejouait les mêmes
photos que le Fil) est supprimé et remplacé par une section resserrée **« Comptes
rendus & documents »** qui ne garde que les éléments utiles ET absents du Fil
(comptes rendus partagés, documents publiés). Les décisions restent portées par le
bandeau et « Vos choix ». (2) **Clarté des perspectives** — un **ruban « Aperçu »**
en tête des vues Artisan et Espace client indique sans ambiguïté que le conducteur
consulte ce que voit un autre acteur ; les vues « Aujourd'hui » / « Chantier »
restent celles du conducteur (pas de ruban = on est chez soi).
**Pourquoi :** rendre l'application plus propre, plus fluide, plus fiable —
« Le Fil doit devenir le récit unique du chantier » ; l'utilisateur doit comprendre
immédiatement de quel côté il se trouve (conducteur / artisan / client).
**Alternatives rejetées :** supprimer entièrement le bloc d'événements (on perdait
les comptes rendus et documents, absents du Fil) ; renommer les onglets du switcher
(risque de churn et de régression pour un gain moindre que les rubans).
**Impact :** nouveau composant de présentation `PerspectiveRibbon` (apps/demo).
Nouvelle suite `stabilite.test.mjs` (16/16) : balayage multi-chantiers × tous
onglets, client-safety exhaustive (zéro fuite inter-chantiers), rubans de
perspective, parcours Fil (coup de cœur + petit mot), états vides, zéro erreur
console. VISION Art. 8 (le fait, colonne vertébrale ; pas de duplication) et Art. 9
(chacun ne voit que ce qui le concerne).

## 03/07/2026 — Posture CTO/Qualité : dix améliorations discrètes plutôt qu'une brique

**Décision :** nouvelle posture validée par le PO — je challenge chaque écran
avant livraison (utilité, simplification, friction, évidence pour conducteur /
artisan / client, risque de bug/régression/fuite, fidélité à la VISION). On
privilégie de petites améliorations à fort impact ; chaque sprint doit laisser
l'application meilleure, même sans nouvelle fonctionnalité. Je contredis avec des
arguments métier quand une idée est inutile ou trop complexe.
**Pourquoi :** l'objectif n'est pas de vider le backlog vite, mais de construire
le meilleur logiciel de rénovation intérieure — irréprochable.
**Alternatives rejetées :** empiler des fonctionnalités ; exécuter mécaniquement
sans challenge.
**Impact — premières passes livrées sous cette posture :**
(1) Libellés d'état lisibles au journal (`EVENT_STATE_LABEL` : « Publié » au lieu
de l'énum brut « publie »). (2) Compteur du matin « réponses à donner » (au lieu
de « clients à répondre », bancal). (3) Titres de journal « Type · contexte
métier » (`Compte rendu · Gros œuvre`, `Photo · Cuisine`, `Décision client ·
Mobilier`) — la légende photo passe en description, rien n'est perdu ; les
réserves n'ont pas de pièce au modèle, on garde `Réserve n°N` (pas de champ
inventé). (4) Suppression de l'heure inutile au journal, à l'historique et aux
cartes client (date longue « 3 juillet 2026 » ; l'heure reste sur les
conversations du Fil, où elle a du sens). (5) **Ancrage de contexte** persistant
dans l'en-tête (sticky) : `Chantier · {nom}` côté conducteur, `Aperçu artisan ·
{nom}` / `Aperçu client · {nom}` en prévisualisation — on sait toujours sur quel
chantier on travaille ou quel espace on prévisualise. Cet ancrage rend le ruban
`PerspectiveRibbon` redondant : il est **retiré** (simplification nette). Suite
`stabilite.test.mjs` portée à 17/17. VISION Art. 3, 9, 11.

## 03/07/2026 — Repère « Chantier actif » sur la vue Aujourd'hui

**Décision :** sur « Aujourd'hui » (vue multi-chantiers), la carte du chantier que
les onglets Chantier / Artisan / Espace client ouvriront porte un repère discret
(bordure or + pastille « Chantier actif », même règle de cible que `App.tsx` :
sélection courante, sinon le premier chantier). Présentation seule.
**Pourquoi :** c'était le seul angle mort restant — depuis Aujourd'hui, les onglets
agissaient sur un chantier actif invisible. Le repère (avant le clic) et l'ancrage
sticky (après le clic) se renforcent : on ne se demande jamais « quel chantier ? ».
**Alternatives rejetées :** désactiver les onglets tant qu'aucun chantier n'est
choisi (retire un raccourci, change le comportement, plus risqué) — écarté au
profit d'une amélioration purement visuelle, sans nouvelle logique métier.
**Impact :** `AujourdhuiView`/`ChantierCard` (prop `active`, `aria-current`).
`stabilite.test.mjs` 19/19 : la pastille marque le bon chantier, l'Espace client
ouvert depuis Aujourd'hui correspond au chantier actif, et le repère suit la
sélection (non-régression multi-chantiers). VISION Art. 3, 9.
