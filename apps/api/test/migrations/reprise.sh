#!/usr/bin/env bash
set -euo pipefail

# Ne crée/supprime aucune base. La cible doit avoir été créée isolément et
# explicitement pour ce test ; aucune configuration .env n'est chargée.
: "${PGDATABASE:?PGDATABASE doit désigner une base temporaire vide}"
: "${PGUSER:?PGUSER est requis}"
case "$PGDATABASE" in
  ci_reprise|scout_test_reprise_[a-z0-9_]*) ;;
  *) echo 'Base ci_reprise ou scout_test_reprise_* requise' >&2; exit 2 ;;
esac
if [[ "$PGDATABASE" != ci_reprise && ! "$PGDATABASE" =~ ^scout_test_reprise_[a-z0-9_]+$ ]]; then
  echo 'Nom de base temporaire invalide' >&2
  exit 2
fi
case "${PGHOST:-}" in
  127.0.0.1|localhost|::1) ;;
  *) echo 'PGHOST doit désigner PostgreSQL en loopback' >&2; exit 2 ;;
esac

REPRISE_TEST_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# Ces options libpq héritées pourraient détourner la cible loopback validée.
exec env -u PGHOSTADDR -u PGSERVICE -u PGSERVICEFILE -u PGOPTIONS \
  psql -X --no-password --host="$PGHOST" --port="${PGPORT:-5432}" \
  --username="$PGUSER" --dbname="$PGDATABASE" --set=ON_ERROR_STOP=1 \
  --file="$REPRISE_TEST_DIR/reprise.sql"
