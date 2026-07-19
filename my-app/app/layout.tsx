import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { ConfirmDialogHost } from '@/app/components/ConfirmDialog'
import { InstallationPwa } from '@/app/components/InstallationPwa'
import { prisma } from '@/lib/prisma'
import { THEME_DEFAUT, couleurSure, hexToRgb, type Theme } from '@/lib/theme'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

function getMetadataBase(): URL {
  const urlConfiguree = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL
  if (urlConfiguree) {
    try {
      return new URL(urlConfiguree)
    } catch {
      // Valeur d'environnement invalide : on garde un fallback stable pour
      // éviter l'avertissement Next.js sans faire échouer le rendu.
    }
  }
  return new URL('http://localhost:3000')
}

// Identité de la PLATEFORME (commune à toutes les paroisses, pas celle d'une
// paroisse en particulier) : appliquée à toutes les pages, y compris avant
// connexion. L'identité propre à chaque paroisse (logo + couleurs) est
// appliquée en surcharge dans le tableau de bord une fois connecté.
const DESCRIPTION_DEFAUT = "Application de suivi pédagogique des scouts catholiques de Côte d'Ivoire"

async function getTheme(): Promise<{
  theme: Theme
  nomSite: string
  logoSite: string | null
  description: string
  ogImage: string | null
}> {
  const cfg = await prisma.configurationPlateforme.findUnique({ where: { id: 'platform' } })
  if (!cfg) return { theme: THEME_DEFAUT, nomSite: 'SCOUT ASCCI', logoSite: null, description: DESCRIPTION_DEFAUT, ogImage: null }

  const theme: Theme = {
    couleurPrimaire: couleurSure(cfg.couleurPrimaire, THEME_DEFAUT.couleurPrimaire),
    couleurAccent: couleurSure(cfg.couleurAccent, THEME_DEFAUT.couleurAccent),
    couleurFond: couleurSure(cfg.couleurFond, THEME_DEFAUT.couleurFond),
    couleurHover: couleurSure(cfg.couleurHover, THEME_DEFAUT.couleurHover),
  }
  return {
    theme,
    nomSite: cfg.nomSite,
    logoSite: cfg.logoUrl,
    description: cfg.metaDescription || DESCRIPTION_DEFAUT,
    // Image de partage Open Graph/Twitter dédiée (format ~1200x630) si
    // configurée, sinon on retombe sur le logo (souvent carré, moins lisible
    // dans un aperçu de lien mais toujours mieux qu'aucune image).
    ogImage: cfg.ogImageUrl || cfg.logoUrl,
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { nomSite, logoSite, description, ogImage } = await getTheme()
  return {
    metadataBase: getMetadataBase(),
    title: `${nomSite} — Suivi pédagogique`,
    description,
    ...(logoSite
      ? {
          icons: {
            icon: logoSite,
            shortcut: logoSite,
            apple: logoSite,
          },
        }
      : {}),
    // iOS ignore manifest.webmanifest pour le mode standalone/le titre à
    // l'écran d'accueil : ces balises meta apple-* sont le seul moyen de les
    // couvrir sur Safari (voir app/manifest.ts pour Android/Chrome).
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: nomSite,
    },
    openGraph: {
      title: `${nomSite} — Suivi pédagogique`,
      description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${nomSite} — Suivi pédagogique`,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await getTheme()
  return {
    width: 'device-width',
    initialScale: 1,
    themeColor: theme.couleurPrimaire,
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { theme, nomSite, logoSite } = await getTheme()
  const { couleurPrimaire: cp, couleurAccent: ca, couleurFond: cf, couleurHover: ch } = theme

  const caRgb = hexToRgb(ca)
  const cpRgb = hexToRgb(cp)
  const chRgb = hexToRgb(ch)

  const cssVars = `
    :root {
      --cp: ${cp};
      --ca: ${ca};
      --cf: ${cf};
      --ch: ${ch};
      --cp-rgb: ${cpRgb};
      --ca-rgb: ${caRgb};
      --ch-rgb: ${chRgb};
    }
    .snav-link { color: rgba(255,255,255,0.72); transition: background-color 0.15s, color 0.15s; }
    .snav-link:hover { background-color: rgba(${chRgb}, 0.22); color: white; }
    .snav-active { background-color: var(--ch) !important; color: white !important; }
    .btn-primary { background-color: var(--cp); }
    .btn-primary:hover { filter: brightness(1.12); }
  `.replace(/\s+/g, ' ').trim()

  return (
    <html lang="fr">
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
        <ConfirmDialogHost />
        <InstallationPwa nomSite={nomSite} logoSite={logoSite} />
      </body>
    </html>
  )
}
