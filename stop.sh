#!/bin/bash
# =============================================================================
# SCOUT ASCCI — Arrêt propre
# =============================================================================

VERT="\033[0;32m"
JAUNE="\033[1;33m"
RESET="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${JAUNE}→ Arrêt des conteneurs Docker...${RESET}"
docker compose down 2>/dev/null || docker-compose down
echo -e "${VERT}✔ Tous les conteneurs sont arrêtés.${RESET}"
echo ""
echo "  Les données sont conservées dans le volume Docker."
echo "  Lance './start.sh' pour reprendre."
echo ""
