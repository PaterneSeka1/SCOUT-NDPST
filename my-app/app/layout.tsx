import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
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

// Identité de la PLATEFORME (commune à toutes les paroisses, pas celle d'une
// paroisse en particulier) : appliquée à toutes les pages, y compris avant
// connexion. L'identité propre à chaque paroisse (logo + couleurs) est
// appliquée en surcharge dans le tableau de bord une fois connecté.
async function getTheme(): Promise<{ theme: Theme; nomSite: string; logoSite: string | null }> {
  const cfg = await prisma.configurationPlateforme.findUnique({ where: { id: 'platform' } })
  if (!cfg) return { theme: THEME_DEFAUT, nomSite: 'SCOUT ASCCI', logoSite: null }

  const theme: Theme = {
    couleurPrimaire: couleurSure(cfg.couleurPrimaire, THEME_DEFAUT.couleurPrimaire),
    couleurAccent: couleurSure(cfg.couleurAccent, THEME_DEFAUT.couleurAccent),
    couleurFond: couleurSure(cfg.couleurFond, THEME_DEFAUT.couleurFond),
    couleurHover: couleurSure(cfg.couleurHover, THEME_DEFAUT.couleurHover),
  }
  return { theme, nomSite: cfg.nomSite, logoSite: cfg.logoUrl }
}

export async function generateMetadata(): Promise<Metadata> {
  const { nomSite, logoSite } = await getTheme()
  return {
    title: `${nomSite} — Suivi pédagogique`,
    description: "Application de suivi pédagogique des scouts catholiques de Côte d'Ivoire",
    ...(logoSite
      ? {
          icons: {
            icon: logoSite,
            shortcut: logoSite,
            apple: logoSite,
          },
        }
      : {}),
    openGraph: {
      title: `${nomSite} — Suivi pédagogique`,
      description: "Application de suivi pédagogique des scouts catholiques de Côte d'Ivoire",
      ...(logoSite ? { images: [{ url: logoSite }] } : {}),
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { theme } = await getTheme()
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
      </body>
    </html>
  )
}
