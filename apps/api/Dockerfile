# API NestJS — image construite depuis la RACINE du monorepo :
#   docker build -f apps/api/Dockerfile -t scout-api .
FROM node:22.23.4-alpine AS base
RUN npm install --global npm@10.9.9
WORKDIR /repo

# Étape 1 : dépendances (couche mise en cache tant que les manifestes ne changent pas)
FROM base AS deps
COPY package.json package-lock.json ./
# npm ci exige tous les manifestes déclarés dans les workspaces (lockfile complet).
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web-paroisse/package.json apps/web-paroisse/
COPY apps/web-district/package.json apps/web-district/
# Le postinstall de l'API génère le client Prisma : il a besoin du schéma.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN npm ci -w @scout/shared -w @scout/api

# Étape 2 : build
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @scout/shared && npm run build -w @scout/api

# Étape 3 : image d'exécution
FROM base AS runner
ENV NODE_ENV=production
# pg_dump : sauvegarde de la base juste avant les migrations (docker-entrypoint.sh).
RUN apk add --no-cache postgresql16-client
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
RUN addgroup --system --gid 1001 scout && adduser --system --uid 1001 scout \
  && mkdir -p /donnees && chown scout /donnees \
  && chmod 755 /repo/apps/api/docker-entrypoint.sh
USER scout
# Fichiers téléversés : à monter sur un volume persistant.
ENV STORAGE_DOSSIER_LOCAL=/donnees
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
