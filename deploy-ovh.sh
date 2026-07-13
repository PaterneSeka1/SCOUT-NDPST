#!/bin/bash
# =============================================================================
# SCOUT ASCCI — Déploiement production sur un VPS OVH
# À lancer sur le VPS (via SSH), depuis la racine du dépôt.
#
# Architecture : seule la base de données tourne dans Docker
# (docker-compose.prod.yml, publiée sur 127.0.0.1:5434). L'application
# elle-même tourne directement sur l'hôte, gérée par pm2 (process "scout-ndpst"),
# et nginx (déjà en place sur ce VPS pour les autres sites) fait office de
# reverse proxy HTTPS vers le port de l'app — voir my-app/.env pour la config.
# =============================================================================

set -e

VERT="\033[0;32m"
JAUNE="\033[1;33m"
ROUGE="\033[0;31m"
RESET="\033[0m"

ok()  { echo -e "${VERT}✔ $1${RESET}"; }
info(){ echo -e "${JAUNE}→ $1${RESET}"; }
err() { echo -e "${ROUGE}✖ $1${RESET}"; exit 1; }

echo ""
echo "=================================================="
echo "  SCOUT ASCCI — Déploiement (OVH VPS)"
echo "=================================================="
echo ""

command -v docker >/dev/null 2>&1 || err "Docker n'est pas installé sur ce serveur."
command -v pm2 >/dev/null 2>&1 || err "pm2 n'est pas installé (npm install -g pm2)."

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  err "Docker Compose n'est pas installé."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --- Fichier .env.prod (uniquement le mot de passe Postgres) ---
if [ ! -f ".env.prod" ]; then
  err ".env.prod introuvable. Copie .env.prod.example vers .env.prod et remplis-le (POSTGRES_PASSWORD) avant de relancer."
fi
ok ".env.prod présent"

# --- Base de données (Docker) ---
info "Démarrage de la base de données..."
"${COMPOSE[@]}" --env-file .env.prod -f docker-compose.prod.yml up -d db

TENTATIVES=0
until "${COMPOSE[@]}" --env-file .env.prod -f docker-compose.prod.yml exec -T db pg_isready -U scout -d scout_db >/dev/null 2>&1; do
  TENTATIVES=$((TENTATIVES + 1))
  if [ $TENTATIVES -gt 30 ]; then
    err "PostgreSQL ne répond pas après 30 secondes."
  fi
  sleep 1
done
ok "Base de données prête (127.0.0.1:5434)"

# --- Application (hôte, pm2) ---
cd my-app

if [ ! -f ".env" ]; then
  err "my-app/.env introuvable. Copie my-app/.env.example vers my-app/.env et remplis-le (DATABASE_URL vers 127.0.0.1:5434, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET…) avant de relancer."
fi
ok "my-app/.env présent"

info "Installation des dépendances (y compris devDependencies, pour le build)..."
npm ci --include=dev

info "Génération du client Prisma"
npx prisma generate

info "Sauvegarde de la base avant migration..."
mkdir -p "$SCRIPT_DIR/backups"
DUMP_FICHIER="$SCRIPT_DIR/backups/pre-migrate-$(date +%Y%m%d%H%M%S).sql"
if "${COMPOSE[@]}" --env-file ../.env.prod -f ../docker-compose.prod.yml exec -T db pg_dump -U scout scout_db > "$DUMP_FICHIER"; then
  ok "Sauvegarde écrite dans backups/$(basename "$DUMP_FICHIER")"
else
  err "Échec de la sauvegarde pré-migration — migration NON appliquée. Vérifie la base avant de relancer."
fi

info "Application des migrations Prisma"
npx prisma migrate deploy

info "Build de production"
npm run build

info "Démarrage / redémarrage de l'application via pm2..."
mkdir -p uploads-prives public/uploads
if pm2 describe scout-ndpst >/dev/null 2>&1; then
  pm2 restart scout-ndpst
else
  pm2 start npm --name scout-ndpst --cwd "$PWD" -- run start -- -p 3002
fi
pm2 save

cd "$SCRIPT_DIR"

PUBLIC_URL=$(grep -E "^NEXTAUTH_URL=" my-app/.env | cut -d'=' -f2- | tr -d '"')

echo ""
echo "=================================================="
echo -e "${VERT}  Déploiement terminé !${RESET}"
echo "=================================================="
echo ""
echo "  Application → ${PUBLIC_URL}"
echo ""
echo "  Logs        → pm2 logs scout-ndpst"
echo "  Statut      → pm2 list"
echo "  Arrêt       → pm2 stop scout-ndpst"
echo ""
