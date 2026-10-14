import path from 'path'
import type { NextConfig } from 'next'
import { urlApiInterne } from './lib/api-interne'

const EN_PRODUCTION = process.env.NODE_ENV === 'production'

// URL interne de l'API, évaluée au chargement de la configuration : en
// production (dont `next build`), une API_URL_INTERNE absente fait échouer
// immédiatement avec un message explicite, au lieu de figer un relais /api
// vers 127.0.0.1 dans le manifeste des réécritures.
const API_INTERNE = urlApiInterne()

// Origine du bucket public de stockage (Supabase, R2, Spaces...), dérivée de
// la même variable que lib/storage.ts — jamais d'hôte distant en dur ici : si
// le stockage local (aucune variable STORAGE_S3_* définie) est utilisé, les
// logos/photos restent des chemins "/api/fichiers-publics/…" déjà couverts par 'self'.
const ORIGINE_STOCKAGE_PUBLIC = (() => {
  if (!process.env.STORAGE_PUBLIC_URL_BASE) return null
  try {
    return new URL(process.env.STORAGE_PUBLIC_URL_BASE).origin
  } catch {
    return null
  }
})()

// Content-Security-Policy : le App Router de Next.js inline lui-même des
// balises <script> pour hydrater les données RSC (en dev comme en prod), donc
// 'unsafe-inline' est nécessaire pour script-src sans mettre en place un
// système de nonce par requête. 'unsafe-eval' n'est requis qu'en développement
// (Turbopack/Fast Refresh).
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${EN_PRODUCTION ? '' : " 'unsafe-eval'"}`,
  // 'unsafe-inline' requis : styles injectés via l'attribut style={{...}} (React)
  // et la balise <style> de personnalisation du thème dans app/layout.tsx.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${ORIGINE_STOCKAGE_PUBLIC ? ` ${ORIGINE_STOCKAGE_PUBLIC}` : ''}`,
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  // Build autonome (serveur Node minimal) pour l'image Docker uniquement ; en
  // production pm2, `next start` est utilisé (voir deploy/ecosystem.config.cjs).
  // La racine du monorepo est la racine de traçage : @scout/shared est inclus.
  ...(process.env.NEXT_SORTIE_AUTONOME === '1' ? { output: 'standalone' as const } : {}),
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Aucune image externe n'est utilisée par l'application (logos/photos sont
  // téléversés localement) : on n'autorise donc aucun hôte distant pour éviter
  // que l'optimiseur d'images ne serve de proxy SSRF vers une URL arbitraire.
  // Le navigateur n'appelle jamais l'API directement : /api/* est relayé
  // par ce serveur vers l'API NestJS (même origine, donc ni CORS ni cookie
  // tiers). En « fallback », une route encore servie par app/api/ reste
  // prioritaire : chaque route supprimée bascule automatiquement vers l'API.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [{ source: '/api/:path*', destination: `${API_INTERNE}/api/:path*` }],
    }
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(EN_PRODUCTION
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
        ],
      },
    ]
  },
}

export default nextConfig
