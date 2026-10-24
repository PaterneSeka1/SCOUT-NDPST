'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LABELS_ROLES } from '@scout/shared'
import { signOut } from '@/lib/session-client'
import { navigationPour, pageAutorisee, rubriqueActive, type SectionNavigation } from '@/lib/navigation'
import { ChevronDown, ExternalLink, LogOut, Menu, ShieldCheck, UserCircle, X } from '@/lib/icons'
import { ParoisseLogoImage } from '@/components/ParoisseLogoImage'
import { RechercheGlobale } from '@/components/RechercheGlobale'
import { EmptyState } from '@/components/ui/EmptyState'

function Navigation({ sections, chemin, onNavigate }: { sections: SectionNavigation[]; chemin: string; onNavigate?: () => void }) {
  const active = rubriqueActive(sections, chemin)
  return (
    <nav aria-label="Navigation principale" className="scrollbar-fine flex-1 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.titre} className="mb-5 last:mb-0">
          <p className="signal mb-1.5 px-3 text-[0.7rem] text-white/50">{section.titre}</p>
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
                    className={`snav-link flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${actif ? 'snav-active' : ''}`}
                  >
                    <Icone className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    <span>{e.libelle}</span>
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
    <Link href="/dashboard" className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-4 focus-visible:outline-white">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
        <ParoisseLogoImage logoUrl={logoUrl} taille="md" />
      </span>
      {/* Le nom peut occuper deux lignes : jamais tronqué. */}
      <span className="min-w-0">
        <span className="titre-display block text-[0.95rem] leading-tight font-semibold text-balance text-white">{nomSite}</span>
        {sousTitreSite && <span className="mt-0.5 block text-xs leading-tight text-white/60">{sousTitreSite}</span>}
      </span>
    </Link>
  )
}

/** Menu du compte : profil, site public, déconnexion (bouton de divulgation). */
function MenuCompte({ nomComplet, role }: { nomComplet: string; role: string }) {
  const [ouvert, setOuvert] = useState(false)
  const conteneur = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!ouvert) return
    const surClic = (e: PointerEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false)
    }
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOuvert(false)
        bouton.current?.focus()
      }
    }
    document.addEventListener('pointerdown', surClic)
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('pointerdown', surClic)
      document.removeEventListener('keydown', surTouche)
    }
  }, [ouvert])

  return (
    <div ref={conteneur} className="relative">
      <button
        ref={bouton}
        type="button"
        aria-expanded={ouvert}
        aria-controls="menu-compte"
        onClick={() => setOuvert((o) => !o)}
        className="flex items-center gap-2.5 rounded-md py-1 pr-1.5 pl-1 hover:bg-papier"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primaire text-sm font-semibold text-white" aria-hidden>
          {nomComplet.charAt(0)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-medium text-encre">{nomComplet}</span>
          <span className="block text-xs text-encre-pale">{LABELS_ROLES[role] ?? role}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-encre-pale transition ${ouvert ? 'rotate-180' : ''}`} aria-hidden />
        <span className="sr-only">Menu du compte</span>
      </button>
      <div id="menu-compte" hidden={!ouvert} className="absolute right-0 z-40 mt-2 w-60 rounded-lg border border-ligne bg-white p-1.5 shadow-flottante">
        <p className="border-b border-ligne px-3 pt-1.5 pb-2.5 text-sm sm:hidden">
          <span className="block font-medium text-encre">{nomComplet}</span>
          <span className="text-encre-pale">{LABELS_ROLES[role] ?? role}</span>
        </p>
        <Link href="/dashboard/profil" onClick={() => setOuvert(false)} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-encre hover:bg-papier">
          <UserCircle className="h-4 w-4 text-encre-pale" aria-hidden /> Mon profil
        </Link>
        <Link href="/" className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-encre hover:bg-papier">
          <ExternalLink className="h-4 w-4 text-encre-pale" aria-hidden /> Voir le site public
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/connexion' })}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Déconnexion
        </button>
      </div>
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
    <div className="flex h-dvh overflow-hidden bg-papier print:h-auto print:overflow-visible">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Aller au contenu
      </a>

      <aside className="hidden w-68 shrink-0 flex-col bg-profond lg:flex print:hidden">
        <Entete {...enteteProps} />
        <Navigation sections={sections} chemin={chemin} />
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
          className="absolute top-3 right-3 z-10 rounded-md p-2 text-white/70 hover:bg-white/10"
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" />
        </button>
        <Entete {...enteteProps} />
        <Navigation sections={sections} chemin={chemin} onNavigate={() => setMenuOuvert(false)} />
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:overflow-visible">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-ligne bg-white px-4 sm:px-6 print:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-encre-douce hover:bg-papier lg:hidden"
              onClick={() => setMenuOuvert(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={menuOuvert}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden min-w-0 flex-1 md:block">
              <RechercheGlobale />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/" className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-encre-douce hover:bg-papier xl:inline-flex">
              <ExternalLink className="h-4 w-4" aria-hidden /> Voir le site
            </Link>
            <MenuCompte nomComplet={nomComplet} role={role} />
          </div>
        </header>

        <main id="contenu" className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:overflow-visible print:p-0">
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
