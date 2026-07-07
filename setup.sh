#!/bin/bash
# =============================================================================
# SCOUT ASCCI — Installation initiale
# À lancer UNE SEULE FOIS sur un nouvel ordinateur
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
echo "  SCOUT ASCCI — Installation initiale"
echo "=================================================="
echo ""

# --- Vérifications préalables ---

command -v node >/dev/null 2>&1 || err "Node.js n'est pas installé. Télécharge-le sur https://nodejs.org"
command -v npm  >/dev/null 2>&1 || err "npm n'est pas installé."
command -v docker >/dev/null 2>&1 || err "Docker n'est pas installé. Télécharge-le sur https://docker.com"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  err "Docker Compose n'est pas installé."
fi

ok "Node.js $(node -v) détecté"
ok "Docker détecté"

# --- Répertoire du projet ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --- Fichier .env ---
if [ ! -f "my-app/.env" ]; then
  info "Création du fichier .env..."
  cp my-app/.env.example my-app/.env
  ok ".env créé depuis .env.example"
  echo ""
  echo -e "${JAUNE}  ⚠ Ouvre my-app/.env et change NEXTAUTH_SECRET par une valeur secrète.${RESET}"
  echo ""
else
  ok ".env déjà présent"
fi

# --- Dépendances npm ---
info "Installation des dépendances npm..."
cd my-app
npm install --silent
ok "Dépendances installées"
cd "$SCRIPT_DIR"

# --- Démarrage de la base de données ---
info "Démarrage de la base de données PostgreSQL..."
"${COMPOSE[@]}" up -d db

info "Attente que PostgreSQL soit prêt..."
TENTATIVES=0
until "${COMPOSE[@]}" exec -T db pg_isready -U scout -d scout_db >/dev/null 2>&1; do
  TENTATIVES=$((TENTATIVES + 1))
  if [ $TENTATIVES -gt 30 ]; then
    err "PostgreSQL ne répond pas après 30 secondes. Vérifie Docker."
  fi
  sleep 1
done
ok "PostgreSQL prêt"

# --- Migrations Prisma ---
info "Création des tables (migration Prisma)..."
cd my-app
if find prisma/migrations -mindepth 1 -maxdepth 1 -type d 2>/dev/null | read; then
  npx prisma migrate deploy
else
  npx prisma db push
fi
ok "Base de données initialisée"

# --- Seed ---
info "Création du compte admin..."
npx prisma db seed
ok "Compte admin créé"

cd "$SCRIPT_DIR"

echo ""
echo "=================================================="
echo -e "${VERT}  Installation terminée avec succès !${RESET}"
echo "=================================================="
echo ""
echo "  Compte admin → matricule: ADMIN001A  / mot de passe: Admin1234!"
echo "  (personnalisable via ADMIN_* dans my-app/.env — voir .env.example)"
echo ""
echo "  Pour lancer l'application : ./start.sh"
echo ""
