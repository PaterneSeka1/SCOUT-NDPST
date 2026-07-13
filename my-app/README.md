# SCOUT ASCCI

Application de gestion du mouvement scout (Association Scouts Catholiques de Côte d'Ivoire) : paroisses, districts, branches, scouts, cotisations, présences, programmes. Next.js (App Router) + Prisma/PostgreSQL + NextAuth.

## Démarrer en local

```bash
# Depuis la racine du dépôt (pas my-app/) : démarre uniquement la base de données
docker compose up -d db

# Depuis my-app/
npm install
npx prisma migrate deploy   # applique les migrations existantes (voir ci-dessous — jamais `migrate dev` en dehors du cas ci-dessous)
npm run seed                # crée le compte ADMIN_PLATEFORME (voir prisma/seed.ts)
npm run dev
```

## Migrations Prisma — lire avant de toucher au schéma

**Ne jamais lancer `prisma migrate dev` sur une base qui contient des données que tu veux garder.** Sur ce projet, `migrate dev` peut déclencher un faux positif de "drift" et proposer un reset de la base alors qu'aucune perte de données n'est réellement nécessaire. Le workflow sûr pour ajouter une migration :

```bash
# 1. Modifier prisma/schema.prisma
# 2. Générer le SQL de la migration à la main, sans toucher à la base :
npx prisma migrate diff --from-config-datasource --to-schema ./prisma/schema.prisma --script > /tmp/diff.sql

# 3. Créer le dossier de migration et y coller le SQL généré (en ajustant si besoin,
#    ex : ajout d'une étape de backfill avant une contrainte NOT NULL, index partiel
#    non exprimable dans le DSL Prisma...) :
mkdir prisma/migrations/$(date +%Y%m%d%H%M%S)_description
# éditer prisma/migrations/.../migration.sql

# 4. Appliquer :
npx prisma migrate deploy
npx prisma generate
```

**Toujours prévoir un backfill avant de rendre une colonne `NOT NULL`** sur une table qui peut déjà contenir des lignes (`UPDATE ... WHERE colonne IS NULL` avant l'`ALTER COLUMN ... SET NOT NULL`, dans la même migration ou une migration précédente) — une contrainte posée sans backfill fonctionne tant que la base est vide (premier déploiement) mais fait échouer `migrate deploy` sur une base qui contient déjà des lignes invalides.

En production (voir `deploy-ovh.sh` et `scripts/deploy-o2switch.sh`), une sauvegarde (`pg_dump`) est prise automatiquement juste avant `migrate deploy` — mais elle ne remplace pas une vraie stratégie de sauvegarde périodique.

## Déploiement

- **VPS (OVH)** : `deploy-ovh.sh` — PostgreSQL en Docker, application sur l'hôte via pm2, nginx en reverse proxy (déjà en place).
- **Hébergement mutualisé (o2switch)** : `my-app/scripts/deploy-o2switch.sh`, via l'interface "Setup Node.js App" de cPanel.

## Tests

```bash
npm run test        # vitest, une fois
npm run test:watch
```
