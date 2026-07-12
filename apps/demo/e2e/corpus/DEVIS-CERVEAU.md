# Le devis, cerveau du chantier — feuille de route d'exploitation

> Vision, **pas** du code. Une fois le devis OBAT parfaitement compris et **validé lot
> par lot**, il devient la source de vérité qui alimente tout PHÉNIX 360. Ce document
> recense ce que la compréhension du devis rend possible, et à quelle donnée déjà
> extraite chaque idée se raccroche. La couture technique existe déjà :
> `ContractDeriver` / `ContractPlan` (`packages/core/src/contract-derivation.ts`),
> nourri par `validatedDevis(dossier)` — un lot non validé n'alimente jamais rien.

## Ce que le lecteur extrait déjà (matière première)

Par prestation : libellé contractuel exact + libellé court, quantité, unité, prix
unitaire, montant HT, TVA, **page source**, statut de confiance, sous-liste de matériaux
et références produits, appartenance à un lot. Par devis : lots, exclusions, options,
remises/moins-values, totaux réconciliés, acompte/échéancier, taux de TVA.

## Idées d'exploitation (mappées sur ContractPlan)

| Idée                                  | Donnée du devis mobilisée                                                | Sortie `ContractPlan`      | Statut    |
| ------------------------------------- | ------------------------------------------------------------------------ | -------------------------- | --------- |
| **Commandes probables**               | sous-listes matériaux, références produits, quantités                    | `commandesProbables`       | seam prêt |
| **Métiers / corps d'état**            | intitulés de lots, mots-clés prestations                                 | `metiers`                  | seam prêt |
| **Réservations amont**                | matériel long délai (menuiseries, clim, agencement)                      | `reservationsProbables`    | seam prêt |
| **Détection de risques / vigilances** | prestations sensibles (électricité CONSUEL, gaz, structure, amiante)     | `vigilances`               | seam prêt |
| **Contrôles de réception**            | une prestation vendue = un point à réceptionner                          | `controlesReception`       | seam prêt |
| **Photos attendues**                  | avant/pendant/après par prestation                                       | `photosAttendues`          | seam prêt |
| **Choix client à obtenir**            | finitions/matériaux à décider (carrelage, faïence, peinture, sanitaires) | `decisionsClientProbables` | seam prêt |

## Idées supplémentaires (à raccrocher au même moteur)

- **Contrôle des quantités** : recouper quantités du devis (m², ml, u) avec les matériaux
  détaillés → détecter incohérences avant commande (donnée : qté + sous-listes).
- **Check-lists automatiques** : une check-list de préparation / pré-réception / réception
  dérivée des prestations validées (donnée : prestations + lots).
- **Estimation des durées** : ratios métier × quantités → pré-planning indicatif (donnée :
  lots, quantités, unités). À caler sur des retours terrain.
- **Pré-réception & réception** : déjà alimentées par les prestations validées ; enrichir
  avec les **exclusions** (ne pas réceptionner ce qui n'est pas vendu) et les **réserves**.
- **Léon** : répond sur le contrat réel (prestations, montants, page source) — uniquement
  du **validé**, avec ouverture du document original ; jamais de donnée fictive.
- **Budget & trésorerie** : total réconcilié + **acompte/échéancier** → plan d'encaissement
  et budget par lot (donnée : totaux, acompte, montants par lot).
- **Moins-values automatiques** : une prestation non réalisée → moins-value chiffrée à
  partir de son montant contractuel (donnée : montant HT par prestation + remises).
- **SAV** : garanties et références produits posées → base SAV (donnée : références,
  matériaux, dates). À corpus-ifier avec de vrais cas.
- **Options** : proposer au client les add-ons du tarif « prestations supplémentaires »
  au bon moment (donnée : options détectées, jamais intégrées sans validation).

## Principes directeurs

1. **Rien sans validation** : toute dérivation lit `validatedDevis` ; un lot non validé
   n'alimente aucune fonctionnalité.
2. **Traçabilité** : chaque artefact dérivé référence son lot/poste d'origine (retour au
   devis, page source) et se **recalcule** si le lot change ou qu'un avenant arrive.
3. **Jamais d'invention** : une incertitude reste « à vérifier », proposée au conducteur,
   jamais injectée en silence.
4. **Une seule vérité** : le devis validé (+ avenants consolidés) est l'unique source ;
   Préparation, pré-réception, réception, budget, commandes, Léon en dérivent.

## Prochaines briques concrètes (quand décidé)

Implémenter, une par une et avec leurs tests, des dériveurs `ContractDeriver` alimentant
un champ de `ContractPlan` (commandes, puis métiers, puis choix client…). Chaque dériveur
naît d'un besoin réel, adossé au corpus OBAT, sans jamais casser la lecture ni la
validation humaine. **Le lecteur de devis devient ainsi le cerveau de l'application :
PHÉNIX comprend le chantier avant même qu'il commence.**
