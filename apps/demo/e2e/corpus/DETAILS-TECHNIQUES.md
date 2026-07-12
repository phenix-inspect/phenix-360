# Enrichissement technique du contrat OBAT — couche dérivée, jamais inventée

> Le contrat validé reste la **source unique de vérité**. On ne touche JAMAIS au
> libellé contractuel : on **ajoute** une lecture technique dérivée et traçable
> (`detailsTechniques`) pour répondre au détail — sans rien inventer.

## Le problème résolu

Jusqu'ici, les **sous-listes de matériaux** d'une prestation OBAT (les puces
`- Prise de courant 2P+T (18 u)`, `- Receveur douche 800 x 800 mm`,
`- Fils H07V-U (429,45 ml)`…) étaient **classées `materiau` puis écartées** du
contrat. Léon répondait donc « je ne trouve pas » à « combien de prises ? ».

## Ce qui a changé

1. **Capture** (`devis-geometry.ts`) — les puces sous un poste sont conservées
   **brutes** dans `poste.detailsSource[]`. Le libellé contractuel n'est pas
   modifié : `detailsSource` est une matière première séparée.
2. **Dérivation** (`details-techniques.ts`) — `deriverDetailsPoste` transforme
   `detailsSource` + la description (`label`) en `DetailTechnique[]` :

   | champ              | exemple                                                                  | source                        |
   | ------------------ | ------------------------------------------------------------------------ | ----------------------------- |
   | `type`             | équipement / matériau / gamme / marque / couleur / dimension / référence |
   | `libellé`          | « Prise de courant 2P+T »                                                | désignation nettoyée          |
   | `quantité`/`unité` | 18 / « u »                                                               | `(18 u)` en fin de puce       |
   | `dimensions`       | « 800 × 800 mm »                                                         | `800 x 800 mm`, `Ø 20 mm`     |
   | `marque`/`gamme`   | Legrand / dooxie                                                         | « de chez … », « type … »     |
   | `couleur`          | blanc / RAL 9010 / à définir                                             |                               |
   | `pièce`            | Salle de bain                                                            | lot + libellé                 |
   | `référence`        | PR00064660                                                               | réf. produit                  |
   | `niveauConfiance`  | Fiable / À vérifier                                                      | tronqué / deviné ⇒ À vérifier |
   | `extraitSource`    | « - Prise … (18 u) »                                                     | traçabilité mot pour mot      |

3. **Léon** (`contract-qa.ts`) répond aux questions techniques : combien de
   radiateurs / prises / interrupteurs, quelle gamme d'appareillage, quel
   receveur, quelle faïence, quelle couleur de peinture, quels équipements par
   pièce. Chaque réponse **cite le poste + la page**, **propose d'ouvrir le
   devis** et **signale l'incertitude**.
4. **Pré-réception** (`prereception.ts`) — `PrestationVerif.detailsTechniques`
   affiche ces repères en **aide au contrôle**, sans créer de nouvelle prestation.
5. **Commandes / choix client** — `preparerBesoinsContrat` / `agregerBesoins`
   **préparent** (sans les créer) les besoins matériels agrégés. Le conducteur
   reste décideur.

## Règles de sécurité (garanties par les tests)

- **Aucune quantité inventée** — toute `quantité` figure telle quelle dans son
  `extraitSource`. Sans quantité chiffrée (ex. radiateurs non dénombrés à la
  source), Léon ne fabrique **aucun total** : il liste et signale « à vérifier ».
- **Aucune référence inventée** — toute `référence` provient de son extrait.
- **Aucune fusion** entre deux prestations — l'extrait d'un détail provient
  EXACTEMENT du poste auquel il est rattaché.
- **Ambiguïté signalée** — quantité tronquée par la mise en page (`(6` sans
  unité), marque/gamme devinée ⇒ `niveauConfiance: 'À vérifier'`.
- **Libellé contractuel intact** — la dérivation ne mute jamais `poste.label`.

## Tests

- `details-techniques.test.mjs` — sur **tout le corpus OBAT** (≈ 730 détails) :
  0 quantité inventée, 0 référence inventée, 0 fusion, ambiguïté toujours
  signalée, traçabilité complète ; puis vérité à la main (18 prises, receveur
  800×800, faïence 30×60, gamme dooxie/Legrand, couleur blanc, réf. PR00064660).
- `leon-technique-stress.test.mjs` — Léon interrogé au détail : totaux fiables
  annoncés (prises), aucun total inventé (radiateurs), attributs tracés,
  équipements absents jamais inventés, non-régression des intents factuels.
