#!/bin/sh
set -e

echo "Sauvegarde de la base avant migration..."
# Best-effort : une copie locale et éphémère (perdue à la suppression du
# conteneur), pas un remplacement d'une vraie stratégie de sauvegarde — juste
# un filet de sécurité immédiat si la migration qui suit tourne mal.
if command -v pg_dump >/dev/null 2>&1 && [ -n "$DATABASE_URL" ]; then
  mkdir -p /tmp/backups
  DUMP_FICHIER="/tmp/backups/pre-migrate-$(date +%Y%m%d%H%M%S).sql"
  if pg_dump "$DATABASE_URL" > "$DUMP_FICHIER"; then
    echo "  Sauvegarde écrite dans $DUMP_FICHIER (dans le conteneur)"
  else
    echo "  ✖ Échec de la sauvegarde pré-migration — arrêt."
    exit 1
  fi
else
  echo "  ⚠ pg_dump ou DATABASE_URL indisponible — sauvegarde ignorée."
fi

echo "Application des migrations Prisma en attente..."
# Appel direct du point d'entrée du CLI (plutôt que `npx prisma` / le lien
# symbolique node_modules/.bin/prisma) : le script résout ses fichiers
# annexes (moteurs .wasm) via un chemin relatif à son propre dossier, qui
# doit donc rester node_modules/prisma/build.
node node_modules/prisma/build/index.js migrate deploy

exec "$@"
