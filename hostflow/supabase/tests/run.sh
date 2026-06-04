#!/usr/bin/env bash
# ============================================================================
# Lokaler RLS-Testlauf OHNE Supabase-Stack: nacktes Postgres + Shim.
# Baut eine frische Test-DB, spielt Shim → Migrationen → Seed ein und führt
# die RLS-Assertions aus. Bricht mit Exit-Code != 0 ab, wenn ein Test fehlschlägt.
#
# Voraussetzung: laufender Postgres. Verbindung über PG*-Variablen steuerbar.
#   Beispiel: PGHOST=/tmp PGPORT=5433 PGUSER=postgres ./supabase/tests/run.sh
# ============================================================================
set -euo pipefail

DB="${HOSTFLOW_TEST_DB:-hostflow_test}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL="psql -v ON_ERROR_STOP=1 -X -q"

echo "▶ Test-DB '$DB' neu anlegen"
dropdb --if-exists "$DB"
createdb "$DB"

echo "▶ Shim einspielen"
$PSQL -d "$DB" -f "$DIR/tests/00_local_shim.sql"

echo "▶ Migrationen einspielen"
for f in "$DIR"/migrations/*.sql; do
  echo "   • $(basename "$f")"
  $PSQL -d "$DB" -f "$f"
done

echo "▶ Seed einspielen"
$PSQL -d "$DB" -f "$DIR/seed.sql"

echo "▶ RLS-Tests ausführen"
$PSQL -d "$DB" -f "$DIR/tests/01_rls_test.sql"
