'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const pathname = usePathname()

  const role = session?.user?.role ?? ''
  const menuItems = getMenuItems(role)
  const nomComplet = session?.user
    ? `${session.user.prenom} ${session.user.nom}`
    : '…'

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <aside className="w-64 bg-[#1a4731] flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-[#27ae60]/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚜️</span>
            <div>
              <p className="text-white font-bold text-sm leading-tight">SCOUT ASCCI</p>
              <p className="text-[#a8d5b5] text-xs">Côte d&apos;Ivoire</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const actif = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
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

        <div className="px-4 py-4 border-t border-[#27ae60]/30">
          <p className="text-[#a8d5b5] text-xs truncate mb-1">{nomComplet}</p>
          <p className="text-[#f39c12] text-xs font-medium mb-3">
            {libelleRole(role)}
          </p>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-xs text-[#a8d5b5] hover:text-white hover:bg-red-700/40 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>🚪</span>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-gray-800 font-semibold text-sm">
              {menuItems.find((m) => m.href === pathname)?.label ?? 'Tableau de bord'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-800">{nomComplet}</p>
              <p className="text-xs text-gray-500">{libelleRole(role)}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#1a4731] flex items-center justify-center text-white text-sm font-bold">
              {session?.user?.prenom?.[0] ?? '?'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
