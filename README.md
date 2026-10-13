# SCOUT ASCCI

Suivi pédagogique du mouvement scout catholique de Côte d'Ivoire. Le dépôt est un monorepo pnpm qui sépare le backend des frontends :

| Paquet | Rôle |
| --- | --- |
| `apps/api` (`@scout/api`) | API NestJS + Prisma/PostgreSQL. Seule à accéder à la base. Conçue pour servir plusieurs plateformes : paroisse aujourd'hui, district, région et nation ensuite. |
| `apps/web-paroisse` (`@scout/web-paroisse`) | Frontend Next.js de la plateforme **paroissiale** uniquement. Aucun accès base, aucun secret. |
| `apps/web-district` (`@scout/web-district`) | Application district : plusieurs paroisses et console de l'administrateur plateforme (paroisses, districts, comptes, journal d'audit, apparence). Déployée sur sa **propre installation** (autre base). Aucun accès base, aucun secret. |
| `packages/shared` (`@scout/shared`) | Règles métier pures partagées : rôles, branches, validation, libellés, périmètre V1. |

## Architecture

```text
Installation paroisse : Navigateur ──► Nginx ──► web-paroisse ──/api/*──► api (NestJS) ──► PostgreSQL paroisse
Installation district : Navigateur ──► Nginx ──► web-district ──/api/*──► api (NestJS) ──► PostgreSQL district
                                                      └── /api/admin/* (installation choisie) ──► api paroisse
```

- **Installations autonomes** : le même code d'API est déployé une fois par plateforme, chacune avec sa base, ses buckets R2 et ses secrets. Les données ne circulent jamais d'une installation à l'autre.
- **Administrateur plateforme unique** : son compte vit dans l'installation district, qui signe ses jetons avec une clé privée ECDSA. Les installations qu'il administre (paroisse) les vérifient avec la seule clé publique, uniquement pour `ADMIN_PLATEFORME` ; ses actions y sont journalisées comme celles d'un acteur externe. Les comptes ordinaires restent propres à chaque installation (secret HS256 distinct).
- Le navigateur n'appelle jamais l'API directement : chaque frontend relaie `/api/*` côté serveur (`next.config.ts`, `rewrites`). Tout reste sur une même origine, sans CORS ni cookie tiers.
- **Authentification** (`apps/api/src/auth`) :
  - un jeton d'accès JWT de courte durée (5 min) dans le cookie httpOnly `scout_acces` ;
  - un jeton de session révocable (12 h, rotation à chaque rafraîchissement, seule son empreinte est stockée en base) dans le cookie httpOnly `scout_session` ;
  - le middleware du frontend (`proxy.ts`) rafraîchit le jeton d'accès de façon transparente ;
  - les autres clients (futures plateformes, scripts) peuvent utiliser `Authorization: Bearer`.
- **Autorisation** : toute route de l'API est protégée par défaut (`AuthGuard` global). Les rôles se déclarent avec `@Roles(...)` (rôle paroissial) ou `@RolesDistrict(...)` (affectation district). Les routes ouvertes portent `@Public()` avec une justification.
- **Périmètre produit V1** (`@scout/shared` `perimetreV1`) : décision propre au frontend paroissial, appliquée par son middleware. L'API expose toutes les fonctionnalités, protégées par rôle.

## Démarrer en local

Prérequis : Node.js ≥ 20 (avec corepack) et Docker.

```bash
./setup.sh   # première fois : fichiers .env, dépendances, base, migrations, compte admin
./start.sh   # ensuite : base de données, puis API (4000), frontend paroissial (3000) et application district (3001)
```

Commandes utiles, depuis la racine :

```bash
corepack pnpm dev         # API + deux frontends en parallèle (après `docker compose up -d db`)
corepack pnpm typecheck   # vérification des types de tous les paquets
corepack pnpm test        # tests unitaires (Vitest)
corepack pnpm lint
corepack pnpm build
```

La documentation interactive de l'API est servie sur `http://localhost:4000/api/docs` quand `SWAGGER_ACTIF=true` (voir `apps/api/.env.example`).

## Migrations Prisma : lire avant de toucher au schéma

Le schéma vit dans `apps/api/prisma/schema.prisma`.

**Ne jamais lancer `prisma migrate dev` sur une base qui contient des données à conserver.** Sur ce projet, `migrate dev` peut signaler un faux écart (« drift ») et proposer une réinitialisation de la base alors qu'aucune perte de données n'est nécessaire. Procédure sûre :

```bash
# 1. Modifier apps/api/prisma/schema.prisma
# 2. Générer le SQL sans toucher à la base :
corepack pnpm db:diff > /tmp/diff.sql
# 3. Créer le dossier de migration et y coller le SQL (en l'ajustant si besoin :
#    backfill avant une contrainte NOT NULL, index partiel…) :
mkdir apps/api/prisma/migrations/$(date +%Y%m%d%H%M%S)_description
# 4. Appliquer et régénérer le client :
corepack pnpm db:deploy
corepack pnpm db:generate
```

**Toujours prévoir un backfill avant de rendre une colonne `NOT NULL`** sur une table qui peut déjà contenir des lignes.

En production, `deploy-ovh.sh` prend une sauvegarde (`pg_dump`) juste avant `migrate deploy`. Elle ne remplace pas une stratégie de sauvegarde périodique.

## Ajouter une fonctionnalité

1. Règle métier pure (calcul, validation, libellé) : `packages/shared`.
2. Endpoint : un module NestJS dans `apps/api/src/modules/<domaine>/` (contrôleur mince, logique dans le service, rôles déclarés, contrôles de propriété dans le service), enregistré dans `src/app.module.ts`. Voir `docs/migration-api.md` pour les briques disponibles.
3. Écran : `apps/web-paroisse`, qui appelle `/api/...` avec `fetch` (cookies transmis automatiquement).

## Déploiement

Procédure complète, première installation comprise : [docs/deploiement-ovh.md](docs/deploiement-ovh.md).

- **VPS (OVH)** : `deploy-ovh.sh`. PostgreSQL en Docker, installation paroisse : deux processus pm2 sur l'hôte (`deploy/ecosystem.config.cjs` : `scout-api`, `scout-web`), Nginx en reverse proxy vers l'espace paroisse (`deploy/nginx-scout.conf`). L'installation district est décrite dans la procédure (section 13).
- **Sauvegardes** : `corepack pnpm --filter @scout/api sauvegarder` envoie dans R2 une sauvegarde de la base chiffrée sur le VPS (AES-256-GCM) ; lancée chaque nuit par cron et avant chaque migration. Relecture avec `restaurer-sauvegarde`.
- **Première installation** : `corepack pnpm --filter @scout/api initialiser` crée, sur une base vide, le compte administrateur plateforme (sauf `--sans-admin`, pour l'installation paroisse), le district, la paroisse et son Chef de Groupe (mots de passe saisis à la main).
- **Fichiers (Cloudflare R2)** : aucun document n'est conservé sur le VPS. En production, l'API refuse de démarrer sans stockage externe. Deux buckets : un privé (photos, fiches médicales, autorisations), servi uniquement par l'API après contrôle des droits, et un public (logos, image d'accueil), exposé sur un domaine personnalisé. Configuration détaillée dans `apps/api/.env.example`. Les fichiers d'une installation antérieure se reprennent avec `corepack pnpm --filter @scout/api fichiers:migrer-r2` (simulation par défaut, `--appliquer` pour écrire).
- **Docker** : `apps/api/Dockerfile`, `apps/web-paroisse/Dockerfile` et `apps/web-district/Dockerfile` (contexte de build : racine du dépôt) ; pile complète locale avec `docker compose --profile app up -d --build`.
