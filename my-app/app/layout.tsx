import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { readFile } from 'fs/promises'
import path from 'path'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

type Theme = {
  couleurPrimaire: string
  couleurAccent: string
  couleurFond: string
  couleurHover: string
}

type SiteConfig = {
  logoSite?: string | null
  nomSite?: string
  theme?: Partial<Theme>
}

const THEME_DEFAUT: Theme = {
  couleurPrimaire: '#1a4731',
  couleurAccent: '#27ae60',
  couleurFond: '#0f2418',
  couleurHover: '#27ae60',
}

// Ces valeurs sont injectées telles quelles dans une balise <style> (voir plus
// bas, dangerouslySetInnerHTML) : on revalide strictement le format hexadécimal
// ici aussi, en défense en profondeur de la validation faite à l'écriture par
// /api/admin/site-config, pour empêcher toute injection HTML/JS via le thème.
const COULEUR_HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
function couleurSure(valeur: string | undefined, defaut: string): string {
  return valeur && COULEUR_HEX_REGEX.test(valeur) ? valeur : defaut
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '39, 174, 96'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

async function getTheme(): Promise<{ theme: Theme; nomSite: string; logoSite: string | null }> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), 'config', 'site.json'),
      'utf-8',
    )
    const config: SiteConfig = JSON.parse(raw)
    const theme: Theme = {
      couleurPrimaire: couleurSure(config.theme?.couleurPrimaire, THEME_DEFAUT.couleurPrimaire),
      couleurAccent: couleurSure(config.theme?.couleurAccent, THEME_DEFAUT.couleurAccent),
      couleurFond: couleurSure(config.theme?.couleurFond, THEME_DEFAUT.couleurFond),
      couleurHover: couleurSure(config.theme?.couleurHover, THEME_DEFAUT.couleurHover),
    }
    return {
      theme,
      nomSite: config.nomSite ?? 'SCOUT ASCCI',
      logoSite: config.logoSite || null,
    }
  } catch {
    return { theme: THEME_DEFAUT, nomSite: 'SCOUT ASCCI', logoSite: null }
  }
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
