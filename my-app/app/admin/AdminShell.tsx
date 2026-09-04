'use client'

import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MONO_PAROISSE } from '@/lib/monoParoisse'

// Districts n'a de sens que pour regrouper plusieurs paroisses : masqué en V1
// mono-paroisse (voir lib/monoParoisse.ts). La page reste accessible en
// direct pour ne pas perdre l'accès au district existant, seule l'entrée de
// menu disparaît.
const MENU = [
  { label: 'Tableau de bord', href: '/admin', icone: '📊' },
  { label: 'Paroisses', href: '/admin/paroisses', icone: '⛪' },
  ...(MONO_PAROISSE ? [] : [{ label: 'Districts', href: '/admin/districts', icone: '🧭' }]),
  { label: 'Utilisateurs', href: '/admin/utilisateurs', icone: '👥' },
  { label: 'Rapports', href: '/admin/rapports', icone: '📈' },
  { label: "Journal d'audit", href: '/admin/audit', icone: '🛡️' },
  { label: 'Apparence', href: '/admin/apparence', icone: '🎨' },
]

function SidebarContent({ pathname, nomComplet, onNavigate }: { pathname: string; nomComplet: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="px-6 py-5 border-b border-white/15 flex-shrink-0">
        <p className="text-white font-bold text-sm leading-tight">Administration plateforme</p>
        <p className="text-white/60 text-xs mt-0.5">Toutes les paroisses</p>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {MENU.map((item) => {
            const actif = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`snav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${actif ? 'snav-active' : ''}`}
                >
                  <span className="text-base">{item.icone}</span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-4 py-4 border-t border-white/15 flex-shrink-0">
        <p className="text-white/60 text-xs truncate mb-0.5">{nomComplet}</p>
        <p className="text-[#f39c12] text-xs font-medium mb-3">Administrateur plateforme</p>
        <Link
          href="/admin/profil"
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

export function AdminShell({ children, nomComplet }: { children: React.ReactNode; nomComplet: string }) {
  const pathname = usePathname()
  const [sidebarOuverte, setSidebarOuverte] = useState(false)
  const sidebarStyle = { backgroundColor: 'var(--cp)' }
  const titrePage = MENU.find((m) => (m.href === '/admin' ? pathname === '/admin' : pathname.startsWith(m.href)))?.label ?? 'Administration'
  const initiale = nomComplet?.trim()?.[0]?.toUpperCase() ?? 'A'

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const fermerSiDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setSidebarOuverte(false)
    }
    mq.addEventListener('change', fermerSiDesktop)
    return () => mq.removeEventListener('change', fermerSiDesktop)
  }, [])

  return (
    <div className="flex h-dvh bg-gray-100 overflow-hidden">
      {sidebarOuverte && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOuverte(false)} />
      )}

      <aside className="hidden lg:flex w-64 flex-col flex-shrink-0" style={sidebarStyle}>
        <SidebarContent pathname={pathname} nomComplet={nomComplet} />
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 flex flex-col transition-transform duration-300 lg:hidden ${sidebarOuverte ? 'translate-x-0' : '-translate-x-full'}`}
        style={sidebarStyle}
      >
        <SidebarContent pathname={pathname} nomComplet={nomComplet} onNavigate={() => setSidebarOuverte(false)} />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 gap-3">
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
            <div className="min-w-0">
              <h2 className="text-gray-900 font-semibold text-sm sm:text-base truncate">{titrePage}</h2>
              <p className="hidden sm:block text-xs text-gray-500 truncate">Administration plateforme</p>
            </div>
          </div>

          <Link
            href="/admin/profil"
            className="flex items-center gap-2 rounded-full p-1.5 pl-2 hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Ouvrir mon profil"
          >
            <div className="hidden sm:block text-right leading-tight">
              <p className="text-sm font-medium text-gray-800 truncate max-w-40">{nomComplet}</p>
              <p className="text-xs text-gray-500">Admin plateforme</p>
            </div>
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {initiale}
            </div>
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6">{children}</main>
      </div>
    </div>
  )
}
