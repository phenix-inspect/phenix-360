# supabase/ — schéma versionné

Le journal vit ici, **entièrement en code** (règle de portabilité ADR-004 §2.5) :
schéma, RLS, triggers, buckets et seed sont versionnés, jamais cliqués dans le
dashboard. C'est une **traduction du modèle canonique `@phenix360/core`** — le
produit dicte le schéma.

## Migrations (`migrations/`, appliquées dans l'ordre)

| Fichier         | Contenu                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| `…_init.sql`    | extensions, enums, tables `project` / `project_member` / `event`, index, trigger d'avancement |
| `…_rls.sql`     | RLS + helpers d'appartenance ; lecture client = **miroir de `core.isVisibleToClient`**        |
| `…_storage.sql` | bucket privé `attachments` + RLS (clé S3 préfixée par `project_id`)                           |

> **Nommage (amendement ADR-004 §4) :** tables en anglais alignées sur core
> (`project`, `project_member`, `event`) ; les **valeurs d'enum restent en
> français** (vocabulaire métier : `compte_rendu`, `gros_oeuvre`…).

## Policies (`policies/`)

Modèle d'accès en clair (revue) — voir [`policies/README.md`](./policies/README.md).
La source **exécutable** des policies est la migration `…_rls.sql` (source
unique, zéro dérive).

## Seed (`seed/seed.sql`)

Un chantier de démo : CR publié (avancement), photo, **décision en attente du
client**, et un brouillon interne (invisible au client). Idempotent.

## Vérification locale

```bash
supabase db reset   # applique migrations + seed
```

> Schéma validé hors-ligne sur PostgreSQL 16 (stubs `auth`/`storage`) : trigger
> d'avancement, RLS client/interne et seed conformes au modèle core.
