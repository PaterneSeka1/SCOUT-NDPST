# Application district Next.js — image construite depuis la RACINE du monorepo :
#   docker build -f apps/web-district/Dockerfile -t scout-district .
# Aucun accès base ni secret : URL de l'API, URL publique du site et du stockage.
FROM node:22-alpine AS base
WORKDIR /repo

# Étape 1 : dépendances
FROM base AS deps
COPY package.json package-lock.json ./
# npm ci exige tous les manifestes déclarés dans les workspaces (lockfile complet).
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web-paroisse/package.json apps/web-paroisse/
COPY apps/web-district/package.json apps/web-district/
RUN npm ci -w @scout/shared -w @scout/web-district

# Étape 2 : build autonome (voir next.config.ts)
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/web-district apps/web-district
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_SORTIE_AUTONOME=1
# Obligatoire au build : le relais /api (réécritures) est figé dans le
# manifeste à ce moment-là (voir lib/api-interne.ts). Exemple :
#   docker build --build-arg API_URL_INTERNE=http://api:4000 ...
ARG API_URL_INTERNE
ENV API_URL_INTERNE=$API_URL_INTERNE
# Les variables publiques et la CSP sont également lues pendant le build.
ARG NEXT_PUBLIC_SITE_URL
ARG STORAGE_PUBLIC_URL_BASE
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV STORAGE_PUBLIC_URL_BASE=$STORAGE_PUBLIC_URL_BASE
RUN npm run build -w @scout/shared && npm run build -w @scout/web-district

# Étape 3 : image d'exécution
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Le build autonome d'un monorepo reproduit l'arborescence depuis la racine.
COPY --from=build --chown=nextjs:nodejs /repo/apps/web-district/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web-district/.next/static ./apps/web-district/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/web-district/public ./apps/web-district/public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web-district/server.js"]
