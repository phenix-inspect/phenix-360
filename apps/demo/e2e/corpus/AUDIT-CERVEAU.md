# Audit — le contrat validé, source unique de vérité de PHÉNIX 360

> Vérification, feature par feature, que chaque information affichée dérive du
> **contrat validé** (`validatedDevis(dossier)` + avenants), sans duplication ni
> donnée inventée. Règle d'or : une prestation validée n'existe qu'**une fois**
> (créée à la validation du devis) ; toutes les fonctionnalités la **réutilisent**.

## Point de passage unique

`validatedDevis(holder)` (contract.ts) restreint le devis aux **lots validés** ; un
lot non validé n'alimente jamais l'aval. Chaque prestation porte : `id`, `label`
(libellé contractuel exact), `lot`, `sourcePage` (page du PDF), et son origine
(devis initial / avenant, via `consolidateDevis`). On remonte toujours au PDF signé.

## Résultat par fonctionnalité

| #   | Fonctionnalité           | Source                                                                                                             | État                        |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| 1   | **Préparation**          | `validatedDevis` (DossierPanel / cockpit) ; état vide propre si aucun lot validé                                   | ✅ conforme                 |
| 2   | **Pré-réception**        | `buildPrestationsAVerifier(validatedDevis, avenants)` — devis + avenants validés, rien d'inventé                   | ✅ conforme (+ page source) |
| 3   | **Réception / réserves** | statuts & réserves issus de la pré-réception (levée au Suivi) — aucune ressaisie                                   | ✅ conforme                 |
| 4   | **Léon (conducteur)**    | `askContrat` → `answerContractQuestion(validatedDevis…)`, zéro hallucination                                       | ✅ nouveau                  |
| 4b  | **Léon (client)**        | client-safe : existence du devis, jamais de montant ; escalade au conducteur                                       | ✅ conforme                 |
| 5   | **Documents**            | devis original archivé & ouvrable ; avenants ; vue consolidée `consolidateDevis`                                   | ✅ conforme                 |
| 6   | **Choix client**         | non créés automatiquement ; seam `ContractPlan.decisionsClientProbables` prêt                                      | ✅ préparé                  |
| 7   | **Budget**               | `buildDevisSummary(validatedDevis(dossier))` — aucune valeur codée en dur                                          | ✅ conforme                 |
| 8   | **Facture finale**       | données présentes : montant HT par poste, remises (montant négatif), moins-values (statut pré-réception), avenants | ✅ info disponible          |
| 9   | **Suivi**                | chaque prestation vérifiée porte `posteId` + `origin` (devis/avenant) ; documents liés au projet/événement         | ✅ traçable                 |

## Corrections réalisées

- **Léon conducteur** : nouveau moteur `contract-qa.ts` (`answerContractQuestion`) +
  `demo.askContrat` — répond **uniquement** depuis `validatedDevis` (+ avenants +
  exclusions). Répond précisément quand l'info existe (prestations, lots, montants,
  TVA, avenants, exclusions), dit « je ne trouve pas » sinon, **n'invente jamais**,
  propose d'ouvrir le devis. Traçabilité par poste (lot, page source).
- **Traçabilité pré-réception** : ajout de `sourcePage` à `PrestationVerif` — chaque
  prestation vérifiée remonte à la page du PDF signé.
- **Données fictives supprimées** : `mockAnalyzeDossier` (≈ 380 lignes de dossier
  scénarisé : prestations, commandes, choix génériques) **retiré** — code mort, jamais
  branché (le port par défaut est `realAnalyzeDossier`, lecture réelle sans invention).
  Commentaires obsolètes corrigés (prepare.ts, store.ts).

## Données fictives — recherche

- Analyseur par défaut : `realAnalyzeDossier` (lecture réelle). ✅
- `mockAnalyzeDossier` : **supprimé** (était inutilisé). ✅
- Aucun montant codé en dur dans les écrans (budget dérive du contrat). ✅
- Démo d'accueil (`SEEDED_KEY`) : projet de découverte **séparé**, choisi
  explicitement (« découvrir la démo » vs « démarrer à vide ») — n'affecte pas un
  chantier réel. Hors périmètre « données inventées dans un vrai chantier ».

## Stress test Léon (anti-hallucination)

`leon-contrat-stress.test.mjs` — 110+ interrogations sur le devis de référence validé :
totaux/TVA/lots exacts, exclusion (porte d'entrée) annoncée « exclue », prestations
présentes retrouvées & tracées, prestations absentes (jacuzzi, piscine, véranda…)
**jamais** présentées comme prévues, refus propre sans contrat validé.
Résultat : **exactes 75/75 · incomplètes 0 · HALLUCINATIONS 0**.

## Verdict

**Oui — le contrat validé est devenu la source unique de vérité.** Les 9
fonctionnalités dérivent de `validatedDevis` (+ avenants) ; la seule source
alternative (analyse scénarisée `mockAnalyzeDossier`) a été supprimée. Léon
conducteur répond exclusivement depuis le contrat, sans hallucination. Chaque
prestation reste unique et traçable jusqu'au PDF signé.

**Restes à faire (non bloquants, futures itérations)** : implémenter les dériveurs
`ContractDeriver` (commandes, choix client…) pour matérialiser les seams
« préparés » ; enrichir la lecture des sous-listes de matériaux (pour « combien de
radiateurs »), aujourd'hui écartées du contrat (réponse honnête « je ne trouve pas »).
