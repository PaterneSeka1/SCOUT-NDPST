# Guide d'installation

SCOUT-NDPST est la plateforme d'une paroisse et de son groupe scout : un site public et un espace de gestion privé. Le dépôt est un monorepo npm :

| Paquet | Rôle |
| --- | --- |
| `apps/api` (`@scout/api`) | API NestJS + Prisma/PostgreSQL, seule à accéder à la base |
| `apps/web` (`@scout/web`) | Next.js : site public, authentification, espace de gestion et administration |
| `packages/shared` (`@scout/shared`) | Règles métier pures partagées (rôles, branches, validation, contenus) |

## Prérequis

- Node.js 22.23.4 (`.nvmrc`) et npm 10.9.9 ;
- Docker (PostgreSQL 16 en conteneur) ;
- en production : un VPS Ubuntu, Nginx, PM2, un compte Cloudflare R2 (fichiers et sauvegardes), un compte SMTP.

## Installation locale (développement)

```bash
./setup.sh   # fichiers .env, dépendances, base, migrations, compte administrateur et jeu de démonstration
./start.sh   # base de données, puis API (4000) et frontend (3000)
```

- Site public : <http://localhost:3000>
- Espace de gestion : <http://localhost:3000/connexion>
- Documentation de l'API : <http://localhost:4000/api/docs> (si `SWAGGER_ACTIF=true`)

Comptes de démonstration (données fictives, `npm run db:seed`, relançable) : administrateur `ADMIN001A` / `Admin1234!` ; maîtrise `DEMOCG` (Chef de Groupe), `DEMOAG`, `DEMOSG`, `DEMORB` (Responsable Louveteaux), `DEMOAB`, `DEMOSB` ; mot de passe commun `Scout1234!`. `DEMOIN` est un compte désactivé (refus de connexion attendu). Le seed ne remplace jamais une identité de paroisse déjà renseignée.

### Commandes utiles

```bash
npm run dev          # shared + API + frontend (après docker compose up -d db)
npm run lint
npm run typecheck
npm test             # tests unitaires (Vitest)
npm run build        # API_URL_INTERNE requise au build du frontend
npm run test:e2e     # Playwright, API simulée locale (npx playwright install chromium)
```

Tests PostgreSQL réels (base jetable dédiée, voir `apps/api/test/README.md`) :

```bash
export DATABASE_URL=postgresql://<utilisateur>:<secret>@127.0.0.1:<port>/scout_test_integration_local
npm run db:deploy
SCOUT_TEST_DATABASE_URL="$DATABASE_URL" npm run test:integration -w @scout/api
```

## Variables d'environnement

- `apps/api/.env` : voir `apps/api/.env.example` (commentaires détaillés). Obligatoires en production : `DATABASE_URL`, `JWT_ACCESS_SECRET` (≥ 32 caractères), `INSTALLATION_ID`, `URL_FRONTEND_PAROISSE` (https), `CRON_SECRET`, `SMTP_HOST`, `SMTP_FROM`, stockage R2 (`STORAGE_S3_*`, `STORAGE_PUBLIC_URL_BASE`). L'API refuse de démarrer si l'une d'elles manque.
- `apps/web/.env` : `API_URL_INTERNE`, `NEXT_PUBLIC_SITE_URL`, `STORAGE_PUBLIC_URL_BASE` (lues au build).
- Variables supprimées par la simplification mono-paroissiale : `ADMIN_CLE_PRIVEE_FICHIER`, `ADMIN_EMETTEUR_CONFIANCE`, `ADMIN_CLE_PUBLIQUE_FICHIER`, `ADMIN_URL_VERIFICATION_SESSION`.

Ne jamais commiter de fichier `.env`.

## Première mise en production

1. Suivre `docs/deploiement-ovh.md` (domaines, R2, secrets, déploiement, Nginx, sauvegardes, supervision) et `docs/exploitation-releases.md` (releases et rollback).
2. Installation neuve : `npm run initialiser` (identité de la paroisse, administrateur, Chef de Groupe).
3. Base existante antérieure à la refonte : suivre **impérativement** `docs/migration-mono-paroisse.md` (sauvegarde, migration contrôlée, `npm run initialiser -- --admin`).
4. Compléter l'identité et les contenus depuis l'administration (voir `docs/guide-administrateur.md`).

## Migrations Prisma

**Ne jamais lancer `prisma migrate dev` ni `prisma migrate reset` sur une base qui contient des données à conserver.** Procédure :

```bash
# 1. Modifier apps/api/prisma/schema.prisma
# 2. Générer le SQL sans toucher à la base :
npm run db:diff > /tmp/diff.sql
# 3. Créer le dossier de migration, y placer le SQL ajusté (backfill avant NOT NULL, index partiels…)
# 4. Appliquer et régénérer le client :
npm run db:deploy && npm run db:generate
```

En production, le déploiement prend une sauvegarde chiffrée juste avant `migrate deploy`.
