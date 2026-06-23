#!/bin/bash
# =============================================================================
# SCOUT ASCCI — Arrêt propre
# =============================================================================

set -e

VERT="\033[0;32m"
JAUNE="\033[1;33m"
ROUGE="\033[0;31m"
RESET="\033[0m"

err() { echo -e "${ROUGE}✖ $1${RESET}"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

command -v docker >/dev/null 2>&1 || err "Docker n'est pas installé. Télécharge-le sur https://docker.com"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  err "Docker Compose n'est pas installé."
fi

echo -e "${JAUNE}→ Arrêt des conteneurs Docker...${RESET}"
"${COMPOSE[@]}" down
echo -e "${VERT}✔ Tous les conteneurs sont arrêtés.${RESET}"
echo ""
echo "  Les données sont conservées dans le volume Docker."
echo "  Lance './start.sh' pour reprendre."
echo ""
