# supabase/ — schéma versionné

Le journal vit ici, **entièrement en code** (règle de portabilité ADR-004 §2.5) :
schéma, RLS et seed sont versionnés, jamais cliqués dans le dashboard.

- `migrations/` — schéma SQL (table `event` au centre, `chantier`, annotations)
- `policies/` — politiques RLS (`client` / `interne`)
- `seed/` — données de démonstration

> Rempli à l'**étape 4** du Sprint 0.
