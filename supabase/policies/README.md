# Modèle d'accès (RLS) — revue lisible

La RLS applique la visibilité **à la source** (ADR-004 §4) ; le front ne fait
jamais foi. Source exécutable : `../migrations/*_rls.sql`. Ce document en est la
revue humaine.

## Helpers (security definer, anti-récursion)

- `app_is_member(project)` — l'utilisateur est membre du projet.
- `app_has_role(project, role)` — membre avec un rôle précis.
- `app_is_internal(project)` — membre **interne** Phénix (`compagnon` ou `equipe`).

## Tables

| Table                             | Lecture                                                              | Écriture                                                                                           |
| --------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `project`                         | membre **ou** `client_id = auth.uid()`                               | update : interne ; insert/delete : rôle de service                                                 |
| `project_member`                  | membres du projet                                                    | rôle de service (accès gérés par la passerelle)                                                    |
| `event`                           | **interne** : tout ; **client** : miroir de `core.isVisibleToClient` | insert/update : interne (`author_id = auth.uid()`) ; client : **aucune** (passe par la passerelle) |
| `storage.objects` (`attachments`) | membres du projet (clé préfixée `project_id/`)                       | interne                                                                                            |

## Règle de visibilité client (miroir de `core.isVisibleToClient`)

Un événement est visible au client si `visibility = 'client'`, qu'il est membre
`client` du projet, **et** :

- `demande` adressée au client (`content.destinataire = 'client'`) → états
  `ouverte`, `traitee`, `close` (il doit pouvoir voir/agir, puis la résolution) ;
- `demande` interne → `traitee`, `close` seulement ;
- `compte_rendu` / `photo` / `document` → `publie`.

> Toute évolution de cette règle se fait **d'abord dans `core`**
> (`isVisibleToClient`), puis est répercutée dans `_rls.sql`. Jamais l'inverse.

## Principe d'écriture

Le client n'écrit **jamais** le journal en direct (aucune policy d'écriture
client). Ses actions (résolution de demande, etc.) passent par la **passerelle**
qui, en rôle de service, **revalide** les permissions avant d'écrire — elle
applique la visibilité, ne la contourne pas (ADR-004 §4).
