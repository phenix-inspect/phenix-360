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

04/07 — friction · Un seul « Nouveau chantier », scène + synthèse
Fait : deux boutons (« vide » / « déposer le dossier ») imposaient un choix
inutile en amont ; et « C'est prêt » ne montrait presque rien de ce que PHÉNIX
avait construit.
Lecture produit : UN SEUL parcours « Nouveau chantier ». On dépose → si documents,
PHÉNIX analyse ; sinon, bascule naturelle en création rapide (nom/client/adresse)
sur le MÊME écran, avec un bouton qui s'adapte. La scène « prépare » est enrichie
(chaque étape révèle le RÉEL trouvé : client, adresse, N étapes/commandes/choix…).
Et « C'est prêt » devient un écran de SYNTHÈSE (client, bien, planning, commandes
+ fournisseurs, décisions, documents, photos avant travaux, alertes) avant
d'entrer — « Ajuster le dossier » reste dispo pour le détail. Moins de choix en
amont, plus de preuve de travail.

04/07 — cherché · Où en est CE chantier ? (statut métier)
Fait : le conducteur savait ce qu'un chantier avait à traiter (compteurs), mais
pas d'un coup d'œil OÙ il en est dans son cycle de vie (pas commencé → clôturé) ;
et il ne pouvait pas isoler « mes chantiers en cours » des autres.
Lecture produit : rien de neuf à inventer — `Project.status` existait déjà comme
propriété MÉTIER saisie à la main (distincte de l'avancement dérivé). On l'a juste
recalé sur les 5 statuts réels du terrain (Pas commencé / En cours / Pré-réception
/ Levée des réserves / Clôturé) et rendu VISIBLE et pilotable, sans écran ni
concept en plus : badge coloré au coup d'œil sur chaque carte et dans le héros du
chantier (donc aussi côté aperçu client), barre de filtres au-dessus de « Mes
chantiers » qui filtre la liste à l'instant (chips avec compteurs, seuls les
statuts présents), et un simple dropdown sur l'écran chantier pour la transition
— MANUELLE (le conducteur décide ; l'IA proposera plus tard). Source de vérité
unique : le même `status` alimente Aujourd'hui, le chantier, l'aperçu client et
l'export/import. Rejeté (challenge) : un écran « Liste des chantiers » — Aujourd'hui
reste le seul point d'entrée, on l'enrichit, on n'ajoute pas de page.

04/07 — cherché · Retrouver le bon dossier quand il y en a beaucoup (filtres)
Fait : à 3 chantiers ça va ; à 20, « Mes chantiers » devient une liste à faire
défiler. Le conducteur veut isoler vite : par statut, par ville, par client, par
« ce qui reste à faire » (Art. 3 piloter la journée, Art. 10 ne rien laisser
tomber).
Lecture produit : Aujourd'hui devient un vrai tableau de pilotage, sans nouvel
écran. Défi UX assumé (Art. 11) : quatre filtres visibles en permanence
alourdiraient l'écran. On garde donc le STATUT en puces toujours visibles (le tri
le plus fréquent, au coup d'œil) et on REPLIE ville / client / urgence derrière un
bouton « Filtres » (badge du nombre d'affinages actifs). Tout se combine, à
l'instant ; « Réinitialiser » remet à plat ; le titre compte les chantiers
affichés (« 2 sur 3 ») ; « aucun résultat » affiche un message clair + une sortie.
Rien d'inventé : la ville est DÉRIVÉE de l'adresse (jamais de valeur creuse si
l'adresse manque), le client vient du carnet, l'urgence relit les mêmes compteurs
que le matin. Dette réglée au passage : l'adresse du chantier principal ne vivait
que dans le dossier — on la porte aussi sur le projet pour que la ville se dérive.

04/07 — bloquant · « PHÉNIX ne lit pas vraiment mon devis »
Fait : en déposant un vrai devis, le conducteur voit un dossier riche… mais
FABRIQUÉ (Maison Dubois), sans rapport avec son PDF. L'analyse ne lisait que le
NOM du fichier et rejouait un scénario. Rupture de confiance : « si ça invente
ici, où d'autre ça invente ? »
Lecture produit : on remplace la SIMULATION par une LECTURE RÉELLE, dans le port
d'analyse existant (pas de nouvel écran, pas de nouveau concept). L'extraction
texte du PDF est 100 % locale (aucun réseau, aucune dépendance : flux de contenu
+ décompression FlateDecode via l'API navigateur `DecompressionStream`) ; un
module pur `extractDevisFields` en tire, par motifs déterministes, le client,
l'adresse, le montant (HT/TTC), la date, les prestations/lots, les pièces, les
matériaux, les délais, l'acompte et l'entreprise émettrice. RÈGLE D'OR : ne jamais
inventer — un champ non trouvé reste « non détecté », et un PDF scanné (sans
couche texte) est annoncé clairement (« Ce devis semble être une image. Je ne peux
pas encore le lire automatiquement. »). L'écran « PHÉNIX prépare » gagne une carte
« Lecture réelle du devis » (détecté / non détecté / indice de confiance). La
feuille de route est DÉRIVÉE des lots réellement lus ; commandes et choix restent
vides tant qu'on ne peut pas les extraire honnêtement (ce sera le rôle du LLM, à
brancher derrière le même port `setDossierAnalyzer`, sans toucher aux écrans). On
échange donc une démo « riche mais fausse » contre une lecture « juste, parfois
partielle » — la confiance prime.

05/07 — besoin · Pouvoir recommencer proprement (supprimer un chantier)
Fait : chantier créé par erreur, analyse de devis ratée, envie de repartir net —
mais aucun moyen de supprimer UN chantier (seul « Repartir de zéro » existait, et
il efface TOUT). Le conducteur reste coincé avec des chantiers fantômes.
Lecture produit : action destructive PROTÉGÉE, sans nouvel écran. Un bouton
« Supprimer » (poubelle) dans « Gérer » (n'importe quel chantier, en liste) et sur
la fiche du chantier actif, tous deux ouvrant une simple confirmation
(« supprime le chantier et toutes ses données locales · irréversible »). 100 %
local, aucun backend : on retire la colonne vertébrale (projet + membres +
événements, via un vrai `deleteProject` ajouté au port) PUIS toutes les données
rattachées par `projectId` (dossier, pins, Fil/récit, conversation PHÉNIX,
partages) et les marqueurs device-local (choix pris en compte, accusés de lecture).
Deux garde-fous : (a) les CONTACTS sont globaux — on ne retire que le LIEN vers ce
chantier ; un contact encore rattaché ailleurs (ou global sans lien) n'est jamais
supprimé ; (b) si le chantier supprimé était actif, on bascule vers un autre, ou
vers l'état vide s'il n'en reste aucun. Export/import restent cohérents (mêmes
clés). La suppression complète le cycle de vie : créer, lire, ajuster, supprimer.

05/07 — bloquant · « PHÉNIX ne lit AUCUN de mes vrais devis »
Fait : après test terrain, les devis du logiciel officiel (Phenix-amo) ne sont pas
lus. Diagnostic : ce sont des PDF à polices CID Identity-H — le flux de contenu ne
contient que des IDENTIFIANTS DE GLYPHES, pas du texte ; le vrai texte vit dans les
tables `ToUnicode`, avec des ressources de police résolues par page/XObject.
L'extracteur maison (latin1 + FlateDecode) ne pouvait structurellement pas les lire.
Lecture produit : on passe à un VRAI moteur PDF (pdf.js), 100 % local (worker
embarqué par Vite, aucun réseau) — build LEGACY pour la compatibilité navigateurs
(le build moderne exige `Math.sumPrecise`, trop récent). Puis, comme « je préfère
une extraction fiable sur MON format qu'une générique moyenne », on ajoute un
LECTEUR EXPERT dédié au format Phenix-amo (détecté par l'en-tête / le n° « D-
AAAAMM-NNN ») : bloc client (« M./Mme Nom / rue / CP Ville »), n° et date, montant
« Total TTC », lots RÉELS du tableau, « Durée estimée », « Acompte de X % ». Vérifié
sur les 3 devis réels → client, adresse, montant, date, émetteur, lots, délais,
acompte corrects, confiance 100 %, zéro invention. Le générique reste le fallback.
Honnêteté maintenue : si un PDF n'a pas de couche texte (scan), message précis
(« lisible à l'écran mais texte non extractible… ») + on n'est jamais bloqué — on
peut COLLER le texte du devis à la main (même port d'analyse). Fixture de test
anonymisée reproduisant la mise en page réelle (pas de vrai devis embarqué).

05/07 — friction · « Je reste bloqué dans la création d'un chantier »
Fait : entré dans l'édition d'un nouveau chantier, le conducteur ne trouvait pas la
sortie. Il ne doit JAMAIS être coincé dans un flux.
Lecture produit : le logo PHÉNIX (déjà en tête) devient l'échappatoire universel —
un clic ramène à « Aujourd'hui ». S'il y a des données non enregistrées (création/
édition en cours), on confirme d'abord (« Quitter la création du chantier ? Les
données non enregistrées seront perdues. ») ; sinon retour direct. Pas de nouvel
écran : on rend cliquable un élément déjà présent.

05/07 — QA · Passe de durcissement avant retest (casser l'app volontairement)
Fait : avant un retest « comme une démo client demain matin », on pousse les tests
loin — fichiers cassés (PDF non-PDF, PDF vide, mauvais format), flux abandonnés,
reload en plein milieu, import invalide, plus AUCUN chantier, et 3 formats d'écran
(iPhone / tablette / desktop). Quatre nouvelles suites e2e durables : `robustesse`,
`mobile`, `mission` (capture → PHÉNIX comprend → valider), `client-concierge`
(+ client-safe strict). Toutes dans `apps/demo/e2e/`, lancées par
`pnpm --filter @phenix360/demo test:e2e`.
Bug trouvé & corrigé : sur écran étroit (390 px), la barre d'onglets du chantier
(Suivi/Préparation/Récit/Réserves/Historique) débordait de ~60 px → scroll latéral
de toute la page. Correctif dans le design system : la `TabsList` défile désormais
horizontalement (`max-w-full overflow-x-auto`, onglets `shrink-0`) au lieu de
pousser la page. Aucun autre débordement, aucune modale bloquée, aucune erreur
console. Résultat : 26 suites vertes (~230 vérifications). Les autres écarts
rencontrés étaient des sélecteurs de test, pas des bugs applicatifs.

05/07 — recadrage · Planning client trop détaillé (retour au premium)
Fait : le planning client montrait le chantier LOT PAR LOT (plomberie, peinture,
électricité…) avec des dates par étape — trop technique, et surtout un engagement
implicite (« vous aviez prévu le carrelage mardi »). Le client ne veut pas exécuter
le chantier, il veut savoir OÙ EN EST son projet.
Lecture produit : on garde l'écran Planning, on SIMPLIFIE son contenu (pas de
nouvel écran ni concept). Le planning client devient 5 grands jalons de cycle de
vie — Projet validé · Préparation · Démarrage · Pré-réception · Réception —,
JAMAIS les lots (le détail est réservé à Léon : « où en est la salle de bain ? »).
Il ÉVOLUE tout seul selon le STATUT métier (source de vérité déjà en place) : avant
le démarrage officiel (« Pas commencé ») → aucune date, une estimation seulement
(« démarrage estimé : dans environ 6 semaines », jamais de promesse) ; dès « En
cours » → bascule automatique sur des dates estimées (début officiel, pré-réception
estimée, réception estimée). Une phrase de contexte rassurante clôt le bloc, jamais
anxiogène. Sélecteur PUR `buildClientPlanning(status, dossier)` (core, testable) ;
la frise détaillée par lots reste côté CONDUCTEUR. Au passage : on extrait la date
« Début des travaux » du devis Phenix-amo → `infos.startDate`, ce qui alimente
l'estimation « dans environ … semaines ». Nouvelle suite e2e `client-planning`
(estimations avant / dates après / 5 jalons max / aucun lot / Léon répond encore).
27 suites vertes.

05/07 — épure · Suppression de l'écran Annuaire (contacts dans le chantier)
Fait : un écran Annuaire GLOBAL (bouton dédié en tête) dupliquait ce que le Carnet
du chantier fait déjà. Deux points d'entrée pour la même chose = charge mentale.
Lecture produit : on SUPPRIME l'écran Annuaire et son bouton — pas le modèle
Contact (il sert toujours aux appels / SMS / WhatsApp / mails et aux références
artisans). Les contacts restent accessibles UNIQUEMENT dans le contexte du chantier
(Préparation → « Intervenants du chantier », responsable de réserve, fournisseur de
commande, client). Rien perdu : le Carnet du chantier permet déjà de créer un
contact, d'en LIER un existant (y compris un contact global non rattaché, ex.
« Cabinet Vitruve »), de l'éditer et de le joindre. Interface seulement — le modèle
de données et le store sont inchangés. Tests recalés sur le Carnet (création +
liaison in-chantier) ; la préservation des contacts globaux à la suppression d'un
chantier se vérifie désormais au niveau de la sauvegarde exportée. 27 suites vertes.

05/07 — épure · Frise des lots retirée de l'écran Chantier
Fait : en tête de l'écran Chantier, une frise numérotée listait tous les lots
(Dépose · Gros œuvre · Plomberie · … · Réception). Elle n'apporte aucune aide à la
décision et donne une impression d'usine à gaz.
Lecture produit : on retire la représentation VISUELLE de surface (le composant
`RoadmapProgress` au sommet de la fiche chantier, `CompagnonView`) pour aérer
l'écran et concentrer l'attention sur ce qui demande une action (statut, mission,
radar d'attention). La DONNÉE métier (feuille de route) est intacte : elle reste
éditable et visible dans la Préparation (« Feuille de route & jalons » + Planning
prévisionnel) et alimente toujours le planning. On garde donc la frise dans le
bureau de Préparation (contexte de gestion volontaire, redondant-safe avec le
planning juste en dessous) — supprimable aussi si le conducteur le souhaite. Test
`chantier-epure` : la frise a disparu de l'entrée du chantier, l'écran reste
complet et actionnable, la feuille de route reste disponible en Préparation.
28 suites vertes.

05/07 — RC1 · Nettoyage Préparation + règles de démarrage client
Peut-on résoudre sans nouvel écran ni nouveau concept ? OUI : on nettoie l'existant
et on rend les blocages INTELLIGIBLES, sans rien ajouter.
Trois décisions liées.
(1) La section « Intervenants du chantier » disparaît de la Préparation : c'était un
annuaire déguisé de plus. Le modèle Contact est intact — on joint toujours le monde
depuis LÀ où le besoin naît (responsable de réserve → « Joindre », fournisseur de
commande, client). Rien perdu, une liste en moins à tenir.
(2) La date « Début des travaux » du devis n'est PLUS jamais la date officielle de
démarrage. C'est une donnée ADMINISTRATIVE ; la vraie date est saisie À LA MAIN par
le conducteur. `realAnalyzeDossier` ne préremplit donc plus `infos.startDate`
(l'extraction documentaire de la date reste, mais ne pilote plus rien). Tant que la
date n'est pas posée, le chantier reste « Pas encore prêt ».
(3) « Pas encore prêt » = espace client INACCESSIBLE. Nouveau sélecteur PUR
`buildClientShareReadiness(dossier)` (core) : 3 bloquants obligatoires avant partage
— devis signé, acompte payé, date officielle fixée. S'il en manque un, l'Espace
client affiche un écran INTERNE conducteur (« Espace client non prêt · il manque… »)
et NE rend AUCUN contenu client (aucune fuite possible). Le bloc de tête de la
Préparation devient actionnable et OUVERT d'office quand ça bloque : « Bloquants
avant partage client » (3, validé/manquant, avec les gestes pour lever acompte +
date) VISUELLEMENT séparés des « Alertes (non bloquantes) » (documents, commandes,
planning, budget…). Les 3 validés → « Prêt à partager », espace client ouvert, le
planning client suit la logique déjà en place (estimation avant démarrage, dates
après). Chantiers seedés (Lyon + Écully + Croix-Rousse) rendus partageables pour
rester cohérents. Tests : `preparation` réécrit (bloc partage, budget, check-list,
alertes, Intervenants absent, client-safe), `contacts` recalé sur « Joindre » depuis
les Réserves, `client-planning` mis à jour (devis futur → bloqué → acompte + date à
la main → « dans environ … semaines »), nouvelle suite `client-partage` (3 validés →
accessible ; sans acompte / sans date / sans devis → bloqué ; séparation
bloquants/alertes ; date du devis ne fixe pas le démarrage). 29 suites vertes.

05/07 — RC1 · Épure du bureau de Préparation (suppressions, zéro ajout)
Peut-on faire sans nouvel écran ni concept ? Oui — c'est de la suppression pure.
Après tests terrain, la Préparation s'était alourdie : le MÊME état de préparation
était affiché TROIS fois (la check-list de partage, la check-list « auto » du
cockpit, et la « Note de lancement » narrative). On tranche.
- SUPPRIMÉ « Ma note de lancement » (grande carte or) : doublon narratif de la
  check-list de partage — « ce qui mérite votre attention » = les alertes, « ce que
  je conseille » = les demandes de documents (déjà dans Documents), les compteurs
  « préparé » = du remplissage.
- SUPPRIMÉ « Mémoire du projet » (paragraphe de compteurs, jamais actionnable).
- SUPPRIMÉ « Feuille de route & jalons » : doublon du Planning prévisionnel, qui
  liste déjà toutes les étapes datées + la frise.
- SUPPRIMÉ la check-list AUTO du cockpit (devis/plans/budget/date/planning/
  décisions/commandes) : troisième copie de l'état de préparation, désormais porté
  par la seule check-list de partage. La « Check-list de lancement » ne garde que
  les points MANUELS du conducteur (« clés récupérées »…).
- SUPPRIMÉ la carte « Prochaines dates » du cockpit (les dates vivent dans le
  Planning).
- Bloc « Pas encore prêt » → vraie CHECK-LIST toujours visible : ❌/✅ Devis signé ·
  Acompte reçu · Date officielle fixée. Plus aucun dépliage : le conducteur ne
  cherche jamais ce qui manque. Les trois cochés → ✅ « prêt à partager ». Le reste
  = alertes non bloquantes, clairement séparées.
- Cartes financières FUSIONNÉES : trois grandes cartes (Prévisionnel / Engagé /
  Restant) → une seule ligne compacte lue en deux secondes ; le prévisionnel s'édite
  en place.
- Fichiers morts supprimés (LaunchNotePanel, RoadmapProgress, CarnetChantier,
  ContactCard).
Aucune capacité perdue : chaque information retirée survit ailleurs (alertes,
Documents, Planning). Tests recalés (preparation, client-partage, chantier-switch,
chantier-epure, consolidation) ; suite complète verte. 29 suites.

05/07 — RC1 · Règle des 5 secondes + correctif d'un clic mort
Nouvelle barre d'acceptation : chaque écran doit se comprendre en moins de 5
secondes ; si le conducteur doit réfléchir à OÙ cliquer, l'écran est encore trop
chargé. En passant l'app à ce crible, une régression de l'épure : la puce
« Vigilance » du devis pointait vers l'ancre `note-lancement` de la « Note de
lancement » supprimée → clic mort. Corrigé : la puce devient informative (le
message reste au survol), plus aucun clic sans effet. Audit consigné pour la
suite : (1) « Aujourd'hui » aligne 6 compteurs très proches (décisions / choix
validés / actions / réserves / réponses / livraisons) — 4 nuances de « à faire »,
à resserrer ; (2) la Préparation garde 3 blocs autour des choix client (Décisions
à obtenir · Propositions · Choix client en lecture seule) — la grille en lecture
seule est le maillon faible (elle ne sert plus que d'ancre au devis). Ces deux
coupes touchent des écrans cœur et attendent le feu vert.

05/07 — RC1 · Deux coupes validées (Aujourd'hui à 3 compteurs, Choix client retiré)
Feu vert donné sur les deux coupes de l'audit 5 secondes.
- AUJOURD'HUI : 6 compteurs → 3. Le matin doit se lire d'un coup d'œil. « À traiter
  aujourd'hui » agrège les quatre natures de tâche conducteur (décisions client,
  choix validés, actions, réponses) ; « Réserves à lever » et « Livraisons à
  contrôler » gardent leur compteur (flux distincts). Aucune capacité perdue : la
  vue filtrée liste les éléments précis, chacun PRÉFIXÉ par sa nature (« Décision
  client · … », « Choix validé · … », « Action · … », « Question client · … ») et
  ouvrant le bon onglet ; le geste « Pris en compte » reste sur les choix validés.
- PRÉPARATION : la grille « Choix client » (lecture seule) est retirée — les choix
  à obtenir restent dans « Décisions client à obtenir » (actionnable, datées) et
  les propositions dans « Propositions préparées par PHÉNIX ». La puce « Choix » du
  devis devient informative (elle n'a plus à faire défiler vers une grille).
Tests recalés (aujourdhui, decisions, client-decision, chantier-filtres,
chantier-statut) ; suite complète verte. 29 suites.

05/07 — RC1 · Le cockpit : suppression de l'onglet « Historique »
Nouveau crible : si un conducteur expérimenté ne regarde JAMAIS un bloc pendant
une semaine de chantier, ce bloc ne mérite plus d'exister. Passé au crible, le
chantier avait TROIS fils chronologiques : le Journal (Suivi, le log de travail),
le Récit (l'histoire côté client) et l'Historique (jalons + épinglés, une archive
rétrospective). L'Historique n'est pas ouvert en semaine → supprimé (5 onglets
chantier → 4). Le clic « choix validé » d'Aujourd'hui ouvre désormais le Suivi,
où la décision figure déjà (le Journal montre tous les événements). La
fonctionnalité d'épinglage, seule à vivre dans l'Historique, était de fait morte :
retirée aussi (togglePin, pinnedOf, l'état `pins`, la clé de stockage). Aucune
capacité perdue : tout événement reste tracé au Journal du chantier. Tests recalés
(decisions, client-decision, documents, mission, client-documents, chantier-epure).
Suite complète verte. 29 suites.

05/07 — RC1 · Widget PHÉNIX / Léon : concierge flottant compact
Peut-on faire sans nouvel écran ni concept ? Oui — ajustement UX du widget
existant. Retour terrain : dans l'espace client, PHÉNIX s'ouvrait en GRAND panneau
plein écran avec fond assombri (`fixed inset-0`, drawer `h-full`) — envahissant,
rupture de navigation. Deux corrections.
- BUG RÉEL de scroll : le bouton flottant (`position: fixed`) était piégé par un
  ANCÊTRE transformé (transform/filter crée un bloc conteneur pour les `fixed`),
  si bien qu'il défilait avec le contenu (mesuré à y=7055 dans un viewport de 740)
  et disparaissait. Corrigé en rendant le widget via un PORTAL sur `<body>` : il
  est désormais réellement ancré au viewport, toujours en bas à droite, à tout
  scroll, sur desktop / tablette / mobile.
- Panneau COMPACT : la bulle fait ~380 px de large (min(380, 100vw−2.5rem)), une
  hauteur bornée (min(72vh, 560px), scroll interne), sans fond assombri — l'espace
  client reste visible et navigable derrière. Fermeture d'un geste (X), historique
  de conversation conservé, réponses + navigation intelligente (document / récit /
  planning) inchangées. Nouvelle suite e2e `phenix-widget` (bouton visible au
  scroll, panneau compact non plein écran, Q/R, recherche document, navigation,
  3 tailles d'écran, zéro console). 30 suites vertes.

05/07 — RC1 · Préparation dégraissée (règle des 5 s, rôle Product Designer)
Nouvelle doctrine : objectif = rendre l'app ÉVIDENTE, pas l'enrichir ; par défaut
on RETIRE. Test de chaque écran : « un nouveau conducteur l'ouvre, en moins de 5 s
il sait quoi faire ». La Préparation était le pire offenseur (long scroll). Passe
validée avec l'utilisateur (« Préparation — dégraisser »).
- SUPPRIMÉ « Questions de PHÉNIX » : questions IA de démarrage, remplies une fois à
  la création, jamais rouvertes en semaine ; leur rôle (fixer date / compléter
  infos) est déjà couvert par la check-list de partage et les Coordonnées.
- SUPPRIMÉ « Photos avant travaux » : l'état des lieux se dépose une fois au début,
  quasi jamais rouvert (le dépôt reste possible à la création, côté PHÉNIX Start).
- REPLIÉ « Le devis » : le détail poste par poste est une RÉFÉRENCE, consultée
  rarement — masquée par défaut derrière « Voir le devis » pour ne plus dominer le
  scroll. L'en-tête (nb de lots) + « Déposer un avenant » restent visibles.
- Code mort retiré (composant PhotosAvantSection, fonction QuestionsList).
Aucune capacité perdue : dépôt de photos avant à la création, infos éditables
ailleurs, devis à un clic. Tests : `preparation` couvre le devis replié + les deux
retraits. 30 suites vertes.

05/07 — RC1 · Philosophie affinée : DÉPLACER plutôt qu'effacer + une question/écran
Précision produit importante : le problème n'est pas le nombre de fonctionnalités,
c'est qu'elles apparaissent au MAUVAIS MOMENT. Nouvelle question à se poser : « à
quel moment du cycle de vie cette info est-elle utile ? » Si c'est uniquement à la
création / pré-réception / clôture, elle ne doit plus polluer le quotidien — mais
on la DÉPLACE, on ne l'efface pas. Et chaque écran répond à UNE seule question
(Aujourd'hui → que faire aujourd'hui ; Suivi → que faire sur CE chantier ;
Préparation → prêt à démarrer ? ; Récit → que s'est-il passé ; Réserves → que
reste-t-il à lever ; Espace client → où en est mon projet).
Correction concrète : au dégraissage précédent j'avais SUPPRIMÉ « Photos avant
travaux » — or c'est une preuve en cas de litige (capacité à conserver à 100 %).
On la RESTAURE mais REPLIÉE par défaut (accessible d'un « Voir »), utile surtout à
la création, hors du regard quotidien. `preparation` vérifie qu'elle est bien
repliée par défaut et dépliable à la demande. 30 suites vertes.

05/07 — RC1 · Suivi : « Dernière activité » au lieu du Journal complet
Une seule question par écran. Le Suivi répond à « que dois-je faire sur CE
chantier aujourd'hui ? » — or le Journal du chantier (timeline complète) répond
à « que s'est-il passé ? », la question du Récit. Deux questions sur un écran.
On garde 100 % de la capacité mais on change le MOMENT : le Suivi ne montre que
la « Dernière activité » (4 événements les plus récents) ; un lien « Voir tout le
journal (N) » déplie l'archive complète (titre → « Journal du chantier »), et
« Réduire » revient à la dernière activité. Le conducteur vient au Suivi pour
AGIR (radar + 5 actions), pas pour feuilleter l'historique. Nouvelle suite
`suivi-journal` (dernière activité par défaut, dépliage/repli) ; `client-documents`
déplie le journal pour retrouver un document ancien. 31 suites vertes.

05/07 — RC1 · Espace client : le badge du LOT en cours retiré
Retour terrain : dans l'espace client, le héros affichait deux badges — le STATUT
(« En cours ») ET le LOT en cours (« Gros œuvre »). Le lot est une information
INTERNE conducteur : le client n'a pas besoin de savoir quel corps d'état est en
cours (il le lit dans le Récit ou le demande à Léon). Côté client, on ne garde que
le statut (Pas commencé / En cours / Pré-réception / Levée des réserves / Clôturé).
`ProjectHero` reçoit un `showStep` (défaut true) ; l'espace client passe
`showStep={false}`. Le conducteur, lui, continue de voir le lot en cours. Donnée
vs affichage : rien n'est supprimé du modèle, on masque juste le lot côté client.
Nouvelle suite `client-hero` (lot absent côté client, présent côté conducteur,
statut conservé). 32 suites vertes.

05/07 — RC1 · Déploiement démo : Vercel + gate mot de passe temporaire
Objectif : mettre la démo en ligne (Mac + téléphone) sans galérer avec le local.
Reste 100 % front (localStorage, pas de backend). Ajout de `vercel.json` (install
workspace pnpm, build @phenix360/demo, sert apps/demo/dist en SPA) → import
turnkey depuis la PR. Pour protéger la démo gratuitement, un GATE mot de passe
TEMPORAIRE (`PasswordGate`, pas une vraie auth, ni le futur système d'auth) :
mot de passe = variable d'env `VITE_DEMO_PASSWORD` (build Vercel) ; AUCUNE
variable → aucun gate (dev + e2e accessibles, zéro régression) ; session gardée
en localStorage (persiste au reload) ; bouton « Verrouiller ». Contrôle 100 %
client (dissuasif, pas confidentiel — le mot de passe est dans le bundle).
Testabilité : `window.__PHENIX_GATE_PW__` simule la variable sans rebuild
(bypass propre). Nouvelle suite `gate` (sans var → accessible ; avec var → écran ;
mauvais/bon mdp ; persistance ; verrouiller). 33 suites vertes.
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

## 06/07/2026 — Correctif : la DURÉE pilote le planning (source de vérité)

**Bug terrain :** début 9 juillet + durée 31 jours produisait une réception le
13 juillet et une **pré-réception le 6 juillet — AVANT le démarrage**. La durée
estimée n'entrait pas dans le calcul : la réception était dérivée de la somme des
durées d'étapes, et la pré-réception d'un écart figé (7 j).

**Décision (modèle « durée = fin du chantier », validé) :** la durée (en jours)
est la SOURCE DE VÉRITÉ. Réception = démarrage + durée. Pré-réception = réception
− fenêtre de levée des réserves, exprimée en **proportion de la durée**
(`LEVEE_RESERVES_RATIO` = 10 %, bornée à ≥ 1 j), **jamais un nombre de jours codé
en dur**. Aucune date ne peut précéder le démarrage (pré-réception bornée au
démarrage pour les chantiers très courts). Toute modification de la durée ou de la
date recalcule immédiatement (sélecteurs purs, déjà réactifs).

**Impact :** core `buildSmartPlanning` expose `endDate` (réception, désormais
dérivée de la durée), `preReceptionDate`, `durationDays` — source unique partagée
par le conducteur (« s'achève autour du ») et le client (`buildClientPlanning`,
plus de `PRE_RECEPTION_LEAD`). `parseDurationDays` : un nombre nu (« 31 ») vaut
des jours (au lieu du défaut 60). Nouveau `planning-duree.test` (7/15/31/60 j :
réception = début + durée, pré-réception proportionnelle, aucune date avant le
début, conducteur ⇆ client cohérents). Gate vert (typecheck/lint/prettier/build,
e2e 34/34). VISION Art. 9, 11.

## 06/07/2026 — Documents : catégories « Acompte » et « Facture finale »

**Besoin terrain :** les documents étaient trop orientés devis / plans /
diagnostics. Le conducteur doit pouvoir déposer une **preuve d'acompte** et la
**facture finale**, les retrouver dans Préparation / Documents, et les partager
(ou non) au client.

**Décision (sans nouvel écran ni concept) :** deux CATÉGORIES de documents en
plus (`acompte`, `facture_finale`) dans la liste existante. Elles apparaissent
automatiquement dans le sélecteur « Type de document » et dans les libellés.

**Checklist de partage — source unique :** « Acompte reçu » est désormais validé
par tout document FOURNI **classé « Acompte »** (ou reconnu au libellé, rétro-compat),
via `isAcompteDocument` (core). Le bouton « Marquer comme payé / Annuler » du
cockpit reflète ce même bloquant (plus de désynchronisation bouton ⇆ checklist).

**Non bloquant / client-safe inchangé :** la facture finale n'entre jamais dans
les 3 bloquants de partage (devis · acompte · date). Les documents restent
INTERNES par défaut (invisibles côté client) et ne deviennent visibles que
partagés — comportement existant, non modifié.

**Impact :** core `PREP_DOC_CATEGORIES` (+`acompte`, +`facture_finale`) +
`isAcompteDocument` ; `buildClientShareReadiness` (acompte par catégorie) ;
`documentFromFile` (acompte→`acompte`, facture→`facture_finale`) ;
`PreparationCockpit` (bouton aligné sur le bloquant, création en catégorie
`acompte`). Export/import inchangé (catégories = simples chaînes). Nouveau
`documents-acompte-facture.test` (dépôt Acompte→checklist validée, Facture finale
interne + partagée, client-safe, 3 obligatoires). Gate vert (e2e 35/35).
VISION Art. 7, 8, 9, 11.

## 06/07/2026 — Check-list de lancement STANDARD (préremplie à la création)

**Décision produit :** la « Check-list de lancement » devient la procédure
standard PHÉNIX. Chaque NOUVEAU chantier démarre avec la même check-list — le
conducteur n'a jamais une liste vide.

**Sans nouvel écran ni concept :** on remplace la check-list manuelle VIDE par une
check-list préremplie. Deux niveaux, déjà existants dans l'UI :
• 🔴 3 bloquants (devis signé · acompte reçu · date de démarrage) — INCHANGÉS,
portés par la check-list de PARTAGE, seuls à piloter l'ouverture de l'espace
client et le passage « En cours » ;
• 🟡 6 contrôles qualité PHÉNIX (clés · déclaration de travaux · panneau ·
sous-traitants · commandes · accès), préremplis dans la check-list du dossier.
INFORMATIFS : ils ne bloquent jamais. Le conducteur coche, ajoute, supprime.

**Une seule source :** `defaultLaunchChecklist()` (core) — ids stables, tout
décoché — injectée à CHAQUE création de dossier : les deux analyseurs
(`realAnalyzeDossier`, `mockAnalyzeDossier`), `ensureDossier` (création rapide /
import ancien) et le seed (chantiers de démo). Sauvegardée avec le chantier
(`dossier.checklist`) → coches persistantes au rechargement et à l'export/import.

**Impact :** core `PHENIX_LAUNCH_CHECKLIST` + `defaultLaunchChecklist` ; injection
dans les 3 constructeurs de dossier + seed. Aucune logique bloquante ajoutée.
Nouveau `checklist-lancement.test` (6 contrôles préremplis, 3 bloquants seuls
bloquants, ajout/suppression, persistance reload + export/import) ; `preparation`
recalé (libellé d'ajout hors liste standard). Gate vert (e2e 36/36).
VISION Art. 5, 9.

## 06/07/2026 — Partage des documents vers l'espace client (visibilité au dépôt)

**Retour terrain :** en ajoutant un document, le conducteur doit décider s'il est
visible ou non dans l'espace client ; et la section Documents du client doit
afficher les VRAIS documents partagés.

**Décision (sans nouveau module) :** on réutilise la VISIBILITÉ d'événement déjà
en place (`interne` / `client`). Au dépôt d'un document, un sélecteur « Visibilité »
(Interne uniquement / Visible client), **par défaut Interne** (anti-fuite). Chaque
document AVEC fichier porte une bascule interne ↔ visible client, modifiable à tout
moment — le client le voit apparaître / disparaître immédiatement.

**Client-safe strict :** la section Documents du client (`ClientView`) ne montre
que les événements `document` `visibility: client` ET publiés (`isVisibleToClient`).
Un interne ne fuit jamais ; aucune carte vide n'est affichée s'il n'y a rien de
partagé (section rendue seulement si `clientDocuments.length > 0`). Aucun partage
automatique : un document reste interne tant qu'on ne le partage pas explicitement.

**Impact :** core `EventRepository.setEventVisibility` + impl `InMemoryBackend`
(événements déjà mutables, cf. `publishEvent`) ; store `addPrepDocument` (param
`visibility`, défaut interne) + `setPrepDocumentVisibility` (agit sur l'événement
du Journal, base unique) ; `PrepDocumentsSection` (sélecteur au dépôt + bascule
par ligne). Export/import inchangé : l'événement (fichier + visibilité) est
sérialisé tel quel. Nouveau `documents-partage.test` (interne invisible, partagé
visible + ouvrable, changement de visibilité ↔ client, jamais de fuite, export/
import conserve fichier + visibilité, non-régression). Gate vert (e2e 37/37).
VISION Art. 7, 8, 9, 11.

## 06/07/2026 — Check-list : migration des chantiers antérieurs (« liste vide »)

**Retour terrain :** « ma check-list est vide, même sur un nouveau chantier ».
Diagnostic : le code de préremplissage est bien en place (vérifié en UI sur les
deux chemins de création — devis ET création rapide via `ensureDossier`) et
déployé (le build du commit check-list a réussi ; seul l'étape `deploy-pages`
d'un run intermédiaire avait échoué par concurrence Pages, le run suivant a
déployé). La cause résiduelle : des chantiers déjà en `localStorage`, créés AVANT
la fonctionnalité, n'ont pas de champ `checklist`.

**Décision :** migration douce au chargement du store — tout dossier dont
`checklist` est `undefined` reçoit la check-list PHÉNIX standard. On NE touche
PAS à un tableau vide (`[]`) : le conducteur a pu retirer volontairement tous les
points. Idempotent, sans écran ni concept nouveau.

**Impact :** store `migrateDossierChecklists()` (appelée à l'init). Nouveau
`checklist-migration.test` (dossier dégradé sans `checklist` → backfill au
rechargement). Gate vert (e2e 38/38).

## 06/07/2026 — Suivi : entrée unique « Nouvelle mission » (suppression des doublons)

**Retour terrain :** dans « Chantier > Suivi », « Nouveau compte rendu » et
« Ajouter des photos » font doublon avec « Nouvelle mission » — le conducteur
hésite (« mission ou compte rendu ? photos ou mission ? »).

**Principe produit :** une action = un seul point d'entrée. « Nouvelle mission »
(MissionFlow → `createMission`) couvre DÉJÀ photos + compte rendu (+ mission,
décision client, réserves, actions).

**Décision (suppression de doublons, sans nouvel écran) :** on retire du Suivi les
deux boutons « Nouveau compte rendu » et « Ajouter des photos ». Restent les
actions SANS équivalent mission (Ajouter un document, Demander au client, Répondre
au client) et « Nouvelle mission ». L'état vide du Journal pointe désormais vers
« Nouvelle mission ». Aucune capacité retirée : le composer conserve ses types, et
la mission produit bien un `compte_rendu` + des photos (Moment).

**Impact :** `CompagnonView` (SuiviTab : `actions` sans `compte_rendu`/`photo`,
prop `onNewMission`, CTA état vide → mission). Nouveau `suivi-entree-unique.test`
(boutons disparus, mission crée un compte rendu + ajoute une photo, trace au
Journal + Récit). Gate vert (e2e 39/39). VISION Art. 5, 8.

## 06/07/2026 — Assistant IA : le visage de Léon (fin du casque de chantier)

**Retour terrain :** le bouton flottant de l'assistant affichait un casque de
chantier — il ne représente pas l'assistant et ne crée aucun lien émotionnel.

**Cause réelle (pas qu'un choix d'icône) :** le bouton ET le chat utilisaient déjà
`LeonAvatar`, qui affiche `public/leon.png`… mais via un chemin RACINE `/leon.png`.
Sous GitHub Pages, la démo est servie sous `/phenix-360/` → `/leon.png` renvoyait
un 404 → repli sur l'icône casque. En local (base `/`), le bug était masqué. Le
conducteur voyait donc le casque uniquement en ligne.

**Décision / correctif :** résoudre l'image via `import.meta.env.BASE_URL`
(`${BASE_URL}leon.png`) → l'avatar de Léon se charge partout (local ET Pages).
Bouton flottant et fenêtre de chat partagent EXACTEMENT le même `LeonAvatar` →
identité cohérente. Le repli n'est plus un casque mais un repère NEUTRE (bulle de
conversation), pour ne jamais réafficher le casque. Texte « PHÉNIX / Une
question ? » inchangé. Aucune autre modification fonctionnelle.

**Vérifié :** build Pages (`PAGES_BASE=/phenix-360/`) référence bien
`/phenix-360/leon.png` (au lieu de `/leon.png`). Nouveau `phenix-avatar.test`
(image chargée, bouton ⇆ chat même `src`). Gate vert (e2e 40/40). VISION Art. 11.

## 06/07/2026 — « Récit » → « Dans les coulisses » (vocabulaire premium)

**Décision produit :** « Récit » est trop froid / administratif. On ne consulte
pas un rapport : on découvre ce qui se passe quand on n'est pas sur le chantier.
« Dans les coulisses » traduit cette promesse. Renommage PARTOUT dans l'UI,
comportement inchangé (aucun nouvel écran, aucun nouveau concept).

**Portée (vocabulaire seulement) :** onglet conducteur, sommaire + section client,
bascule Coulisses/Bibliothèque, titres, textes, et les réponses de Léon dans le
chat (`phenix.ts` : « … dans les coulisses de votre chantier », bouton « Voir les
coulisses »). Les IDENTIFIANTS internes (`fil`, `filDuChantier`, `clientFeed`,
valeur d'onglet `'fil'`) restent inchangés — le comportement ne bouge pas.

**Note UX :** l'onglet « Dans les coulisses » est plus long, mais la barre
d'onglets (`TabsList`) a déjà `max-w-full overflow-x-auto` + triggers
`whitespace-nowrap` → défilement interne sur écran étroit, aucun débordement de
page (mobile OK).

**Impact :** libellés dans `CompagnonView`, `ClientView`, `FilView`,
`BibliothequeView`, `CoordonneesCard`, `ReservesView`, `DeleteChantierButton`,
`PhenixStart`, et `packages/core/phenix.ts`. Suites e2e recalées (tab/heading/chip)

- nouveau `coulisses.test` (« Récit » absent de l'UI côté conducteur, client et
  chat ; « Dans les coulisses » partout ; navigation intacte). Gate vert (e2e 41/41).
  VISION Art. 11.

---

## 07/07/2026 — Notifications BIDIRECTIONNELLES (chaque action importante prévient l'autre)

**Décision produit :** toute action marquante d'un camp crée une notification pour
l'AUTRE, dans son écran d'accueil — jamais un nouvel écran. **Conducteur → client**
(dans l'Espace client) : nouvelle publication (photo/moment partagé), nouveau compte
rendu, document partagé. **Client → conducteur** (dans « Aujourd'hui ») : coup de
cœur (❤️), commentaire, décision validée/déléguée. Un clic **ouvre l'élément
concerné** et **éteint** la notification (elle disparaît) ; l'historique seedé ne
notifie jamais.

**Mécanique (rien de nouveau persisté) :** les notifications sont **dérivées des
faits** (`conductorNotifications` / `clientNotifications`) — moments partagés, coups
de cœur, événements `compte_rendu`/`document` visibles client, décisions `validee`/
`deleguee` d'origine `client`. Deux garde-fous d'extinction : (1) un **repère
`notifBaseline`** posé à l'ouverture / au rechargement de la démo → le passé ne
notifie pas ; (2) un **accusé de lecture par rôle** (`seen[role]`, `markSeen`) que
le clic renseigne. Le commentaire réutilise le mécanisme existant
(`pendingClientMoments`) — feed et badges restent cohérents.

**Sans nouvel écran ni concept :** on réutilise Aujourd'hui et l'Espace client via
un bloc `NotificationsFeed` compact (or, discret) qui s'efface quand il est vide.
**Alternatives rejetées :** écran « Notifications » dédié ; drapeau lu/non-lu
persisté par notification ; messagerie temps réel. Client-safe strict : chaque camp
ne voit QUE ce qui le concerne ; export/import inchangé.

**Impact :** store `AppNotification` + `conductorNotifications` / `clientNotifications`,
`markSeen(role, ids)`, `ensureNotifBaseline` / reset dans `loadDemo` ; composant
`NotificationsFeed` ; câblage `AujourdhuiView` (agrégé multi-chantiers) et
`ClientView`. Nouveau `notifications-bidirect.test` (photo/document → client ; ❤️/
décision → conducteur ; clic ouvre + marque lu ; client-safe ; zéro console). Gate
vert (e2e 42/42). VISION Art. 3, 9, 11.

---

## 07/07/2026 — Tout document est CONSULTABLE (un clic l'ouvre, toujours)

**Décision produit (retour terrain) :** un document ne doit JAMAIS être une simple
ligne dans une liste. Partout dans PHÉNIX, un document est cliquable et s'ouvre
immédiatement. Deux cas, une seule règle pour l'utilisateur : **fichier réel**
(PDF / image) → ouverture du fichier ; **document généré par PHÉNIX** (compte rendu,
PV de réception, liste des points à reprendre, fiche de référence d'un devis / d'une
facture / d'un acompte sans pièce jointe) → PHÉNIX **génère** le document (page HTML
autonome, lisible et imprimable) et l'ouvre. Côté client comme côté conducteur.

**Mécanique (enrichir l'existant, aucun nouvel écran) :** avant, seul un `document`
event PORTANT un `dataUrl` était ouvrable (`DocumentLink`) ; les documents générés
et les documents seedés sans fichier restaient inertes (« disponible prochainement »).
Désormais un point d'entrée unique `demo.openDocument(event)` route : fichier réel →
`openAttachment` (blob) ; sinon → `buildDocumentHtml(event, ctx)` + `openHtmlDocument`
(blob `text/html`). Même mécanique d'ouverture par onglet que les fichiers — pour
l'utilisateur, tout document se consulte pareil. Le rendu généré est **pure
présentation** (titre = `docTitre` d'une mission quand présent : « PV de réception »…,
métadonnées chantier / date / auteur / étape / présents, corps : texte + décisions +
actions + questions + manquants pour un compte rendu ; fiche de référence pour un
document sans pièce). Contenu métier **échappé** (HTML-safe).

**Portée :** `MomentCard` (récit + documents + comptes rendus client), Journal
conducteur (`CompagnonView`), Préparation (`PrepDocuments`) via un `DocumentButton`
générique qui remplace `DocumentLink`. La visibilité GOUVERNE DÉJÀ où un document
apparaît — ouvrir ne contourne rien : le client ne voit et n'ouvre que le partagé,
l'interne reste au conducteur. **Alternatives rejetées :** un lecteur / écran dédié
(nouveau concept) ; générer un vrai PDF (dépendance lourde hors-ligne — l'HTML
imprimable suffit et reste 100 % local).

**Impact :** `lib/document.ts` (`openBlob` extrait, `openHtmlDocument`), nouveau
`lib/generatedDocument.ts` (`buildDocumentHtml`), `store.openDocument`, nouveau
`components/DocumentButton`. Nouveau `documents-consultables.test` (compte rendu /
devis / interne / pré-réception / réception / partagé client — fichier ET généré,
client-safe, zéro console) ; `client-documents.test` recalé (le document sans fichier
s'ouvre désormais). Gate vert (e2e 43/43). VISION Art. 7, 8, 9, 11.

---

## 07/07/2026 — « Dans les coulisses » recentré sur les photos (l'Instagram du chantier)

**Décision produit :** « Dans les coulisses » N'EST PAS l'historique du chantier.
C'est la brique PLAISIR — l'album photo/vidéo privé du chantier : le client l'ouvre
pour voir l'avancement en images, les moments, les belles photos, aimer, commenter.
Contenu AUTORISÉ : photos (vidéos à venir), texte d'accompagnement court, coups de
cœur, commentaires. Contenu INTERDIT : documents, comptes rendus, PV de pré-réception /
réception, réserves, devis, factures, historique technique — qui vivent au **Suivi**,
dans **Documents** et **Comptes rendus**.

**Filtre (aucun nouvel écran, on clarifie le rôle) :** un Moment appartient aux
coulisses ssi il porte au moins une photo ET n'est PAS un moment « de travail »
(`estMomentCoulisses` / `momentsCoulisses`). Les types documentaires
(`MOMENT_TYPES_TRAVAIL` : réunion, visite, livraison, pré-réception, réception, SAV,
note, décision) — ceux que « Nouvelle mission » génère avec un compte rendu / PV —
sont écartés du Fil ET de la Bibliothèque, côté conducteur comme client. Un compte
rendu généré ne s'affiche donc jamais dans les coulisses ; il reste consultable au
Suivi (cf. décision « Tout document est consultable »).

**Album (jusqu'à 10 photos) :** le composer « Créer un moment » devient un pur album
photo — plus de sélecteur de type (les albums sont des moments PHOTO par défaut),
**10 photos maximum** en une fois (`MAX_ALBUM_PHOTOS`, tronqué au dépôt et à la
saisie). Un dépôt = **un seul moment/album** (badge « N photos », galerie immersive
au clic, cœur rouge vif, commentaires sous l'album — UX déjà en place). Notification
client **unique** par album : « Nouvelles photos ajoutées dans les coulisses »
(jamais une par photo).

**Seed :** les moments photo « Visite / Préparation » (sans livrable) sont reclassés
en moments d'album (`etape`) pour rester dans les coulisses ; l'« Avant travaux » de
PHÉNIX Start devient un album photo. La vraie « Réunion » interne reste un moment de
travail (hors coulisses) — l'exemple du contenu écarté. **Alternatives rejetées :**
un onglet « Album » séparé (nouvel écran) ; filtrer par présence de photos seulement
(laisserait passer les missions photographiées).

**Impact :** core `fil.ts` (`MOMENT_TYPES_TRAVAIL`, `estMomentCoulisses`,
`momentsCoulisses`, `MAX_ALBUM_PHOTOS`) ; `FilView` / `ClientView` (filtre du Fil +
Bibliothèque) ; `store` (`addMoment` type album par défaut + cap 10, notification
album) ; `MomentComposer` (album pur, cap 10) ; `seed` / `PhenixStart`. Nouveau
`coulisses-photos.test` (document/CR/pré-réception hors coulisses ; 1 photo → moment ;
12 photos → 1 album limité à 10 ; notification unique ; cœur + commentaire ;
client-safe) ; `notifications-bidirect` recalé (texte album). Gate vert (e2e 44/44).
VISION Art. 9, 11.

---

## 07/07/2026 — « Nouvelle mission » = point d'entrée UNIQUE des actions (ACTION ≠ CONSULTATION)

**Décision produit :** le conducteur ne navigue plus dans un sous-menu pour AGIR.
Toute action part de **➕ Nouvelle mission** — y compris publier des photos. Principe
clair : **Nouvelle mission = JE FAIS** ; **Dans les coulisses = JE REGARDE**. On
sépare l'ACTION de la CONSULTATION.

**Publier dans les coulisses depuis Nouvelle mission :** le sélecteur de mission gagne
une action mise en avant « 📸 Publier dans les coulisses » qui ouvre DIRECTEMENT le
composer d'album (jusqu'à 10 photos, description, couverture, partage). La publication
crée l'album, la notification client et un moment visible immédiatement dans l'espace
client — sans jamais ouvrir le sous-menu. Le sous-menu « Dans les coulisses » perd son
bouton « Créer un moment » : il devient un **espace de consultation** pur (le conducteur
y garde le partage / la suppression / la création de réserve depuis une photo, qui sont
de la modération, pas de la publication).

**Sans nouvel écran ni concept :** on réutilise le workflow « Nouvelle mission » et le
composer d'album existants — on ajoute juste une entrée au sélecteur et on retire un
bouton du sous-menu. **Alternatives rejetées :** garder deux points d'entrée (publier
depuis le sous-menu ET la mission) — ambigu, contraire à « une action = une entrée ».

**Impact :** `MissionPicker` (`onPublishAlbum` + action « Publier dans les coulisses ») ;
`CompagnonView` (état + rendu du `MomentComposer` déclenché par le sélecteur) ;
`FilView` (retrait du bouton/composer — consultation seule). Tests : `coulisses-photos`
(publication via Nouvelle mission uniquement, sous-menu sans bouton, album visible en
consultation) et `notifications-bidirect` recalés sur le nouveau parcours. Gate vert
(e2e 44/44). VISION Art. 9, 11.

---

## 07/07/2026 — Acquisition des photos : capacités NATIVES du téléphone (partout)

**Décision produit :** PHÉNIX est d'abord un outil de terrain sur smartphone. Partout
où l'on ajoute une photo (coulisses, compte rendu, pré-réception, réception, réserves,
documents avec photo…), on utilise le **sélecteur NATIF** du téléphone : prendre une
photo à l'instant avec l'appareil, choisir dans la galerie, ou piocher un fichier
(Drive · Fichiers · iCloud). On ne réinvente pas cette interface — l'OS la fournit. Le
conducteur ne quitte jamais PHÉNIX pour photographier ; une photo prise à l'instant se
publie immédiatement.

**Mécanique (améliorer l'existant, aucun nouvel écran) :** en HTML, `accept="image/*"`
SANS l'attribut `capture` déclenche déjà, sur iOS/Android, le sélecteur natif offrant
les trois options (appareil photo, galerie, fichiers). Imposer `capture` forcerait
l'appareil photo et masquerait galerie/fichiers — on ne le fait donc JAMAIS. On
centralise ces valeurs en une **source unique** (`ACCEPT_IMAGE`, `ACCEPT_DOCUMENT`
dans `lib/media.ts`, documentées) et on l'applique à TOUS les champs : coulisses
(album, multiple), capture de mission (compte rendu / pré-réception / réception,
multiple), réserve (preuve à la levée), décision client, documents (PDF **ou** photo),
photos avant travaux. Sur ordinateur, le même attribut ouvre la sélection multi-fichiers
(le glisser-déposer reste géré à l'onboarding) — comportement inchangé.

**Album coulisses :** jusqu'à 10 photos en une fois → un seul album (cf. décision
« coulisses »). La vidéo (« si supportée ») reste **à prévoir** : le MediaUploader de la
démo ne traite que l'image (décodage canvas) — on ne l'active pas pour ne pas casser le
rendu. `ACCEPT_IMAGE` est le point unique où l'étendre le jour venu.

**Alternatives rejetées :** ajouter un bouton « appareil photo » dédié avec
`capture="environment"` (réinvente l'interface et masque galerie/fichiers) ; une
librairie de capture custom (inutile — le navigateur fait tout, 100 % natif).

**Impact :** `lib/media.ts` (`ACCEPT_IMAGE`, `ACCEPT_DOCUMENT`) appliqués à
`MomentComposer`, `MissionFlow`, `ReserveLeveeDialog`, `ClientDecisionComposer`,
`ProposalWorkshop`, `Composer`, `PrepDocuments`. Nouveau `media-capture.test`
(viewport iPhone : coulisses/mission/réserves/documents = champ natif `image/*` sans
`capture`, albums `multiple`, ajout réel de photos ; desktop inchangé ; zéro console).
Gate vert (e2e 45/45). VISION Art. 9, 11.

---

## 07/07/2026 — Formulaire « Dans les coulisses » simplifié (publier en < 30 s)

**Décision produit (retour terrain) :** les coulisses sont un espace ÉMOTIONNEL
(Instagram privé du chantier), pas un compte rendu. On retire du composer d'album les
deux champs sans valeur pour le client :

1. **« Partager avec le client » (case à cocher) → supprimée.** Une publication
   coulisses est TOUJOURS destinée au client : le conducteur n'a pas à se poser la
   question. Le partage devient **automatique** (`shareWithClient: true` en dur).
2. **« Intervenants présents » → supprimé.** Le client regarde des photos, pas une
   feuille de présence.

Le formulaire se réduit à l'essentiel : **📸 photos, titre, description (observations),
pièce (optionnelle), Créer le moment.** Tout ce qui n'apporte pas de valeur au client
disparaît — objectif : publier un album en moins de 30 secondes.

**Sans nouvel écran ni concept :** on retire deux champs d'un formulaire existant.
Le partage automatique n'ajoute rien — il applique la règle « coulisses = toujours
client » déjà posée (une publication apparaît immédiatement dans l'espace client et
déclenche la notification album). **Alternatives rejetées :** garder le partage
optionnel « pour les cas particuliers » (les coulisses n'en ont pas — le contenu
technique passe par Nouvelle mission, hors coulisses).

**Impact :** `MomentComposer` (retrait du state `share` / `intervenants`, du bloc
« Partager » et du groupe « Intervenants », du helper `Group` devenu inutile ;
`create()` publie toujours partagé). Nouveau `coulisses-formulaire.test` (ni case
Partager ni champ Intervenants ; publication sans action de partage → visible côté
client ; marquée « Partagé avec le client » côté conducteur) ; `coulisses-photos` et
`notifications-bidirect` recalés (plus de case à cocher ; une notification PAR ALBUM).
Gate vert (e2e 46/46). VISION Art. 9, 11.

---

## 07/07/2026 — Coulisses : suppression du champ « Titre », « Observations » → « Légende »

**Décision produit (retour terrain) :** le champ **Titre** n'apporte aucune valeur —
les coulisses sont un espace type Instagram, pas un rapport de chantier, et le
conducteur ne doit pas avoir à inventer un titre à chaque publication. On le
**supprime**. Le champ texte restant (« Observations ») est **renommé « Légende
(optionnelle) »** (placeholder « Décrivez ce moment… », ex. « La cuisine prend
forme ! ») — libre, sans obligation de le remplir.

Le formulaire se réduit à : **📸 photos · 📝 légende (optionnelle) · 🏠 pièce
(optionnelle) · Créer.** Objectif : publier un album en **moins de 20 secondes**.
Plus le formulaire est court, plus le conducteur publie souvent.

**Mécanique (aucun nouvel écran) :** on retire le champ Titre et son état ; la
légende est stockée dans `observations` (le Moment n'a plus de `title` — chaîne
vide). Deux composants d'affichage s'adaptent : `FilMoment` n'affiche le `<h3>` que
si un titre EXISTE (les albums coulisses n'en ont pas → juste la légende sous la
photo, façon caption) ; `MomentGallery` retombe sur la légende puis un libellé
générique (« Photos du chantier ») pour l'entête et le nom accessible. Les moments
seedés (« Dalle coulée »…) gardent leur titre — aucune régression. La création
n'exige plus qu'au moins une photo (la légende est optionnelle).

**Alternatives rejetées :** rendre le titre optionnel mais le garder (encore un
champ à ignorer — on veut le formulaire le plus court possible) ; stocker la légende
comme titre prominent (une caption se lit sous la photo, pas en gros titre serif).

**Impact :** `MomentComposer` (retrait du champ et de l'état `title`, `Observations` →
`Légende`, création sans titre) ; `FilMoment` (titre conditionnel) ; `MomentGallery`
(entête de repli). Nouveau périmètre de `coulisses-formulaire.test` (Titre absent ;
Observations remplacé par Légende ; publication photos seules ; publication photos +
légende ; légende affichée côté client) ; `coulisses-photos` / `notifications-bidirect`
/ `media-capture` recalés (champ Légende). Gate vert (e2e 46/46). VISION Art. 9, 11.

---

## 07/07/2026 — « Nouvelle mission » : point d'entrée UNIQUE des créations

**Décision produit (retour terrain) :** le conducteur hésitait entre les cartes du
Suivi et le bouton « + Nouvelle mission ». Règle unique désormais : **« je veux faire
quelque chose → Nouvelle mission ».** Les trois dernières actions de CRÉATION du Suivi
— **Ajouter un document · Demander au client · Répondre au client** — rejoignent le
sélecteur « Nouvelle mission ». Le Suivi ne CRÉE plus rien : il ne sert qu'à
CONSULTER (radar d'attention — déjà hors du Suivi —, dernière activité, publication
des brouillons).

Le bouton « + Nouvelle mission » devient l'entrée unique de toutes les créations :
compte rendu, pré-réception, réception, réserve (via mission), document, demande au
client, réponse au client, publication « Dans les coulisses », décision client.

**Sans nouvel écran ni concept :** on DÉPLACE trois points d'entrée. Les composers
(`document` / `demande` / `repondre`) sont inchangés ; seul l'endroit d'où on les
ouvre change. Le compteur de questions en attente (badge) suit « Répondre au client »
dans le sélecteur. **Alternatives rejetées :** garder les cartes dans le Suivi « au
cas où » (c'est justement l'hésitation qu'on supprime — un seul endroit pour créer).

**Impact :** `MissionPicker` (nouveau `onCompose` + `pendingReplies`, grille des trois
actions administratives) ; `CompagnonView` (câblage du sélecteur, retrait de la grille
d'actions du `SuiviTab` → consultation seule). Nouveau `mission-entree-unique.test`
(cartes absentes du Suivi ; trois actions présentes dans Nouvelle mission ; chaque
composer s'ouvre ; parcours complet « ajouter un document » → au Journal ; compteur
« Répondre ») ; `documents-acompte-facture` recalé (ajout de document via Nouvelle
mission). Gate vert (e2e 47/47). VISION Art. 9, 11.

---

## 07/07/2026 — Un onglet = un univers : réorg. du Chantier + Documents dédié

**Décision produit (retour terrain) :** trop de briques mélangées sur une même page.
Règle unique : **un onglet = un univers = une seule question.** On ne crée aucun
concept — on DÉPLACE les briques existantes dans le bon univers.

- **SUIVI** = « que s'est-il passé ? » → le journal chronologique SEUL. Aucune
  création, aucune bibliothèque de documents, aucune notification.
- **PRÉPARATION** = « le chantier est-il piloté ? » → le cockpit (check-list de
  lancement, devis/budget, planning, dates, commandes, décisions client, avenants).
  Plus de bibliothèque de documents ici.
- **DOCUMENTS** (nouvel onglet) = « où retrouver un document ? » → **tout** : la
  préparation documentaire (dépôt, obtention, « Demander au client », partage) ET la
  **bibliothèque du chantier** (devis, factures, plans, comptes rendus, PV de
  pré-réception / réception… tout document ou PV généré). Chaque document est
  **consultable, ouvrable, téléchargeable et partageable**. On ne cherche jamais
  ailleurs.
- **DANS LES COULISSES** = photos/albums (inchangé).
- **AUJOURD'HUI** = le centre de notifications (déjà en place) : une notification vit
  ICI, jamais QUE dans un chantier, et son clic ouvre directement l'élément concerné.

**Mécanique (déplacement, pas de nouveau concept) :** `PrepDocumentsSection` quitte la
Préparation pour le nouvel onglet `DocumentsTab`, qui ajoute une **bibliothèque**
dérivée du journal (`document` + `compte_rendu` events NON gérés par la préparation →
aucun doublon intra-onglet). Nouveaux ports : `demo.downloadDocument(event)`
(fichier réel → le fichier ; document généré → sa page HTML) via `downloadAttachment`
/ `downloadHtmlDocument` ; `demo.setDocumentVisibility(eventId, visibility)` (partage
d'un fichier au client). Le Suivi ne crée plus rien (les actions ont déjà migré vers
« Nouvelle mission »). `PhotosAvantSection` (état des lieux) reste en Préparation.

**Espace client : NON touché** (conforme au brief — on valide d'abord le conducteur,
puis on appliquera la même philosophie au client). **Alternatives rejetées :** garder
les documents à la fois en Préparation et en Documents (le doublon qu'on supprime) ;
une page unique immense (contraire à « un onglet = une question »).

**Impact :** nouvel onglet `Documents` (`CompagnonView` + `DocumentsTab`), retrait de
`PrepDocumentsSection` de `DossierPanel`, `lib/document` (download), `store`
(`downloadDocument`, `setDocumentVisibility`). Nouveau `chantier-architecture.test`
(chaque univers, aucun doublon, notifications dans Aujourd'hui, clic → bon écran) ;
tests documentaires recalés (dépôt via l'onglet Documents) : `documents`,
`documents-partage`, `documents-acompte-facture`, `client-partage`, `coulisses-photos`,
`media-capture`, `notifications-bidirect`. Gate vert (e2e 48/48). VISION Art. 8, 9, 11.

## 07/07/2026 — Un onglet = un univers : refonte complète de l'Espace client

**Décision produit (retour terrain) :** on applique à l'Espace client la même règle que
le Chantier — **un onglet = un univers = une seule question.** Le client ne doit jamais
avoir l'impression d'un logiciel de chantier / ERP : il comprend tout en < 5 s, comme
un réseau social premium qui rassure. On ne crée aucun concept — on DÉPLACE les briques
existantes dans le bon univers. Quatre onglets, quatre questions :

- **AUJOURD'HUI** = « PHÉNIX attend-il quelque chose de moi ? » → la boîte de réception :
  décisions à prendre, questions PHÉNIX, réponses du conducteur, nouveaux documents,
  nouvelles photos, ❤️/💬, rappels. Une notification traitée disparaît (accusé de
  lecture), et son clic ouvre **directement le bon écran** (le bon onglet + la bonne
  section). Aucun univers mélangé ici : juste ce qui appelle une action.
- **LE PROJET** = « où en est mon chantier ? » → grandes étapes, avancement, dates,
  planning simplifié, « Vos choix ». **Aucun document, aucune photo, aucun historique.**
  Rassure, ne stresse pas.
- **DANS LES COULISSES** = « que se passe-t-il ? » → l'Instagram privé du chantier :
  albums photos/vidéos, ❤️ et 💬. **Aucun document / CR / PV / PDF.**
- **DOCUMENTS** = « où retrouver mes documents ? » → devis, avenants, acompte, factures,
  **comptes rendus**, visites, PV de pré-réception / réception, garanties, notices…
  Chaque document **ouvrable et téléchargeable** d'un clic. On ne cherche jamais ailleurs.

**Mécanique (déplacement, pas de nouveau concept) :** `ClientView` passe d'une page qui
défile (sommaire + `#section-*`) à **4 sous-onglets** `Tabs` ; les `id` de section sont
conservés À L'INTÉRIEUR des onglets pour que les notifications ciblent toujours le bon
ancrage. `AppNotification` gagne un champ `clientTab` (`'aujourdhui' | 'projet' |
'coulisses' | 'documents'`) : `clientNotifications` route photo/moment → coulisses,
document/compte rendu → documents ; le clic bascule sur le bon onglet PUIS scrolle vers
la section. Les **comptes rendus rejoignent la bibliothèque Documents** (un seul univers
documentaire, plus de section « Comptes rendus » à part). Nouveau composant
`ClientDocuments` (liste `li` : titre + « Ouvrir le document » + « Télécharger »,
via `demo.openDocument` / `demo.downloadDocument`). « Dans les coulisses » n'affiche que
les moments-photos (`momentsCoulisses`), en lecture (`canCompose=false`).

**Collision de libellé résolue :** le sous-onglet client « Aujourd'hui » porte le même
nom que le sélecteur de vue global « Aujourd'hui » (deux `role=tab`). L'en-tête étant
premier dans le DOM, les tests ciblent l'en-tête via `.first()` ; le helper e2e
`openClientTab` ouvre l'« Aujourd'hui » client via `.last()`.

**Alternatives rejetées :** garder une longue page qui défile (contraire à « un onglet =
une question ») ; laisser les comptes rendus dans un univers séparé (le client cherchait
à deux endroits) ; mélanger photos et documents dans un même « fil » (l'ERP qu'on fuit).

**Impact :** `ClientView` réécrit (4 onglets), nouveau `components/ClientDocuments`,
`store` (`clientTab` dans `AppNotification` + `clientNotifications`), helper
`openClientTab` (harness). Nouveau `client-architecture.test` (chaque fonctionnalité dans
le bon onglet, aucun doublon, toutes les notifications dans Aujourd'hui ouvrant le bon
écran, photos hors Documents, documents hors Coulisses, zéro fuite, zéro erreur console).
~18 suites client recalées (navigation par sous-onglet). Gate vert (e2e 49/49). VISION
Art. 3, 6, 8, 11.

## 07/07/2026 — Documents : consultation seule + filtres par type (fin du doublon)

**Décision produit (retour terrain) :** on ancre la règle unique de PHÉNIX — **créer →
« + Nouvelle mission », consulter → « Documents ».** L'onglet Documents ne sert plus qu'à
**consulter, filtrer, ouvrir et télécharger** ; il ne CRÉE plus rien.

- **Suppression du doublon d'ajout.** Le formulaire « Ajouter un document » (+ bouton
  « Ajouter le document ») quitte l'onglet Documents. L'ajout d'un document passe
  désormais EXCLUSIVEMENT par « Nouvelle mission → Ajouter un document ». Il n'existe
  plus deux façons d'ajouter un document.
- **Filtre par type**, identique côté **conducteur** ET côté **client** : « Tous » +
  Devis, Avenants, Acompte, Factures, Plans, Comptes rendus, Visites chantier,
  Pré-réceptions, Réceptions, Réserves, Garanties, DOE, Autres. On n'affiche que les
  familles réellement présentes (avec leur compte) — jamais de puce morte. Le filtrage
  est une pure lecture : aucune donnée n'est modifiée (retour « Tous » = liste intacte).

**Mécanique (déplacement + lecture, aucun nouveau concept) :** nouvelle lib pure
`lib/documentFilter` (`documentFamily` déduit la famille d'un document depuis sa catégorie

- son libellé, ou la nature structurée d'un compte rendu ; `presentFamilies` ;
  `filterDocuments`) et composant partagé `DocumentFilterBar` (puces `role=tab`, masqué s'il
  n'y a qu'une famille). Appliqué à la bibliothèque de `DocumentsTab` (conducteur) et à
  `ClientDocuments` (client). `PrepDocumentsSection` perd son formulaire (le suivi
  d'obtention, l'ouverture, « Demander au client » et le partage restent). La check-list de
  partage « Acompte payé » se valide via le cockpit (« Marquer comme payé »), source unique
  inchangée.

**Alternatives rejetées :** garder le formulaire « au cas où » (le doublon qu'on
supprime) ; afficher les 13 familles en dur, y compris vides (bruit) ; ajouter un
sélecteur de catégorie au composer (nouveau champ non demandé — la famille se déduit).

**Impact :** `lib/documentFilter` + `components/DocumentFilterBar` (nouveaux),
`DocumentsTab` (filtre + plus de silo), `ClientDocuments` (filtre), `prep/PrepDocuments`
(formulaire retiré). Nouveau `documents-filtres.test` (formulaire absent, ajout via
Nouvelle mission uniquement, filtres conducteur + client, filtrage non destructif) ; tests
d'ajout recalés vers Nouvelle mission : `documents`, `documents-partage`,
`documents-acompte-facture`, `coulisses-photos`, `notifications-bidirect`, `media-capture`.
Gate vert (e2e 50/50). VISION Art. 7, 8, 9, 11.
