#!/bin/bash
# =============================================================================
# SCOUT ASCCI — Lancement quotidien
# Lance la base de données et le serveur de développement
# =============================================================================

VERT="\033[0;32m"
JAUNE="\033[1;33m"
ROUGE="\033[0;31m"
RESET="\033[0m"

ok()  { echo -e "${VERT}✔ $1${RESET}"; }
info(){ echo -e "${JAUNE}→ $1${RESET}"; }
err() { echo -e "${ROUGE}✖ $1${RESET}"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=================================================="
echo "  SCOUT ASCCI — Lancement"
echo "=================================================="
echo ""

# --- Démarrage des conteneurs Docker ---
info "Démarrage des conteneurs Docker..."
docker compose up -d db adminer 2>/dev/null || docker-compose up -d db adminer
ok "Conteneurs démarrés"

# --- Attente PostgreSQL ---
info "Attente de PostgreSQL..."
TENTATIVES=0
until docker compose exec -T db pg_isready -U scout -d scout_db >/dev/null 2>&1 || \
      docker-compose exec -T db pg_isready -U scout -d scout_db >/dev/null 2>&1; do
  TENTATIVES=$((TENTATIVES + 1))
  if [ $TENTATIVES -gt 20 ]; then
    err "PostgreSQL ne répond pas. Lance './setup.sh' si c'est la première fois."
  fi
  sleep 1
done
ok "PostgreSQL prêt"

echo ""
echo "  Application  → http://localhost:3000"
echo "  Adminer (DB) → http://localhost:8080"
echo ""
echo "  Appuie sur Ctrl+C pour arrêter le serveur."
echo "  (Les conteneurs Docker restent actifs — lance './stop.sh' pour tout arrêter)"
echo ""

# --- Lancement du serveur Next.js ---
cd my-app
npm run dev
