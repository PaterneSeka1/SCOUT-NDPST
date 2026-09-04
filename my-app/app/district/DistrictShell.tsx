'use client'

import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LABELS_ROLES } from '@/lib/roles'
import { Widgets } from '@/app/components/widgets/Widgets'
import { NavIcon, Menu, UserCircle, LogOut, Award, type LucideIcon } from '@/lib/icons'

type MenuItem = { label: string; href: string; icone: LucideIcon }

const MENU_BASE: MenuItem[] = [
  { label: 'Vue d’ensemble', href: '/district', icone: NavIcon.tableauDeBord },
  { label: 'Paroisses', href: '/district/paroisses', icone: NavIcon.paroisses },
]

// Équipe et Rapports sont réservés au Commissaire de District, comme la page
// "Membres" et les rapports d'une paroisse sont réservés au Chef de Groupe
// (ROLES_GROUPE = ['CHEF_GROUPE'], jamais ROLES_GROUPE_ETENDU) — voir lib/roles.ts.
const MENU_COMMISSAIRE: MenuItem[] = [
  { label: 'Équipe du district', href: '/district/equipe', icone: NavIcon.equipe },
  { label: 'Rapports', href: '/district/rapports', icone: NavIcon.rapports },
]

function menuPour(role: string, brancheType: string | null): MenuItem[] {
  // Un ASSISTANT_DISTRICT chargé d'une branche précise (brancheTypeDistrict
  // renseigné) n'a besoin que de "Ma branche" (voir /api/district/ma-branche) :
  // la vue d'ensemble et la liste des paroisses montrent des données
  // multi-branches de tout le district, hors de son périmètre. Un assistant
  // sans branche assignée (fonction libre, ex. "Spiritualité") garde le menu
  // complet : sa charge est par nature transverse à tout le district.
  if (role === 'ASSISTANT_DISTRICT' && brancheType) {
    return [{ label: 'Ma branche', href: '/district/ma-branche', icone: Award }]
  }

  const menu = [...MENU_BASE]
  return role === 'COMMISSAIRE_DISTRICT' ? [...menu, ...MENU_COMMISSAIRE] : menu
}

function SidebarContent({
  menuItems, pathname, nomComplet, role, roleParoisse, nomDistrict, onNavigate,
}: {
  menuItems: MenuItem[]; pathname: string; nomComplet: string; role: string; roleParoisse: string; nomDistrict: string; onNavigate?: () => void
}) {
  return (
    <>
      <div className="flex-shrink-0 border-b border-white/10 px-6 py-5">
        <p className="text-sm leading-tight font-semibold text-white">District {nomDistrict}</p>
        <p className="mt-0.5 text-xs text-white/55">Espace district</p>
      </div>

      <nav className="scrollbar-fine flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {menuItems.map((item) => {
            const actif = item.href === '/district' ? pathname === '/district' : pathname.startsWith(item.href)
            const Icone = item.icone
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`snav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${actif ? 'snav-active' : ''}`}
                >
                  <Icone className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="flex-shrink-0 border-t border-white/10 px-4 py-4">
        <p className="mb-0.5 truncate text-xs text-white/55">{nomComplet}</p>
        <p className="mb-0.5 text-xs font-medium" style={{ color: 'var(--ca)' }}>{LABELS_ROLES[role] ?? role}</p>
        <p className="mb-3 text-[11px] text-white/45">{LABELS_ROLES[roleParoisse] ?? roleParoisse} (paroisse)</p>
        {/* Toute personne affectée au district a par ailleurs toujours un rôle
            paroissial actif (roleDistrict est additif, jamais un remplacement)
            — ce lien de bascule est donc toujours pertinent, sans condition. */}
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <NavIcon.paroisse className="h-4 w-4" strokeWidth={2} />
          Mon espace paroisse
        </Link>
        <Link
          href="/district/profil"
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

export function DistrictShell({
  children, role, roleParoisse, paroisseId, nomComplet, nomDistrict, brancheType,
}: {
  children: React.ReactNode
  role: string
  roleParoisse: string
  paroisseId: string | null
  nomComplet: string
  nomDistrict: string
  brancheType: string | null
}) {
  const pathname = usePathname()
  const [sidebarOuverte, setSidebarOuverte] = useState(false)
  const menuItems = menuPour(role, brancheType)
  const sidebarStyle = { backgroundColor: 'var(--cp)' }
  const titrePage = menuItems.find((m) => (m.href === '/district' ? pathname === '/district' : pathname.startsWith(m.href)))?.label ?? 'District'
  const initiale = nomComplet?.trim()?.[0]?.toUpperCase() ?? 'D'

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const fermerSiDesktop = (event: MediaQueryListEvent) => { if (event.matches) setSidebarOuverte(false) }
    mq.addEventListener('change', fermerSiDesktop)
    return () => mq.removeEventListener('change', fermerSiDesktop)
  }, [])

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50">
      {sidebarOuverte && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOuverte(false)} />
      )}

      <aside className="hidden w-64 flex-shrink-0 flex-col lg:flex" style={sidebarStyle}>
        <SidebarContent menuItems={menuItems} pathname={pathname} nomComplet={nomComplet} role={role} roleParoisse={roleParoisse} nomDistrict={nomDistrict} />
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col transition-transform duration-300 lg:hidden ${sidebarOuverte ? 'translate-x-0' : '-translate-x-full'}`}
        style={sidebarStyle}
      >
        <SidebarContent menuItems={menuItems} pathname={pathname} nomComplet={nomComplet} role={role} roleParoisse={roleParoisse} nomDistrict={nomDistrict} onNavigate={() => setSidebarOuverte(false)} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOuverte(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-gray-900 sm:text-base">{titrePage}</h2>
              <p className="hidden truncate text-xs text-gray-500 sm:block">District {nomDistrict}</p>
            </div>
          </div>

          <Link
            href="/district/profil"
            className="flex flex-shrink-0 items-center gap-2 rounded-full p-1.5 pl-2 transition-colors hover:bg-gray-100"
            aria-label="Ouvrir mon profil"
          >
            <div className="hidden text-right leading-tight sm:block">
              <p className="max-w-40 truncate text-sm font-medium text-gray-800">{nomComplet}</p>
              <p className="text-xs text-gray-500">{LABELS_ROLES[role] ?? role}</p>
            </div>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white sm:h-9 sm:w-9"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {initiale}
            </div>
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-6">{children}</main>
      </div>

      {/* Activités/documents dépendent du rôle PAROISSIAL (roleParoisse), pas du
          rôle district (role) — ROLES_TOUT_STAFF et /api/documents/expirations
          ne connaissent que la hiérarchie paroissiale (voir lib/roles.ts). */}
      <Widgets role={roleParoisse} paroisseId={paroisseId} />
    </div>
  )
}
