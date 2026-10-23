#!/usr/bin/env bash
# Sonde destinée à un ordonnanceur supervisé, aucun redémarrage automatique.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$ROOT/deploy/check-health.sh" "${1:?Installation paroisse|district requise}"
(cd "$ROOT/apps/api" && node ../../deploy/check-backup.cjs)
node "$ROOT/deploy/check-resources.cjs"
# Seuil proposé : 85 %; toute saturation rend la sonde non nulle.
USED="$(df -P "$ROOT" | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
[[ "$USED" =~ ^[0-9]+$ && "$USED" -lt 85 ]]
echo '{"evenement":"supervision.ok"}'
