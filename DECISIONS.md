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

## 🧭 Journal de terrain — RC1 (observations produit · éphémère)

> **Mode RC1, hors modèle produit.** Ce journal recueille les **enseignements**
> du terrain — ce que le conducteur fait _vraiment_ sur un vrai chantier —, pas
> les bugs ni les décisions techniques. Il est **éphémère** : relu à la fin de
> RC1 pour orienter les prochaines Epics, puis retiré. La référence produit reste
> **VISION.md**.
>
> Grille d'observation (un fait observé, jamais une solution — la solution se
> décide après RC1) : _le conducteur est sorti de PHÉNIX pour… · a cherché… · n'a
> jamais utilisé… · a hésité devant…_
>
> Format d'une entrée :
>
> ```
> JJ/MM — [sorti / cherché / jamais utilisé / hésité] · écran ou geste concerné
> Fait : ce qui s'est passé sur le chantier.
> Lecture produit : ce que ça suggère (sans trancher la solution).
> ```

```
04/07 — cherché · Aperçu client
Fait : le conducteur voulait vérifier ce que voit le client d'un AUTRE chantier
que l'actif ; il se retrouvait bloqué sur le chantier actif.
Lecture produit : l'aperçu client doit être multi-chantiers — « quel chantier je
regarde » doit pouvoir changer sans quitter la vue.

04/07 — hésité · « Le Fil »
Fait : le nom « Le Fil » n'évoque rien de premium ni de client.
Lecture produit : le récit visuel du chantier gagne un nom parlant, orienté client.

04/07 — perdu · Commentaire client sous une photo
Fait : quand un client commente une photo, le conducteur risque de ne jamais le
voir (noyé dans l'espace client).
Lecture produit : un signal doit remonter au conducteur, et l'échange doit pouvoir
se tenir SOUS l'élément partagé (conversation contextuelle, pas une messagerie).

04/07 — friction · Décision client « Je souhaite une modification »
Fait : l'option de demande de modification brouillait la décision.
Lecture produit : garder la décision client nette et rassurante (choisir / valider).

04/07 — posture · Partage aux artisans
Fait : l'app n'est pas encore prête à être mise entre les mains des artisans.
Lecture produit : masquer toute invitation artisan tant que ce n'est pas assumé
(sans rien jeter du travail déjà fait).

04/07 — cherché · Compteurs d'« Aujourd'hui »
Fait : le conducteur clique sur un compteur (« décisions clients ») en espérant
travailler DESSUS ; il n'obtenait qu'un défilement vers la liste de tous les
chantiers, sans voir les éléments concernés.
Lecture produit : un compteur du matin est un outil de tri, pas un simple total —
il doit filtrer la journée sur les seuls chantiers concernés, montrer l'élément
précis, et mener droit au bon endroit du chantier (pas une animation).

04/07 — cherché · Notifications (client ET conducteur)
Fait : une notification (« l'équipe vous a laissé 1 message », « 1 commentaire
client ») menait vers une zone, pas vers l'ÉLÉMENT. Et elle restait tant qu'on
n'avait pas répondu, alors qu'on l'avait déjà lue.
Lecture produit : une notification est un raccourci qui porte une cible précise —
clic = ouvrir le Moment concerné, curseur prêt, et la consultation suffit à
l'éteindre (chacun, conducteur et client, a son propre « lu »).
Tension notée (non tranchée) : côté conducteur, « consulter = éteindre » peut
masquer un commentaire encore SANS RÉPONSE. À surveiller en terrain : faut-il, un
jour, distinguer « lu » de « traité » côté conducteur ? Pour l'instant, un seul
état « lu » — la simplicité prime.

04/07 — cherché · Décisions client — l'AUTRE sens
Fait : quand le client VALIDE un choix (ex. une ambiance), le conducteur ne le
voyait nulle part de façon proactive ; or c'est le signal qui déclenche une
commande, un appel à l'artisan, une mise à jour du planning.
Lecture produit : une décision a DEUX faces — « le client doit agir » (en
attente) et « le conducteur doit agir » (choix validé). Aujourd'hui doit porter
les deux. Ici, contrairement au commentaire, « consulter » ne suffit pas :
c'est une action à engager → on distingue « validé » de « pris en compte », et
seul le geste explicite « Pris en compte » éteint la notification (le radar ne
doit pas retomber sur un simple coup d'œil).

04/07 — cherché · Se repérer dans l'Espace client
Fait : la page client s'allonge (décisions, planning, documents, comptes rendus,
récit, bibliothèque) ; le client défile longuement pour retrouver une section.
Lecture produit : un simple sommaire de puces en haut, qui défile vers la
section, suffit — pas d'onglets, pas d'écran. Une puce ne s'affiche que si sa
section existe (jamais d'entrée creuse). Récit et Bibliothèque étant deux vues
d'une même section, leur puce défile ET bascule la vue (sinon la puce est vide
de sens).

04/07 — cherché · Passer d'un chantier à l'autre en plein suivi
Fait : dans la vue Chantier, le nom du chantier ancré n'était qu'une étiquette ;
pour changer de chantier, le conducteur devait repasser par Aujourd'hui.
Lecture produit : le chantier ancré doit être un vrai SÉLECTEUR — on change de
chantier sans quitter la vue, en gardant l'onglet courant (Suivi/Récit/Réserves…).
Seule exception : la Préparation sans dossier n'a pas de contenu → retour sur
Suivi. À noter (dette de test) : rendre le nom sélectionnable ajoute ses options
au DOM ; un test visait « le nom » par son texte et attrapait désormais l'option
cachée du menu → on cible le TITRE (heading), pas un texte ambigu.

04/07 — cherché · Demander une décision au client depuis le terrain
Fait : dans « Nouvelle mission », le conducteur ne trouvait pas comment demander
un choix au client (carrelage, couleur, luminaire…) alors que c'est courant.
Lecture produit : c'est une entrée « Décision client » dans Nouvelle mission —
pas un module. On RÉUTILISE tout l'existant : une décision = une sélection
proposée (déjà rendue par « Une décision vous attend » + galerie de propositions
avec la délégation PHÉNIX intégrée), validée en un événement décision, suivie par
le radar « choix validés ». Le neuf se limite à un formulaire de saisie et à deux
champs (contexte, photos de la décision).

04/07 — bug de feedback · Coup de cœur
Fait : cliquer « Coup de cœur » ne changeait RIEN à l'écran — le conducteur (et le
client) ne savait pas si le clic était pris en compte.
Lecture produit : l'état « aimé » était bien enregistré (et persistait), mais les
classes de couleur (`text-red-500`, `fill-red-500`) n'existent pas — la palette
de marque REMPLACE les couleurs Tailwind par défaut : ces classes ne produisaient
aucun style. La couleur d'émotion (#e11d48) n'est pas un rôle de marque ; on la
pose en style inline dans l'app (hors garde-fou tokens, comme les dégradés). Le
« pop » se joue en Web Animations API (pas de keyframe globale). Rappel : le coup
de cœur reste SANS compteur (émotion, pas métrique) — décision produit conservée.

04/07 — encombrement · Hauteur des photos du récit
Fait : la qualité des photos n'est pas en cause, mais leur HAUTEUR : une seule
photo mange l'écran, on voit peu de moments, le récit perd en fluidité.
Lecture produit : simple réglage de cadre — la couverture passe de 4/5 (portrait,
h = 1,25 × largeur) à 6/5 (h ≈ 0,83 × largeur, ≈ 33 % plus court), l'image reste
en object-cover (aucun écrasement), coins arrondis et plein écran inchangés. Le
récit se parcourt alors comme un fil social. Le plein écran (galerie) garde son
4/5 : c'est le FLUX qu'on densifie, pas la lecture d'une photo.

04/07 — bug d'ouverture · Documents côté client
Fait : le client clique un document et « rien ne s'ouvre ». Deux causes : (1) les
documents seedés n'ont pas de fichier → aucun lien (mais rien ne le disait) ; (2)
les vrais documents utilisaient `<a download>` (téléchargement silencieux) au lieu
d'ouvrir un aperçu.
Lecture produit : un document AVEC fichier s'ouvre dans un nouvel onglet (titre
cliquable + bouton « Ouvrir le document »), via un Blob (les navigateurs bloquent
la navigation directe vers une URL `data:`). Un document SANS fichier n'affiche
aucun faux lien : « Document disponible prochainement ». Client-safe inchangé (un
document interne ne fuit jamais). Piège technique : `window.open(url,'noopener')`
renvoie toujours `null` → on ouvre par une ancre `target="_blank"`.

04/07 — fluidité · Sprint Fluidité (audit UX, zéro fonctionnalité)
Fait : audit conducteur + client à la recherche de frictions (clics/scrolls/
doublons/hiérarchie/transitions). Deux corrections retenues, minimales :
 • Chantier — suppression du bandeau « Bonjour Mickaël / Projet actuel » : il
   redisait ce que la barre de contexte (« Chantier · … ») et Aujourd'hui disent
   déjà, et repoussait le projet vers le bas. Le projet devient le héros dès
   l'entrée ; « Nouvelle mission » remonte à côté du titre.
 • Transition douce (opacity + 6px, 180 ms, respecte prefers-reduced-motion) au
   changement de grand écran (Aujourd'hui/Chantier/Espace client) : l'app se lit
   comme un tout, sans coupure sèche. Aucun effet sur les changements internes
   (filtre, onglet, chantier).
Rejeté volontairement (challenge) : (a) déplacer/supprimer le sélecteur Récit⇄
Bibliothèque du Récit malgré la puce homonyme du sommaire — puce = saut, bascule
= contrôle local, rôles distincts ; (b) fusionner « Nouvelle mission » et les
grandes actions du Suivi — chevauchement réel MAIS ce serait un changement de
CONCEPT → à discuter avant, pas à trancher seul.

04/07 — cherché · Créer un chantier = déposer, pas remplir
Fait : le parcours par défaut était le FORMULAIRE ; le parcours intelligent
existait mais enfoui derrière un bouton fantôme « Parcours guidé ». Le conducteur
ressaisissait ce que le devis contient déjà.
Lecture produit : deux parcours, INTELLIGENT par défaut. On déposait déjà, PHÉNIX
analysait déjà (scène « prépare » → « prêt ») via un moteur déterministe. On a
juste (a) inversé la prominence (déposer le dossier = action principale ; chantier
vide = échappatoire), (b) formalisé le PORT unique `demo.analyzeDossier` (mock
aujourd'hui, `setDossierAnalyzer` pour un LLM demain, sans toucher aux écrans),
(c) matérialisé les images déposées en Moment « Avant travaux » du Récit, (d)
ajouté l'acompte aux documents détectés. Aucun faux OCR : simulation déterministe,
remplaçable derrière la même signature.
```

---

## 03/07/2026 — EPIC 1 : un véritable espace « Préparation », éditable, sur tout chantier

**Décision :** la Préparation devient un vrai bureau de préparation, disponible sur
**chaque** chantier (y compris créé à la main : `demo.ensureDossier` crée un dossier
vide amorcé depuis les infos + la feuille de route standard) et **entièrement
éditable**. Le **dossier** est l'agrégat de préparation, distinct du Journal
append-only : c'est un document de travail qu'on édite directement (`saveDossier`) ;
les actions vers le client (demande de document, envoi de décision) passent, elles,
par le Journal. Sections : cockpit « prêt à démarrer ? », note de lancement,
**coordonnées & accès client** (éditable, synchronise nom client + adresse du
chantier), devis + avenants, **feuille de route & jalons** (ajout), planning
prévisionnel, **intervenants** (artisans + fournisseurs, contact, CRUD),
**commandes** (ajout + fiche complète), décisions client, propositions, choix,
**documents catégorisés** (devis/plan/diagnostic/DPE/assurance/contrat) avec **vrais
fichiers** (Lot 3) et demande au client, **photos avant travaux**, check-list.
**Ajouts core :** `Project.address` (déjà), `ProjectDocument.categorie` +
`attachment`, `PrepDocCategory`, `Fournisseur`, `SousTraitant.contact`,
`ProjectDossier.fournisseurs`.
**Pourquoi :** « avant le premier coup de marteau, préparer entièrement le
chantier » — un espace, pas un formulaire, où le conducteur sent que PHÉNIX
travaille avec lui. VISION Art. 1, 3, 7, 11.
**Alternatives rejetées :** garder la Préparation réservée aux chantiers issus du
parcours guidé (démo) ; laisser les documents sans fichier ; dupliquer les
intervenants (le cockpit en avait un bloc — **retiré** au profit de la section
dédiée unique, pour éviter le doublon).
**Impact :** `ensureDossier`, `CoordonneesCard`, `IntervenantsSection`,
`PrepDocuments` (+ photos avant), `DossierPanel` augmenté, Préparation ouverte sur
tout chantier (`CompagnonView`). `prep.test.mjs` 11/11 (préparer, coordonnées,
intervenants, documents avec fichier, demande client, photos avant, jalons,
commandes, persistance, client-safe). Non-régression : preparation 9/9 + 12 autres
suites (141 assertions), zéro erreur console.

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

## 03/07/2026 — Compteurs du matin actionnables (raccourci, pas routage)

**Décision :** chaque compteur du matin (« réserves à lever », « réponses à
donner »…) devient, quand il est > 0, un **raccourci** répondant à « où dois-je
regarder ? » : clic → défilement vers « Mes chantiers » + **pulsation** temporaire
des cartes qui alimentent ce compteur. Les compteurs à 0 ne sont pas cliquables
(aspect inchangé).
**Pourquoi :** les compteurs sont des **agrégats multi-chantiers** — ils n'ont pas
de destination unique. Router vers un onglet serait faux (le travail est réparti)
et incohérent (seules les réserves ont un onglet dédié). On relie l'agrégat (« le
quoi ») au détail déjà affiché par les cartes (« le où »), sans rien inventer.
**Alternatives rejetées :** router vers un onglet (ne généralise pas, parfois
faux) ; filtrer la liste (masque des chantiers, exige un état + un « retirer le
filtre » = usine à gaz).
**Impact :** présentation seule dans `AujourdhuiView` (helper `focusCounter` +
`scrollIntoView` + `animate`, motif déjà utilisé côté client ; ids `mes-chantiers`
/ `chantier-{id}`). Aucune logique métier, aucun état persistant.
`stabilite.test.mjs` 21/21 : compteur > 0 = raccourci en page (reste sur
Aujourd'hui, « Mes chantiers » à l'écran) ; compteur à 0 non cliquable. VISION
Art. 3 (piloter sa journée), Art. 7/8 (tout dérive des faits, rien d'inventé).

## 03/07/2026 — Cohérence du Journal du chantier (lisibilité)

**Décision :** stabilisation du Journal / Historique (aucun nouveau module, aucune
refonte, append-only intact). (1) **Libellés voix conducteur** : « Une décision
vous attend » → « Décision attendue du client » (le « vous » parlait au client) ;
« Demande » → « Question du client ». (2) **Badges harmonisés** via un helper de
présentation unique `journalStatut` : un seul badge par ligne, casse et sémantique
unifiées (à traiter = ambre, fait = vert) — Brouillon, En attente, Traitée,
Ouverte, Levée. Le badge **« Publié » est masqué** (tout est publié par défaut : il
n'informait pas et écrasait les états utiles). Le badge « Interne » (visibilité)
reste, distinct. (3) **Actions plus visibles avec hiérarchie** : « Lever la
réserve » devient un bouton plein or (action posée par le conducteur), « Voir la
photo » un bouton contour (navigation) — fini les liens soulignés discrets.
**Pourquoi :** rendre le Journal exploitable au quotidien — chaque type se comprend
en moins de 10 s, sans doublon visuel. Le Journal est une **mémoire de chantier**,
pas une pile d'événements.
**Alternatives rejetées :** garder « Publié » (bruit, validé par le PO pour
suppression) ; router les actions ailleurs (elles vivent au bon endroit, dans la
ligne).
**Impact :** `eventText.ts` (libellés + `journalStatut`), `CompagnonView`
(SuiviTab) et `HistoriqueView` partagent le même langage visuel. Présentation
seule : `isVisibleToClient` inchangé, **client-safe** vérifié (les libellés de
demande ne remontent jamais côté client). Nouveau `journal.test.mjs` 9/9 (titres,
badges, actions, dialogue de levée, historique, client-safe). VISION Art. 8 (les
vues sont des projections du Journal), Art. 10 (rien ne tombe), Art. 11 (simplicité).

## 03/07/2026 — AttentionPanel : un radar de blocages, pas une liste

**Décision :** « PHÉNIX surveille votre chantier » répond à une seule question —
« qu'est-ce qui bloque réellement mon chantier maintenant ? ». (1) Le radar
n'affiche que les items **`warning`** (blocages réels), **3 au maximum**, triés par
priorité (décision, avenant, commande, document). Les items `info` (phases à venir,
questions PHÉNIX, docs « à fournir plus tard ») **sortent du radar** — ils vivent
dans la Préparation / le planning. Suppression du « Voir tout (N) » ; s'il reste des
blocages au-delà de 3, un simple pointeur « + N à traiter → Préparation » (Art. 10 :
rien ne tombe). (2) Message d'avenant **raccourci** et orienté action (« Avenant n°1
— à répercuter sur le planning et les commandes. ») : les chiffres sont déjà dans le
badge +ajoutées/~modifiées (fin du doublon). (3) Bouton d'action « Ouvrir » passé de
ghost gris à **contour** lisible.
**Pourquoi :** un radar montre ce qui mérite l'attention _maintenant_, pas « toutes
les choses possibles ». Lisible en < 10 s.
**Alternatives rejetées :** garder les items `info` repliés derrière « Voir tout »
(validé par le PO pour suppression) ; retirer la décision du Journal pour éviter le
doublon (le radar est une LOUPE de triage, le Journal le registre — le recoupement
est voulu, on ne touche pas au Journal).
**Impact :** `AttentionPanel` (présentation + tri), `describeAvenantImpact` (core,
message court — ne sert que le radar). Sélecteur déterministe inchangé, **rien
d'inventé**, **client-safe** vérifié (le radar est interne, jamais côté client).
Nouveau `attention.test.mjs` 8/8. VISION Art. 3, 7, 10, 11.

## 03/07/2026 — App réelle locale · Lot 1 : la démo devient un choix

**Décision :** au tout premier lancement, PHÉNIX n'impose plus le chantier de
démonstration. Un **écran de bienvenue** propose deux voies : **« Découvrir la
démonstration »** (charge un chantier complet) ou **« Démarrer à vide »** (espace
de travail propre, prêt pour de vrais chantiers). Le choix se fait une fois
(marqueur `SEEDED_KEY`) ; « Recharger la démo » et « Repartir de zéro » restent
disponibles à tout moment.
**Pourquoi :** l'objectif passe de « regarder une démo » à « utiliser PHÉNIX pour
de vrai ». La 1ʳᵉ étape est de pouvoir démarrer sur un espace vierge, sans données
de démo à effacer.
**Alternatives rejetées :** garder l'auto-chargement de la démo (impose la démo) ;
un simple bouton « vider » sans écran de choix (moins clair au premier contact).
**Impact :** `store.ts` — `snapshot.seeded`, `startBlank()`, `clearWorkspace()`
factorisé ; suppression de l'auto-seed. `App.tsx` rend `Welcome` tant que
`!seeded`. Présentation seule, aucune logique métier, persistance localStorage
inchangée. `reel.test.mjs` 7/7 (bienvenue, à vide, persistance, démo via CTA et via
bienvenue, repartir de zéro). Premier lot du sprint « App réelle locale » (suite :
création/édition de chantier réel, export/import local, vrais fichiers). VISION
Art. 2, 11.

## 03/07/2026 — App réelle locale · Lot 2 : création/édition d'un chantier réel

**Décision :** on peut créer son propre chantier **à la main**, sans démo et sans
tunnel : un petit formulaire premium (`ChantierForm`, Dialog) — **nom, client,
adresse, étape de départ** — crée un vrai chantier vide via les ports
`createProject`/`addMember` et on **atterrit directement dedans**. Les infos sont
**modifiables** ensuite (même formulaire pré-rempli, « Modifier le chantier actif »
dans Gérer). Compatible Aujourd'hui / Chantier / Espace client sans dossier de prep.
**Ajouts modèle (core, minimes) :** `Project.address?`, `NewProject`/`ProjectPatch`
acceptent `address` et `currentStep` (étape de départ). Le cache d'avancement ne
« recule » plus : `refreshCurrentStep` conserve l'étape saisie tant qu'aucun compte
rendu ne la fixe (`currentStep(events) ?? project.currentStep`).
**Pourquoi :** rendre PHÉNIX utilisable pour de vrai — « je veux créer mes chantiers,
pas regarder une démo ». Simple et rapide, pas d'onboarding.
**Alternatives rejetées :** détourner `PhenixStart` (le flux guidé « dépose un
dossier ») pour la création simple (trop lourd — il reste dispo en « Parcours
guidé ») ; stocker l'adresse dans un dossier minimal (déclencherait un cockpit de
préparation inutile pour un chantier vide).
**Impact :** `store.createChantier`/`updateChantier` ; `ChantierForm` ; `App`
(entrées « Créer un chantier » / « Modifier », `NoProject` recadré chantier) ;
`ProjectHero` affiche l'adresse. Persistance localStorage inchangée, reset OK,
**aucune régression démo**. `chantier.test.mjs` 10/10 (créer, atterrir, éditer,
persistance, reset, démo intacte, multi-vues). VISION Art. 2, 11.

## 03/07/2026 — App réelle locale · Lot 4 : sauvegarde / restauration locale

**Décision :** on peut **exporter** tout l'espace de travail en un fichier `.json`
et **importer** une sauvegarde pour restaurer l'état complet. Deux boutons dans
« Gérer » (section « Sauvegarde locale ») : _Exporter mes données_ (télécharge
`phenix-360-sauvegarde-AAAA-MM-JJ.json`) et _Importer une sauvegarde_. Une **source
unique** `WORKSPACE_KEYS` couvre toutes les clés (chantiers/journal, noms, projet
actif, dossiers, épingles, **tout le Fil** photos localStorage comprises,
conversations PHÉNIX, partages) — export, import et « vider » partagent la même
liste, donc rien n'est oublié.
**Sécurité :** import = **restauration complète** (remplace l'état, retire les clés
absentes de la sauvegarde) ; **validation stricte AVANT toute écriture** (marqueur
`app: 'phenix-360'` + objet `data`) → un fichier invalide affiche un message clair
et **ne modifie rien** (aucune perte silencieuse) ; **confirmation obligatoire**
avant de remplacer les données (« Remplacer mes données », action irréversible).
**Pourquoi :** pouvoir tester PHÉNIX avec de vrais chantiers sans peur de perdre ses
données — le filet de sécurité AVANT d'ajouter de vrais fichiers (Lot 3).
**Alternatives rejetées :** import fusionnel (ambigu, risque d'état incohérent) ;
import direct sans confirmation (perte accidentelle) ; cloud / compte (hors cadre —
100 % local).
**Impact :** `store.exportWorkspace`/`importWorkspace` + `WORKSPACE_KEYS` ;
`ManageDialog` (téléchargement Blob, `<input type=file>` caché, étape de
confirmation avec message d'erreur). `backup.test.mjs` 8/8 (créer, exporter,
fichier invalide sans perte, reset, confirmation, restauration complète, démo
intacte). VISION Art. 8 (le journal, source unique — ici sérialisée), Art. 11.

## 03/07/2026 — App réelle locale · Lot 3 : vrais fichiers (photos / documents)

**Décision :** on peut charger de VRAIS fichiers, stockés 100 % en local. Les
photos du Fil et des missions étaient déjà réelles (`mediaUploader` : compression
canvas → data URL base64) ; on complète : (1) `EventAttachment.dataUrl?` (aperçu
local, parallèle à `FilPhoto.imageUrl`) ; (2) `PhotoTile` affiche la vraie image
quand elle existe (sinon dégradé) ; (3) le Composer « Ajouter des photos » /
« Ajouter un document » upload de vrais fichiers (aperçu miniature / nom de
fichier) au lieu de pièces jointes synthétiques ; (4) `DocumentLink` ouvre le
document local (journal + Espace client). Nouveau `lib/upload.ts` :
`readPhotoAttachment` (images compressées) / `readDocumentAttachment` (PDF ou
image).
**Sécurité / limites :** images compressées (≤ 1600 px) donc légères ; limite
d'entrée image **15 Mo**, document **2 Mo** (localStorage ~5 Mo) ; **message clair
si trop lourd, rien n'est publié** (aucune perte silencieuse). Le `visibility`
(client/interne) gate l'événement entier via `isVisibleToClient` : la `dataUrl`
d'une pièce interne n'atteint jamais le client (**client-safe inchangé**). Les
fichiers (base64) vivent dans les mêmes clés localStorage → **compatibles
export/import du Lot 4**.
**Pourquoi :** utiliser PHÉNIX avec ses vraies photos et documents, en local.
**Alternatives rejetées :** cloud / Supabase / stockage externe (hors cadre) ;
laisser les documents sans fichier réel (aperçu impossible).
**Impact :** `attachment.ts` (core, `dataUrl`), `lib/upload.ts`, `PhotoTile`,
`Composer`, `DocumentLink`, `MomentCard`, `CompagnonView` (lien document au
journal). `files.test.mjs` 7/7 (photo réelle affichée, document + lien, document
côté client, fichier trop lourd bloqué, interne non fuité, fichiers dans l'export).
VISION Art. 4/5 (capture), Art. 8, Art. 9, Art. 11.

## 03/07/2026 — Bureau mobile · EPIC Communication & Contacts (V1 deep-links)

**Décision :** faire de PHÉNIX le point de départ des communications du
conducteur, sans jamais devenir une messagerie. Un **annuaire** réutilisable
(modèle `Contact` dans core, hors Journal — c'est un carnet, pas un fait de
chantier), un **carnet par chantier**, et des **actions en deep-links natifs**
(`tel:` / `sms:` / `https://wa.me/` / `mailto:` / Google Maps). L'app native
s'ouvre ; PHÉNIX ne l'intègre pas. **100 % local, aucun backend, aucun envoi
réel.** Messages **pré-remplis déterministes** (aucune IA) : PHÉNIX propose, le
conducteur ajuste et envoie (Art. 7).
**Traçabilité :** toute action lancée depuis un chantier est journalisée
(`appendEvent` type `communication`), **append-only** et **toujours `interne`** :
`isVisibleToClient` la rejette par construction (première garde `visibility !==
'client'`), donc **jamais de fuite côté client** (Art. 9). L'historique des
échanges se lit par contact (`communicationsOf`), pas dans la timeline des jalons.
**Choix d'affichage :** `communication` n'est **pas** un `isMilestone` — la
communication est une trace utile, surfacée dans la fiche contact, sans encombrer
l'Historique du chantier. Sans chantier (annuaire global d'un contact non lié),
on n'écrit rien au Journal : l'app native s'ouvre quand même.
**Contacts vs `intervenants` (EPIC 5) :** l'annuaire (`Contact`, réutilisable,
avec actions et historique) **coexiste** avec les intervenants texte du dossier
(sous-traitants / fournisseurs de la Préparation, déjà stabilisés à 141
assertions). On n'a **pas** fusionné pour ne pas déstabiliser EPIC 5 ; une
consolidation « intervenant = référence à un contact » est notée pour plus tard.
**Pont réserve → annuaire :** quand le `responsable` (texte libre) d'une réserve
correspond à un contact (nom / société), PHÉNIX propose de le joindre — sans
ressaisie (Art. 6).
**Alternatives rejetées :** messagerie intégrée / envoi serveur (hors cadre V1,
imposerait un backend) ; API WhatsApp Business (compte, coût, hors local) ;
journaliser les communications comme jalons visibles (bruit dans l'Historique) ;
exposer l'annuaire au client (Art. 9).
**Impact :** core `contact.ts` (+ `Event` type `communication`, mappers) ;
`lib/contactActions.ts`, `lib/commTemplates.ts` ; `components/contacts/*`
(`ContactActions`, `ContactCard`, `ContactEditor`, `CarnetChantier`) ;
`surfaces/Annuaire.tsx` (bouton d'en-tête) ; `store` (`saveContact`,
`deleteContact`, `toggleContactProject`, `logCommunication`, sélecteurs
`contactsOf` / `communicationsOf`) ; intégration `DossierPanel` + `ReservesView` ;
contacts seedés. `contacts.test.mjs` 10/10, 14 suites de non-régression au vert,
zéro erreur console. VISION Art. 1, 2, 6, 7, 9, 11.

## 04/07/2026 — Phase de consolidation · Contacts = base unique (fin du texte libre)

**Contexte :** le PO ouvre une **phase de consolidation** (« plus jamais de
duplication ; je préfère supprimer 500 lignes qu'en ajouter 5 000 »). Audit des 5
bases visées : **Interventions** (réunion/visite/réception/SAV) sont **déjà** un
seul `Moment.type` (union fermée ; `MissionKind` sous-ensemble vérifié à la
compilation) et **Communication** est **déjà** une base unique (événement
`communication` + `Contact`). → 2 des 5 « doublons » n'existaient pas ; on ne
facture pas de travail fictif. Restait 3 vraies consolidations : **Contacts** (ce
lot), Documents, Photos.

**Décision (Contacts) :** l'annuaire (`Contact`) devient la **source unique** des
personnes. Fin du texte libre pour les objets **durables de pilotage** :

- **Intervenants du chantier** : suppression des modèles `SousTraitant` /
  `Fournisseur` et de `dossier.sousTraitants/fournisseurs` + du composant
  `IntervenantsSection`. Le **Carnet du chantier** (Contacts liés au projet) est
  la liste unique. `Contact` gagne `trade` (corps d'état / fourniture).
- **Réserve** : `responsable` (texte) → `responsableContactId` (sélecteur
  `ContactPicker`). Suppression du **matching flou** `matchContact` : le pont
  réserve→contact est désormais un **lien réel**.
- **Commande** : `fournisseur` (texte) → `fournisseurContactId` (sélecteur).
- **Client** : `Contact.userId` incarne le membre client. L'identité qui pilote
  le client-safe reste `Project.clientId` (choix PO « annuaire opérationnel,
  client référencé ») ; ses coordonnées s'éditent **une seule fois** sur son
  contact (`CoordonneesCard` → `ContactEditor`). `dossier.infos` ne porte plus que
  les infos du **bien** (type, surface, budget, durée, début).

**Frontière produit tenue (validée PO) :** la **capture de mission** reste en
**langage naturel** — le conducteur raconte, PHÉNIX structure (VISION Art. 4/5/11).
Imposer un sélecteur de contact dans le récit réintroduirait un formulaire et un
matching flou. Le pont se fait **en aval** : la réserve née d'une mission s'assigne
à un contact au registre.

**Dénormalisation assumée (read-model) :** un nom lisible reste mis en cache à côté
de l'id (`Order.fournisseur`, `Reserve.responsable`) pour la recherche/mémoire de
l'assistant et les instantanés append-only. **La source éditable unique est le
Contact** ; l'UI résout le nom vivant via l'id ; `saveContact` rafraîchit les
caches des commandes (dossier mutable) et le nom affichable du client (`people`).
Les événements (réserves) sont append-only : leur nom figé reste, l'affichage
résout toujours le nom vivant par l'id.

**Alternatives rejetées :** déplacer `Contact` dans l'état core maintenant
(migration lourde d'une base tout juste introduite, risque de déstabilisation) ;
fusion totale de l'identité client dans l'annuaire (exposerait le pilotage du
client-safe à un carnet éditable) ; forcer les présents de mission en contacts
(casse la capture signature).

**Suite (à faire) :** Consolidation 2 — **Documents** (une bibliothèque ;
Préparation/Journal/Client = vues ; la checklist `ProjectDocument` vs les fichiers
`document`). Consolidation 3 — **Photos** (`FilPhoto` vs `EventAttachment` →
forme canonique + tags). Mode Artisan pourra ensuite dériver sa liste d'artisans
des Contacts (aujourd'hui : noms de responsables + intervenants).

**Impact :** core `contact.ts` (+trade +userId), `prepare.ts` (−SousTraitant,
−Fournisseur, −champs summary, Order.fournisseurContactId), `event.ts`
(reserve/action.responsableContactId) ; demo `ContactPicker` (nouveau),
`ContactEditor` (+trade, +initialRole, +onCreated, préserve userId),
`CoordonneesCard` (édite le contact client), `DossierPanel`/`ReservesView`
(sélecteurs), `store` (upsertClientContact, ensureClientContact, caches),
`seed`. Suites au vert : preparation 9/9, reserves 7/7, **consolidation 7/7**,
aujourd'hui 9/9, attention 8/8, mission 14/14, journal 9/9, artisan 8/8, moment
13/13, stabilité 21/21. Gate (typecheck/lint/prettier/build) vert. VISION Art. 2,
6, 7, 9, 11.

## 04/07/2026 — Consolidation 2 · Documents = une bibliothèque, trois vues

**Audit :** Journal et Client étaient **déjà** une seule base (événement `document`

- `visibility` = la vue ; sélecteur `vault`). Le vrai doublon : la **préparation**
  stockait ses fichiers sur `ProjectDocument.attachment` (base64) **sans créer
  d'événement** → un document préparé restait siloté (invisible au Journal et au
  client), et le même fichier pouvait exister en double.

**Décision (choix PO « suivi d'obtention pointant vers la bibliothèque ») :** le
`document` event du Journal (`vault`) est la **base UNIQUE des fichiers**. Déposer
un document en préparation crée désormais un événement `document` (INTERNE par
défaut, client-safe) ; la **checklist** du dossier ne stocke plus le fichier : elle
suit l'obtention et **pointe** vers l'événement (`ProjectDocument.eventId`).
Préparation / Journal / Client ne sont que des **vues** de cette base.

**Effet concret :** un document préparé **remonte au Journal** (fini le silo) ;
un fichier n'existe qu'une fois. Le verdict « prêt à démarrer » est préservé (la
checklist garde ses statuts attendu / demandé / fourni). `ProjectDocument.attachment`
devient **déprécié** — encore utilisé par la catégorie `photo_avant` en attendant
la **Consolidation 3 (Photos)**, où les photos avant travaux rejoindront la base
photo unique.

**Dénormalisation assumée :** la checklist garde `label`/`categorie`/`status` à
côté de l'`eventId` (métadonnées d'obtention) ; le fichier, lui, est unique.

**Alternatives rejetées :** tout collapser dans la bibliothèque (perdrait le suivi
des documents attendus DPE/assurance — régression de préparation) ; garder les
fichiers sur le dossier et projeter le Journal depuis lui (viole Art. 8, journal
source de vérité).

**Impact :** core `ProjectDocument` (+`eventId`, `attachment` déprécié) ; store
`addPrepDocument` (crée l'événement + lie la checklist) ; `PrepDocumentsSection`
(dépôt → bibliothèque, résolution du fichier via l'événement). Gate vert
(typecheck/lint/prettier/build). `documents.test` 5/5 (dépôt → fourni + fichier
ouvrable, remontée au Journal, client-safe), preparation 9/9. VISION Art. 7, 8, 9.

## 04/07/2026 — RC1 : commentaires client → conducteur (sans read/unread, sans messagerie)

**Décision (retours terrain 7 & 8) :** un commentaire client ne doit jamais se
perdre. Le conducteur est SIGNALÉ dans « Aujourd'hui » (badge « N commentaire(s)
client » sur la carte chantier), le clic ouvre **droit sur le Récit**, et le
Moment concerné porte « Nouveau commentaire du client ». Le conducteur **répond
dans le fil contextuel** déjà existant sous le Moment (aucune messagerie globale).

**Mécanique :** aucun modèle « lu / non-lu » — l'état est **dérivé de l'ordre des
messages** : un Moment est « en attente » si le DERNIER message de son fil est du
client (`pendingClientMoments`). Répondre suffit à vider le signal (le message du
conducteur devient le dernier). Réversible, sans nouvelle donnée persistée.

**Sans nouvel écran ni concept :** on réutilise Aujourd'hui, la carte chantier,
l'onglet Récit, le fil de messages existant (le client commentait déjà, le
conducteur pouvait déjà répondre — ce qui manquait, c'était le SIGNAL).
**Alternatives rejetées :** centre de notifications dédié (nouvel écran) ;
messagerie globale (hors contexte) ; drapeau lu/non-lu persisté (état en plus).

**Impact :** store `pendingClientMoments` / `pendingClientCommentCount` ;
`AujourdhuiView` (badge + ouverture ciblée), `App`/`CompagnonView` (onglet
d'ouverture imposé), `FilView`/`FilMoment` (marqueur conducteur). `comments.test`
7/7. VISION Art. 3, 9, 11.
