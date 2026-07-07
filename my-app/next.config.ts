import type { NextConfig } from 'next'

const EN_PRODUCTION = process.env.NODE_ENV === 'production'

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
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  output: 'standalone',
  // Sur l'hébergement mutualisé o2switch (CloudLinux/CageFS), le build échoue
  // avec "spawn EAGAIN" / "kill EPERM" : l'environnement interdit à Next.js de
  // fork() des processus enfants pour paralléliser la génération des pages.
  // workerThreads bascule sur des threads (même process, pas de fork), et
  // cpus:1 évite d'en créer plusieurs en parallèle.
  experimental: {
    workerThreads: true,
    cpus: 1,
  },
  // Aucune image externe n'est utilisée par l'application (logos/photos sont
  // téléversés localement) : on n'autorise donc aucun hôte distant pour éviter
  // que l'optimiseur d'images ne serve de proxy SSRF vers une URL arbitraire.
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
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
