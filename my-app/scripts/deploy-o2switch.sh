#!/usr/bin/env bash
# Script de build/déploiement pour un hébergement mutualisé O2Switch (cPanel).
#
# À exécuter depuis la racine du projet (my-app/), sur le serveur, via le
# terminal SSH de cPanel — après avoir activé l'environnement virtuel Node.js
# de l'app (bouton "Enter to the virtual environment" dans "Setup Node.js App",
# qui affiche la commande exacte, du type :
#   source /home/<utilisateur>/nodevenv/<chemin-app>/<version>/bin/activate
# Cette étape est indispensable : elle sélectionne la bonne version de Node ET
# exporte les variables d'environnement configurées dans cPanel (DATABASE_URL,
# NEXTAUTH_SECRET…) dans la session shell courante, dont ce script a besoin
# pour lancer les migrations Prisma.
#
# Aucune optimisation de taille ici (pas de --omit=dev, pas de pruning) : le
# disque NVMe est illimité sur ce type d'offre, donc on privilégie la
# simplicité — un seul checkout complet sert à la fois au build et aux
# migrations.

set -euo pipefail

echo "→ Installation des dépendances (y compris devDependencies, pour le CLI Prisma)"
npm ci

echo "→ Génération du client Prisma"
npx prisma generate

echo "→ Build de production (mode standalone)"
npm run build

echo "→ Copie des fichiers statiques dans le build standalone"
# Next.js ne les inclut pas automatiquement dans .next/standalone/ — sans
# cette étape, les images/CSS et les assets statiques renvoient une 404 en
# production alors que les pages elles-mêmes fonctionnent.
rm -rf .next/standalone/public
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static

# Si les variables d'environnement sont configurées dans l'interface "Setup
# Node.js App" de cPanel, cette copie est inutile (elles sont déjà dans
# process.env). Utile seulement si tu préfères piloter la config par fichier :
# vérifié manuellement que .next/standalone/server.js charge bien un .env
# placé à côté de lui.
if [ -f .env ]; then
  cp .env .next/standalone/.env
fi

echo "→ Application des migrations Prisma (nécessite DATABASE_URL dans l'environnement)"
npx prisma migrate deploy

echo ""
echo "✓ Build prêt dans .next/standalone/"
echo "  Fichier de démarrage à renseigner dans cPanel : .next/standalone/server.js"
echo "  → Redémarrer l'app depuis « Setup Node.js App » pour appliquer les changements."
