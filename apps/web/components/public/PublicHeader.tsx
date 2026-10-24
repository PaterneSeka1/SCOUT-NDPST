'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Menu, X } from '@/lib/icons'
import { ParoisseLogoImage } from '@/components/ParoisseLogoImage'
import { LIENS_PUBLICS } from '@/lib/navigation-publique'

export function PublicHeader({ nomSite, sousTitre, logoUrl }: { nomSite: string; sousTitre: string; logoUrl: string }) {
  const chemin = usePathname()
  const [ouvert, setOuvert] = useState(false)
  const [defile, setDefile] = useState(false)
  const tiroir = useRef<HTMLDialogElement>(null)
  const surAccueil = chemin === '/'

  useEffect(() => {
    const surDefilement = () => setDefile(window.scrollY > 24)
    surDefilement()
    window.addEventListener('scroll', surDefilement, { passive: true })
    return () => window.removeEventListener('scroll', surDefilement)
  }, [])

  useEffect(() => {
    if (ouvert) tiroir.current?.showModal()
    else tiroir.current?.close()
  }, [ouvert])

  useEffect(() => setOuvert(false), [chemin])

  // Transparent sur le hero de l'accueil, opaque ailleurs ou après défilement.
  const transparent = surAccueil && !defile
  const actif = (href: string) => chemin === href || chemin.startsWith(`${href}/`)

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        transparent ? 'bg-transparent text-white' : 'border-b border-stone-200/70 bg-creme/95 text-stone-800 backdrop-blur'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`${nomSite} — accueil`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/90 shadow-sm sm:h-12 sm:w-12">
            <ParoisseLogoImage logoUrl={logoUrl} taille="md" />
          </span>
          <span className="min-w-0">
            <span className="titre-display block truncate text-base leading-tight font-semibold sm:text-lg">{nomSite}</span>
            {sousTitre && <span className={`block truncate text-xs ${transparent ? 'text-white/80' : 'text-stone-500'}`}>{sousTitre}</span>}
          </span>
        </Link>

        <nav aria-label="Navigation du site" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {LIENS_PUBLICS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={actif(l.href) ? 'page' : undefined}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                    actif(l.href)
                      ? transparent
                        ? 'bg-white/20'
                        : 'bg-foret-50 text-primaire'
                      : transparent
                        ? 'hover:bg-white/15'
                        : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {l.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/nous-rejoindre"
            className="hidden rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 sm:inline-flex"
          >
            Nous rejoindre
          </Link>
          <Link
            href="/connexion"
            className={`hidden rounded-full px-3 py-2 text-sm font-medium sm:inline-flex ${transparent ? 'hover:bg-white/15' : 'text-stone-600 hover:bg-stone-100'}`}
          >
            Espace membres
          </Link>
          <button
            type="button"
            className={`flex h-10 w-10 items-center justify-center rounded-full xl:hidden ${transparent ? 'hover:bg-white/15' : 'hover:bg-stone-100'}`}
            onClick={() => setOuvert(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={ouvert}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <dialog
        ref={tiroir}
        aria-label="Menu du site"
        onCancel={(e) => {
          e.preventDefault()
          setOuvert(false)
        }}
        className="fixed inset-y-0 right-0 m-0 ml-auto hidden h-dvh max-h-none w-80 max-w-[88vw] flex-col bg-creme p-0 text-stone-800 backdrop:bg-black/50 open:flex xl:hidden"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <span className="titre-display font-semibold">Menu</span>
          <button type="button" onClick={() => setOuvert(false)} className="rounded-full p-2 hover:bg-stone-100" aria-label="Fermer le menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            <li>
              <Link href="/" className="block rounded-lg px-3 py-2.5 font-medium hover:bg-stone-100">
                Accueil
              </Link>
            </li>
            {LIENS_PUBLICS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={actif(l.href) ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-2.5 font-medium ${actif(l.href) ? 'bg-foret-50 text-primaire' : 'hover:bg-stone-100'}`}
                >
                  {l.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-2 border-t border-stone-200 p-4">
          <Link href="/nous-rejoindre" className="block rounded-full bg-accent px-4 py-2.5 text-center font-semibold text-white">
            Nous rejoindre
          </Link>
          <Link href="/connexion" className="block rounded-full border border-stone-300 px-4 py-2.5 text-center font-medium">
            Espace membres
          </Link>
        </div>
      </dialog>
    </header>
  )
}
