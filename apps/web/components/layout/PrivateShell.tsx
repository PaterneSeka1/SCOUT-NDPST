'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LABELS_ROLES } from '@scout/shared'
import { signOut } from '@/lib/session-client'
import { navigationPour, pageAutorisee, rubriqueActive, type SectionNavigation } from '@/lib/navigation'
import { ExternalLink, LogOut, Menu, UserCircle, X } from '@/lib/icons'
import { ParoisseLogoImage } from '@/components/ParoisseLogoImage'
import { EmptyState } from '@/components/ui/EmptyState'
import { ShieldCheck } from '@/lib/icons'

function Navigation({
  sections,
  chemin,
  onNavigate,
}: {
  sections: SectionNavigation[]
  chemin: string
  onNavigate?: () => void
}) {
  const active = rubriqueActive(sections, chemin)
  return (
    <nav aria-label="Navigation principale" className="scrollbar-fine flex-1 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.titre} className="mb-5 last:mb-0">
          <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-white/45 uppercase">{section.titre}</p>
          <ul className="space-y-0.5">
            {section.elements.map((e) => {
              const actif = active?.href === e.href
              const Icone = e.icone
              return (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    aria-current={actif ? 'page' : undefined}
                    onClick={onNavigate}
                    className={`snav-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${actif ? 'snav-active' : ''}`}
                  >
                    <Icone className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    <span className="truncate">{e.libelle}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Entete({ logoUrl, nomSite, sousTitreSite }: { logoUrl: string; nomSite: string; sousTitreSite: string }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
        <ParoisseLogoImage logoUrl={logoUrl} taille="md" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm leading-tight font-semibold text-white">{nomSite}</p>
        {sousTitreSite && <p className="truncate text-xs text-white/55">{sousTitreSite}</p>}
      </div>
    </div>
  )
}

function Pied({ nomComplet, role, onNavigate }: { nomComplet: string; role: string; onNavigate?: () => void }) {
  return (
    <div className="shrink-0 border-t border-white/10 px-4 py-4">
      <p className="truncate text-sm text-white">{nomComplet}</p>
      <p className="mb-3 text-xs text-or-300">{LABELS_ROLES[role] ?? role}</p>
      <Link
        href="/dashboard/profil"
        onClick={onNavigate}
        className="mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
      >
        <UserCircle className="h-4 w-4" aria-hidden /> Mon profil
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/connexion' })}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-red-500/20 hover:text-white"
      >
        <LogOut className="h-4 w-4" aria-hidden /> Déconnexion
      </button>
    </div>
  )
}

export function PrivateShell({
  children,
  role,
  editeurContenu,
  nomComplet,
  logoUrl,
  nomSite,
  sousTitreSite,
}: {
  children: React.ReactNode
  role: string
  editeurContenu: boolean
  nomComplet: string
  logoUrl: string
  nomSite: string
  sousTitreSite: string
}) {
  const chemin = usePathname()
  const [menuOuvert, setMenuOuvert] = useState(false)
  const tiroir = useRef<HTMLDialogElement>(null)
  const profil = useMemo(() => ({ role, editeurContenu }), [role, editeurContenu])
  const sections = useMemo(() => navigationPour(profil), [profil])
  const autorisee = pageAutorisee(profil, chemin)

  useEffect(() => {
    if (menuOuvert) tiroir.current?.showModal()
    else tiroir.current?.close()
  }, [menuOuvert])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const changement = (e: MediaQueryListEvent) => e.matches && setMenuOuvert(false)
    mq.addEventListener('change', changement)
    return () => mq.removeEventListener('change', changement)
  }, [])

  const enteteProps = { logoUrl, nomSite, sousTitreSite }

  return (
    <div className="flex h-dvh overflow-hidden bg-creme print:h-auto print:overflow-visible">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Aller au contenu
      </a>

      <aside className="hidden w-68 shrink-0 flex-col bg-profond lg:flex print:hidden">
        <Entete {...enteteProps} />
        <Navigation sections={sections} chemin={chemin} />
        <Pied nomComplet={nomComplet} role={role} />
      </aside>

      <dialog
        ref={tiroir}
        aria-label="Menu"
        onCancel={(e) => {
          e.preventDefault()
          setMenuOuvert(false)
        }}
        className="fixed inset-y-0 left-0 m-0 hidden h-dvh max-h-none w-72 max-w-[85vw] flex-col border-0 bg-profond p-0 backdrop:bg-black/50 open:flex lg:hidden"
      >
        <button
          type="button"
          onClick={() => setMenuOuvert(false)}
          className="absolute top-3 right-3 z-10 rounded-lg p-2 text-white/70 hover:bg-white/10"
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" />
        </button>
        <Entete {...enteteProps} />
        <Navigation sections={sections} chemin={chemin} onNavigate={() => setMenuOuvert(false)} />
        <Pied nomComplet={nomComplet} role={role} onNavigate={() => setMenuOuvert(false)} />
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 lg:hidden"
              onClick={() => setMenuOuvert(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={menuOuvert}
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="truncate text-sm font-medium text-stone-500 lg:hidden">{nomSite}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-stone-600 hover:bg-stone-100 sm:inline-flex">
              <ExternalLink className="h-4 w-4" aria-hidden /> Voir le site
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium text-stone-800">{nomComplet}</p>
              <p className="text-xs text-stone-500">{LABELS_ROLES[role] ?? role}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primaire text-sm font-semibold text-white" aria-hidden>
              {nomComplet.charAt(0)}
            </span>
          </div>
        </header>

        <main id="contenu" className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 print:overflow-visible print:p-0">
          <div className="mx-auto max-w-7xl">
            {autorisee ? (
              children
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="Cette rubrique ne fait pas partie de votre espace."
                description="Si vous pensez devoir y accéder, contactez le Chef de Groupe ou l'administrateur."
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
