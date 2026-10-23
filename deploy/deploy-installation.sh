#!/bin/bash
# =============================================================================
# SCOUT ASCCI — Déploiement production d'une installation (VPS OVH)
# À lancer sur le VPS (via SSH), depuis la racine du clone à déployer.
#
# Chaque installation a son propre clone, sa propre base et ses propres
# secrets ; .env.prod (INSTALLATION=paroisse|district) indique laquelle ce
# clone déploie :
#
#   | Installation | Base (Docker)  | API (pm2)                | Frontend (pm2)              |
#   | paroisse     | 127.0.0.1:5434 | scout-api :4000          | scout-web :3002             |
#   | district     | 127.0.0.1:5436 | scout-district-api :4100 | scout-district-web :3004    |
#
# Seule la base tourne dans Docker (docker-compose.prod.yml). Les fichiers
# téléversés sont dans Cloudflare R2, jamais sur le VPS. Nginx fait office de
# reverse proxy HTTPS vers le frontend (deploy/nginx-scout.conf,
# deploy/nginx-district.conf).
# Procédure complète (première installation incluse) : docs/deploiement-ovh.md.
# =============================================================================

set -euo pipefail
[ "${SCOUT_PREPARED_RELEASE:-}" = yes ] || { echo "Utiliser deploy-ovh.sh depuis le clone source." >&2; exit 1; }

VERT="\033[0;32m"
JAUNE="\033[1;33m"
ROUGE="\033[0;31m"
RESET="\033[0m"

ok()  { echo -e "${VERT}✔ $1${RESET}"; }
info(){ echo -e "${JAUNE}→ $1${RESET}"; }
err() { echo -e "${ROUGE}✖ $1${RESET}"; exit 1; }

# Valeur d'une variable dans un fichier .env (guillemets retirés), vide si absente.
lire_env() { grep -E "^$2=" "$1" 2>/dev/null | tail -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true; }

command -v docker >/dev/null 2>&1 || err "Docker n'est pas installé sur ce serveur."
command -v pm2 >/dev/null 2>&1 || err "pm2 n'est pas installé (sudo npm install -g pm2)."
command -v npm >/dev/null 2>&1 || err "npm est introuvable (fourni avec Node.js ≥ 22.12)."
[ "$(node --version)" = "v22.23.4" ] || err "Node.js 22.23.4 est requis (.nvmrc)."
[ "$(npm --version)" = "10.9.9" ] || err "npm 10.9.9 est requis."

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  err "Docker Compose n'est pas installé."
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# --- Installation déployée par ce clone ---
[ -f ".env.prod" ] || err ".env.prod introuvable. Copie .env.prod.example vers .env.prod et remplis-le (INSTALLATION, POSTGRES_PASSWORD…) avant de relancer."
INSTALLATION=$(lire_env .env.prod INSTALLATION)
INSTALLATION=${INSTALLATION:-paroisse}

case "$INSTALLATION" in
  paroisse)
    FRONT=web-paroisse
    ECOSYSTEM=deploy/ecosystem.config.cjs
    PORT_API=4000
    PROCESSUS_API=scout-api
    PROCESSUS_WEB=scout-web
    ;;
  district)
    FRONT=web-district
    ECOSYSTEM=deploy/ecosystem.district.config.cjs
    PORT_API=4100
    PROCESSUS_API=scout-district-api
    PROCESSUS_WEB=scout-district-web
    ;;
  *)
    err "INSTALLATION=$INSTALLATION dans .env.prod : valeurs possibles « paroisse » ou « district »."
    ;;
esac

PORT_DB=$(lire_env .env.prod PORT_DB)
PORT_DB=${PORT_DB:-5434}
CONTENEUR_DB=$(lire_env .env.prod CONTENEUR_DB)
CONTENEUR_DB=${CONTENEUR_DB:-scout_db}
COMPOSE_PROJET=$(lire_env .env.prod COMPOSE_PROJET)
COMPOSE_PROJET=${COMPOSE_PROJET:-scout-ascci}

echo ""
echo "=================================================="
echo "  SCOUT ASCCI — Déploiement de l'installation $INSTALLATION (OVH VPS)"
echo "=================================================="
echo ""

# Le district partage le VPS avec la paroisse : il ne doit jamais réutiliser
# le projet Compose, le conteneur ni le port de la base paroisse.
if [ "$INSTALLATION" = "district" ]; then
  [ "$COMPOSE_PROJET" != "scout-ascci" ] && [ "$CONTENEUR_DB" != "scout_db" ] && [ "$PORT_DB" != "5434" ] \
    || err "Installation district : définis COMPOSE_PROJET, CONTENEUR_DB et PORT_DB dans .env.prod (voir .env.prod.example), distincts de ceux de la paroisse."
fi

# --- Fichiers d'environnement ---
API_ENV=apps/api/.env
FRONT_ENV=apps/$FRONT/.env
[ -f "$API_ENV" ] || err "$API_ENV introuvable. Copie apps/api/.env.example et remplis-le (voir docs/deploiement-ovh.md, section 6.2 ou 13)."
[ -f "$FRONT_ENV" ] || err "$FRONT_ENV introuvable. Copie apps/$FRONT/.env.example et remplis-le (API_URL_INTERNE, NEXT_PUBLIC_SITE_URL, STORAGE_PUBLIC_URL_BASE)."

[ "$(lire_env "$API_ENV" NODE_ENV)" = "production" ] || err "NODE_ENV doit valoir production dans $API_ENV."

# L'API de ce clone doit viser SA base : un DATABASE_URL copié de l'autre
# installation écrirait dans la mauvaise base.
case "$(lire_env "$API_ENV" DATABASE_URL)" in
  *"@127.0.0.1:$PORT_DB/"*|*"@localhost:$PORT_DB/"*) ;;
  *) err "DATABASE_URL de $API_ENV doit pointer vers 127.0.0.1:$PORT_DB (base de l'installation $INSTALLATION)." ;;
esac

[ "$(lire_env "$FRONT_ENV" API_URL_INTERNE)" = "http://127.0.0.1:$PORT_API" ] \
  || err "API_URL_INTERNE de $FRONT_ENV doit valoir http://127.0.0.1:$PORT_API (API de l'installation $INSTALLATION)."

# Clé privée de l'administrateur plateforme : uniquement sur le district.
CLE_PRIVEE=$(lire_env "$API_ENV" ADMIN_CLE_PRIVEE_FICHIER)
if [ "$INSTALLATION" = "district" ]; then
  [ -n "$CLE_PRIVEE" ] && [ -r "$CLE_PRIVEE" ] \
    || err "ADMIN_CLE_PRIVEE_FICHIER doit désigner un fichier lisible dans $API_ENV (clé privée de l'administrateur plateforme)."
else
  [ -z "$CLE_PRIVEE" ] || err "ADMIN_CLE_PRIVEE_FICHIER ne doit JAMAIS être défini sur l'installation paroisse : seule la clé publique y a sa place."
fi
ok "Fichiers d'environnement présents et cohérents ($INSTALLATION)"

# --- Fichiers téléversés (Cloudflare R2) ---
# Aucun document n'est conservé sur le VPS : photos, fiches médicales,
# autorisations et logos vivent dans Cloudflare R2. L'API refuse d'ailleurs de
# démarrer en production sans stockage externe (apps/api/src/config/env.ts).
STOCKAGE_S3=$(lire_env "$API_ENV" STORAGE_S3_BUCKET)
[ -n "$STOCKAGE_S3" ] || err "STORAGE_S3_BUCKET est vide dans $API_ENV : configure Cloudflare R2 (voir apps/api/.env.example)."
# Avant la séparation API/frontend, les fichiers de la paroisse vivaient dans
# my-app/uploads-*. Ils doivent être repris dans R2 avant la mise en service,
# sinon les photos et documents existants ne seraient plus servis.
if [ "$INSTALLATION" = "paroisse" ] && { [ -d "my-app/uploads-prives" ] || [ -d "my-app/uploads-publiques" ]; }; then
  err "Des fichiers téléversés sont encore sur le VPS (my-app/uploads-*). Reprends-les dans R2 : cd apps/api && npm run fichiers:migrer-r2 -- --source ../../my-app --public-ancien ../web-paroisse/public/uploads (simulation), puis avec --appliquer ; vérifie l'affichage, puis supprime my-app/uploads-* et relance."
fi
# Le frontend doit autoriser le domaine public R2 dans sa CSP, sinon les logos
# et images d'accueil seraient bloqués par le navigateur.
URL_PUBLIQUE_API=$(lire_env "$API_ENV" STORAGE_PUBLIC_URL_BASE)
URL_PUBLIQUE_FRONT=$(lire_env "$FRONT_ENV" STORAGE_PUBLIC_URL_BASE)
[ -n "$URL_PUBLIQUE_API" ] && [ "$URL_PUBLIQUE_API" = "$URL_PUBLIQUE_FRONT" ] \
  || err "STORAGE_PUBLIC_URL_BASE doit être renseigné et identique dans $API_ENV et $FRONT_ENV."
ok "Stockage Cloudflare R2 configuré"

# --- Sauvegardes de la base (Cloudflare R2, chiffrées) ---
for CLE in SAUVEGARDE_S3_BUCKET SAUVEGARDE_PHRASE; do
  [ -n "$(lire_env "$API_ENV" "$CLE")" ] || err "$CLE est vide dans $API_ENV : configure les sauvegardes (voir apps/api/.env.example)."
done
# La sauvegarde lit la base dans son conteneur : celui de CETTE installation.
CONTENEUR_SAUVEGARDE=$(lire_env "$API_ENV" SAUVEGARDE_CONTENEUR)
[ "${CONTENEUR_SAUVEGARDE:-scout_db}" = "$CONTENEUR_DB" ] \
  || err "SAUVEGARDE_CONTENEUR de $API_ENV doit valoir $CONTENEUR_DB (conteneur de la base $INSTALLATION)."
ok "Sauvegardes de la base : configurées (conteneur $CONTENEUR_DB)"

# --- Base existante : ne pas modifier le service pendant une release ---
info "Vérification de la base existante (initialisation manuelle préalable)..."

TENTATIVES=0
until "${COMPOSE[@]}" --env-file .env.prod -f docker-compose.prod.yml exec -T db pg_isready -U scout -d scout_db >/dev/null 2>&1; do
  TENTATIVES=$((TENTATIVES + 1))
  if [ $TENTATIVES -gt 30 ]; then
    err "PostgreSQL ne répond pas après 30 secondes."
  fi
  sleep 1
done
ok "Base de données prête (127.0.0.1:$PORT_DB, conteneur $CONTENEUR_DB)"

# --- Dépendances et build ---
info "Installation des dépendances (lockfile figé)..."
# --include=dev : le build et les scripts d'exploitation (ts-node, CLI Prisma)
# en ont besoin, même si NODE_ENV=production est défini dans le shell.
npm ci --include=dev

info "Build : paquet partagé, API, frontend $FRONT"
npm run build -w @scout/shared
npm run build -w @scout/api
# Les variables lues au build (API_URL_INTERNE, STORAGE_PUBLIC_URL_BASE) viennent
# de $FRONT_ENV, chargé par Next.js.
npm run build -w "@scout/$FRONT"

# --- Migrations (après sauvegarde) ---
# Sauvegarde chiffrée envoyée dans Cloudflare R2 : rien n'est conservé sur le VPS.
info "Sauvegarde de la base avant migration (chiffrée, vers R2)..."
if (cd apps/api && npm run sauvegarder -- --motif avant-migration); then
  ok "Sauvegarde envoyée dans R2"
else
  err "Échec de la sauvegarde pré-migration — migration NON appliquée. Vérifie la configuration SAUVEGARDE_* avant de relancer."
fi

(cd apps/api && node ../../deploy/check-backup.cjs)

info "Application des migrations Prisma"
npm run prisma:deploy -w @scout/api

# --- Processus pm2 ---
info "Démarrage / rechargement des processus pm2..."
pm2 startOrReload "$ECOSYSTEM" --env production

info "Vérification de l'API..."
if "$SCRIPT_DIR/deploy/check-health.sh" "$INSTALLATION"; then
  ok "API disponible"
else
  err "L'API ne répond pas : pm2 logs $PROCESSUS_API --lines 100"
fi

PUBLIC_URL=$(lire_env "$FRONT_ENV" NEXT_PUBLIC_SITE_URL)

echo ""
echo "=================================================="
echo -e "${VERT}  Déploiement terminé ($INSTALLATION) !${RESET}"
echo "=================================================="
echo ""
echo "  Adresse     → ${PUBLIC_URL}"
echo ""
echo "  Logs        → pm2 logs $PROCESSUS_API | pm2 logs $PROCESSUS_WEB"
echo "  Statut      → pm2 list"
echo ""
