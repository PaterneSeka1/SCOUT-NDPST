#!/usr/bin/env bash
# Test R2 dans une base jetable, jamais une URL ou un conteneur fourni en entrée.
set -euo pipefail
umask 077
[[ $# -eq 0 ]] || { echo "Aucun argument accepté : la cible est toujours créée par ce script." >&2; exit 1; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP="$(mktemp -d)"
# Affecté uniquement après création réussie : ne jamais supprimer un nom existant.
CONTAINER_ID=""
cleanup() {
  if [[ -n "$CONTAINER_ID" ]]; then docker rm -f -v "$CONTAINER_ID" >/dev/null 2>&1 || true; fi
  rm -rf -- "$TEMP"
}
trap cleanup EXIT
cd "$ROOT/apps/api"
node ../../deploy/check-backup.cjs
npm run restaurer-sauvegarde -- --derniere --sortie "$TEMP/base.dump" >/dev/null
# Aucune donnée de production n'est montée. PGDATA est en mémoire; le volume
# anonyme déclaré par l'image PostgreSQL est masqué par ce montage temporaire.
CONTAINER_ID="$(docker run -d --network none --memory 1g \
  --label scout.restore-test=true \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,size=768m \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine)"
[[ "$CONTAINER_ID" =~ ^[a-f0-9]{64}$ ]] || { echo 'ID du conteneur temporaire invalide' >&2; exit 1; }
# Dernière barrière avant toute écriture: identité créée ici, réseau fermé,
# aucun bind mount/volume ni port publié. Ne jamais accepter une cible externe.
docker inspect "$CONTAINER_ID" --format '{{json .}}' | node -e '
  let input = "";
  process.stdin.on("data", (chunk) => input += chunk);
  process.stdin.on("end", () => {
    const c = JSON.parse(input);
    const safe = c.Config.Labels["scout.restore-test"] === "true"
      && c.HostConfig.NetworkMode === "none"
      && Object.keys(c.HostConfig.PortBindings || {}).length === 0
      && c.Mounts.every((mount) => mount.Type === "tmpfs")
      && c.HostConfig.Tmpfs["/var/lib/postgresql/data"];
    if (!safe) process.exitCode = 1;
  });'
READY=false
for attempt in {1..30}; do
  if docker exec "$CONTAINER_ID" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then READY=true; break; fi
  sleep 1
done
[[ "$READY" = true ]] || { echo 'PostgreSQL temporaire indisponible' >&2; exit 1; }
docker exec "$CONTAINER_ID" createdb -U postgres scout_restore
docker exec -i "$CONTAINER_ID" pg_restore -U postgres -d scout_restore --no-owner --no-privileges --exit-on-error < "$TEMP/base.dump"
COUNT="$(docker exec "$CONTAINER_ID" psql -U postgres -d scout_restore -Atc "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL")"
[[ "$COUNT" =~ ^[0-9]+$ && "$COUNT" -gt 0 ]]
echo '{"evenement":"sauvegarde.restauration_test_ok"}'
