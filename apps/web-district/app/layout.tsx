import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { ConfirmDialogHost } from '@/app/components/ConfirmDialog'
import { hexToRgb } from '@scout/shared'
import { getIdentitePlateforme } from '@/lib/identite-serveur'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Thème de la plateforme, modifiable à chaud depuis « Apparence » : rendu à
// chaque requête plutôt que figé au build (le build n'a pas accès à l'API).
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { nomSite } = await getIdentitePlateforme()
  return {
    title: `${nomSite} — Administration`,
    description: 'Administration de la plateforme SCOUT ASCCI',
    icons: { icon: '/favicon.ico', shortcut: '/favicon.ico', apple: '/icons/apple-icon-180.png' },
    // Espace d'administration : jamais indexé par les moteurs de recherche.
    robots: { index: false, follow: false },
  }
}

export async function generateViewport(): Promise<Viewport> {
  const { theme } = await getIdentitePlateforme()
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
  const { theme } = await getIdentitePlateforme()
  const { couleurPrimaire: cp, couleurAccent: ca, couleurFond: cf, couleurHover: ch } = theme
  const chRgb = hexToRgb(ch)

  // Couleurs déjà validées par l'API (format hexadécimal strict) avant d'être
  // injectées dans cette balise <style>.
  const cssVars = `
    :root {
      --cp: ${cp};
      --ca: ${ca};
      --cf: ${cf};
      --ch: ${ch};
      --cp-rgb: ${hexToRgb(cp)};
      --ca-rgb: ${hexToRgb(ca)};
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
      </body>
    </html>
  )
}
