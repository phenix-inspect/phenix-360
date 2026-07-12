# Cartographie du format OBAT (profil spécialisé)

Référentiel du gabarit OBAT (compte « Phenix-amo » du conducteur), établi sur 6 devis
OBAT réels anonymisés. Le profil OBAT (`packages/core/src/devis-obat.ts`) reconnaît ce
gabarit et l'analyse avec des **colonnes ancrées sur l'en-tête** ; le pipeline de
lecture (reconstruction, classification, contrôles) est partagé avec le moteur
générique.

## Reconnaissance (ancres sémantiques, pas des coordonnées figées)

`detecterObat` calcule une confiance 0–1 sur ces indices ; l'en-tête de colonnes est
obligatoire, `estObat` dès que la moitié des indices sont réunis :

- en-tête `N° DÉSIGNATION QTÉ U. PRIX U. TVA TOTAL HT` (**signal fort**) ;
- `PRIX U.` + `TVA` accolés ; bloc `Total net HT` / `NET À PAYER` ;
- `Valable jusqu'au …` ; pied de page `Page X sur Y` ;
- ventilation `Taux TVA` / `Base HT` ; `Garantie décennale`.

Mesuré : devis OBAT → confiance 0,88–1,00 ; bon de commande → 0,25 ; devis Revel → 0,13
(tous deux routés vers le moteur générique).

## Structure des colonnes (x de l'en-tête → frontières par milieux)

| Colonne     | Ancre en-tête (x) | Données                                             |
| ----------- | ----------------- | --------------------------------------------------- |
| N°          | ~24               | numéro de lot (`1`) ou de poste (`1.1`), OPTIONNEL  |
| DÉSIGNATION | ~57               | libellé + descriptions multi-lignes, cadré à gauche |
| QTÉ         | ~293              | quantité, cadrée à droite                           |
| U.          | ~319              | unité (`u`, `m²`, `ml`, `ens`, `forfait`…)          |
| PRIX U.     | ~400              | prix unitaire HT                                    |
| TVA         | ~461              | taux (`5,50 %` / `10,00 %` / `20,00 %`)             |
| TOTAL HT    | ~528              | montant HT de la ligne                              |

La désignation s'arrête 15 px avant la colonne QTÉ ; les valeurs (cadrées à droite) sont
assignées par frontières = milieux entre x d'en-tête consécutifs. Robuste même à une
seule ligne (aucune dépendance aux données), là où l'apprentissage générique peut
vaciller.

## Blocs reconnus

- **Lot** : `N TITRE … <sous-total>` (numéro simple, ni prix ni quantité).
- **Prestation** : désignation + total + (prix ou quantité). Numéro OPTIONNEL.
- **Descriptions multi-lignes / multi-pages** : lignes de désignation sans numéro ni
  valeurs, rattachées à la prestation en cours (y compris après un saut de page).
- **Sous-listes de matériaux** : `- … (2 u)` → rattachées à la description, jamais un lot.
- **Exclusion** : `ATTENTION : … N'EST PAS INCLUSE …` → écartée du contrat.
- **Liste de prix à la carte** : `Transparence des prix` / `prestations supplémentaires`
  → OPTIONS (quantité 0), jamais intégrées sans validation.
- **Totaux** : `Total net HT` / `TVA` / `Total TTC` / `NET À PAYER` → réconciliation.
- **Ventilation TVA** : table `Taux TVA / Base HT / Total` → jamais des prestations.
- **Acompte, échéancier, conditions de paiement, gestion des déchets, garantie, mentions,
  observations, pied de page** → non contractuels.

## Variantes couvertes (corpus OBAT)

- devis long (13 lots / 21 postes) et court (1 lot / 1 poste) ;
- un ou plusieurs taux de TVA (5,5 / 10 / 20 %) ;
- lots à une ou plusieurs prestations ;
- devis **PLAT** sans lots (prestations numérotées 1, 2, 3…) → lot implicite ;
- lignes forfaitaires, descriptions sur plusieurs lignes / pages ;
- **liste de prix** « prestations supplémentaires » (options à 0 €) ;
- exclusion ; observations ; frais annexes (« Frais … »).

## Objectif de précision (atteint sur le corpus OBAT)

100 % des prestations détectées · 0 inventée · 0 exclusion prise pour une prestation ·
0 ligne TVA prise pour une prestation · descriptions réassemblées · montants 100 %
réconciliés · options identifiées · écarts de total signalés · chaque prestation reliée
à sa page source. Toute ligne non certaine reste « À vérifier » — jamais inventée. La
validation humaine (lot par lot) demeure obligatoire avant exploitation aval.
