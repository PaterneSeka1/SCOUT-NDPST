#!/bin/sh
set -e

echo "Application des migrations Prisma en attente..."
# Appel direct du point d'entrée du CLI (plutôt que `npx prisma` / le lien
# symbolique node_modules/.bin/prisma) : le script résout ses fichiers
# annexes (moteurs .wasm) via un chemin relatif à son propre dossier, qui
# doit donc rester node_modules/prisma/build.
node node_modules/prisma/build/index.js migrate deploy

exec "$@"
