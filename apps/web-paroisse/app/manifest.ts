import type { MetadataRoute } from 'next'
import { getIdentitePlateforme } from '@/lib/identite-serveur'

// Comme app/page.tsx : sans ceci, Next fige ce manifeste (nom/logo/couleurs)
// au moment du build plutôt que de refléter les changements faits depuis
// l'administration plateforme.
export const dynamic = 'force-dynamic'

// Convention de fichier Next.js : servi automatiquement sur /manifest.webmanifest
// et lié dans le <head> de toutes les pages (aucune balise <link> manuelle requise).
// Reflète l'identité de la PLATEFORME servie par l'API, la même source que
// app/layout.tsx et app/page.tsx, sans build supplémentaire.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const identite = await getIdentitePlateforme()
  const cfg = { logoUrl: identite.logoUrl }

  const nomSite = identite.nomSite
  const couleurPrimaire = identite.theme.couleurPrimaire
  const couleurFond = identite.theme.couleurFond
  // Sans logo configuré : icônes PNG dérivées du logo officiel (lib/theme.ts).
  const icons: MetadataRoute.Manifest['icons'] = cfg?.logoUrl
    ? [
        { src: cfg.logoUrl, sizes: 'any', purpose: 'any' },
        { src: cfg.logoUrl, sizes: '192x192', purpose: 'any' },
        { src: cfg.logoUrl, sizes: '512x512', purpose: 'any' },
      ]
    : [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ]

  return {
    name: `${nomSite} — Suivi pédagogique`,
    short_name: nomSite,
    description: "Application de suivi pédagogique des scouts catholiques de Côte d'Ivoire",
    start_url: '/',
    display: 'standalone',
    background_color: couleurFond,
    theme_color: couleurPrimaire,
    lang: 'fr',
    icons,
  }
}
