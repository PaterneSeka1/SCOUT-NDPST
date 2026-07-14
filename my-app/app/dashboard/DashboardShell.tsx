'use client'

import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ParoisseLogoImage } from '@/app/components/ParoisseLogoImage'

type MenuItem = {
  label: string
  href: string
  icone: string
}

// aDesEnfants : un membre du staff (Chef de Groupe, encadrement de branche,
// Ressources Adultes rattaché via un compte SCOUT…) peut être par ailleurs
// parent d'un scout de la paroisse — le rôle PARENT n'est pas une condition
// pour avoir des enfants rattachés (voir app/api/utilisateurs/route.ts). Le
// lien "Mes enfants" doit donc apparaître dans son menu habituel, sans lui
// substituer le menu PARENT (dont il n'a pas les autres droits).
//
// roleDistrict : affectation district ADDITIVE au rôle paroissial (role),
// jamais un remplacement (voir prisma/schema.prisma) — un Chef de Groupe par
// ailleurs Commissaire de District garde son menu paroissial complet, avec un
// lien de bascule supplémentaire vers /district (symétrique au lien "Mon
// espace paroisse" de DistrictShell).
function getMenuItems(role: string, aDesEnfants: boolean, roleDistrict?: string | null): MenuItem[] {
  const items = getMenuItemsDeBase(role)
  let menu = items
  if (role !== 'PARENT' && aDesEnfants) {
    const item = { label: 'Mes enfants', href: '/dashboard/mes-enfants', icone: '👨‍👧‍👦' }
    const indexApresParoisse = items.findIndex((m) => m.href === '/dashboard/paroisse')
    const position = indexApresParoisse >= 0 ? indexApresParoisse + 1 : items.length
    menu = [...items.slice(0, position), item, ...items.slice(position)]
  }
  if (roleDistrict) {
    menu = [...menu, { label: 'Espace district', href: '/district', icone: '🏛️' }]
  }
  return menu
}

function getMenuItemsDeBase(role: string): MenuItem[] {
  switch (role) {
    case 'CHEF_GROUPE':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: '📊' },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: '⛪' },
        { label: 'Membres', href: '/dashboard/utilisateurs', icone: '👥' },
        { label: 'Parents', href: '/dashboard/parents', icone: '👨‍👩‍👧' },
        { label: 'Branches', href: '/dashboard/branches', icone: '🌿' },
        { label: 'Scouts', href: '/dashboard/scouts', icone: '⚜️' },
        { label: 'Documents', href: '/dashboard/documents', icone: '📄' },
        { label: 'Calendrier', href: '/dashboard/calendrier', icone: '🗓' },
        { label: 'Cotisations', href: '/dashboard/cotisations', icone: '💶' },
        { label: 'Activités', href: '/dashboard/activites', icone: '📅' },
        { label: 'Réunions', href: '/dashboard/reunions', icone: '🗓️' },
        { label: 'Programmes', href: '/dashboard/programmes', icone: '📘' },
        { label: 'Rapports', href: '/dashboard/rapports', icone: '📈' },
        { label: "Journal d'audit", href: '/dashboard/audit', icone: '🛡️' },
      ]
    case 'ADJOINT_GROUPE':
    case 'ASSISTANT_GROUPE':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: '📊' },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: '⛪' },
        { label: 'Branches', href: '/dashboard/branches', icone: '🌿' },
        { label: 'Scouts', href: '/dashboard/scouts', icone: '⚜️' },
        { label: 'Documents', href: '/dashboard/documents', icone: '📄' },
        { label: 'Calendrier', href: '/dashboard/calendrier', icone: '🗓' },
        { label: 'Cotisations', href: '/dashboard/cotisations', icone: '💶' },
        { label: 'Activités', href: '/dashboard/activites', icone: '📅' },
        { label: 'Réunions', href: '/dashboard/reunions', icone: '🗓️' },
        { label: 'Programmes', href: '/dashboard/programmes', icone: '📘' },
      ]
    case 'RESPONSABLE_BRANCHE':
    case 'ADJOINT_BRANCHE':
    case 'ASSISTANT_BRANCHE':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: '📊' },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: '⛪' },
        { label: 'Ma branche', href: '/dashboard/ma-branche', icone: '🌿' },
        { label: 'Scouts', href: '/dashboard/scouts', icone: '⚜️' },
        { label: 'Documents', href: '/dashboard/documents', icone: '📄' },
        { label: 'Calendrier', href: '/dashboard/calendrier', icone: '🗓' },
        { label: 'Cotisations', href: '/dashboard/cotisations', icone: '💶' },
        { label: 'Activités', href: '/dashboard/activites', icone: '📅' },
        { label: 'Réunions', href: '/dashboard/reunions', icone: '🗓️' },
        { label: 'Programmes', href: '/dashboard/programmes', icone: '📘' },
        { label: 'Présences', href: '/dashboard/presences', icone: '✅' },
      ]
    case 'PARENT':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: '📊' },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: '⛪' },
        { label: 'Mes enfants', href: '/dashboard/mes-enfants', icone: '👨‍👧‍👦' },
      ]
    case 'SCOUT':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: '📊' },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: '⛪' },
        { label: 'Ma progression', href: '/dashboard/ma-progression', icone: '🏅' },
      ]
    default:
      return [{ label: 'Tableau de bord', href: '/dashboard', icone: '📊' }]
  }
}

function libelleRole(role: string): string {
  const libelles: Record<string, string> = {
    CHEF_GROUPE: 'Chef de groupe',
    ADJOINT_GROUPE: 'Adjoint de groupe',
    ASSISTANT_GROUPE: 'Assistant de groupe',
    RESPONSABLE_BRANCHE: 'Responsable de branche',
    ADJOINT_BRANCHE: 'Adjoint de branche',
    ASSISTANT_BRANCHE: 'Assistant de branche',
    PARENT: 'Parent',
    SCOUT: 'Scout',
  }
  return libelles[role] ?? role
}

function SidebarContent({
  menuItems,
  pathname,
  nomComplet,
  role,
  logoUrl,
  nomSite,
  sousTitreSite,
  onNavigate,
}: {
  menuItems: MenuItem[]
  pathname: string
  nomComplet: string
  role: string
  logoUrl: string | null
  nomSite: string
  sousTitreSite: string
  onNavigate?: () => void
}) {
  return (
    <>
      {/* Logo paroisse + nom de la paroisse */}
      <div className="px-6 py-5 border-b border-white/15 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
          >
            <ParoisseLogoImage logoUrl={logoUrl} taille="xl" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{nomSite}</p>
            <p className="text-white/60 text-xs truncate">{sousTitreSite}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const actif = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`snav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    actif ? 'snav-active' : ''
                  }`}
                >
                  <span className="text-base">{item.icone}</span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Pied de sidebar */}
      <div className="px-4 py-4 border-t border-white/15 flex-shrink-0">
        <p className="text-white/60 text-xs truncate mb-0.5">{nomComplet}</p>
        <p className="text-[#f39c12] text-xs font-medium mb-3">{libelleRole(role)}</p>
        <Link
          href="/dashboard/profil"
          onClick={onNavigate}
          className="w-full text-xs text-white/60 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 mb-1"
        >
          <span>👤</span>
          Mon profil
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-xs text-white/60 hover:text-white hover:bg-red-700/40 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <span>🚪</span>
          Déconnexion
        </button>
      </div>
    </>
  )
}

export function DashboardShell({
  children,
  role,
  roleDistrict,
  nomComplet,
  logoUrl,
  nomSite,
  sousTitreSite,
  aDesEnfants = false,
}: {
  children: React.ReactNode
  role: string
  roleDistrict?: string | null
  nomComplet: string
  logoUrl: string | null
  nomSite: string
  sousTitreSite: string
  aDesEnfants?: boolean
}) {
  const pathname = usePathname()
  const [sidebarOuverte, setSidebarOuverte] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setSidebarOuverte(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const menuItems = getMenuItems(role, aDesEnfants, roleDistrict)
  const titrePage = menuItems.find((m) => m.href === pathname)?.label ?? 'Tableau de bord'
  const initiale = nomComplet?.[0] ?? '?'

  const sidebarStyle = { backgroundColor: 'var(--cp)' }
  const sidebarProps = { pathname, nomComplet, role, logoUrl, nomSite, sousTitreSite }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden print:h-auto print:overflow-visible">

      {/* Overlay mobile */}
      {sidebarOuverte && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOuverte(false)}
        />
      )}

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0 print:hidden" style={sidebarStyle}>
        <SidebarContent menuItems={menuItems} {...sidebarProps} />
      </aside>

      {/* Sidebar mobile (drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 flex flex-col transition-transform duration-300 lg:hidden print:hidden ${
          sidebarOuverte ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={sidebarStyle}
      >
        <SidebarContent menuItems={menuItems} {...sidebarProps} onNavigate={() => setSidebarOuverte(false)} />
      </aside>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 print:overflow-visible">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 gap-3 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
              onClick={() => setSidebarOuverte(true)}
              aria-label="Ouvrir le menu"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-gray-800 font-semibold text-sm truncate">{titrePage}</h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-800 leading-tight">{nomComplet}</p>
              <p className="text-xs text-gray-500">{libelleRole(role)}</p>
            </div>
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {initiale}
            </div>
          </div>
        </header>

        {/* Contenu */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  )
}
