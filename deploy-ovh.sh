#!/usr/bin/env bash
# Prépare une release sans modifier le clone ni ses fichiers compilés actifs.
# Voir docs/exploitation-releases.md avant la première utilisation.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$ROOT/deploy/release.sh" "$@"
