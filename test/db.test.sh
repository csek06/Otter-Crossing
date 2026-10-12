#!/usr/bin/env bash
# Applies the Supabase migrations to a scratch Postgres database and runs the
# checks in test/db/checks.sql. Needs psql and a Postgres server you can create
# databases on (PG* environment variables, or a local socket).
#   bash test/db.test.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="otter_crossing_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f test/db/supabase-stub.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f test/db/checks.sql
