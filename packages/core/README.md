# @phenix360/core — modèle canonique

**Le produit dicte le schéma, pas l'inverse.** Ce package définit la colonne
vertébrale — l'**événement** — _avant_ toute table Supabase. La base de données
sera une traduction de ce modèle ; jamais le contraire.

> **Sprint 0 :** types canoniques (fait) → migration Supabase → policies RLS →
> seed → couche d'accès portable. (Voir ADR-001/002/004.)

## L'événement n'est pas une timeline

C'est la **source unique** qui alimente les quatre surfaces du produit :

1. **l'interface PHÉNIX** (boucle terrain) ;
2. **l'espace client** (récit, photos, documents) ;
3. **l'assistant IA** (récupération structurée dans le journal) ;
4. **le bandeau décision** « Vous n'avez rien à faire / Une décision vous attend ».

Forme : **enveloppe commune + contenu typé** (ADR-002 §2). `Event` est une union
discriminée sur `type` ; affiner `type` donne un `content` typé.

## Types canoniques

| Type                                                                  | Rôle                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `Project` (≡ chantier), `ProjectStep`, `ProjectMember`, `ProjectRole` | le projet = un journal ; avancement = **étape**, jamais un % |
| `Event` (`CompteRendu`/`Photo`/`Document`/`Demande`)                  | la colonne vertébrale (enveloppe + contenu typé)             |
| `EventType`, `EventVisibility`, `EventState`                          | énumérations d'enveloppe                                     |
| `EventActor`, `ActorRole`, `Role`                                     | auteur **humain** (l'IA n'est jamais auteur — ADR-001 §3)    |
| `EventAttachment`, `AttachmentKind`                                   | fichier S3-compatible (portabilité ADR-004 §2.5)             |
| `Decision`, `ClientDecisionBanner`, `ClientAction`                    | projection des demandes client + bandeau d'accueil           |
| `*Id` (branded), `IsoDateTime`                                        | identifiants typés, anti-confusion d'ID                      |

## Invariants (verrouillés par les ADR)

- **L'IA n'est jamais auteur** : elle propose, l'humain valide (ADR-001 §3).
- **La validation est un ÉTAT**, pas un type : `brouillon → publie` (ADR-002 §4).
- **Une demande = un besoin = une résolution**, pas un fil : `ouverte → traitee
→ close` ; la réponse est portée par la demande (ADR-001 §6).
- **L'avancement est une étape** portée par le compte_rendu, jamais un %.
- **Les vues sont des lectures filtrées** du journal, pas des stockages séparés.

## Vues dérivées (`views.ts`)

Sélecteurs purs sur `Event[]`, réutilisables partout :
`currentStep`, `gallery`, `vault`, `teamQueue`, `clientFeed`, `forClient`,
`pendingClientDecisions`, `clientDecisionBanner`.

> `isVisibleToClient(event)` est la **source unique** de la règle de visibilité
> client ; la policy RLS Postgres devra la **refléter** (et non l'inverse).
