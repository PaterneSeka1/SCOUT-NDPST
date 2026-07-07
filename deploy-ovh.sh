#!/bin/bash
# =============================================================================
# SCOUT ASCCI — Déploiement production sur un VPS OVH
# À lancer sur le VPS (via SSH), depuis la racine du dépôt.
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

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  err "Docker Compose n'est pas installé."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --- Fichier .env.prod ---
if [ ! -f ".env.prod" ]; then
  err ".env.prod introuvable. Copie .env.prod.example vers .env.prod et remplis-le (DOMAIN, mots de passe…) avant de relancer."
fi
ok ".env.prod présent"

# --- Build et démarrage ---
info "Construction de l'image de l'application (peut prendre quelques minutes la première fois)..."
"${COMPOSE[@]}" --env-file .env.prod -f docker-compose.prod.yml build app

info "Démarrage des conteneurs (db, app, caddy)..."
"${COMPOSE[@]}" --env-file .env.prod -f docker-compose.prod.yml up -d

info "Attente que l'application réponde..."
TENTATIVES=0
until "${COMPOSE[@]}" --env-file .env.prod -f docker-compose.prod.yml exec -T app node -e "process.exit(0)" >/dev/null 2>&1; do
  TENTATIVES=$((TENTATIVES + 1))
  if [ $TENTATIVES -gt 30 ]; then
    err "L'application ne répond pas après 30 secondes. Vérifie les logs : ${COMPOSE[*]} -f docker-compose.prod.yml logs app"
  fi
  sleep 2
done
ok "Application démarrée (les migrations Prisma sont appliquées automatiquement au démarrage du conteneur)"

PUBLIC_URL=$(grep -E "^PUBLIC_URL=" .env.prod | cut -d'=' -f2-)

echo ""
echo "=================================================="
echo -e "${VERT}  Déploiement terminé !${RESET}"
echo "=================================================="
echo ""
echo "  Application → ${PUBLIC_URL}"
echo ""
echo "  Logs        → ${COMPOSE[*]} -f docker-compose.prod.yml logs -f app"
echo "  Arrêt       → ${COMPOSE[*]} -f docker-compose.prod.yml down"
echo ""
