# supabase/test — validation du schéma sur Postgres nu

Vérifie les migrations **sans** la CLI Supabase : léger, rapide, compréhensible.

- `stubs.sql` — le strict nécessaire fourni par Supabase (rôles, `auth`/`storage`,
  `auth.uid()` pilotée par la GUC `app.user_id`).
- `rls_test.sql` — assertions : avancement dérivé (`gros_oeuvre`), vue client
  (3 événements, brouillon masqué), vue interne (4). Échoue au moindre écart.
- `run.sh` — applique stubs → migrations → seed → test RLS.

## En local

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres \
  bash supabase/test/run.sh
```

> La CLI Supabase sera ajoutée plus tard, quand il faudra tester des
> comportements Supabase spécifiques. La CI actuelle protège le produit (schéma,
> RLS, avancement) sans surcoût d'infrastructure.
