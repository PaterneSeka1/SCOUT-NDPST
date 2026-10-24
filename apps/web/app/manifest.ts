import type { MetadataRoute } from 'next'
import { getIdentite } from '@/lib/identite-serveur'
import { nomAffiche } from '@/lib/identite'

// Sans ceci, Next fige ce manifeste (nom/logo/couleurs) au moment du build
// plutôt que de refléter les changements faits depuis l'administration.
export const dynamic = 'force-dynamic'

// Convention de fichier Next.js : servi automatiquement sur /manifest.webmanifest
// et lié dans le <head> de toutes les pages (aucune balise <link> manuelle requise).
// Reflète l'identité de l'installation servie par l'API, sans build supplémentaire.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const identite = await getIdentite()
  const cfg = { logoUrl: identite.logoUrl }

  const nomSite = nomAffiche(identite)
  const couleurPrimaire = identite.theme.couleurPrimaire
  const couleurFond = identite.theme.couleurFond
  // Logo configuré (fichier distant de dimensions et de format inconnus) :
  // déclaré en « any » plutôt qu'avec des tailles fixes non garanties.
  // Sans logo configuré : icônes PNG dérivées du logo par défaut (lib/identite.ts).
  const icons: MetadataRoute.Manifest['icons'] = cfg?.logoUrl
    ? [{ src: cfg.logoUrl, sizes: 'any', purpose: 'any' }]
    : [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ]

  return {
    name: nomSite,
    short_name: nomSite.length > 20 ? 'Scouts' : nomSite,
    description: 'Site et espace de gestion du groupe scout de la paroisse',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: couleurFond,
    theme_color: couleurPrimaire,
    lang: 'fr',
    icons,
  }
}
