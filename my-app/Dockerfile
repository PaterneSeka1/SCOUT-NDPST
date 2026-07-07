# Étape 1 : dépendances
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Étape 2 : build
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Génération du client Prisma avant le build Next.js
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Étape 3 : image de production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# config/site.json est modifié à l'exécution par l'écran d'administration
# "Apparence du site" (route API PUT) : sans ce chown, il reste appartenant à
# root (propriétaire par défaut des COPY ci-dessus) alors que le conteneur
# tourne en tant que "nextjs", et l'écriture échoue avec EACCES.
RUN chown -R nextjs /app/config

# CLI Prisma (et ses dépendances transitives, ex. @prisma/engines, effect…) :
# non tracé par le build standalone (qui bundle le client généré directement
# dans les chunks serveur), mais nécessaire pour appliquer les migrations en
# attente au démarrage du conteneur (voir docker-entrypoint.sh). On réutilise
# l'installation complète de la phase `deps` : le node_modules du build
# standalone n'en est qu'un sous-ensemble élagué, donc cette copie ne fait
# qu'ajouter les fichiers manquants, jamais en retirer.
COPY --from=deps /app/node_modules ./node_modules

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod 755 ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
