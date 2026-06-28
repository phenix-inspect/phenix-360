#!/usr/bin/env bash
# PHÉNIX 360 — applique stubs + migrations + seed + test RLS sur un Postgres nu.
# Usage : DATABASE_URL=postgres://user:pass@host:5432/db bash supabase/test/run.sh
set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" # = supabase/

if ! command -v psql >/dev/null 2>&1; then
  echo "✗ psql introuvable — installer postgresql-client." >&2
  exit 1
fi

run() { psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }

echo "→ stubs auth/storage"
run "$ROOT/test/stubs.sql"

echo "→ migrations"
for f in "$ROOT"/migrations/*.sql; do
  echo "  • $(basename "$f")"
  run "$f"
done

echo "→ seed"
run "$ROOT/seed/seed.sql"

echo "→ test RLS"
run "$ROOT/test/rls_test.sql"

echo "✓ migrations + seed + RLS OK"
