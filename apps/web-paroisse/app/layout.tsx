import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { ConfirmDialogHost } from '@/app/components/ConfirmDialog'
import { InstallationPwa } from '@/app/components/InstallationPwa'
import { hexToRgb, type Theme } from '@scout/shared'
import { getIdentitePlateforme } from '@/lib/identite-serveur'
import { LOGO_OFFICIEL } from '@/lib/identite'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// URL publique du site (liens absolus des métadonnées Open Graph). Le repli
// sur localhost n'est utilisé qu'en développement : en production, une valeur
// absente ou invalide laisse Next.js résoudre les URL sans base (avertissement
// au rendu) plutôt que de publier des liens vers localhost.
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

// Identité de la PLATEFORME (commune à toutes les paroisses, pas celle d'une
// paroisse en particulier) : appliquée à toutes les pages, y compris avant
// connexion. L'identité propre à chaque paroisse (logo + couleurs) est
// appliquée en surcharge dans le tableau de bord une fois connecté.
//
// Le thème est modifiable à chaud (administration plateforme) : il ne doit pas
// être figé au moment du build (et le build, notamment en CI Docker, n'a pas
// accès à l'API). Le layout racine est donc rendu dynamiquement à chaque requête.
export const dynamic = 'force-dynamic'

// Identité plateforme servie par l'API (repli sur l'identité par défaut si
// l'API est indisponible, voir lib/identite-serveur.ts), avec le logo
// officiel du frontend quand aucun logo n'est configuré.
async function getTheme(): Promise<{ theme: Theme; nomSite: string; logoSite: string }> {
  const identite = await getIdentitePlateforme()
  return { theme: identite.theme, nomSite: identite.nomSite, logoSite: identite.logoUrl || LOGO_OFFICIEL }
}

export async function generateMetadata(): Promise<Metadata> {
  const { nomSite, logoSite } = await getTheme()
  return {
    metadataBase: getMetadataBase(),
    title: `${nomSite} — Suivi pédagogique`,
    description: "Application de suivi pédagogique des scouts catholiques de Côte d'Ivoire",
    // Logo officiel par défaut : app/favicon.ico et les PNG de public/icons/
    // en sont dérivés (formats attendus par les navigateurs et iOS).
    icons:
      logoSite === LOGO_OFFICIEL
        ? { icon: '/favicon.ico', shortcut: '/favicon.ico', apple: '/icons/apple-icon-180.png' }
        : { icon: logoSite, shortcut: logoSite, apple: logoSite },
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
      description: "Application de suivi pédagogique des scouts catholiques de Côte d'Ivoire",
      images: [{ url: logoSite }],
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
  `
    .replace(/\s+/g, ' ')
    .trim()

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
