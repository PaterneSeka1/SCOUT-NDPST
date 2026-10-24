import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed, Fraunces, Geist_Mono, Source_Sans_3 } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { ConfirmDialogHost } from '@/components/ConfirmDialog'
import { InstallationPwa } from '@/components/InstallationPwa'
import { hexToRgb } from '@scout/shared'
import { getIdentite } from '@/lib/identite-serveur'
import { LOGO_PAR_DEFAUT, nomAffiche } from '@/lib/identite'

// Corps de texte lisible (interface), titres éditoriaux chaleureux (Fraunces)
// et signalétique condensée pour les dates, âges et surtitres.
const corps = Source_Sans_3({ variable: '--font-corps', subsets: ['latin'], display: 'swap' })
const titre = Fraunces({ variable: '--font-titre', subsets: ['latin'], display: 'swap', axes: ['opsz'] })
const signal = Barlow_Condensed({ variable: '--font-signal', subsets: ['latin'], weight: ['500', '600'], display: 'swap' })
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

// URL publique du site (liens absolus des métadonnées Open Graph). Le repli
// sur localhost n'est utilisé qu'en développement.
function getMetadataBase(): URL | undefined {
  const urlConfiguree = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (urlConfiguree) {
    try {
      return new URL(urlConfiguree)
    } catch {
      // Valeur d'environnement invalide : repli ci-dessous.
    }
  }
  return process.env.NODE_ENV === 'production' ? undefined : new URL('http://localhost:3000')
}

// L'identité (nom, couleurs, logo) est modifiable à chaud depuis
// l'administration : jamais figée au build (qui n'a pas accès à l'API).
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const identite = await getIdentite()
  const nom = nomAffiche(identite)
  const logo = identite.logoUrl || LOGO_PAR_DEFAUT
  const description =
    identite.presentation?.slice(0, 160) ||
    `Le scoutisme catholique à ${identite.nomParoisse || 'la paroisse'} : histoire, branches, actualités et activités.`
  return {
    metadataBase: getMetadataBase(),
    title: { default: nom, template: `%s — ${nom}` },
    description,
    icons:
      logo === LOGO_PAR_DEFAUT
        ? { icon: '/favicon.ico', shortcut: '/favicon.ico', apple: '/icons/apple-icon-180.png' }
        : { icon: logo, shortcut: logo, apple: logo },
    // iOS ignore le manifeste pour le mode autonome : balises apple-* requises.
    appleWebApp: { capable: true, statusBarStyle: 'default', title: nom },
    openGraph: { title: nom, description, images: [{ url: logo }], locale: 'fr_FR', type: 'website' },
  }
}

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await getIdentite()
  return { width: 'device-width', initialScale: 1, themeColor: theme.couleurPrimaire }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const identite = await getIdentite()
  const { couleurPrimaire: cp, couleurAccent: ca, couleurFond: cf, couleurHover: ch } = identite.theme

  // Couleurs revalidées par l'API (regex hexadécimale stricte) : injection sûre.
  const cssVars = `:root{--cp:${cp};--ca:${ca};--cf:${cf};--ch:${ch};--cp-rgb:${hexToRgb(cp)};--ca-rgb:${hexToRgb(ca)};--ch-rgb:${hexToRgb(ch)};}`

  return (
    <html lang="fr">
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body className={`${corps.variable} ${titre.variable} ${signal.variable} ${mono.variable} antialiased`}>
        <Providers>{children}</Providers>
        <ConfirmDialogHost />
        <InstallationPwa nomSite={nomAffiche(identite)} logoSite={identite.logoUrl || LOGO_PAR_DEFAUT} />
      </body>
    </html>
  )
}
