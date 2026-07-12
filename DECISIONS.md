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

## 07/07/2026 — Réponse à une demande de document (échange documentaire, pas une conversation)

**Décision produit (retour terrain) :** une demande de document sert à RÉCUPÉRER un
document — répondre par un simple message ne suffit pas. **Le document est l'élément
principal ; le commentaire est facultatif.** Le client peut répondre de trois façons :
commentaire seul, document seul, document + commentaire.

- **Pièces jointes** : PDF / JPEG / PNG, via le sélecteur natif habituel de PHÉNIX
  (`ACCEPT_DOCUMENT`, sans `capture`) — sur mobile : prendre une photo, galerie, Drive,
  Fichiers. Cohérent avec tous les autres uploads.
- **Enregistrement automatique** : le document envoyé devient un événement `document`
  (visible client, publié), classé au projet. Il apparaît dans « Documents » des DEUX
  côtés (conducteur ET client), consultable et téléchargeable. Le conducteur ne
  retélécharge/réimporte jamais rien.
- **Notification conducteur** dans « Aujourd'hui » : « 📎 … a envoyé : {document} » (ou
  « a répondu à votre demande de document » pour un commentaire seul). Le clic ouvre
  directement l'onglet Documents du chantier, sur le document reçu.

**Mécanique (enrichissement d'une demande existante, aucun nouveau concept) :** la
`DemandeContent` gagne `attendu: 'document'` + `docLibelle` / `docCategorie` (posés par
« Demander au client ») ; la `DemandeResolution` gagne `docEventId` (lien vers le document
créé). `toDecision` projette ces champs. Nouveau port `demo.resolveDocumentDemande` : crée
l'événement `document` (acteur = client) puis résout la demande. `conductorNotifications`
notifie sur la demande de document résolue ; `clientNotifications` ignore les documents que
le client s'est lui-même envoyés (pas d'auto-notification). Le `DecisionResponder` gère la
réponse documentaire (joindre + commentaire, l'un ou l'autre suffit). Côté `ClientView`, une
demande de document n'est PLUS une « décision » : elle sort du bandeau « Une décision vous
attend » (`SmartBanner`) pour vivre dans sa propre section « Documents demandés », toujours
atteignable. Le seed Lyon 6e gagne deux documents « à fournir » (démo réaliste).

**Alternatives rejetées :** garder la réponse en message seul (ne récupère pas le document) ;
demander au conducteur de réimporter le fichier (double manipulation) ; traiter la demande de
document comme une décision d'ambiance (mélange deux univers).

**Impact :** `core/event` (+`attendu`/`docLibelle`/`docCategorie`/`docEventId`),
`core/decision` (`toDecision`), `store` (`resolveDocumentDemande`, notifications),
`DecisionResponder` (réponse documentaire), `DocumentsTab` (« Demander au client » marque la
demande), `ClientView` (section « Documents demandés »), `seed`. Nouveau
`demande-document.test` (trois modes de réponse, notification conducteur, document présent et
consultable des deux côtés, commentaire seul ne crée aucun document). Gate vert (e2e 51/51).
VISION Art. 6, 7, 8, 9, 11.

## 07/07/2026 — Demander au client = point d'entrée unique typé (décision / document / question)

**Décision produit (retour terrain) :** « je ne trouve pas comment demander un document ».
Règle simple : **tout ce que le conducteur demande au client passe par « + Nouvelle mission
→ Demander au client »**, où il choisit le TYPE :

1. **Demander une décision** → ouvre le composer de décision structuré (existant).
2. **Demander un document** → libellé + type de document (Justificatif d'acompte, Attestation
   assurance, RIB, Diagnostic, DPE, Plan, Autorisation copropriété, Pièce d'identité, Autre) +
   message facultatif + échéance facultative ; **visible client automatiquement**.
3. **Poser une question simple** → une question ouverte.

Le client reçoit la demande dans « Aujourd'hui » (section « Documents demandés » pour un
document) et répond en trois façons (commentaire seul / fichier seul / fichier + commentaire ;
PDF/JPEG/PNG via le sélecteur natif). À réception d'un fichier : la demande passe en **« Reçu »**
(sinon « Répondu » pour un commentaire seul), le conducteur est notifié dans « Aujourd'hui », et
le document est **ajouté automatiquement à l'onglet Documents** (des deux côtés), ouvrable et
téléchargeable — jamais de réimport.

**Créer une demande de document ne se fait PLUS depuis l'onglet Documents** : ce dernier ne fait
que consulter (bibliothèque + suivi « Documents demandés au client » avec statut En attente /
Reçu / Répondu). Créer = Nouvelle mission ; consulter = Documents.

**Mécanique (enrichissement de l'action existante, aucun nouvel écran) :** le composer
« Demander au client » (kind `demande`) présente un menu 3 choix ; « Décision » remonte au
composer structuré via `onEscalateDecision`, « Document » et « Question » restent en ligne. La
`DemandeContent` gagne `echeance?` (les champs `attendu`/`docLibelle`/`docCategorie` existaient
déjà) ; `toDecision` la projette. Le bouton « Demander au client » par document quitte la
check-list de préparation ; `DocumentsTab` gagne la section de suivi « Documents demandés au
client » et ne crée plus rien (retrait de `askDocument`/`onAskDocument`, `actor`). Le raccourci
contextuel « Demander » du radar (AttentionPanel) crée désormais une vraie demande de document
(`attendu: 'document'`). Le bouton autonome « Décision client » de « Nouvelle mission » est
absorbé par « Demander au client → Décision ».

**Alternatives rejetées :** garder la demande de document cachée dans l'onglet Documents (le
conducteur ne la trouvait pas) ; multiplier les points d'entrée (Documents + radar + mission) ;
deux boutons « décision » distincts dans Nouvelle mission (doublon).

**Impact :** `core/event` (+`echeance`), `core/decision` (`toDecision`), `Composer` (menu 3
types + formulaire document), `MissionPicker` (retrait « Décision client »), `CompagnonView`
(escalade décision, demande de document contextuelle), `prep/PrepDocuments` (retrait du bouton),
`DocumentsTab` (suivi « Documents demandés », plus de création). `demande-document.test` réécrit
(entrée Nouvelle mission, 3 modes, statut Reçu/Répondu, notification, ouvert/téléchargé des deux
côtés, client-safe) ; `mission-entree-unique` et `client-decision` recalés. Gate vert (e2e
51/51). VISION Art. 6, 7, 8, 9, 11.

## 07/07/2026 — Suppression du bandeau « PHÉNIX surveille votre chantier » (fin du 2ᵉ tableau de bord)

**Décision produit (retour terrain) :** depuis la refonte, le bandeau radar en tête du
chantier (« PHÉNIX surveille votre chantier ») est un DOUBLON — ses informations vivent déjà
dans leur univers : les alertes/actions dans « Aujourd'hui », le pilotage dans « Préparation »,
l'historique au « Suivi », les documents dans « Documents », les photos dans « Dans les
coulisses ». On le **supprime entièrement, sans le remplacer** : le conducteur arrive
directement sur les onglets du chantier (Suivi / Préparation / Documents / Dans les coulisses /
Réserves). Le chantier ne possède plus de second tableau de bord ; **les alertes ne vivent que
dans « Aujourd'hui »**.

**Peut-on supprimer sans perte fonctionnelle ? Oui** — toutes les informations existent déjà
ailleurs. Le raccourci contextuel « Demander » du radar disparaît lui aussi : demander un
document passe désormais par « Nouvelle mission → Demander au client → Document ».

**Mécanique :** retrait de `<AttentionPanel>` de `CompagnonView` (+ suppression du calcul
`buildChantierAttention` et de la fonction `askDocument` devenue inutile) ; le composant
`components/AttentionPanel.tsx` est supprimé. Le sélecteur core `buildChantierAttention` reste
disponible (pur, sans UI) mais n'est plus consommé — aucune modification du modèle.

**Alternatives rejetées :** remplacer le bandeau par un autre encart de synthèse (on recréerait
le doublon) ; garder un radar allégé (deux endroits où lire les alertes).

**Impact :** `CompagnonView` (retrait du panneau), suppression de `AttentionPanel.tsx`. Nouveau
`chantier-sans-radar.test` (le bandeau n'existe plus, on arrive directement sur les onglets,
chaque onglet s'ouvre, les alertes vivent dans « Aujourd'hui », zéro erreur console). Gate vert
(e2e 52/52). VISION Art. 3, 7, 10, 11.

## 07/07/2026 — Aucun document « mort » : le TITRE ouvre le document (partout)

**Décision produit (retour terrain) :** dans « Documents », les documents s'affichaient mais on
ne savait pas où cliquer — seul un petit bouton « Ouvrir le document » agissait, pas le document
lui-même. Règle : **si un document apparaît dans une liste, un clic sur son titre l'ouvre
immédiatement.** Il ne doit jamais exister un document visible mais inaccessible.

- Le **titre** (icône + libellé + méta) devient un bouton cliquable qui ouvre le document, dans
  la bibliothèque du chantier ET le suivi « Documents demandés au client » (conducteur) et dans
  l'espace client. Les boutons « Ouvrir le document » et « Télécharger » restent (redondance
  assumée : deux affordances, jamais de ligne morte).
- L'ouverture reste la règle unique : fichier PDF/image → aperçu natif du navigateur (zoom
  natif) ; document GÉNÉRÉ par PHÉNIX (compte rendu, PV de visite / pré-réception / réception,
  avenant, facture…) → page HTML autonome relisible à tout moment. Le téléchargement et le
  partage (visibilité) restent inchangés.

**Constat technique :** le port `demo.openDocument` ouvrait déjà TOUJOURS quelque chose (fichier
réel si `dataUrl`, sinon document généré) — aucun bug d'ouverture. Le vrai défaut était UX : la
zone cliquable se limitait à un bouton discret. On rend donc la ligne interactive, sans nouveau
concept ni logique métier.

**Alternatives rejetées :** retirer les boutons au profit du seul clic-titre (casse les tests et
réduit la lisibilité) ; ouvrir dans un panneau maison (l'aperçu natif du navigateur offre déjà
zoom / impression / téléchargement).

**Impact :** `DocumentsTab` (titre cliquable dans la bibliothèque + « Documents demandés »),
`ClientDocuments` (titre cliquable). Nouveau `documents-cliquables.test` (chaque ligne
conducteur ET client ouvre au clic du titre — PDF, image, document généré —, aucun document
mort, téléchargement des deux côtés, zéro erreur console). Gate vert (e2e 53/53). VISION
Art. 7, 8, 9, 11.

## 08/07/2026 — « Dans les coulisses » : album & viewer photo dignes d'un album premium

**Décision produit (retour terrain) :** les coulisses sont la brique PLAISIR (l'album du
chantier que le client regarde). Quatre défauts nuisaient à cette promesse — on les corrige
d'un bloc, sans nouveau concept ni logique métier (présentation seule) :

1. **La photo était RECADRÉE.** Le viewer plein écran forçait chaque image dans un cadre 4:5
   (`object-cover`) : les bords étaient rognés. On montre désormais la **photo entière**
   (`object-contain`, letterbox) — on ne coupe plus rien. **Subtilité technique déterminante :**
   le calque d'annotations (`PhotoAnnotator`) se positionne en `inset-0` avec des coordonnées
   normalisées 0..1 ; un `object-contain` naïf aurait désaligné toutes les annotations sur les
   bandes de letterbox. Le conteneur **épouse donc la photo** (`inline-block`, l'image porte
   `max-h`/`max-w`), si bien que l'overlay reste calé au pixel près.
2. **On ne pouvait pas regarder un détail.** Ajout d'un **zoom** (bouton + double-clic), avec
   **déplacement au doigt/souris** une fois zoomé ; flèches et swipe désactivés pendant le zoom
   pour ne pas se télescoper ; zoom réinitialisé au changement de photo et à l'entrée en
   annotation. Le zoom n'apparaît que sur une **vraie image** (pas les tuiles dégradées).
3. **Navigation pauvre dans un album.** Les simples points de pagination deviennent une
   **pellicule de miniatures** défilante : on parcourt l'album d'un coup d'œil et on saute à
   une photo ; pastille or = la photo porte un mot.
4. **La carte d'un album ne montrait qu'UNE photo.** Un album (≥ 2 photos) affiche maintenant une
   **mosaïque d'aperçu** (couverture + suivantes, « +N » au-delà de 3) — on voit immédiatement
   qu'il y en a plusieurs. La mosaïque reste **dans le cadre dense 6/5** (contrat `recit-densite`).
5. **Bonus cohérence :** dans la **Bibliothèque**, les vignettes étaient des `<div>` morts —
   cliquer n'ouvrait rien. Elles deviennent cliquables et **ouvrent le viewer** sur la bonne
   photo (même règle que « tout est consultable d'un clic », 07/07).

**Alternatives rejetées :** garder `object-cover` et « juste » agrandir le cadre (on continue de
rogner) ; recalculer la position des annotations en fonction du letterbox (fragile, deux sources
de vérité géométriques) ; un carrousel de vignettes distinct de la galerie (deux façons de
naviguer). Le pinch natif multi-touch est laissé à plus tard : le zoom bouton + glisser couvre le
besoin sur mobile sans dépendance.

**Mécanique :** `MomentGallery` (photo entière + zoom/pan + pellicule), `FilMoment` (mosaïque
d'aperçu), `BibliothequeView` (vignettes → bouton `onOpenPhoto`), `FilView` (câblage vignette →
galerie ciblée). Aucun changement de modèle ni de sélecteur core ; client-safe et append-only
intacts. Nouveau `coulisses-viewer.test` (mosaïque ≥ 2 images, photo `object-contain`, pellicule +
compteur, zoom masquant les flèches, vignette Bibliothèque ouvrant le viewer, zéro erreur console),
`recit-densite` toujours vert (cadre 6/5 conservé). Gate vert (e2e 54/54). VISION Art. 1, 8, 9, 11.

## 08/07/2026 — Viewer photo : un VRAI plein écran, pas un overlay sur la page (RC1)

**Décision produit (retour terrain, test réel) :** l'album progressait, mais **ouvrir une photo
donnait une impression cassée** : énorme bande noire, photo mal centrée, on voyait encore la page
derrière, il fallait parfois scroller, et le **header** comme le **concierge Léon** restaient
au-dessus. Ce n'était pas une galerie. Objectif : un **vrai mode de consultation photo** (type
Photos iPhone / Instagram).

**Cause racine (deux défauts distincts) :**

1. **Ce n'était pas au-dessus de la page.** Le viewer était rendu _dans l'arbre_ de `FilView`
   avec `z-modal` (1400) et un fond **semi-transparent** (`rgba(19,16,9,0.985)`). Or Léon est
   **porté sur `body`** avec le **même** `z-modal` → il passait devant ; le header (`z-sticky`)
   et la page transparaissaient.
2. **La photo ne tenait pas dans la fenêtre.** L'image était plafonnée à `max-h-72vh` **et** un
   gros panneau bas (légende + messages + annotations + saisie) mangeait la hauteur → la somme
   dépassait l'écran (scroll), la photo était petite, cernée de noir.

**Correctif :**

- **Portal sur `document.body`** + **nouveau token `z-viewer` (1500)** — au-dessus des modales
  et de Léon (`z-modal` 1400), sous les toasts (1600). Ajout du token à `packages/ui`
  (`tokens.ts` + preset). **Fond noir OPAQUE** (`#000`) plein écran.
- **Scroll du body verrouillé** tant que le viewer est ouvert (rétabli à la fermeture).
- **La photo tient TOUJOURS dans la fenêtre, centrée, entière.** On mesure la zone photo
  (`ResizeObserver`) et le **ratio réel** de l'image (`width/height`, affiné à `onLoad`), puis on
  donne au cadre exactement le plus grand rectangle au bon ratio qui rentre — `object-contain`, ni
  recadrage ni scroll. Le cadre épousant l'image, **le calque d'annotations reste aligné** (le
  problème géométrique du letterbox disparaît).
- **Chrome compact** : barre haute (titre, compteur `1 / n`, zoom, annoter, fermer) ; barre basse
  (pellicule de miniatures **compacte** + messages/annotations **plafonnés et défilant en
  interne**, jamais un scroll de page). Flèches desktop, swipe mobile, clavier — inchangés.

**Alternatives rejetées :** monter le `z-index` sans portal (un ancêtre de `FilView` peut créer un
contexte d'empilement qui piège le `fixed`) ; réutiliser `z-toast` (sémantiquement faux, passerait
devant les toasts) ; garder le panneau bas en flux (revole la hauteur) ; recomposer la position des
annotations d'après le letterbox (fragile).

**Mécanique :** `MomentGallery` réécrit (portal, fond noir, verrou body, dimensionnement mesuré,
chrome compact) ; token `z-viewer` (`packages/ui`). `coulisses-viewer.test` étendu (fond noir plein
écran, photo `object-contain` contenue dans la fenêtre, body verrouillé + libéré à la fermeture,
**header occulté**, **Léon occulté** côté client via `elementFromPoint`, desktop + mobile). Aucun
changement de modèle ni de logique. Gate vert (e2e 54/54, zéro erreur console). VISION Art. 8, 9, 11.

## 08/07/2026 — Viewer photo : expérience immersive type Photos iPhone / Instagram (RC2)

**Décision produit :** le RC1 était un vrai plein écran ; le RC2 en fait une **expérience**. Quand
on ouvre un album, on doit **oublier PHÉNIX** : la photo est le sujet, l'interface s'efface.
**On ne touche pas à l'architecture RC1** (portal, `z-viewer`, verrou body, `ResizeObserver`,
annotations alignées) — on ajoute la couche immersive par-dessus.

- **Chrome minimal + auto-effacement.** Deux niveaux : le **niveau 1** (compteur `1/n`, fermer,
  flèches) reste au repos ; le **niveau 2** (titre, zoom, annoter, bouton commentaires, pellicule,
  légende) **apparaît au mouvement** et **s'efface après 4 s d'inactivité**. Transitions en
  opacity, aucun flash.
- **Tap pour l'immersion totale.** Un tap sur la photo masque **tout** le chrome ; un mouvement (ou
  un nouveau tap) le ramène. Repères `data-chrome` pour un test déterministe de l'opacité.
- **Commentaires en Bottom Sheet.** Ils ne volent plus de hauteur : un bouton **« Commentaires
  (N) »** ouvre une feuille (commentaires + annotations + saisie) ; **la photo reste visible
  derrière** ; fermeture au clic (croix / fond) ou **glissé vers le bas**.
- **Pellicule** réduite (miniatures `size-10`), intégrée au niveau 2 (donc auto-effacée).
- **Navigation** : flèches desktop + clavier ←/→, **swipe horizontal** mobile ; changement de photo
  **instantané** grâce au **préchargement** systématique des voisines (précédente + suivante).
- **Fermeture** multi-voies : **Échap** (referme d'abord la feuille si ouverte), **croix**, **clic
  sur le fond noir** (hors photo), **glissé vers le bas** (mobile).
- **Orientation** : à la rotation, on **conserve** la photo affichée et le zoom ; seul le viewport
  est recalculé (le `ResizeObserver` redimensionne le cadre, l'index et le zoom sont préservés).
- **Accessibilité** : **focus piégé** dans le viewer (cycle Tab), et **rendu à l'élément ouvrant**
  à la fermeture.
- **Animations** : ouverture opacity + léger `scale`, fermeture inverse (démontage différé ~200 ms),
  transitions de navigation fluides.

**Alternatives rejetées :** garder les commentaires en flux (revole la hauteur, contredit
l'immersion) ; masquer le chrome via `display:none` (casse les transitions et le piège à focus) ;
inertie de swipe « physique » (surcoût sans bénéfice réel en V1 — un seuil + transition suffit) ;
pincer-zoomer multi-touch natif (reporté ; zoom bouton + double-tap + glisser couvre le besoin).

**Mécanique :** `MomentGallery` (niveaux de chrome `immersive`/`controls` + minuterie d'inactivité,
Bottom Sheet, préchargement, piège à focus + restitution, animations d'ouverture/fermeture, tap /
clic-fond / glissé). Aucun changement de modèle, de sélecteur core, ni de l'architecture RC1.
`coulisses-viewer.test` étendu (tap masque puis mouvement révèle via `data-chrome`, Bottom Sheet
ouvre/ferme avec photo derrière, fermeture Échap + clic-fond, focus rendu à l'ouvrant) ; les acquis
RC1 restent couverts. Gate vert (e2e 54/54, zéro erreur console). VISION Art. 8, 9, 11.

## 09/07/2026 — Suppression complète de l'annotation photo (moins, c'est plus)

**Décision produit validée :** on RETIRE totalement la fonction « Annoter » du viewer photo.
L'annotation sur photo créait **plus de complexité que de valeur** : risque de confusion et de
mauvais usage côté client, surcharge UX, maintenance inutile, et surtout **doublon avec les
commentaires**. Nouvelle règle : dans « Dans les coulisses », une photo se **regarde**, se **like**
et se **commente** — elle **ne s'annote plus**.

**Retiré, de bout en bout (aucune trace morte) :**

- **Viewer** (`MomentGallery`) : bouton « Annoter », icône crayon, bouton afficher/masquer, mode
  édition, calque de dessin, états (`editing`, `showAnnotations`, `reserveFor`…), et le pont
  « créer une réserve depuis une annotation » du Bottom Sheet. Props `annotations`,
  `canCreateAction`, `onAddAnnotation`, `onCreateReserve` supprimées.
- **Composant dédié** : `PhotoAnnotator.tsx` **supprimé**.
- **Câblage** (`FilView`) : ne lit plus ni ne passe les annotations.
- **Store** : clé `FIL_ANNOTATIONS_KEY`, état `annotations`, `addAnnotation`, `deleteAnnotation`,
  `createReserveFromAnnotation`, persistance, purge par projet, sauvegarde/restauration, et
  `filOf.annotations`.
- **Core** : `Annotation`, `AnnotationType`, `AnnotationPoint`, `ANNOTATION_TYPES`,
  `annotationsDePhoto`, `comptesAnnotationsParPhoto`, `prochainNumeroAnnotation`, `AnnotationId` +
  `annotationId`. `FilSource.annotationId` retiré (le lien réserve→photo `photoId` **reste**).
- **Seed** : annotation seedée retirée ; la **réserve** correspondante est **conservée** (interne,
  levable) avec son lien `photoId` — « Voir la photo » reste fonctionnel.

**Préservé (intact) :** commentaires (photo + Bottom Sheet), likes ❤️, albums, miniatures, viewer
plein écran (portal, `z-viewer`, verrou body, dimensionnement mesuré, navigation, zoom), documents,
notifications, **réserves** (création manuelle + « Voir la photo »), journal.

**Tests :** `coulisses-viewer.test` — nouvelles assertions **« plus aucune fonction Annoter »**
côté **conducteur** ET côté **client** ; tous les acquis viewer (plein écran, body lock,
`z-viewer`, navigation, pellicule, commentaires, occlusion, desktop) conservés. Aucun test
d'annotation n'existait à supprimer. Gate verte (typecheck, lint, prettier, build, e2e 54/54, zéro
erreur console). VISION Art. 8, 9, 11 (l'écran se comprend en 10 s, rien d'interne ne fuit, la
simplicité est une fonctionnalité).

## 09/07/2026 — Fusion « Visite » + « Réunion » → « Compte rendu de chantier » (à points)

**Décision produit validée :** une visite improvisée et une réunion programmée produisent le même
résultat (des observations, des photos). Le conducteur ne doit plus choisir le bon bouton : il
**raconte ce qu'il vient de constater**. On supprime la distinction Visite / Réunion → un seul
**« Compte rendu de chantier »**. Les 5 autres missions (Livraison, Pré-réception, Réception, SAV,
Note) sont conservées (elles ont leurs propres livrables : PV, fiche SAV, bon de livraison).

**Deux arbitrages tranchés avec le PO :** (1) le nouveau CR est **à points** (photo + commentaire +
diffusion) et abandonne la déduction décisions/actions/réserves + présents — MAIS **conserve la
confirmation d'étape** : l'avancement reste porté par le compte rendu (invariant ADR-002 §5) ;
(2) on **garde** les 5 autres missions (fusion Visite+Réunion uniquement, conforme à « supprimer la
logique séparant visite et réunion »).

**Structure d'un compte rendu :** infos générales (date / heure / auteur, portées par
l'événement), puis une suite de **points**. Chaque point = **1 photo (obligatoire)** + **1
commentaire (obligatoire)** + **1 cible de diffusion** : `Client` / `Artisan` / `Client + Artisan`.
Aucune autre cible. UX de capture : photographier → écrire une phrase → choisir la cible → point
suivant. Étape franchie **facultative** en fin de saisie.

**Diffusion & confidentialité (client-safe strict) :**

- La **visibilité de l'événement** est DÉRIVÉE des points : `client` s'il existe ≥ 1 point destiné
  au client (client ou les deux) ; sinon `interne` (CR 100 % artisan → invisible au client).
- **Conducteur** : voit TOUS les points, avec le **badge** de diffusion (affichage chronologique
  photo + commentaire + badge au Suivi).
- **Client** : ne voit QUE les points `client` + `les deux` — le point `artisan` reste **totalement
  invisible** (jamais dans l'espace client, jamais dans son PDF).
- **PDF / document imprimable** filtré par destinataire : **PDF client** = points client + les
  deux ; **PDF artisan** = points artisan + les deux. En-tête « Version client / artisan ».

**Mécanique :** core — `MissionKind` fusionné (`compte_rendu` remplace `visite`+`reunion` ;
`reunion`/`visite` restent des `MomentType` HÉRITÉS pour les données antérieures), nouveau modèle
`Diffusion` + `CompteRenduPoint` + `content.points`, sélecteurs `pointsPourAudience` /
`crADesPointsPour` ; `prepareMission` ne traite plus visite/réunion. App — nouveau flux de capture
`CompteRenduFlow` (routé depuis `CompagnonView`), rendu inline `CompteRenduPoints` (Suivi
conducteur, badges), `buildDocumentHtml` paramétré par audience (points filtrés + style),
`openDocument`/`downloadDocument` + `DocumentButton` + `ClientDocuments` audience-aware (le client
ouvre la version client), `MissionPicker` mis à jour. Nouveau `compte-rendu.test` (picker fusionné,
3 points, conducteur voit tout + badges, client ne voit pas le point artisan, **PDF client / PDF
artisan filtrés** vérifiés via le document ouvert). Aucun test existant ne sélectionnait Visite /
Réunion. Gate verte (typecheck, lint, prettier, build, e2e, zéro erreur console).
VISION Art. 1, 5, 8, 9, 11.

## 09/07/2026 — Compte rendu : un point porte 1 à 3 photos (mini-album)

**Évolution produit :** un point représente UNE observation ; il mérite parfois plusieurs angles
(vue générale, détail, gros plan). Un point porte désormais **1 à 3 photos** (au lieu d'une seule),
le **commentaire reste unique** et concerne l'ensemble des photos. Le conducteur peut **prendre une
photo directement OU en choisir une existante** (sélecteur natif `image/*` sans `capture`, déjà en
place — appareil / galerie / fichiers) et en ajouter jusqu'à trois. UX inchangée dans l'esprit :
ajouter un point → 1 à 3 photos → commentaire → cible → point suivant → publier.

**Mécanique :** core — `CompteRenduPoint.imageUrl` (photo unique) devient `photos: CompteRenduPhoto[]`
(1 à 3), + constante `MAX_POINT_PHOTOS = 3`. App — `CompteRenduFlow` capture un mini-album par point
(sélection multiple, retrait photo par photo, bouton d'ajout masqué à 3) ; `CompteRenduPoints`
(Suivi) et `buildDocumentHtml` (document / PDF) affichent les photos en **mini-album** (rangée de
vignettes au-dessus du commentaire). Le filtrage par destinataire et la confidentialité client-safe
sont inchangés (par point). `compte-rendu.test` étendu (point à 3 photos, plafond à 3 vérifié).
Gate verte (typecheck, lint, prettier, build, e2e, zéro erreur console). VISION Art. 5, 8, 11.

## 09/07/2026 — Correctif CRITIQUE : page Chantier blanche (compat comptes rendus)

**Bug :** la page « Chantier » restait BLANCHE. **Cause racine reproduite** (test dédié) : le
passage du compte rendu au mini-album a changé le modèle d'un point de `imageUrl` (photo unique)
à `photos: CompteRenduPhoto[]`. Les comptes rendus créés avec la version PRÉCÉDENTE (points avec
`imageUrl`, **sans `photos`**) restaient en base locale ; au rendu du Suivi, `point.photos.length` /
`point.photos.map` s'exécutaient sur `undefined` → `TypeError: Cannot read properties of undefined
(reading 'length')` → tout le chantier plantait (pas de garde-fou d'erreur) → écran blanc. Un
chantier **frais** (seed sans point) ne plantait pas — d'où une suite verte mais un PO bloqué : le
défaut ne touchait QUE les données déjà présentes.

**Correction (vraie cause, sans contournement) :** compatibilité ASCENDANTE explicite. On garde
`imageUrl?` sur `CompteRenduPoint` en champ **déprécié (lecture seule, jamais écrit)** et on ajoute
un accesseur unique `pointPhotos(point)` qui normalise : `photos` si présent, sinon
`[{ imageUrl }]`, sinon `[]`. **Tous les sites de lecture** des photos d'un point stocké passent
désormais par lui (`CompteRenduPoints` du Suivi, `buildDocumentHtml` du document / PDF). Pas de
try/catch, pas de fallback blanc : un point historique s'affiche correctement.

**Anti-régression :** nouveau `chantier-blanche.test` — injecte un compte rendu à l'ANCIEN format
(point `imageUrl`, sans `photos`) daté du jour, puis vérifie que la page Chantier **ne reste pas
blanche**, que le point historique **s'affiche**, que **tous les onglets** (Suivi / Préparation /
Documents / Dans les coulisses) s'ouvrent, et **zéro erreur console**. Confirmé : ROUGE avant le
correctif (`pageerror … reading 'length'`), VERT après. Gate complète relancée. VISION Art. 11.

## 09/07/2026 — « Nouvelle mission » simplifiée : retrait de « Livraison de matériel »

**Décision produit validée :** on retire **provisoirement** la mission « Livraison de matériel »
du menu « Nouvelle mission ». Trop spécifique, valeur insuffisante pour une V1. Objectif : réduire
le nombre de choix — moins le conducteur réfléchit, plus PHÉNIX est efficace. Le menu ne propose
plus que les missions du quotidien : **Compte rendu de chantier · Pré-réception · Réception · SAV ·
Note** (5 au lieu de 6).

**Réversible (logique métier conservée) :** on ne retire QUE l'entrée du catalogue `MISSIONS` (les
cartes du picker en dérivent → la carte, son icône et son libellé disparaissent, sans trou dans la
grille `sm:grid-cols-2`). On **garde** le `MissionKind` `livraison`, ses libellés
(`MISSION_LABEL` / `MISSION_DOC_TITLE`), son icône (`Truck` dans `ICONS`) et la branche
`prepareMission` `livraison` : le flux reste isolé et inactif. **Réactiver = ré-ajouter une seule
ligne** dans `MISSIONS`. À noter : le compteur « Livraisons à contrôler » d'« Aujourd'hui » est
indépendant (dérivé des commandes/alertes) — inchangé.

**Tests :** garde négative ajoutée à `compte-rendu.test` (le picker ne propose plus « Livraison de
matériel »). Aucun test ne sélectionnait cette mission. Gate verte (typecheck, lint, prettier,
build, e2e, zéro erreur console). VISION Art. 4, 11.

## 09/07/2026 — Léon, point d'entrée UNIQUE du client → demande conducteur (1 demande = 1 réponse)

**Décision produit validée :** le client n'a **PAS** de bouton « Faire une demande ». **Léon devient
l'unique porte d'entrée** de toutes les interactions client — il ne se demande jamais « est-ce que je
pose ma question ici ? est-ce que je fais une demande ? est-ce que je contacte PHÉNIX ? ». Il parle
uniquement à Léon. Cette simplicité est un principe fondamental de PHÉNIX 360.

**Fonctionnement :** dans la conversation avec Léon, le client écrit librement et peut **joindre 0 à
3 photos** (texte et/ou photos). C'est **Léon qui décide** : (1) s'il connaît la réponse (info du
chantier) → il répond **immédiatement**, aucun ticket, aucune intervention conducteur ; (2) s'il ne
sait pas — ou dès qu'une **photo** est jointe (Léon ne voit pas les images, l'œil humain est requis)
— il répond « **Je vais transmettre votre demande à votre conducteur de travaux PHÉNIX. Vous serez
notifié dès qu'une réponse sera disponible.** » et **crée AUTOMATIQUEMENT une demande conducteur**.
Le client ne crée jamais un ticket lui-même.

**La demande créée** contient : texte du client + 0 à 3 photos + date + auteur. Statut **À traiter**.

**Côté conducteur :** la demande **remonte automatiquement dans « Aujourd'hui »** (« Question
client · … », `questionsEnAttente`) tant qu'elle n'est pas traitée. Le conducteur l'ouvre au Suivi
et **répond une fois** — texte libre + 0 à 3 photos. Une seule réponse autorisée.

**Après réponse :** statut **Répondu**, la demande **quitte Aujourd'hui** (état `traitee`), une
**notification part au client**. La réponse est visible côté client (dans « Vos demandes » ET reprise
dans le fil de Léon). Côté client, un statut client-safe **« En attente »** (jamais le « à traiter »
interne du conducteur, qui ne doit pas fuiter).

**Trace Suivi (mémoire officielle) :** chaque demande trace le Suivi avec la demande + ses photos,
la réponse + ses photos, le statut et les dates (demande, réponse). Le Suivi devient la mémoire
officielle de tous les échanges.

**Mécanique (réutilise le modèle existant) :** le type d'événement `demande` `destinataire:'phenix'`
portait déjà « question du client → réponse conducteur » (`resolveDemande` → `resolution`), et Léon
(`askPhenix`) escaladait déjà en créant cette demande. Ajouts : `photos?` sur `DemandeContent` et
`DemandeResolution` (`MAX_DEMANDE_PHOTOS = 3`) ; sélecteurs `demandesPourPhenix` / `demandeRepondue` ;
`hasPhotos` sur l'entrée core de Léon → **escalade forcée** dès qu'une photo est jointe, et message
d'escalade unifié « je transmets à votre conducteur ». App : `askPhenix(projectId, actor, question,
photos)` attache les photos à la demande et au message client ; le widget **Léon** gagne une **icône
d'ajout de photos** (0–3) et affiche les photos jointes dans la bulle client ; notification client à
la réponse (`clientNotifications`) ; composants `PhotoPicker` (0–3 photos), `DemandeThread` (question

- photos + réponse + photos + statut + dates, réponse inline conducteur), câblés dans « Vos demandes »
  (client, lecture seule) et le Suivi conducteur. **Retiré :** le bouton « Faire une demande » et le
  composant `ClientDemandeComposer` (Léon est le seul point d'entrée). Aucune messagerie, aucune
  conversation infinie. `demande-client.test` (10/10 : Léon = point d'entrée / pas de bouton, escalade
  texte seul, escalade texte+photos, remontée Aujourd'hui, réponse texte / texte+photos, disparition
  d'Aujourd'hui, trace Suivi, notification + réponse reprise dans Léon). Gate verte (typecheck, lint,
  prettier, build, e2e, zéro erreur console). VISION Art. 2, 8, 9, 10, 11.

## 09/07/2026 — Correctif critique : demande à Léon avec photo figeait le chat (quota localStorage)

**Bug observé (production) :** après avoir beaucoup testé l'app (photos accumulées), envoyer une
demande à Léon **avec une photo** figeait tout — rien ne s'affichait dans la conversation, le chat
devenait inutilisable (envoi et ajout de photo impossibles), et **aucune demande n'était créée** côté
conducteur.

**Vraie cause (reproduite déterministiquement) :** `askPhenix` écrivait D'ABORD le fil de
conversation **avec les photos recopiées** (data URL base64) dans `localStorage`. Sur un stockage
quasi plein, `localStorage.setItem('…phenix-conv:v1', …)` levait `QuotaExceededError`. Cette exception
n'était pas rattrapée : la promesse `askPhenix` était rejetée, donc dans `PhenixWidget.send` le
`setBusy(false)` n'était jamais atteint → **chat figé sur `busy`** ; et l'écriture ayant échoué
_avant_ la création de la demande, **la demande n'existait pas**. Le `InMemoryBackend` de la démo est
« read-through » (localStorage = source de vérité), donc un `setItem` qui échoue = donnée perdue.

**Correctif (la vraie cause, sans masquer) :**

1. **Les photos quittent le blob de conversation.** Elles vivent désormais **uniquement dans
   l'événement demande** (source unique) ; le fil ne garde que le texte + une référence
   (`demandeRef`), et la bulle client réaffiche les photos **depuis la demande**. Fini la duplication
   d'un gros payload base64 dans un blob éphémère — l'écriture du fil redevient minuscule.
2. **`safeSetItem` :** toute écriture localStorage est best-effort — sur quota, on **journalise
   (console.warn) et on continue** au lieu de laisser l'exception casser le flux. La session reste
   fonctionnelle (vérité en mémoire vive) ; seule la survie au rechargement dégrade.
3. **`PhenixWidget.send` en `try/finally` :** `busy` est **toujours** relâché, quoi qu'il arrive — le
   chat ne peut plus rester figé.
4. **Ordre :** la demande conducteur est créée **avant** l'écriture du fil, pour que les messages la
   référencent et que la demande existe même si le fil ne persiste pas.

**Vérifié :** reproduction déterministe (localStorage rempli à ~4,3 Mo) — avant : `QuotaExceededError`
sur `phenix-conv:v1`, chat figé, 0 demande ; après : confirmation affichée, chat utilisable, demande
créée et visible côté conducteur, 0 exception. Nouveau `demande-client-quota.test` (pas de gel, pas
d'exception quota non rattrapée, confirmation visible sous pression mémoire). `demande-client.test`
enrichi (11/11 : chat utilisable juste après l'envoi). Gate verte (typecheck, lint, prettier, build,
e2e complet, zéro erreur console). VISION Art. 8, 9, 11.

## 09/07/2026 — Correctif : notification conducteur manquante + demande perdue quota plein

**Deux retours client :** (1) aucune notification dans « Aujourd'hui » côté conducteur quand le
client envoie une demande ; (2) toujours le même problème avec une photo — la question disparaît de
la conversation et « rien ne fonctionne ».

**Cause 1 — notification absente :** `conductorNotifications` couvrait ❤️, 💬, décisions et réponses
de document du client, mais **aucune entrée pour une nouvelle demande client**. La demande n'apparaissait
que comme item du filtre « à traiter », jamais comme la notification attendue. **Correctif :** ajout
d'une notification **« Nouvelle demande client à traiter »** (📩, onglet Suivi) tant que la demande est
`ouverte` ; elle disparaît dès la réponse (demande `traitee`).

**Cause 2 — demande perdue quand localStorage est plein :** le premier correctif avait retiré les
photos du fil et rendu les écritures best-effort, mais le backend démo est **« read-through »**
localStorage : `build()` **relit** localStorage à chaque `refresh()`. Donc quand le quota est atteint,
une écriture qui échoue = donnée réellement perdue — au refresh suivant, la demande et le message du
fil **disparaissent** (et le conducteur n'a rien). **Correctif structurel :** un **miroir mémoire**
(`memMirror`) devient la vérité de session ; `lsGet`/`safeSetItem`/`lsRemove` lisent/écrivent d'abord
en mémoire, puis persistent en best-effort. `kv.load/save`, `readJson`, `clearWorkspace`,
`import/export` et le reset passent par le miroir ; un message inter-onglets vide le miroir pour
relire localStorage (cohérence multi-onglets). Résultat : la session reste **pleinement
fonctionnelle** même quota plein (demande créée, fil conservé, conducteur notifié) — seule la survie
au rechargement dégrade.

**Vérifié (reproduction déterministe) :** localStorage rempli jusqu'à ~4,5 Mo (proche de la limite
navigateur) avec une vraie photo — la question reste dans le fil, la confirmation s'affiche, le chat
n'est pas figé, **la demande est créée et le conducteur reçoit « Nouvelle demande client à traiter »**,
zéro exception. `demande-client.test` (12/12, + assertion notification conducteur) ;
`demande-client-quota.test` (4/4 : question conservée + demande créée + conducteur notifié sous
pression). Gate verte (typecheck, lint, prettier, build, e2e complet, zéro erreur console).
VISION Art. 8, 9, 11.

## 09/07/2026 — Onglet Chantier « Demandes client » (tableau de pilotage)

**Décision produit validée :** un nouvel onglet **« Demandes client »** dans la page Chantier
(entre « Dans les coulisses » et « Réserves ») regroupe **toutes les demandes créées via Léon** pour
les piloter **sans polluer le Suivi**. C'est un **tableau de pilotage, PAS une messagerie** — le
modèle reste **1 demande = 1 réponse**.

**Contenu :** toutes les demandes du chantier avec, pour chacune, le message client + photos
éventuelles, la date, le statut, la réponse conducteur (+ photos) si elle existe, et un bouton
**« Répondre »** tant qu'elle n'est pas répondue. **Filtres simples** (segmented) : **Tous / À
traiter / Non lus / Répondus**, avec compteurs — pas de filtres complexes.

**Répartition des surfaces :** « Aujourd'hui » ne montre que les demandes **À traiter** (+ la
notification d'arrivée) ; « Demandes client » montre **tout l'historique filtrable** ; « Suivi » ne
conserve que la **trace officielle après réponse** (lecture seule — le bouton « Répondre » a quitté
le Suivi pour l'onglet). Le pilotage/réponse se fait donc dans l'onglet dédié, la mémoire reste au
Suivi.

**Nouveau concept « Non lu / Lu » :** on réutilise l'accusé de lecture existant `seen['compagnon']`.
Une demande est **Non lu** si le conducteur ne l'a **jamais ouverte** ET qu'elle n'est **pas encore
répondue** (une demande répondue est « Répondu », jamais « Non lu »). Un **badge** sur l'onglet
compte les non-lues ; **l'ouvrir la marque lue** (le badge diminue) ; **y répondre** la passe
**Répondu**, la fait **quitter « Aujourd'hui »**, **notifie le client** et **conserve la trace** ici
et au Suivi. Les écritures d'accusés de lecture passent par le miroir mémoire (`safeSetItem`) →
résilientes au quota.

**Mise en œuvre :** composant `DemandesClientTab` (SegmentedControl + cartes dépliables ; ouvrir =
`markSeen('compagnon')` ; répondre = `DemandeThread canReply`) ; onglet + badge « non lus » dans
`CompagnonView` ; `SuiviTab` n'affiche plus le fil de demande qu'une fois **répondue** (lecture
seule). Aucune messagerie, aucune conversation infinie. Nouveau `demandes-onglet.test` (11/11 :
onglet visible + position, demande Léon listée, filtres, badge +1/−1, ouverture → lu, réponse →
Répondu, disparition d'Aujourd'hui, conservation dans l'onglet, trace au Suivi) ; `demande-client`
(12/12) mis à jour pour répondre **via l'onglet**. Gate verte (typecheck, lint, prettier, build,
e2e complet, zéro erreur console). VISION Art. 2, 8, 9, 11.

## 09/07/2026 — Suppression de l'onglet « Réserves » (page Chantier)

**Décision produit validée :** on **retire complètement l'onglet « Réserves »** de la page Chantier.
Au départ un espace dédié, il ne répond plus à une question distincte : **une réserve est un
événement métier parmi d'autres** (Journal). On réduit le nombre d'onglets et on évite les doublons.
Onglets restants : **Suivi · Préparation · Documents · Dans les coulisses · Demandes client**.

**Nouvelle philosophie :** une réserve est **créée via une mission** (Pré-réception / Réception) et
reste rattachée à ces événements. Le conducteur la retrouve **au Suivi** (historique), **pendant la
Pré-réception / Réception**, et **dans « Aujourd'hui »** quand une action est attendue. **Plus de page
dédiée.**

**Fait :** onglet « Réserves » + son badge retirés ; la navigation « Aujourd'hui → réserve » ouvre
désormais le **Suivi** (au lieu de l'onglet supprimé) ; le bouton « Nouvelle réserve » disparaît (la
création manuelle passait par la page ; elle se fait via les missions) ; **`ReservesView` supprimée**
(vue devenue inutile).

**Conservé (aucune perte de logique métier) :** le **modèle de données** des réserves, tous les
**événements existants**, la **création via Pré-réception / Réception**, le **suivi**, la **levée** et
l'**historique**. La réserve est désormais **pleinement actionnable au Suivi** : on la **lève** (dialogue
de levée, déjà présent) et on **joint son responsable** (contact — Appeler / SMS / WhatsApp / Mail) via
un nouveau composant `ReserveResponsable` (extrait de l'ancienne page, greffé sur l'entrée réserve du
Suivi). Rien de tout cela n'apparaît côté client (Art. 9).

**Tests :** `reserves.test` réécrit autour du Suivi (plus d'onglet ; réserve lue + responsable joignable
au Suivi ; remontée « Aujourd'hui » → Suivi ; levée → « Levée » ; client-safe). `contacts.test` et
`consolidation.test` repointés vers le Suivi (join du responsable). `aujourdhui`, `chantier-switch`,
`chantier-architecture`, `chantier-sans-radar`, `chantier-epure` mis à jour (l'onglet « Réserves »
n'existe plus ; le Suivi / « Demandes client » servent de témoins). Gate verte (typecheck, lint,
prettier, build, e2e complet, zéro erreur console). VISION Art. 2, 8, 9.

## 09/07/2026 — Refonte de l'Espace client (extrêmement simple, orienté action)

**Décision produit validée :** l'Espace client ne doit **jamais ressembler à un logiciel de
gestion**. Le client vient savoir **ce qu'il doit faire**, **ce qui nécessite une décision**, **où en
est son projet**. Chaque écran répond à **une seule question**. Nouvelle architecture à **5 onglets** :
**Aujourd'hui · Vos demandes · Vos choix · Documents · Dans les coulisses**.

**Aujourd'hui** devient un **tableau d'ACTIONS** : d'abord les **notifications importantes** (réponse
PHÉNIX, document partagé, photos publiées, décision demandée), puis **uniquement ce qui attend une
action** (valider un choix, répondre à une demande de décision, envoyer un document…). **État vide**
(aucune action, aucune notification) → un **seul** message, rien d'autre : « **Vous n'avez rien à
faire. Tout est à jour. Votre équipe PHÉNIX veille sur votre chantier.** » — le client comprend
immédiatement qu'il peut profiter de sa journée.

**Nouvel onglet « Vos demandes »** (`ClientDemandesTab`) : l'historique des échanges avec PHÉNIX (via
Léon). Filtres **Tous / En attente / Répondues / Non lues** (« À traiter » du conducteur adapté en
« En attente », client-safe). « Non lue » = réponse pas encore ouverte ; l'ouvrir l'éteint
(`seen['client']`). Lecture seule — pour une nouvelle demande, le client parle à Léon.

**Nouvel onglet « Vos choix »** (`ClientChoixTab`) : l'historique des décisions demandées (carrelage,
peinture, robinetterie, dates…). Filtres **Tous / En attente / Répondu / Annulé** (« Annulé » réservé
— aucun choix annulable dans le modèle actuel). Les choix actionnables (une proposition à valider)
restent **actionnables ici** (`ClientDecisionBanner`), et sont aussi des actions dans « Aujourd'hui ».

**Onglet « Le projet » RETIRÉ** : le planning/grandes-étapes n'est plus une surface client (c'était
« du logiciel de gestion »). L'avancement se vit désormais **« Dans les coulisses »** (récit
émotionnel). Le planning reste un outil **conducteur** (Préparation, `SmartPlanningView`) ; sa logique
core est intacte. Léon répond toujours aux questions de planning en texte ; sa navigation « voir les
étapes » ouvre « Dans les coulisses ». Le **héros/statut** projet (retiré de « Le projet ») vit dans
la **barre de contexte** (« Aperçu client · … »).

**Câblage :** `ClientView` réécrite (5 onglets, actions + état vide) ; notification « PHÉNIX a
répondu » pointe vers l'onglet « Vos demandes » ; `clientTab` ajoute `demandes`/`choix`.
**Composants supprimés de la vue client :** `ProjectHero`, `GrandesEtapes`, `StepProgress`,
`SmartBanner` (conservés au dépôt, réutilisables).

**Tests :** `client-architecture`, `client-sommaire` réécrits (5 onglets) ; `client-hero` → le lot
interne ne fuit dans aucun onglet ; `client-decision`, `decisions`, `notifications-bidirect` → « Vos
choix » ; `client.test`, `chantier-switch` → nom du chantier via la barre de contexte ;
`client-partage` → onglets client comme témoin d'accès ; `phenix-widget` → « voir les étapes » ouvre
les coulisses ; `demande-client` → demandes lues dans l'onglet « Vos demandes ». **Supprimés :**
`client-planning.test`, `planning-duree.test` (ils testaient le planning CLIENT, retiré ; la logique
core de dates reste couverte au niveau `packages/core`). Gate verte (typecheck, lint, prettier, build,
e2e complet, zéro erreur console). VISION Art. 2, 9, 11.

## 09/07/2026 — Léon IA premium : chercher avant de transmettre (le cerveau, pas le visage)

**Décision produit validée :** Léon devient l'assistant central de l'Espace client. **Aucun changement
de design / UI / widget** — on améliore uniquement l'**intelligence** (`packages/core/phenix.ts`). Léon
ne crée une demande conducteur qu'en **dernier recours** : il cherche d'abord dans les données du
chantier (documents, planning, choix, demandes, coordonnées PHÉNIX, historique).

**Ajouts au cerveau (`askPhenix`) :**

- **Coordonnées PHÉNIX** (`PHENIX_PHONE` / `PHENIX_EMAIL`, configurables) → intention `contact` :
  « le numéro de PHÉNIX ? » répond directement, jamais d'escalade.
- **Recherche documentaire robuste** : `DOC_TYPES` (devis, avenant, facture, acompte, facture finale,
  assurance, DPE, plan, compte rendu, pré-réception, réception, SAV) — recherche par type OU mot-clé,
  sur les fichiers ET les comptes rendus. 1 résultat → **bouton « Ouvrir »** (jamais d'escalade) ;
  plusieurs → courte liste + ouverture du 1er ; **aucun → Léon EXPLIQUE puis propose de transmettre**
  (pas d'escalade silencieuse, pas de demande fantôme).
- **Réception / planning / avancement** répondent depuis les **dates du dossier** (fin de chantier =
  réception) au lieu d'escalader.
- **Actions & décisions** : « ai-je quelque chose à faire ? », « quels documents manque-t-il ? »
  lues depuis les décisions/demandes en attente.
- **Escalade ciblée (dernier recours)** : demande explicite de transmission (`TRANSMIT_RX`),
  **signalement de problème** (`PROBLEM_RX` : fissure, fuite, malfaçon…), **demande d'action /
  changement / permission** (`REQUEST_RX` sans verbe d'info : « peut-on décaler… », « je voudrais
  récupérer les clés… »), question de prix, ou photo jointe. Une demande d'**information/navigation**
  formulée comme une requête (« je voudrais **voir** le devis ») reste traitée par Léon.
- **Robustesse chat inchangée** : `send` en try/finally (jamais figé), photos conservées, confirmation
  claire à la création d'une demande.

**Corrections de reconnaissance :** « montre-moi le DPE » n'est plus confondu avec une demande de
photos (les types de documents priment sur `photo`) ; « réception » n'est traité comme une **date**
que sur une question de timing (sinon c'est le document « PV de réception ») ; `\bsav\b` / `\bdpe\b`
/ `\bpv\b` bornés (plus de faux positif sur « **sav**oir »).

**Interdits respectés :** pas de refonte du widget, pas de nouvel écran IA, pas d'ajout visuel — le
bouton « Ouvrir » et les bulles existent déjà. Nouveau `leon-ia.test` (8/8 : devis trouvé + bouton
sans escalade, numéro PHÉNIX, réception depuis les dates, document introuvable expliqué + non bloquant,
demande conducteur créée + reçue dans « Aujourd'hui », message avec photo conservée + chat utilisable).
Gate verte (typecheck, lint, prettier, build, e2e complet, zéro erreur console). VISION Art. 2, 8, 9, 11.

## 09/07/2026 — Suppression de « Répondre au client » dans « + Nouvelle mission »

**Décision produit validée :** on retire la carte **« Répondre au client »** du sélecteur « Nouvelle
mission ». Depuis l'ajout de l'onglet **« Demandes client »**, elle est devenue un **doublon** : le
conducteur ne doit avoir **qu'un seul endroit** pour répondre à un client. Règle : le client pose ses
questions via **Léon** → la demande arrive dans **« Aujourd'hui »** et **« Demandes client »** ; le
conducteur répond **exclusivement** depuis « Demandes client ».

**Fait :** carte + libellé + icône (`Reply`) retirés de `MissionPicker` (+ son badge « compteur de
questions » et la prop `pendingReplies`) ; kind `'repondre'` retiré de `ComposerKind` ; composant
`ReplyList` supprimé (seul consommateur) ; nettoyage des imports devenus inutiles (`questionsEnAttente`
côté `CompagnonView`/`Composer`, prop `events` du `Composer`). La grille des actions ne laisse aucun
vide (2 cartes : « Ajouter un document », « Demander au client »).

**Conservé (intact) :** **« Demander au client »** (initiative conducteur : décision / document /
question), l'onglet **« Demandes client »**, **Léon**, **Aujourd'hui**, **Suivi**. Le sélecteur
`questionsEnAttente` reste (utilisé par « Aujourd'hui »).

**Tests :** `mission-entree-unique` mis à jour (2 actions ; garde négative « plus de carte Répondre au
client ») ; `chantier-architecture` mis à jour. Gate verte (typecheck, lint, prettier, build, e2e
complet, zéro erreur console). Objectif : une action = un seul point d'entrée, aucun doublon
fonctionnel. VISION Art. 4, 8, 9, 11.

## 09/07/2026 — Sprint qualité premium + Léon V2 (compréhension de l'intention)

**Décision produit validée :** on élève la **qualité** et la **robustesse** de Léon sans **rien
toucher au design** (widget, bulles, bouton « Ouvrir » inchangés). Léon comprend d'abord **l'intention
réelle** et le **sujet**, choisit **ensuite** la bonne source, puis répond — **jamais l'inverse**.
Règle d'or renforcée : **une mauvaise réponse est pire qu'un « je ne trouve pas »**. En cas de doute,
Léon admet honnêtement qu'il n'a pas l'information puis **propose** (sans l'imposer) de transmettre.

**Bug critique corrigé — « adresse du chantier » ≠ « votre adresse » :** « C'est quoi l'adresse du
chantier ? » renvoyait une réponse **totalement à côté** (une commande « Cuisine équipée »). Léon
distingue désormais deux adresses **bien réelles et jamais interchangeables** :

- **adresse du chantier** (le bien en travaux, donnée du dossier `project.address`, câblée jusqu'au
  cerveau via `PhenixInput.chantierAddress`) → « L'adresse de votre chantier est : … » ;
- **adresse de l'entreprise PHÉNIX** (`PHENIX_ADDRESS`, configurable) → « L'adresse de PHÉNIX est : … ».
  « votre adresse », « adresse de PHÉNIX », « vos bureaux » tombent ici ; « adresse **du chantier** »,
  « où est **le chantier** » tombent là. On exclut l'adresse **e-mail** (traitée par le contact).

**Fin des réponses au hasard (les « fallbacks faibles ») :**

- **Document introuvable** : on a supprimé le repli « on ouvre le **premier** document de la liste » —
  Léon n'ouvre un document que s'il **recoupe réellement** la demande, sinon il l'admet et oriente
  vers « Documents ». Une question incomprise ne fait **plus** remonter un document au hasard.
- **Recherche de dernier recours** (`searchKnowledge`) : les **étiquettes génériques** de catégorie
  (`document`, `commande`, `photo`, `planning`…) ne suffisent **plus** à « matcher » — il faut un
  recouvrement sur un mot **spécifique** (libellé, pièce, fournisseur). Sinon → « je ne trouve pas ».
- **Défaut** : une question **non comprise** ne crée **plus** une demande dans le dos du client
  (plus d'escalade silencieuse) — Léon dit « je ne trouve pas » et **propose** de transmettre.

**Mémoire de conversation resserrée (fini le hors-sujet hérité) :** l'intention du tour précédent
n'est **reportée** que pour une **vraie relance de continuité** (« et la cuisine ? », « et le salon ? » :
message commençant par un connecteur de suite **ou** désignant seulement une pièce). Un charabia court
(« azerty qsdfgh ») ne **récupère plus** l'intention précédente — il porte son propre (non-)sujet.

**Reconnaissance affinée :** intention `todo` élargie (« qu'est-ce qu'il me **reste à faire** ? »,
« que **faire** ? ») ; intention `conducteur` (« comment s'appelle mon conducteur ? ») → Léon
**n'invente pas** un nom et **n'oppose pas** un numéro à la place : il oriente vers la transmission ;
contact e-mail reconnu même avec « **votre** » (« votre adresse mail »).

**Interdits respectés :** aucun changement de design / widget / écran ; on n'a touché qu'au **cerveau**
(`packages/core/phenix.ts`) et au **câblage de données** (`store.askPhenix` passe `chantierAddress`).

**Tests :** `leon-ia` étendu (12/12) — adresse **du chantier** (jamais une commande), adresse **PHÉNIX**
(distincte), « qu'il me reste à faire » (actions, pas une date de réception), **question incomprise**
→ « je ne trouve pas » **sans** document au hasard **ni** demande fantôme — en plus des cas conservés
(devis + bouton, numéro PHÉNIX, réception depuis les dates, document introuvable expliqué, demande
conducteur créée + reçue dans « Aujourd'hui », photo conservée + chat utilisable). **Audit QA** : la
suite Playwright complète (58 suites : navigation, onglets, formulaires, modales, uploads, photos,
PDF/visionneuse, documents, notifications, responsive, robustesse) sert de filet de non-régression et
**assert zéro erreur console** sur chaque surface. Gate verte (typecheck, lint, prettier, build, e2e
complet). VISION Art. 2, 8, 9, 11.

## 09/07/2026 — Léon V3 : le cerveau devient un vrai assistant (pipeline + base de connaissances)

**Décision produit validée :** Léon n'est plus « un chatbot qui répond » mais un assistant qui
**raisonne avant de répondre**. On ne touche **pas** à l'interface (design définitivement validé) :
tout le travail est dans le cerveau (`packages/core/phenix.ts`) + le câblage de données
(`store.askPhenix`). Objectif : que le client se dise « on dirait qu'il connaît mon chantier par cœur ».

**Pipeline obligatoire (jamais l'inverse) :** question → **compréhension de l'intention** →
**classification** vers UNE catégorie → **recherche dans la bonne source** → **évaluation de la
confiance** → **réponse** (empathique, avec action) → **escalade conducteur uniquement si nécessaire**.

**Base de connaissances.** Léon « sait » sans fouiller les documents :

- **Fiche PHÉNIX** (constantes, source unique) : nom, adresse, téléphone, e-mail, **site**, **horaires**.
- **Fiche CHANTIER** (câblée depuis le projet + l'annuaire) : **adresse du chantier** (≠ adresse PHÉNIX),
  nom, client, **état**, **artisans** (contacts liés), planning, documents, décisions, demandes, choix.

**Intentions couvertes** (une question ne part jamais vers la mauvaise catégorie) : coordonnées PHÉNIX,
horaires/site, adresse chantier, adresse PHÉNIX, conducteur (nom), artisans, documents (devis, avenants,
factures, plans, assurance, DPE, comptes rendus, réception, pré-réception, SAV), planning, réception,
choix restants, choix validés, documents demandés, **statut d'une demande client**, à-faire du jour,
avancement, commandes/livraisons, photos, problème technique, modification, **administratif/logistique**
(clés, RDV…), question générale.

**Recherche par INTENTION, plus par mot au hasard.** « adresse du chantier » → fiche chantier ; jamais
« → documents → devis → réponse au hasard ». Fin des replis faibles : aucun document « premier de la
liste », la recherche libre exige un mot **spécifique**.

**Logique de CONFIANCE.** Confiance haute → réponse directe ; faible → **« Je n'ai malheureusement pas
trouvé cette information »** puis proposition de transmettre. Règle d'or : **une absence de réponse est
toujours préférable à une mauvaise réponse** — jamais d'invention, jamais d'hallucination.

**Ton humain + actions.** Formulations chaleureuses (« Je viens de retrouver votre devis. », « Bonne
nouvelle : … », « Avec plaisir 🙂 »), jamais « Erreur / Impossible ». Chaque réponse propose d'**agir**
(bouton Ouvrir le devis / Voir le choix / Voir les coulisses / Voir mes demandes). **Mémoire** de
conversation conservée (relance de continuité « et l'avenant ? »).

**Robustesse de langage** : normalisation des apostrophes typographiques (’ → '), tolérance aux fautes
(« adrese »), aux radicaux (« plombier » ↔ « Plomberie »), aux synonymes ; garde-fous prioritaires
(photo jointe, transmission explicite, problème, administratif, requête d'action, prix) évalués **avant**
toute recherche.

**Interdits respectés :** aucun changement de design / widget / écran ; interface strictement
identique. Seuls le cerveau et le câblage de données évoluent.

**Tests :** nouvelle **batterie d'intentions** `leon-intentions` (58/58, pur Node : bundle du core à la
volée) couvrant des dizaines de formulations naturelles — synonymes, tournures, fautes de frappe,
adresse chantier ≠ PHÉNIX, documents trouvés / absents, planning, commandes, choix, demandes, artisans,
escalades ciblées, charabia → « je ne trouve pas ». `leon-ia` (12/12), `phenix-widget` (14/14),
`client-concierge` (5/5) conservés. Gate verte (typecheck, lint, prettier, build, e2e complet, zéro
erreur console). VISION Art. 2, 8, 9, 11.

## 09/07/2026 — Espace client : « Mon espace » (accès, invités, préférences, cookies)

**Décision produit validée :** un vrai espace de gestion client, **sans usine à gaz**. Un 6ᵉ onglet
**« Mon espace »** (nommé ainsi — plus client, plus premium que « Paramètres ») s'ajoute à l'Espace
client **sans toucher au design global** ni casser les onglets existants (Aujourd'hui, Vos demandes,
Vos choix, Documents, Dans les coulisses, Léon). Navigation cible : ces 6 onglets.

**Contenu de « Mon espace » (5 encarts sobres) :**

1. **Accès au chantier** : nom + adresse du chantier, **code d'accès masqué** (œil pour révéler),
   bouton « Modifier mon code d'accès » → modale (double saisie de confirmation, **min. 6 caractères**,
   messages d'erreur clairs) + **message de succès** à l'enregistrement.
2. **Personnes invitées** : le client invite une personne de confiance (prénom/nom, e-mail, **rôle
   libre** avec suggestions : conjoint, parent, investisseur, associé, locataire, architecte,
   décorateur). La personne apparaît avec un **statut** (Invité / Actif) et un bouton **« Retirer
   l'accès »**. Microcopy : « Invitez une personne de confiance à suivre l'avancement de votre
   chantier. » — levier de découverte / recommandation PHÉNIX.
3. **Préférences de notification** : 5 toggles simples (nouvelles photos, nouveaux documents, réponse
   PHÉNIX, décision attendue, rappel avant réception), stockés en local (store démo).
4. **Cookies et confidentialité** : état « Cookies nécessaires acceptés. »
5. **Sécurité** : « Votre espace est privé. Seules les personnes disposant d'un accès peuvent consulter
   les informations du chantier. »

**Bandeau cookies (première connexion).** V1 sans CMP : à la première connexion client, un bandeau
sobre « PHÉNIX 360 utilise des cookies nécessaires… » avec **Accepter** / **En savoir plus** ; le
consentement est **stocké localement** et le bandeau **ne réapparaît plus** après acceptation (ni au
reload). Les suites e2e existantes pré-acceptent le consentement dans `openDemo` pour ne pas être
gênées ; la suite dédiée le teste à part.

**Store (démo, remplaçable par un backend sans toucher l'écran) :** nouveau slice `clientSettings`
par chantier (code d'accès, invités, préférences) + drapeau `cookieConsent` (device-local). Mutations
`setClientAccessCode`, `inviteClientPerson`, `removeClientInvitee`, `setClientNotifPref`,
`acceptCookies` ; sélecteur `clientSettingsOf`. `CLIENT_SETTINGS_KEY` rejoint les clés d'espace de
travail (réinitialisables) ; le consentement cookies reste device-local.

**Interdits respectés :** pas de page technique lourde, pas de menu complexe, design global intact,
aucun des onglets existants cassé.

**Tests :** nouvelle suite `mon-espace` (14/14) — bandeau cookies (visible, « En savoir plus »,
Accepter, non-retour au reload, état dans « Mon espace »), code masqué + refus (< 6 car., non
concordants) + succès, invitation (apparition + statut) + retrait, toggles sans crash, mention
sécurité. `client-architecture` mis à jour (6 onglets). Gate verte (typecheck, lint, prettier, build,
e2e complet, zéro erreur console). VISION Art. 6, 8, 9, 11.

## 09/07/2026 — « Nouvelle mission » : retrait de « SAV » et « Note / observation »

**Décision produit validée :** pour la V1, on **allège encore** le sélecteur « Nouvelle mission ». On
retire de l'interface **« SAV »** et **« Note / observation »** (peu de valeur au quotidien, elles
alourdissaient le menu). Objectif : le conducteur choisit sa mission **en quelques secondes** — moins
de choix, meilleure expérience, chaque mission restante à forte valeur métier.

**On ne supprime PAS la logique métier — on la cache.** Même geste que pour « Livraison de matériel »
(retirée plus tôt) : les deux entrées sont **commentées** dans `MISSIONS` (`packages/core/mission.ts`).
Tout le reste est **conservé** : le type `MissionKind` (`sav`, `note`), les libellés (`MISSION_LABEL`,
`MISSION_DOC_TITLE`), les cas de `prepareMission` (`sav`, `note`), l'icône dans `ICONS`. Réactiver une
mission = **décommenter** son entrée. Aucune route/point d'entrée résiduel : le seul accès passe par
`MISSIONS.map` dans `MissionPicker`.

**Le menu « Nouvelle mission » devient (6 entrées, grille propre, aucun trou de carte) :** Publier dans
les coulisses · Compte rendu de chantier · Pré-réception · Réception · Ajouter un document · Demander
au client.

**Tests :** `mission` gagne une garde négative (« SAV » / « Note / observation » absents ; les 6
entrées présentes) et bascule son parcours de flux générique sur **Pré-réception** (Note utilisait le
même `MissionFlow`) ; `suivi-entree-unique` idem. `mission` (8/8), `suivi-entree-unique` (7/7). Gate
verte (typecheck, lint, prettier, build, e2e complet, zéro erreur console). VISION Art. 4, 8, 9, 11.

## 09/07/2026 — BUG CRITIQUE : ouvrir un document rend le FICHIER d'origine (jamais une page HTML)

**Symptôme :** Espace client → Documents → « Devis signé » → Ouvrir affichait une **page HTML générée**
(« Ce document a été enregistré dans PHÉNIX… ») au lieu du **PDF réel**. Impression bas de gamme,
inacceptable.

**Diagnostic.** `openDocument` ouvrait le fichier UNIQUEMENT si `attachment.dataUrl` était présent ;
**sinon il générait une page HTML** (`buildDocumentHtml`) — comportement voulu à l'origine (« fiche de
référence d'un devis sans pièce »). Or les documents importés seedés (« Devis plomberie — lot
sanitaire », « Contrat sous-traitant ») portaient un `bucket`/`storagePath` factices **sans `dataUrl`**
→ ils tombaient dans la génération HTML. (Les imports réels, eux, portent bien un `dataUrl` via
`readDocumentAttachment` — donc un vrai import s'ouvrait correctement ; c'est le seed qui trompait.)

**Nouvelle règle produit — DEUX catégories, jamais confondues :**

1. **Document IMPORTÉ** (`type === 'document'`, un vrai fichier déposé : PDF, image…) → on ouvre
   **TOUJOURS le fichier d'origine**, jamais une page HTML de remplacement. Si le fichier a disparu
   (non persisté / purgé) → **message clair** « Le document n'est plus disponible. » (jamais une fausse
   page).
2. **Document GÉNÉRÉ par PHÉNIX** (`type === 'compte_rendu'` : compte rendu, PV de réception, liste de
   points à reprendre…) → PHÉNIX le rend en **page HTML autonome** (légitime, c'est sa nature).

**Correctifs.** `store.openDocument` / `downloadDocument` branchent sur le **type d'événement** : un
`document` ouvre le fichier ou, à défaut, `openUnavailableDocument()` (nouveau helper dans
`lib/document.ts`, page honnête « indisponible ») — **jamais** `buildDocumentHtml`. Le **seed** fournit
désormais un **vrai PDF** (`SAMPLE_PDF_DATAURL`, PDF valide) aux documents importés (« Devis
plomberie », « Contrat sous-traitant ») pour qu'ils s'ouvrent tels quels.

**Tests.** Nouvelle suite `documents-originaux` (5/5) : on **intercepte `URL.createObjectURL`** et on
lit le **type MIME** réellement ouvert — import PDF → `application/pdf`, import image → `image/*`,
compte rendu généré → `text/html`, et **garde de régression** sur le devis seedé côté client
(`application/pdf`, jamais `text/html`). `documents-consultables` mis à jour (devis / contrat importés →
ouverture du fichier). `documents-cliquables` (7/7) conservé. Gate verte (typecheck, lint, prettier,
build, e2e complet, zéro erreur console). VISION Art. 2, 8, 9, 11.

## 09/07/2026 — Choix client : suivi complet dans « Demandes client »

**Décision produit validée :** une « Demande de choix » (« Nouvelle mission → Demander au client →
Demander une décision ») devient un **objet pilotable** — statut + historique — suivi dans l'onglet
CONDUCTEUR existant **« Demandes client »**, aux côtés des demandes simples de Léon. **Pas de nouvel
onglet, pas de doublon.** Un choix ne disparaît jamais.

**Statuts d'un choix (côté conducteur, reflétant l'état CLIENT) :**

- **Non lu** = le client n'a pas encore ouvert le choix ;
- **En attente de réponse** = il l'a ouvert (clic « Voir la décision ») mais n'a pas répondu ;
- **Répondu** = il a validé une option.

Traçage : l'ouverture par le client marque `seen['client'][selectionId]` (via `markChoixOpenedByClient`),
la validation passe la sélection en `valide`.

**Onglet « Demandes client » unifié** : demandes simples + choix dans une seule liste filtrable —
**Tous · Demandes · Choix client · Non lus · En attente · Répondus** (statut normalisé non_lu /
en_attente / repondu pour les deux types). Ouvrir une demande simple la marque lue (conducteur) ;
ouvrir un choix ne change jamais son statut (c'est l'ouverture CLIENT qui compte).

**Carte de choix conducteur (`ChoixClientCard`)** : titre, texte (contexte), date, statut, options
proposées avec photos, et — une fois répondu — l'**option choisie EN CLAIR** : « Option B — Carrelage
effet pierre beige » + **photo de l'option** + **commentaire du client**. Jamais un simple « Option 2 ».

**Côté client** : le choix reste une **action dans « Aujourd'hui »** tant qu'il n'est pas validé, et
figure toujours dans **« Vos choix »** (avec, une fois répondu, l'option choisie + photo + commentaire —
`ChoixReponse`). Le client peut joindre un **commentaire** en validant (nouveau champ, `ClientDecisionBanner`).
Une **notification client** « Un choix vous attend » apparaît (clé = la sélection : l'ouvrir bascule le
statut conducteur). À la validation → **notification conducteur** « Décision validée par le client »
(déjà en place), le choix **quitte « Aujourd'hui »**, **reste dans « Vos choix »** et **« Demandes
client »**, **trace au Suivi**.

**Modèle** : `ClientSelection.clientComment` (core) conserve le commentaire ; `ClientDecision` expose
`chosenOptionId` + `clientComment`. La réponse conserve id + libellé + photo de l'option + commentaire +
date. **Demandes simples via Léon inchangées** (elles cohabitent avec les choix, filtres partagés).

**Tests :** nouvelle suite `choix-client-suivi` (12/12) couvrant les 9 étapes (création 2 options +
photos → Non lu → Aujourd'hui + Vos choix → ouverture → En attente → réponse → Répondu avec libellé +
photo + commentaire → disparition d'Aujourd'hui (delta) → conservé dans Vos choix + Demandes client →
trace au Suivi). `demandes-onglet` mis à jour (nouveaux filtres). `client-decision` (10/10),
`client-architecture` (7/7) conservés. Gate verte (typecheck, lint, prettier, build, e2e complet, zéro
erreur console). VISION Art. 3, 4, 8, 9, 11.

## 09/07/2026 — Planning simplifié côté client (« Planning de votre projet »)

**Décision produit validée :** le client doit toujours savoir **où en est son chantier**, **quelle est
la prochaine étape** et **quand**, sans demander à Léon. On rend visible dans l'Espace client un bloc
**« Planning de votre projet »** — les **GRANDES ÉTAPES** seulement, jamais un planning technique.

**Découverte :** le cerveau existait déjà (`buildClientPlanning` dans `core/client-planning.ts` — 5
jalons de cycle de vie : Projet validé · Préparation · Démarrage · Pré-réception · Réception, avec
état terminé/en cours/à venir et dates dérivées) et son rendu aussi (`GrandesEtapes`), mais le
composant était **orphelin** depuis la suppression de l'onglet « Le projet ». On le **remonte** au lieu
de dupliquer.

**Fait :**

- Nouveau bloc **`ClientPlanningBlock`** (en-tête « Planning de votre projet » + `GrandesEtapes`),
  affiché en bas de l'onglet **« Aujourd'hui »** du client. Timeline simple : étapes terminées
  **cochées**, étape en cours **mise en évidence** (« En cours »), étapes futures **grisées**
  (« À venir »).
- **Rappel « Aujourd'hui »** : `ClientProchaineEtape` — « Prochaine étape : Pré-réception dans 5 jours »
  / « Réception prévue le 25 septembre 2026 », via le nouveau sélecteur core `nextClientMilestone`.
- **Synchronisation automatique** : les dates viennent du chantier conducteur (source unique
  `buildSmartPlanning` / statut métier). Le client ne peut rien modifier ; toute modification
  conducteur (statut, dates) met à jour le bloc client sans code additionnel.
- **Aujourd'hui** conserve ses actions/notifications ; le planning s'ajoute (sans casser l'état vide).

**Interdits respectés :** aucun planning artisans, tâche technique, check-list conducteur ni
organisation interne — uniquement les grandes étapes (garde-fou testé).

**Tests :** nouvelle suite `client-planning` (9/9) : bloc visible, 3 jalons principaux, étape terminée
(cochée) / en cours (évidence) / future (grisée), rappel dans « Aujourd'hui », **mise à jour après modif
conducteur** (statut → Levée des réserves fait passer Pré-réception « Terminé » et Réception « En
cours »), et garde client-safe (aucun détail technique). Gate verte (typecheck, lint, prettier, build,
e2e complet, zéro erreur console). VISION Art. 2, 3, 8, 9, 11.

## 09/07/2026 — Revue totale 110 % (conducteur + client) : bugs corrigés

**Décision produit validée :** revue complète de l'app comme deux vrais utilisateurs (conducteur +
client). On corrige la VRAIE CAUSE, jamais un contournement, et on renforce les tests.

**Bugs Léon (batterie live des 12 questions) :**

- **Incohérence « ai-je quelque chose à faire ? »** répondait « rien à faire » alors qu'un CHOIX était
  proposé (alors que « quels choix en attente ? » le trouvait). Cause : `clientTodos` ne comptait que
  les décisions du journal, pas les choix `propose` du dossier. → Léon compte désormais les deux.
- **« je veux déplacer la réception »** → « je ne trouve pas de réception » (routé « document »). Cause :
  « je veux » n'est pas dans `REQUEST_RX` (exprès), donc pas escaladé. → Nouveau garde-fou `MODIFY_RX`
  (déplacer/décaler/avancer/reporter une réception/date/livraison…) → escalade conducteur.
- **« je veux envoyer une photo »** → « les photos sont dans les coulisses » (à côté). → Léon explique
  désormais comment JOINDRE une photo à son message.

**Bugs parcours (audit statique + traçage) :**

- **Double-envoi (`Composer`)** : « Publier »/« Envoyer » n'étaient jamais désactivés pendant l'écriture
  → un double-clic créait des événements dupliqués (photos postées deux fois) + doubles notifications.
  → Verrou `busy` en try/finally sur `submit`/`submitDemande`.
- **Toggles de notification MORTS (`Mon espace`)** : `clientNotifications` ne consultait jamais
  `notifPrefs` → désactiver une catégorie ne changeait rien. → Chaque catégorie (photos, documents,
  réponse, décision, rappel réception) est maintenant respectée ; le rappel réception d'« Aujourd'hui »
  aussi.
- **Double-validation (`DecisionResponder`)** : bouton « Valider ma décision » sans garde `busy`. → Garde
  ajoutée + bouton désactivé pendant l'envoi.
- **Filtre mort « Annulé » (`Vos choix`)** : onglet cliquable toujours vide (aucun choix annulable). →
  Retiré.

**Corrections de copie (audit orthographe/cohérence) :** « clients à répondre » → « questions client en
attente » (`PointDuSoir`) ; « réponses clients » → « réponses client » (`journee`, invariable) ;
« Acompte » → « Acomptes » (chip de filtre, cohérence avec les autres pluriels).

**Tests ajoutés / renforcés :** nouvelle suite `notif-prefs` (5/5 : désactiver « Décision attendue »
retire la notification, la réactiver la ramène) ; `leon-intentions` étendu (62/62 : modification →
escalade, envoyer-photo, todo compte les choix). Gate verte (typecheck, lint, prettier, build, e2e
complet, zéro erreur console). VISION Art. 2, 4, 8, 9, 11.

## 09/07/2026 — Suppression du doublon « Propositions préparées par PHÉNIX » (Préparation)

**Décision produit validée :** une demande de choix est un objet UNIQUE, créé une seule fois
(« Nouvelle mission → Demander au client → Demander une décision ») et piloté EXCLUSIVEMENT dans
« Demandes client » (Non lu / En attente / Répondu). Il ne doit plus exister un second endroit pour
gérer la même demande.

**Fait :** retrait de la section **« Propositions préparées par PHÉNIX »** de l'onglet **Préparation**
(`DossierPanel`) — cartes de choix + boutons « envoyer / renvoyer / confirmer la délégation ». Le
composant `ProposalWorkshop` (seul consommateur) est **supprimé** ; les handlers devenus morts
(`sendProposals`, `confirmDelegation`) et leurs imports (`buildDecisionContent`, `decisionVisibility`)
sont retirés. La logique métier de création/validation reste intacte et centralisée
(`createClientDecision`, `ClientDecisionComposer`, `ChoixClientCard`).

**Préparation** ne porte désormais **AUCUNE interaction client** : cockpit, coordonnées, devis/avenants,
budget, commandes, check-list, planning, dates, photos avant. « Décisions client à obtenir » y reste en
LECTURE SEULE (information de préparation, aucun bouton). Toute interaction client vit dans
« Demandes client » (conducteur), « Aujourd'hui », « Vos choix » (client).

**Architecture réaffirmée :** Préparation = préparer le chantier · Demandes client = gérer les échanges
client · Aujourd'hui = actions du jour. Une action = un seul écran.

**Tests :** `preparation` gagne une garde négative (12/12 : la section « Propositions préparées » et tout
bouton d'envoi de choix ont disparu) ; `choix-client-suivi` (12/12) confirme que les demandes de choix
fonctionnent toujours de bout en bout depuis « Demandes client ». Gate verte (typecheck, lint, prettier,
build, e2e complet, zéro erreur console). VISION Art. 4, 8, 9, 11.

## 12/07/2026 — Refonte complète de la Pré-réception : vérifier l'exécution du contrat

**Décision produit validée :** la Pré-réception n'est plus une liste de réserves saisie à la main.
Elle devient la **vérification de l'exécution du contrat signé**. Le conducteur ne ressaisit jamais les
prestations : PHÉNIX **reconstruit automatiquement** le chantier à partir du **devis signé + de tous les
avenants validés** (vue consolidée, postes actifs — les postes remplacés par un avenant ne sont plus au
contrat). Le conducteur **contrôle**, prestation par prestation, au lieu de créer une liste de défauts.

**Modèle (core) :** nouveau `packages/core/src/prereception.ts` — quatre statuts exclusifs
(🟢 `fait` · 🟠 `reserve` · 🟡 `non_fait` · ⚫ `moins_value`), `PrestationReserve` (1 à 3 photos +
commentaire obligatoire + responsable PHÉNIX/Artisan/Fournisseur + date de reprise optionnelle),
`PrestationVerif`, `PrereceptionData`. Sélecteurs PURS : `buildPrestationsAVerifier(devis, avenants)`
(via `consolidateDevis`, postes actifs, statut initial « Fait »), `prereceptionSynthese`
(conformes / avec réserve / restantes / supprimées), `prestationsADeduire` (les moins-values, réservées
à la future facture finale), `prestationComplete` / `prereceptionComplete`. La saisie est portée par un
champ additif `prereception?` du `CompteRenduContent` — **aucune double saisie** (VISION Art. 8).

**Écran (dédié) :** `PrereceptionFlow` remplace le flux générique pour la mission `prereception`
(routé dans `CompagnonView`). Trois temps : **vérifier** (date + heure automatiques, présents libres,
puis les prestations groupées par lot — un statut par prestation, champs conditionnels : réserve
(photos + commentaire + responsable + reprise) / commentaire « à faire » / motif de moins-value) →
**synthèse** automatique + commentaire général → **génération**. UX pensée pour parcourir très vite :
une prestation, un statut, éventuellement une réserve, puis la suivante.

**Deux documents, une saisie :** `buildDocumentHtml` rend la pré-réception **filtrée par destinataire**.
La **version client** ne montre JAMAIS le responsable, la date de reprise, le motif de moins-value ni les
notes internes — seulement les prestations, leurs statuts, et, s'il y a réserve, ses photos + commentaire,
puis le commentaire général. La **version artisan** porte tout l'opérationnel. Diffusion : version client
→ Espace client · version artisan → conducteur (boutons « Version client / artisan » au Suivi). La
pré-réception apparaît aussitôt dans **Documents** (famille « Pré-réceptions ») et dans le **Suivi**.

**Store :** `createPrereception(projectId, actor, data)` émet UN `compte_rendu` (`visibility: 'client'`,
`docTitre: 'Pré-réception'`). Les libellés `MISSION_DOC_TITLE.prereception` et la description du menu
sont mis à jour (« Vérifier l'exécution du contrat signé »).

**Tests :** nouveau `prereception` (16/16) — fusion devis + avenants (le poste remplacé disparaît,
l'origine « Avenant n°1 » s'affiche), toutes les prestations, les quatre statuts, champs conditionnels,
1 à 3 photos, génération des documents client ET artisan, **étanchéité des données internes côté client**,
stockage Documents, Suivi, responsive (375 px). Suites adaptées au flux dédié : `mission`,
`suivi-entree-unique`, `media-capture` (parcours de capture générique exercé via « Réception »),
`coulisses-photos` et `documents-consultables` (nouveau flux). Gate verte (typecheck, lint, prettier,
build, e2e complet 65/65, zéro erreur console). VISION Art. 5, 7, 8, 9, 11.

## 12/07/2026 — Validation humaine avant tout envoi (Pré-réception)

**Décision produit validée :** aucun document contractuel généré par PHÉNIX ne quitte l'outil sans
validation HUMAINE. La pré-réception est un document contractuel : une erreur de génération pourrait
avoir des conséquences juridiques. Le conducteur garde le dernier contrôle — PHÉNIX assiste, génère et
prépare ; le conducteur contrôle et valide avant toute diffusion (VISION Art. 9).

**Nouveau parcours :** à la fin de sa saisie, le conducteur ouvre un **écran de validation avant envoi**.
Les deux versions (client / artisan) y sont préparées en **brouillon**, visibles de lui seul. Il peut
**Prévisualiser** chaque version EXACTEMENT comme le destinataire la recevra, puis décide :
**Modifier la Pré-réception** (retour à la saisie, rien n'est perdu) ou **Valider et envoyer**.

**Règle stricte (avant validation) :** tant que le conducteur n'a pas validé, RIEN n'est créé ni
diffusé — le client ne voit rien, les artisans ne voient rien, aucune notification n'est envoyée.
Implémentation : la saisie vit dans l'écran (React) ; l'événement `compte_rendu` publié n'est créé
qu'à « Valider et envoyer ». La prévisualisation passe par `demo.previewPrereception` (rendu HTML
synthétique, jamais journalisé). Comme `clientNotifications` et le flux client ne lisent que les
événements `visibility: 'client'` ET `state: 'publie'`, l'absence d'événement garantit l'étanchéité.

**Après validation :** le document est **verrouillé** (append-only : non modifiable) et **diffusé** —
version client → Espace client (+ notification « Votre pré-réception est disponible ») ; version artisan
→ conservée côté conducteur, à transmettre aux artisans concernés. Une correction se fait en créant une
**nouvelle version (V2)** — jamais de modification silencieuse d'un document déjà transmis. Le numéro de
version est calculé à la validation (`prereceptionDocTitle`) et porté par le titre (« Pré-réception V2 »).

**Tests :** `prereception` passe à 19/19 — écran de validation (brouillon + actions), prévisualisation
client/artisan, « Modifier » sans perte de saisie, « Valider et envoyer » (verrouillage + diffusion),
notification client, et la garde **« un document préparé mais non validé ne quitte jamais PHÉNIX »**
(préparer puis fermer sans valider ⇒ le client ne voit rien). Suites `documents-consultables` et
`coulisses-photos` adaptées à l'étape de validation. Gate verte (typecheck, lint, prettier, build,
e2e complet 65/65, zéro erreur console). VISION Art. 8, 9, 11.
