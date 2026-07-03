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
