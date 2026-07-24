# Sprint — Pré-réception premium + Assistant Chantier

> Chaîne complète : devis OBAT → contrat consolidé → compréhension des
> équipements → **Assistant Chantier** (prépare) → contrôle humain →
> **Pré-réception** (PV Client + Artisan) → validation conducteur → diffusion.
> PHÉNIX **prépare** ; le conducteur **décide**. La PR #3 n'est jamais mergée.

## 1. Audit de l'existant (ce qui était déjà là)

La refonte du 12/07 avait déjà livré une pré-réception solide : flux dédié
(`PrereceptionFlow.tsx`), reconstruction des prestations depuis le devis validé et
les avenants (`buildPrestationsAVerifier`), 4 statuts, réserves (photo,
commentaire, responsable interne, date de reprise), synthèse, **écran de
validation** avec double document Client/Artisan dérivé par destinataire
(`buildDocumentHtml`, filtrage `audience`), **versionnement** (V1/V2 = comptage
append-only), stockage Documents, Suivi, notification client, étanchéité
client/interne.

**Écarts corrigés par ce sprint :**

| Écart identifié                                        | Correction                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| Statuts « Fait / Réserve / À faire / Moins-value »     | Renommés **professionnels** (source unique `PRESTATION_STATUT_*`) |
| Libellés dupliqués (flow + doc + synthèse)             | Centralisés dans le cœur (plus de divergence)                     |
| En-tête sans adresse / client / conducteur / référence | En-tête complet + **référence stable** `PR-AAAAMMJJ-Vx`           |
| `detailsTechniques` dérivés mais jamais affichés       | **Aide au contrôle** sous chaque prestation                       |
| Réserves non mises en évidence                         | **Rouge** (bordure, pastille ⚠️, commentaire) — réserves seules   |
| Documents sans signatures / filigrane / adresse        | 2 **encarts de signature** + filigrane **BROUILLON** + en-tête    |
| `contract-derivation.ts` : seam sans implémentation    | **Assistant Chantier** (`assistant-chantier.ts`) l'implémente     |

## 2. Statuts professionnels (source unique — `prereception.ts`)

| Clé           | Conducteur / Artisan                        | Client                   |
| ------------- | ------------------------------------------- | ------------------------ |
| `fait`        | Réceptionné sans réserve                    | Réceptionné sans réserve |
| `reserve`     | Réceptionné avec réserve                    | Réceptionné avec réserve |
| `non_fait`    | Non réceptionné — à réaliser                | Non réceptionné          |
| `moins_value` | Retiré du périmètre — moins-value à prévoir | Retiré du périmètre      |

Le client ne voit jamais la notion interne « moins-value ». Boutons courts
(`PRESTATION_STATUT_SHORT`), pastilles (`PRESTATION_STATUT_DOT`), libellés de
synthèse (`PRERECEPTION_SYNTHESE_LABEL`) — tous dérivés du cœur.

## 3. Documents (Client / Artisan)

Rendu HTML autonome imprimable (print → PDF navigateur), déjà compatible signature
en ligne. En-tête : Chantier · Adresse · Client · Référence · Date · Conducteur ·
Présents. Synthèse professionnelle. Réserves en **rouge**. Deux **encarts de
signature** (PHÉNIX + Client ou son représentant : Nom / Qualité / Date /
Signature), `page-break-inside: avoid`. **Filigrane BROUILLON** tant que le
document n'est pas validé ; il disparaît sur le document validé. Le client ne
reçoit jamais responsable / date de reprise / motif / commentaire « non
réceptionné ».

## 4. Assistant Chantier (`assistant-chantier.ts`) — prépare, ne décide jamais

`preparerAssistantChantier(holder, avenants)` → plan de **brouillons** dérivés du
contrat validé (+ avenants consolidés), avec résumé « PHÉNIX 360 a préparé votre
chantier » :

- **Matériel à commander** : équipements + finitions (hors consommables),
  quantité additionnée si fiable sinon « Quantité à confirmer », « Référence à
  définir » si absente.
- **Préparation des commandes** : statuts (À vérifier / Choix client nécessaire /
  … / Commandé / Annulé) — l'assistant ne pose jamais « À commander » tout seul.
- **Choix à demander au client** : couleur « à définir », gamme devinée, référence
  absente sur une finition — statut « À analyser », **options vides**, jamais
  envoyé.
- **Check-list** : dérivée par famille de lot (Consuel, étanchéité, délais…).
- **Points de vigilance** : délais longs, mises en service, quantités/références à
  confirmer — formulés prudemment, « À vérifier ».
- **Documents à récupérer** & **Photos recommandées** : par lot + transverses.

**Garanties** (prouvées par les tests) : blocage propre sans contrat validé ;
aucun matériel / quantité / référence inventé (tout tracé jusqu'au poste + page) ;
aucune fusion entre prestations ; aucune action déclenchée. Encart **lecture
seule** dans Préparation (emplacement de l'ancienne section retirée) — aucune
interaction client (les choix passent par « Nouvelle mission → Demander au
client » après validation).

## 5. Tests ajoutés / renforcés

- `assistant-chantier.test.mjs` (**108/108**) — corpus OBAT complet : blocage,
  0 invention, mentions prudentes, aucune action déclenchée, choix « À analyser »
  options vides, traçabilité, vérité à la main (18 prises, receveur 800×800,
  Consuel, étanchéité, photos avant fermeture), statuts professionnels.
- `prereception.test.mjs` (**20/20**, e2e) — en-tête + référence PR-…, 4 statuts
  professionnels, réserve rouge, filigrane BROUILLON (aperçu) puis absent (validé),
  encarts de signature, confidentialité client/artisan, versionnement, Suivi.
- `preparation.test.mjs` (**13/13**, e2e) — Assistant Chantier visible côté
  conducteur, aucune action d'envoi, non-fuite côté client.
- Non-régression : `details-techniques` 72/72, `leon-technique-stress` 18/18,
  `leon-contrat-stress` 75/75, `corpus-qualification` 99/99.

## 6. Limites honnêtes restantes

- Le « PDF » reste un HTML imprimable (impression navigateur) — pas d'écriture PDF
  binaire ni de pagination « Page X/Y » ; suffisant pour la signature en ligne.
- L'Assistant Chantier est en **lecture seule** : l'édition fine des brouillons
  (fusionner / séparer / statut par ligne) et le routage « en un clic » vers les
  points d'entrée officiels restent à câbler (le modèle expose déjà statuts,
  regroupements et traçabilité).
- Sur un devis mock sans sous-listes, peu de matériels sont détectés (normal :
  rien n'est inventé) ; la richesse vient des devis OBAT réels.
