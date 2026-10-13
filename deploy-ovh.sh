#!/bin/bash
# =============================================================================
# SCOUT ASCCI — Déploiement production de l'installation PAROISSE (VPS OVH)
# À lancer sur le VPS (via SSH), depuis la racine du dépôt.
#
# Architecture : seule la base de données tourne dans Docker
# (docker-compose.prod.yml, publiée sur 127.0.0.1:5434). Deux processus pm2
# tournent sur l'hôte (deploy/ecosystem.config.cjs) :
#   - scout-api : API NestJS (127.0.0.1:4000), seule à accéder à la base ;
#   - scout-web : frontend paroissial Next.js (127.0.0.1:3002), qui relaie
#     /api/* vers scout-api.
# Les fichiers téléversés sont dans Cloudflare R2, jamais sur le VPS. Nginx
# fait office de reverse proxy HTTPS vers scout-web — voir deploy/nginx-scout.conf.
# L'application district est une installation distincte (autre base).
# Procédure complète (première installation incluse) : docs/deploiement-ovh.md.
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
command -v corepack >/dev/null 2>&1 || err "corepack est introuvable (fourni avec Node.js ≥ 20)."

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  err "Docker Compose n'est pas installé."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
PNPM=(corepack pnpm)

# --- Fichiers d'environnement ---
[ -f ".env.prod" ] || err ".env.prod introuvable. Copie .env.prod.example vers .env.prod et remplis-le (POSTGRES_PASSWORD) avant de relancer."
[ -f "apps/api/.env" ] || err "apps/api/.env introuvable. Copie apps/api/.env.example et remplis-le (DATABASE_URL vers 127.0.0.1:5434, JWT_ACCESS_SECRET, URL_FRONTEND_PAROISSE, CRON_SECRET, STORAGE_S3_* pour Cloudflare R2…)."
for FRONT in web-paroisse; do
  [ -f "apps/$FRONT/.env" ] || err "apps/$FRONT/.env introuvable. Copie apps/$FRONT/.env.example et remplis-le (API_URL_INTERNE, NEXT_PUBLIC_SITE_URL, STORAGE_PUBLIC_URL_BASE)."
done
ok "Fichiers d'environnement présents"

# --- Fichiers téléversés (Cloudflare R2) ---
# Aucun document n'est conservé sur le VPS : photos, fiches médicales,
# autorisations et logos vivent dans Cloudflare R2. L'API refuse d'ailleurs de
# démarrer en production sans stockage externe (apps/api/src/config/env.ts).
STOCKAGE_S3=$(grep -E "^STORAGE_S3_BUCKET=" apps/api/.env | cut -d'=' -f2- | tr -d '"')
[ -n "$STOCKAGE_S3" ] || err "STORAGE_S3_BUCKET est vide dans apps/api/.env : configure Cloudflare R2 (voir apps/api/.env.example)."
# Avant la séparation API/frontend, les fichiers vivaient dans my-app/uploads-*.
# Ils doivent être repris dans R2 avant la mise en service, sinon les photos
# et documents existants ne seraient plus servis.
if [ -d "my-app/uploads-prives" ] || [ -d "my-app/uploads-publiques" ]; then
  err "Des fichiers téléversés sont encore sur le VPS (my-app/uploads-*). Reprends-les dans R2 : cd apps/api && corepack pnpm fichiers:migrer-r2 --source ../../my-app --public-ancien ../web-paroisse/public/uploads (simulation), puis avec --appliquer ; vérifie l'affichage, puis supprime my-app/uploads-* et relance."
fi
# Les frontends doivent autoriser le domaine public R2 dans leur CSP, sinon
# les logos et images d'accueil seraient bloqués par le navigateur.
URL_PUBLIQUE_API=$(grep -E "^STORAGE_PUBLIC_URL_BASE=" apps/api/.env | cut -d'=' -f2- | tr -d '"')
for FRONT in web-paroisse; do
  URL_PUBLIQUE_FRONT=$(grep -E "^STORAGE_PUBLIC_URL_BASE=" "apps/$FRONT/.env" | cut -d'=' -f2- | tr -d '"')
  [ -n "$URL_PUBLIQUE_API" ] && [ "$URL_PUBLIQUE_API" = "$URL_PUBLIQUE_FRONT" ] \
    || err "STORAGE_PUBLIC_URL_BASE doit être renseigné et identique dans apps/api/.env et apps/$FRONT/.env."
done
ok "Stockage des fichiers : Cloudflare R2 ($STOCKAGE_S3, public : $URL_PUBLIQUE_API)"

# --- Sauvegardes de la base (Cloudflare R2, chiffrées) ---
for CLE in SAUVEGARDE_S3_BUCKET SAUVEGARDE_PHRASE; do
  grep -qE "^$CLE=\"?[^\"]+" apps/api/.env || err "$CLE est vide dans apps/api/.env : configure les sauvegardes (voir apps/api/.env.example)."
done
ok "Sauvegardes de la base : configurées"

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

# --- Dépendances et build ---
info "Installation des dépendances (lockfile figé)..."
"${PNPM[@]}" install --frozen-lockfile

info "Build : paquet partagé, API, frontend paroissial"
"${PNPM[@]}" --filter @scout/shared build
"${PNPM[@]}" --filter @scout/api build
"${PNPM[@]}" --filter @scout/web-paroisse build

# --- Migrations (après sauvegarde) ---
# Sauvegarde chiffrée envoyée dans Cloudflare R2 : rien n'est conservé sur le VPS.
info "Sauvegarde de la base avant migration (chiffrée, vers R2)..."
if (cd apps/api && "${PNPM[@]}" sauvegarder --motif avant-migration); then
  ok "Sauvegarde envoyée dans R2"
else
  err "Échec de la sauvegarde pré-migration — migration NON appliquée. Vérifie la configuration SAUVEGARDE_* avant de relancer."
fi

info "Application des migrations Prisma"
"${PNPM[@]}" --filter @scout/api prisma:deploy

# --- Processus pm2 ---
info "Démarrage / rechargement des processus pm2..."
pm2 startOrReload deploy/ecosystem.config.cjs --env production
pm2 save

info "Vérification de l'API..."
sleep 3
if curl -fsS http://127.0.0.1:4000/api/sante >/dev/null; then
  ok "API disponible"
else
  err "L'API ne répond pas : pm2 logs scout-api --lines 100"
fi

PUBLIC_URL=$(grep -E "^NEXT_PUBLIC_SITE_URL=" apps/web-paroisse/.env | cut -d'=' -f2- | tr -d '"')

echo ""
echo "=================================================="
echo -e "${VERT}  Déploiement terminé !${RESET}"
echo "=================================================="
echo ""
echo "  Espace paroisse → ${PUBLIC_URL}"
echo ""
echo "  Logs        → pm2 logs scout-api | pm2 logs scout-web"
echo "  Statut      → pm2 list"
echo ""
