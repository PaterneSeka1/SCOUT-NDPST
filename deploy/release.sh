#!/usr/bin/env bash
set -euo pipefail
umask 077
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
fail() { echo "$*" >&2; exit 1; }
# Base distincte du clone, obligatoire pour éviter une release dans le code servi.
BASE="${SCOUT_RELEASE_ROOT:?Définir SCOUT_RELEASE_ROOT, ex. /srv/scout-paroisse-runtime}"
[[ "$BASE" = /* && "$BASE" != "$SOURCE" && "$BASE" != / ]] || fail "Chemin runtime absolu distinct du clone requis."
command -v flock >/dev/null || fail "flock requis."
mkdir -p "$BASE/releases"
BASE="$(cd "$BASE" && pwd -P)"
[[ "$BASE" != "$SOURCE" && "$BASE" != "$SOURCE/"* ]] || fail "Le runtime doit être extérieur au clone source."
exec 9>"$BASE/.release.lock"
flock -n 9 || fail "Une opération de release est déjà active."
ACTION="${1:-deploy}"
[[ "${2:-}" = --schema-compatible ]] || fail "Usage: deploy-ovh.sh deploy|rollback --schema-compatible (validation humaine des migrations obligatoire)."
[[ "$ACTION" = deploy || "$ACTION" = rollback ]] || fail "Action inconnue."
[[ -f "$BASE/shared/.env.prod" ]] || fail "Configuration shared absente; voir docs/exploitation-releases.md."
INSTALLATION="$(sed -n 's/^INSTALLATION=//p' "$BASE/shared/.env.prod" | tr -d '\r\"\047')"
[[ "$INSTALLATION" = paroisse ]] || fail "INSTALLATION=paroisse requise (seule installation prise en charge)."
FRONT=web; ECOSYSTEM=ecosystem.config.cjs
link_release() {
  local name="$1" target="$2"
  [[ ! -e "$BASE/$name" || -L "$BASE/$name" ]] || fail "$name doit être un lien symbolique."
  ln -s "$target" "$BASE/.$name.next"
  mv -Tf "$BASE/.$name.next" "$BASE/$name"
}
OLD=""
if [[ -L "$BASE/current" ]]; then
  OLD="$(readlink -f "$BASE/current")"
  [[ "$OLD" = "$BASE/releases/"* && -f "$OLD/.release-ready" ]] || fail "Release courante invalide."
elif [[ -e "$BASE/current" ]]; then
  fail "current doit être un lien symbolique."
fi
if [[ "$ACTION" = rollback ]]; then
  if [[ -L "$BASE/pending" ]]; then
    # Échec d’une bascule: current reste la dernière release validée.
    TARGET="$OLD"
  else
    TARGET="$(readlink -f "$BASE/previous" 2>/dev/null || true)"
  fi
  [[ "$TARGET" = "$BASE/releases/"* && -f "$TARGET/.release-ready" ]] || fail "Aucune release précédente validée."
  pm2 startOrReload "$TARGET/deploy/$ECOSYSTEM" --env production --update-env
  "$TARGET/deploy/check-health.sh" "$INSTALLATION"
  link_release current "$TARGET"
  if [[ -n "$OLD" && "$OLD" != "$TARGET" ]]; then link_release previous "$OLD"; fi
  if [[ -L "$BASE/pending" ]]; then unlink "$BASE/pending"; fi
  pm2 save
  echo "Rollback applicatif terminé; aucune restauration de base effectuée."
  exit 0
fi
[[ ! -L "$BASE/pending" ]] || fail "Release inachevée: diagnostiquer puis rollback avant une nouvelle tentative."
[[ -z "$(git -C "$SOURCE" status --porcelain)" ]] || fail "Le clone source doit être propre et les modifications committées."
[[ -n "$OLD" || "${SCOUT_FIRST_RELEASE:-}" = yes ]] || fail "Première bascule: lire le runbook puis définir SCOUT_FIRST_RELEASE=yes."
VERSION="$(date -u +%Y%m%dT%H%M%SZ)-$(git -C "$SOURCE" rev-parse --short=12 HEAD)"
TARGET="$BASE/releases/$VERSION"
mkdir "$TARGET"
git -C "$SOURCE" archive HEAD | tar -x -C "$TARGET"
ln -s "$BASE/shared/.env.prod" "$TARGET/.env.prod"
ln -s "$BASE/shared/api.env" "$TARGET/apps/api/.env"
ln -s "$BASE/shared/$FRONT.env" "$TARGET/apps/$FRONT/.env"
# Les binaires PM2 et dépendances sont ceux de la release; jamais ceux de current.
link_release pending "$TARGET"
SCOUT_PREPARED_RELEASE=yes "$TARGET/deploy/deploy-installation.sh"
touch "$TARGET/.release-ready"
[[ -z "$OLD" ]] || link_release previous "$OLD"
link_release current "$TARGET"
unlink "$BASE/pending"
pm2 save
echo "Release $VERSION validée. Les anciennes releases sont conservées."
