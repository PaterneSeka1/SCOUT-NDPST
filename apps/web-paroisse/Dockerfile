# Frontend paroissial Next.js — image construite depuis la RACINE du monorepo :
#   docker build -f apps/web-paroisse/Dockerfile -t scout-web .
# Aucun accès base ni secret : la configuration se limite à API_URL_INTERNE.
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# Étape 1 : dépendances
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web-paroisse/package.json apps/web-paroisse/
RUN pnpm install --frozen-lockfile --filter @scout/web-paroisse...

# Étape 2 : build autonome (voir next.config.ts)
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/web-paroisse apps/web-paroisse
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_SORTIE_AUTONOME=1
RUN pnpm --filter @scout/shared build && pnpm --filter @scout/web-paroisse build

# Étape 3 : image d'exécution
FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Le build autonome d'un monorepo reproduit l'arborescence depuis la racine.
COPY --from=build --chown=nextjs:nodejs /repo/apps/web-paroisse/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web-paroisse/.next/static ./apps/web-paroisse/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/web-paroisse/public ./apps/web-paroisse/public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web-paroisse/server.js"]
