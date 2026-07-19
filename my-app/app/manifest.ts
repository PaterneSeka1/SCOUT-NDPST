import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { THEME_DEFAUT, couleurSure } from '@/lib/theme'

// Comme app/page.tsx : sans ceci, Next fige ce manifeste (nom/logo/couleurs)
// au moment du build plutôt que de refléter les changements faits depuis
// /admin/apparence.
export const dynamic = 'force-dynamic'

// Convention de fichier Next.js : servi automatiquement sur /manifest.webmanifest
// et lié dans le <head> de toutes les pages (aucune balise <link> manuelle requise).
// Reflète l'identité de la PLATEFORME (ConfigurationPlateforme), la même source
// que app/layout.tsx et app/page.tsx — cohérent avec le nom/logo/couleurs
// configurés depuis /admin/apparence, sans build supplémentaire.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cfg = await prisma.configurationPlateforme.findUnique({ where: { id: 'platform' } })

  const nomSite = cfg?.nomSite || 'SCOUT ASCCI'
  const couleurPrimaire = couleurSure(cfg?.couleurPrimaire, THEME_DEFAUT.couleurPrimaire)
  const couleurFond = couleurSure(cfg?.couleurFond, THEME_DEFAUT.couleurFond)
  const logo = cfg?.logoUrl || '/favicon.ico'
  const description = cfg?.metaDescription || "Application de suivi pédagogique des scouts catholiques de Côte d'Ivoire"

  return {
    name: `${nomSite} — Suivi pédagogique`,
    short_name: nomSite,
    description,
    start_url: '/',
    display: 'standalone',
    background_color: couleurFond,
    theme_color: couleurPrimaire,
    lang: 'fr',
    icons: [
      { src: logo, sizes: 'any', purpose: 'any' },
      { src: logo, sizes: '192x192', purpose: 'any' },
      { src: logo, sizes: '512x512', purpose: 'any' },
    ],
  }
}
