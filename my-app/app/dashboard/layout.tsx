'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

type MenuItem = {
  label: string
  href: string
  icone: string
}

function getMenuItems(role: string): MenuItem[] {
  switch (role) {
    case 'ADMIN_PAROISSE':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: '📊' },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: '⛪' },
        { label: 'Utilisateurs', href: '/dashboard/utilisateurs', icone: '👥' },
        { label: 'Branches', href: '/dashboard/branches', icone: '🌿' },
        { label: 'Scouts', href: '/dashboard/scouts', icone: '⚜️' },
        { label: 'Activités', href: '/dashboard/activites', icone: '📅' },
        { label: 'Rapports', href: '/dashboard/rapports', icone: '📈' },
      ]
    case 'CHEF_GROUPE':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: '📊' },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: '⛪' },
        { label: 'Utilisateurs', href: '/dashboard/utilisateurs', icone: '👥' },
        { label: 'Branches', href: '/dashboard/branches', icone: '🌿' },
        { label: 'Scouts', href: '/dashboard/scouts', icone: '⚜️' },
        { label: 'Activités', href: '/dashboard/activites', icone: '📅' },
        { label: 'Rapports', href: '/dashboard/rapports', icone: '📈' },
      ]
    case 'ADJOINT_GROUPE':
    case 'ASSISTANT_GROUPE':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: '📊' },
        { label: 'Branches', href: '/dashboard/branches', icone: '🌿' },
        { label: 'Scouts', href: '/dashboard/scouts', icone: '⚜️' },
        { label: 'Activités', href: '/dashboard/activites', icone: '📅' },
      ]
    case 'RESPONSABLE_BRANCHE':
    case 'ADJOINT_BRANCHE':
    case 'ASSISTANT_BRANCHE':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: '📊' },
        { label: 'Ma branche', href: '/dashboard/ma-branche', icone: '🌿' },
        { label: 'Scouts', href: '/dashboard/scouts', icone: '⚜️' },
        { label: 'Activités', href: '/dashboard/activites', icone: '📅' },
        { label: 'Présences', href: '/dashboard/presences', icone: '✅' },
      ]
    case 'PARENT':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: '📊' },
        { label: 'Mes enfants', href: '/dashboard/mes-enfants', icone: '👨‍👧‍👦' },
      ]
    case 'SCOUT':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: '📊' },
        { label: 'Ma progression', href: '/dashboard/ma-progression', icone: '🏅' },
      ]
    default:
      return [{ label: 'Tableau de bord', href: '/dashboard', icone: '📊' }]
  }
}

function libelleRole(role: string): string {
  const libelles: Record<string, string> = {
    ADMIN_PAROISSE: 'Administrateur',
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
  onNavigate,
}: {
  menuItems: MenuItem[]
  pathname: string
  nomComplet: string
  role: string
  onNavigate?: () => void
}) {
  return (
    <>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#27ae60]/30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚜️</span>
          <div>
            <p className="text-white font-bold text-sm leading-tight">SCOUT ASCCI</p>
            <p className="text-[#a8d5b5] text-xs">Côte d&apos;Ivoire</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const actif = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    actif
                      ? 'bg-[#27ae60] text-white'
                      : 'text-[#a8d5b5] hover:bg-[#27ae60]/20 hover:text-white'
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

      {/* Pied */}
      <div className="px-4 py-4 border-t border-[#27ae60]/30 flex-shrink-0">
        <p className="text-[#a8d5b5] text-xs truncate mb-0.5">{nomComplet}</p>
        <p className="text-[#f39c12] text-xs font-medium mb-3">{libelleRole(role)}</p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-xs text-[#a8d5b5] hover:text-white hover:bg-red-700/40 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <span>🚪</span>
          Déconnexion
        </button>
      </div>
    </>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOuverte, setSidebarOuverte] = useState(false)

  // Fermer la sidebar si l'écran s'agrandit au-delà du breakpoint lg
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setSidebarOuverte(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const role = session?.user?.role ?? ''
  const menuItems = getMenuItems(role)
  const nomComplet = session?.user ? `${session.user.prenom} ${session.user.nom}` : '…'
  const titrePage = menuItems.find((m) => m.href === pathname)?.label ?? 'Tableau de bord'

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* Overlay mobile */}
      {sidebarOuverte && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOuverte(false)}
        />
      )}

      {/* Sidebar desktop (toujours visible) */}
      <aside className="hidden lg:flex w-64 bg-[#1a4731] flex-col flex-shrink-0">
        <SidebarContent
          menuItems={menuItems}
          pathname={pathname}
          nomComplet={nomComplet}
          role={role}
        />
      </aside>

      {/* Sidebar mobile (drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-[#1a4731] flex flex-col transition-transform duration-300 lg:hidden ${
          sidebarOuverte ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent
          menuItems={menuItems}
          pathname={pathname}
          nomComplet={nomComplet}
          role={role}
          onNavigate={() => setSidebarOuverte(false)}
        />
      </aside>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Bouton hamburger — mobile seulement */}
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
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1a4731] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {session?.user?.prenom?.[0] ?? '?'}
            </div>
          </div>
        </header>

        {/* Contenu */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
