'use client'

import { signOut } from '@/lib/session-client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MONO_PAROISSE } from '@scout/shared'
import { pageHorsPerimetreV1 } from '@scout/shared'
import { NavIcon, Menu, UserCircle, LogOut, type LucideIcon } from '@/lib/icons'
import { ChoixInstallation, type OptionInstallation } from './ChoixInstallation'

type MenuItem = { label: string; href: string; icone: LucideIcon }

// Districts n'a de sens que pour regrouper plusieurs paroisses : masqué en V1
// mono-paroisse (voir lib/monoParoisse.ts). La page reste accessible en
// direct pour ne pas perdre l'accès au district existant, seule l'entrée de
// menu disparaît.
const MENU: MenuItem[] = [
  { label: 'Tableau de bord', href: '/admin', icone: NavIcon.tableauDeBord },
  { label: 'Paroisses', href: '/admin/paroisses', icone: NavIcon.paroisses },
  ...(MONO_PAROISSE ? [] : [{ label: 'Districts', href: '/admin/districts', icone: NavIcon.districts }]),
  { label: 'Utilisateurs', href: '/admin/utilisateurs', icone: NavIcon.membres },
  { label: 'Rapports', href: '/admin/rapports', icone: NavIcon.rapports },
  { label: "Journal d'audit", href: '/admin/audit', icone: NavIcon.audit },
  { label: 'Apparence', href: '/admin/apparence', icone: NavIcon.apparence },
].filter((m) => !pageHorsPerimetreV1(m.href)) // Périmètre V1 : voir lib/perimetreV1.ts

interface Installations {
  options: OptionInstallation[]
  cible: string
  nomDistrict: string
}

function SidebarContent({
  pathname,
  nomComplet,
  installations,
  onNavigate,
}: {
  pathname: string
  nomComplet: string
  installations: Installations
  onNavigate?: () => void
}) {
  return (
    <>
      <div className="shrink-0 border-b border-white/10 px-6 py-5">
        <p className="text-sm leading-tight font-semibold text-white">Administration plateforme</p>
        <p className="mt-0.5 text-xs text-white/55">Toutes les paroisses</p>
        {installations.options.length > 0 && (
          <div className="mt-4">
            <ChoixInstallation
              installations={installations.options}
              cible={installations.cible}
              nomDistrict={installations.nomDistrict}
            />
          </div>
        )}
      </div>

      <nav className="scrollbar-fine flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {MENU.map((item) => {
            const actif = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
            const Icone = item.icone
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`snav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${actif ? 'snav-active' : ''}`}
                >
                  <Icone className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-white/10 px-4 py-4">
        <p className="mb-0.5 truncate text-xs text-white/55">{nomComplet}</p>
        <p className="mb-3 text-xs font-medium" style={{ color: 'var(--ca)' }}>Administrateur plateforme</p>
        <Link
          href="/admin/profil"
          onClick={onNavigate}
          className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <UserCircle className="h-4 w-4" strokeWidth={2} />
          Mon profil
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-white/60 transition-colors hover:bg-red-500/20 hover:text-white"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          Déconnexion
        </button>
      </div>
    </>
  )
}

export function AdminShell({
  children,
  nomComplet,
  installations,
  nomCible,
}: {
  children: React.ReactNode
  nomComplet: string
  installations: Installations
  // Nom de l'installation administrée quand ce n'est pas le district lui-même.
  nomCible: string | null
}) {
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
    <div className="flex h-dvh overflow-hidden bg-gray-50">
      {sidebarOuverte && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOuverte(false)} />
      )}

      <aside className="hidden w-64 shrink-0 flex-col lg:flex" style={sidebarStyle}>
        <SidebarContent pathname={pathname} nomComplet={nomComplet} installations={installations} />
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col transition-transform duration-300 lg:hidden ${sidebarOuverte ? 'translate-x-0' : '-translate-x-full'}`}
        style={sidebarStyle}
      >
        <SidebarContent
          pathname={pathname}
          nomComplet={nomComplet}
          installations={installations}
          onNavigate={() => setSidebarOuverte(false)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOuverte(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-gray-900 sm:text-base">{titrePage}</h2>
              <p className="hidden truncate text-xs text-gray-500 sm:block">Administration plateforme</p>
            </div>
          </div>

          <Link
            href="/admin/profil"
            className="flex shrink-0 items-center gap-2 rounded-full p-1.5 pl-2 transition-colors hover:bg-gray-100"
            aria-label="Ouvrir mon profil"
          >
            <div className="hidden text-right leading-tight sm:block">
              <p className="max-w-40 truncate text-sm font-medium text-gray-800">{nomComplet}</p>
              <p className="text-xs text-gray-500">Admin plateforme</p>
            </div>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white sm:h-9 sm:w-9"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {initiale}
            </div>
          </Link>
        </header>

        {nomCible && (
          // Rappel permanent : chaque action porte sur une autre installation.
          <div role="status" className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6">
            Vous administrez l’installation <strong>{nomCible}</strong>. Les modifications s’appliquent à sa base, pas à
            celle du district.
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-6">{children}</main>
      </div>
    </div>
  )
}
