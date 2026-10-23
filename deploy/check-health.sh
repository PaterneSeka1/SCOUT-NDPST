#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  paroisse) API=4000; WEB=3002 ;;
  district) API=4100; WEB=3004 ;;
  *) echo 'Usage: check-health.sh paroisse|district' >&2; exit 1 ;;
esac
# Délai borné, vérifie aussi le relais Next -> API et une page publique.
for attempt in {1..20}; do
  if curl --max-time 3 -fsS "http://127.0.0.1:$API/api/sante" >/dev/null &&
     curl --max-time 3 -fsS "http://127.0.0.1:$WEB/api/sante" >/dev/null &&
     curl --max-time 3 -fsS "http://127.0.0.1:$WEB/" >/dev/null; then
    echo '{"evenement":"disponibilite.ok"}'
    exit 0
  fi
  sleep 2
done
echo '{"evenement":"disponibilite.echec"}' >&2
exit 1
