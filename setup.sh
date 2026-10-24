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
command -v npm >/dev/null 2>&1 || err "npm est introuvable (fourni avec Node.js ≥ 22.12)."
node -e 'const [majeur, mineur] = process.versions.node.split(".").map(Number); process.exit(majeur > 22 || (majeur === 22 && mineur >= 12) ? 0 : 1)' || err "Node.js ≥ 22.12 est requis."
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

# --- Fichiers .env ---
if [ ! -f "apps/api/.env" ]; then
  info "Création de apps/api/.env..."
  cp apps/api/.env.example apps/api/.env
  # Secret de signature des jetons généré localement, jamais commité.
  SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
  SECRET_CRON=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
  # Développement : sans SMTP_HOST, les liens de réinitialisation sont
  # affichés dans la console de l'API ; documentation Swagger sur /api/docs.
  sed -i.bak \
    -e "s#^JWT_ACCESS_SECRET=.*#JWT_ACCESS_SECRET=\"$SECRET\"#" \
    -e "s#^CRON_SECRET=.*#CRON_SECRET=\"$SECRET_CRON\"#" \
    -e "s#^SWAGGER_ACTIF=.*#SWAGGER_ACTIF=true#" \
    -e "s#^SMTP_\(HOST\|USER\|PASS\)=.*#SMTP_\1=\"\"#" \
    apps/api/.env && rm -f apps/api/.env.bak
  ok "apps/api/.env créé (secrets générés, SMTP désactivé, Swagger actif)"
else
  ok "apps/api/.env déjà présent"
fi
for FRONT in web-paroisse web-district; do
  if [ ! -f "apps/$FRONT/.env" ]; then
    cp "apps/$FRONT/.env.example" "apps/$FRONT/.env"
    ok "apps/$FRONT/.env créé"
  else
    ok "apps/$FRONT/.env déjà présent"
  fi
done

# --- Dépendances (workspaces npm) ---
# Le client Prisma est généré par le postinstall de @scout/api.
info "Installation des dépendances..."
npm install
npm run build -w @scout/shared
ok "Dépendances installées"

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
cd apps/api
npm run prisma:deploy
ok "Base de données initialisée"

# --- Seed ---
info "Création du compte admin et des comptes de démonstration..."
npm run prisma:seed
ok "Comptes créés (liste affichée ci-dessus)"

cd "$SCRIPT_DIR"

echo ""
echo "=================================================="
echo -e "${VERT}  Installation terminée avec succès !${RESET}"
echo "=================================================="
echo ""
echo "  Compte admin → matricule: ADMIN001A  / mot de passe: Admin1234!"
echo "  Comptes de démonstration (un par rôle) → mot de passe: Scout1234!"
echo "  (personnalisable via ADMIN_* et SEED_* dans apps/api/.env — voir apps/api/.env.example)"
echo "  Réinitialiser les données de démonstration : npm run db:seed"
echo ""
echo "  Pour lancer l'application : ./start.sh"
echo ""
