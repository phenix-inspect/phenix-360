# OBAT Knowledge Base — la grammaire d'un devis OBAT

> **Version 1** · À relire dans six mois pour comprendre parfaitement un devis OBAT.
> La partie MACHINE-VÉRIFIÉE vit dans `packages/core/src/devis-obat-kb.ts`
> (`OBAT_VARIANTES`, `OBAT_KB_VERSION`) et est testée par
> `apps/demo/e2e/obat-knowledge-base.test.mjs` : chaque règle documentée ici doit
> être **démontrée par au moins un devis réel du corpus**. On ne documente pas une
> règle qu'on ne sait pas exhiber. La cartographie technique des colonnes/blocs est
> dans `OBAT.md` ; ce document-ci explique la **logique métier**.

## Principe

On raisonne comme l'équipe qui développe OBAT. Pour chaque élément on note : **ce
qu'OBAT présente**, **pourquoi** (logique métier), ce qui est **CONSTANT** (invariant
du gabarit) et ce qui peut **VARIER** (selon le devis). Un devis OBAT n'est pas une
liste de lignes : c'est un **contrat structuré**, hiérarchisé, financièrement bouclé.

## Journal des versions

- **v1 (12/07/2026)** — première base : hiérarchie, prestations, descriptions,
  matériaux/références, options, exclusions, remises/moins-values, prestations
  offertes, multi-TVA, totaux/ventilation, acompte/échéancier, signatures, sous-profils
  (structuré / plat / liste de prix). 8 variantes structurelles testées sur 10 devis.

---

## 1. Hiérarchie : lots → prestations → sous-descriptions

- **CONSTANT** : la colonne « N° » porte la hiérarchie. Un **lot** = numéro simple
  (`1`, `2`…) avec un intitulé et un **sous-total** à droite, sans prix ni quantité.
  Une **prestation** = numéro `N.M` avec quantité, unité, prix unitaire, TVA, total.
- **VARIABLE** : l'intitulé du lot est libre — `1. INSTALLATION / PREPARATION`,
  `LOT 01 – INSTALLATION ET LOGISTIQUE`, `LOT 01 – Préparation du chantier`. Le nombre
  de lots (1 à 14 observés) et de prestations par lot (1 à plusieurs) varie.
- **Pourquoi** : OBAT structure le chiffrage par **corps d'état** pour qu'un devis long
  reste lisible et que chaque prestation soit rattachable à son lot (planning, budget).
- **Sous-profil PLAT** : certains devis courts n'ont **pas de lots** — prestations
  numérotées `1, 2, 3…` directement. PHÉNIX crée alors un **lot implicite « Prestations »**.
  Corollaire de grammaire : **les lots OBAT sont toujours numérotés** — une ligne courte
  en MAJUSCULES (référence produit, « NUMERO 6 ») n'est donc **jamais** un lot.

## 2. Descriptions multi-lignes et multi-pages

- **CONSTANT** : la désignation d'une prestation peut se prolonger sur plusieurs lignes
  (voire au-delà d'un saut de page). Ces lignes n'ont ni numéro ni valeurs : elles se
  **rattachent à la prestation en cours**. Aucune description n'est tronquée silencieusement.
- **Pourquoi** : OBAT décrit finement le « fourni et posé » (le contrat exact) — c'est la
  matière que le conducteur doit retrouver mot pour mot face au document.

## 3. Sous-listes de matériaux & références produits

- **CONSTANT** : sous une prestation, OBAT liste les **matériaux** en puces
  `- <désignation> (<quantité> <unité>)` (`- Bloc-porte … (1 u)`, `- Panneau rayonnant
SOLIUS NEO … (1 u)`), et des **références produits/marques** (« Série Mosaïc »,
  « Céliane », « Apollo ou équivalent », « SOLIUS NEO »).
- **VARIABLE** : présence, longueur et granularité de la sous-liste.
- **Traitement** : rattachées à la description de la prestation ; **jamais** prises pour
  un lot/une section (une ligne avec `(N u)` est un matériau, pas un titre).
- **Pourquoi** : OBAT expose le détail matière pour justifier le prix et préparer les
  achats — c'est un gisement futur (commandes, quantités).

## 4. Options, variantes, prestations supplémentaires

- **CONSTANT** : bloc « **Transparence des prix** / **prestations supplémentaires** »
  = tarif d'add-ons à **quantité 0** (prix unitaire indiqué, total 0). Ce sont des
  **OPTIONS**, jamais intégrées au contrat sans validation.
- **Pourquoi** : cadrer d'avance le prix des demandes de dernière minute sans refaire un
  devis. La distinction contractuel / optionnel est essentielle pour le budget.

## 5. Exclusions (hors périmètre)

- **CONSTANT** : `ATTENTION : … N'EST PAS INCLUSE …` (souvent montant 0) → **écartée du
  contrat**, tracée à part.
- **Pourquoi** : matérialiser ce qui n'est **pas** vendu, pour prévenir tout litige. Une
  exclusion prise pour une prestation serait une faute (fausse promesse).

## 6. Remises, moins-values, plus-values

- **CONSTANT** : une **remise / moins-value** est une **ligne numérotée du tableau** à
  **montant négatif** (`10.2 Remise commerciale exceptionnelle -1 200,00 €`). Elle
  **diminue** le total et entre dans la réconciliation.
- **VARIABLE** : au niveau du devis (remise globale) ou d'un lot. Une **plus-value**
  (supplément) est une ligne positive normale (souvent libellée « Plus-value … »).
- **Pourquoi** : la remise est un engagement contractuel chiffré, pas une note de bas de
  page — d'où la règle « une ligne numérotée + valeurs est une prestation **avant** tout
  mot-clé ».

## 7. Prestations offertes / lignes à 0 €

- **CONSTANT** : une prestation à **0,00 €** (« … (OFFERT) », étude offerte) existe au
  contrat. PHÉNIX la **conserve** et la signale **« à vérifier »** (montant nul = contrôle
  humain : offert, ou montant non lu ?).
- **Pourquoi** : tracer le **geste commercial**. La prestation est due même à 0 €.

## 8. TVA multiple & ventilation

- **VARIABLE** : plusieurs taux (5,5 % rénovation énergétique · 10 % rénovation · 20 %
  neuf/agencement) coexistent, ligne par ligne, puis **ventilés** en fin de devis
  (`Taux TVA / Base HT / Total`).
- **Traitement** : le taux est lu **par ligne** (colonne TVA) ; la table de ventilation
  est un bloc **non contractuel** (jamais une prestation).
- **Pourquoi** : la TVA dépend de la nature des travaux — donnée clé pour la facturation.

## 9. Totaux & réconciliation financière

- **CONSTANT** : bloc `Total net HT` / `TVA` / `Total TTC` / `NET À PAYER`. PHÉNIX
  **rapproche** Σ des lignes lues et total HT déclaré (tolérance au centime). Un écart
  hors tolérance est **bloquant** (jamais masqué).
- **Pourquoi** : le total OBAT est la **vérité financière** ; la réconciliation prouve
  qu'aucune ligne n'a été oubliée ni inventée.

## 10. Acompte, échéancier, conditions de paiement

- **VARIABLE** : `Acompte de N %` (souvent 30–50 %), échéancier (« 40 % signature / 40 %
  milieu / 20 % réception »), méthodes de paiement.
- **Traitement** : blocs **non contractuels** (n'entrent pas au tableau des prestations),
  mais **exploitables** (trésorerie — cf. DEVIS-CERVEAU.md).

## 11. Observations, mentions, signatures, annexes

- **VARIABLE** : observations libres (« matériel communiqué à titre indicatif… »),
  mentions légales (article 257 CGI, garantie décennale APRIL), gestion des déchets,
  cadre de signature « Reçu avant exécution, bon pour accord ».
- **Traitement** : non contractuels ; un **mot-clé de bloc** (« déchetterie »,
  « garantie ») trouvé DANS une description de prestation adjacente est rattaché à la
  prestation, pas pris pour un bloc de fin.

## 12. Avenants (à approfondir)

- Un avenant OBAT est un **nouveau devis** rattaché à l'initial : ajout, suppression,
  remplacement, changement de quantité/prix, plus-value, moins-value, modification de
  description. PHÉNIX conserve l'original, extrait les impacts, rapproche les lignes,
  affiche les ambiguïtés et produit un **contrat consolidé versionné** (append-only ;
  cf. `consolidateDevis` / `avenantImpact`). **Variantes à corpus-ifier** dès réception
  d'avenants OBAT réels.

---

## Invariants d'or (constants, quel que soit le devis)

1. Ne **jamais inventer** : une ligne non lue reste à 0 / « à vérifier ».
2. Une **exclusion** n'est pas une prestation ; une **ligne de ventilation TVA** non plus.
3. Une **option** n'est jamais intégrée sans validation.
4. Une ligne **numérotée + valeurs** est une prestation (même « Remise … -1 200 € »).
5. Les **lots OBAT sont toujours numérotés**.
6. **Réconciliation obligatoire** ; tout écart est signalé, jamais masqué.
7. **Validation humaine** lot par lot avant toute exploitation aval.

## Ce qui peut varier (à surveiller à chaque nouveau devis)

Intitulés de lots · nombre de lots/prestations · présence de remise/option/exclusion ·
taux de TVA · longueur des descriptions · sauts de page · références produits · acompte
et échéancier · devis structuré vs plat · légers décalages de mise en page (colonnes
ancrées **sémantiquement** sur l'en-tête, tolérantes aux décalages).
