'use client'

import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ParoisseLogoImage } from '@/app/components/ParoisseLogoImage'
import { Widgets } from '@/app/components/widgets/Widgets'
import { NavIcon, Menu, UserCircle, LogOut, type LucideIcon } from '@/lib/icons'

type MenuItem = {
  label: string
  href: string
  icone: LucideIcon
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
    const item = { label: 'Mes enfants', href: '/dashboard/mes-enfants', icone: NavIcon.mesEnfants }
    const indexApresParoisse = items.findIndex((m) => m.href === '/dashboard/paroisse')
    const position = indexApresParoisse >= 0 ? indexApresParoisse + 1 : items.length
    menu = [...items.slice(0, position), item, ...items.slice(position)]
  }
  if (roleDistrict) {
    menu = [...menu, { label: 'Espace district', href: '/district', icone: NavIcon.espaceDistrict }]
  }
  return menu
}

function getMenuItemsDeBase(role: string): MenuItem[] {
  switch (role) {
    case 'CHEF_GROUPE':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: NavIcon.tableauDeBord },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: NavIcon.paroisse },
        { label: 'Membres', href: '/dashboard/utilisateurs', icone: NavIcon.membres },
        { label: 'Parents', href: '/dashboard/parents', icone: NavIcon.parents },
        { label: 'Branches', href: '/dashboard/branches', icone: NavIcon.branches },
        { label: 'Scouts', href: '/dashboard/scouts', icone: NavIcon.scouts },
        { label: 'Documents', href: '/dashboard/documents', icone: NavIcon.documents },
        { label: 'Calendrier', href: '/dashboard/calendrier', icone: NavIcon.calendrier },
        { label: 'Cotisations', href: '/dashboard/cotisations', icone: NavIcon.cotisations },
        { label: 'Activités', href: '/dashboard/activites', icone: NavIcon.activites },
        { label: 'Réunions', href: '/dashboard/reunions', icone: NavIcon.reunions },
        { label: 'Programmes', href: '/dashboard/programmes', icone: NavIcon.programmes },
        { label: 'Rapports', href: '/dashboard/rapports', icone: NavIcon.rapports },
      ]
    case 'ADJOINT_GROUPE':
    case 'ASSISTANT_GROUPE':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: NavIcon.tableauDeBord },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: NavIcon.paroisse },
        { label: 'Branches', href: '/dashboard/branches', icone: NavIcon.branches },
        { label: 'Scouts', href: '/dashboard/scouts', icone: NavIcon.scouts },
        { label: 'Documents', href: '/dashboard/documents', icone: NavIcon.documents },
        { label: 'Calendrier', href: '/dashboard/calendrier', icone: NavIcon.calendrier },
        { label: 'Cotisations', href: '/dashboard/cotisations', icone: NavIcon.cotisations },
        { label: 'Activités', href: '/dashboard/activites', icone: NavIcon.activites },
        { label: 'Réunions', href: '/dashboard/reunions', icone: NavIcon.reunions },
        { label: 'Programmes', href: '/dashboard/programmes', icone: NavIcon.programmes },
      ]
    case 'RESPONSABLE_BRANCHE':
    case 'ADJOINT_BRANCHE':
    case 'ASSISTANT_BRANCHE':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: NavIcon.tableauDeBord },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: NavIcon.paroisse },
        { label: 'Ma branche', href: '/dashboard/ma-branche', icone: NavIcon.maBranche },
        { label: 'Scouts', href: '/dashboard/scouts', icone: NavIcon.scouts },
        { label: 'Documents', href: '/dashboard/documents', icone: NavIcon.documents },
        { label: 'Calendrier', href: '/dashboard/calendrier', icone: NavIcon.calendrier },
        { label: 'Cotisations', href: '/dashboard/cotisations', icone: NavIcon.cotisations },
        { label: 'Activités', href: '/dashboard/activites', icone: NavIcon.activites },
        { label: 'Réunions', href: '/dashboard/reunions', icone: NavIcon.reunions },
        { label: 'Programmes', href: '/dashboard/programmes', icone: NavIcon.programmes },
        { label: 'Présences', href: '/dashboard/presences', icone: NavIcon.presences },
      ]
    case 'PARENT':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: NavIcon.tableauDeBord },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: NavIcon.paroisse },
        { label: 'Mes enfants', href: '/dashboard/mes-enfants', icone: NavIcon.mesEnfants },
      ]
    case 'SCOUT':
      return [
        { label: 'Tableau de bord', href: '/dashboard', icone: NavIcon.tableauDeBord },
        { label: 'Paroisse', href: '/dashboard/paroisse', icone: NavIcon.paroisse },
        { label: 'Ma progression', href: '/dashboard/ma-progression', icone: NavIcon.maProgression },
      ]
    default:
      return [{ label: 'Tableau de bord', href: '/dashboard', icone: NavIcon.tableauDeBord }]
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
      <div className="flex-shrink-0 border-b border-white/10 px-6 py-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
          >
            <ParoisseLogoImage logoUrl={logoUrl} taille="xl" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-semibold text-white">{nomSite}</p>
            <p className="truncate text-xs text-white/55">{sousTitreSite}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="scrollbar-fine flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {menuItems.map((item) => {
            const actif = pathname === item.href
            const Icone = item.icone
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`snav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    actif ? 'snav-active' : ''
                  }`}
                >
                  <Icone className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Pied de sidebar */}
      <div className="flex-shrink-0 border-t border-white/10 px-4 py-4">
        <p className="mb-0.5 truncate text-xs text-white/55">{nomComplet}</p>
        <p className="mb-3 text-xs font-medium" style={{ color: 'var(--ca)' }}>{libelleRole(role)}</p>
        <Link
          href="/dashboard/profil"
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

export function DashboardShell({
  children,
  role,
  roleDistrict,
  paroisseId,
  nomComplet,
  logoUrl,
  nomSite,
  sousTitreSite,
  aDesEnfants = false,
}: {
  children: React.ReactNode
  role: string
  roleDistrict?: string | null
  paroisseId: string | null
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
    <div className="flex h-dvh overflow-hidden bg-gray-50 print:h-auto print:overflow-visible">

      {/* Overlay mobile */}
      {sidebarOuverte && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOuverte(false)}
        />
      )}

      {/* Sidebar desktop */}
      <aside className="hidden w-64 flex-shrink-0 flex-col lg:flex print:hidden" style={sidebarStyle}>
        <SidebarContent menuItems={menuItems} {...sidebarProps} />
      </aside>

      {/* Sidebar mobile (drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col transition-transform duration-300 lg:hidden print:hidden ${
          sidebarOuverte ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={sidebarStyle}
      >
        <SidebarContent menuItems={menuItems} {...sidebarProps} onNavigate={() => setSidebarOuverte(false)} />
      </aside>

      {/* Zone principale */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">

        {/* Header */}
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4 print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOuverte(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
            </button>
            <h2 className="truncate text-sm font-semibold text-gray-800">{titrePage}</h2>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium text-gray-800">{nomComplet}</p>
              <p className="text-xs text-gray-500">{libelleRole(role)}</p>
            </div>
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white sm:h-9 sm:w-9"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {initiale}
            </div>
          </div>
        </header>

        {/* Contenu */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0">{children}</main>
      </div>

      <Widgets role={role} paroisseId={paroisseId} />
    </div>
  )
}
