'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, LogIn, Menu, X } from '@/lib/icons'
import { ParoisseLogoImage } from '@/components/ParoisseLogoImage'
import { LIEN_REJOINDRE, RUBRIQUES_PUBLIQUES, lienActif, rubriqueActive, type RubriquePublique } from '@/lib/navigation-publique'

/**
 * Regroupement de liens (« Le groupe », « Activités ») : bouton de divulgation
 * (aria-expanded), fermeture par Échap, clic extérieur ou perte du focus.
 */
function Regroupement({ rubrique, chemin, clair }: { rubrique: RubriquePublique; chemin: string; clair: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  const conteneur = useRef<HTMLLIElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)
  const actif = rubriqueActive(chemin, rubrique)
  const id = `menu-${rubrique.libelle.toLowerCase().replace(/\W+/g, '-')}`

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
    <li
      ref={conteneur}
      className="relative"
      onBlur={(e) => {
        if (!conteneur.current?.contains(e.relatedTarget as Node)) setOuvert(false)
      }}
    >
      <button
        ref={bouton}
        type="button"
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={() => setOuvert((o) => !o)}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-[0.95rem] font-medium whitespace-nowrap transition ${
          clair ? 'text-white/90 hover:bg-white/10 hover:text-white' : 'text-encre-douce hover:bg-papier-fonce hover:text-encre'
        } ${actif ? (clair ? 'text-white' : 'text-encre') : ''}`}
      >
        {rubrique.libelle}
        <ChevronDown className={`h-4 w-4 transition ${ouvert ? 'rotate-180' : ''}`} aria-hidden />
        {actif && <span className="sr-only">(rubrique actuelle)</span>}
      </button>
      {actif && <span className="absolute inset-x-3 -bottom-[0.95rem] h-0.5 rounded-full bg-accent lg:-bottom-[1.2rem]" aria-hidden />}
      <div
        id={id}
        hidden={!ouvert}
        className="absolute top-full left-0 z-50 mt-3 w-72 overflow-hidden rounded-xl border border-ligne bg-white p-1.5 text-encre shadow-flottante"
      >
        <ul>
          {rubrique.liens!.map((l) => {
            const courant = lienActif(chemin, l.href)
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={courant ? 'page' : undefined}
                  onClick={() => setOuvert(false)}
                  className={`block rounded-lg px-3.5 py-2.5 transition ${courant ? 'bg-foret-50' : 'hover:bg-papier'}`}
                >
                  <span className={`block font-semibold ${courant ? 'text-primaire' : 'text-encre'}`}>{l.libelle}</span>
                  {l.description && <span className="mt-0.5 block text-sm text-encre-pale">{l.description}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </li>
  )
}

export function PublicHeader({ nomSite, sousTitre, logoUrl }: { nomSite: string; sousTitre: string; logoUrl: string }) {
  const chemin = usePathname()
  const [cheminOuvert, setCheminOuvert] = useState<string | null>(null)
  const ouvert = cheminOuvert === chemin
  const setOuvert = (valeur: boolean) => setCheminOuvert(valeur ? chemin : null)
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

  if (cheminOuvert !== null && cheminOuvert !== chemin) {
    setCheminOuvert(null)
  }

  // Transparent sur la photo d'ouverture de l'accueil, opaque ailleurs.
  const clair = surAccueil && !defile

  return (
    <header
      className={`sticky top-0 z-40 h-(--hauteur-entete) transition-colors duration-300 ${
        clair ? 'border-b border-transparent bg-transparent' : 'border-b border-ligne bg-papier/95 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label={`${nomSite} — accueil`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/5 lg:h-11 lg:w-11">
            <ParoisseLogoImage logoUrl={logoUrl} taille="md" />
          </span>
          {/* Le nom n'est jamais tronqué : il peut passer sur deux lignes. */}
          <span className="min-w-0 max-w-[15rem] sm:max-w-xs lg:max-w-[17rem] xl:max-w-sm">
            <span className={`titre-display block text-[1.05rem] leading-[1.15] font-semibold text-balance lg:text-lg ${clair ? 'text-white' : 'text-encre'}`}>
              {nomSite}
            </span>
            {sousTitre && (
              <span className={`mt-0.5 hidden text-xs leading-tight sm:block ${clair ? 'text-white/75' : 'text-encre-pale'}`}>{sousTitre}</span>
            )}
          </span>
        </Link>

        <nav aria-label="Navigation du site" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {RUBRIQUES_PUBLIQUES.map((r) =>
              r.liens ? (
                <Regroupement key={r.libelle} rubrique={r} chemin={chemin} clair={clair} />
              ) : (
                <li key={r.href} className="relative">
                  <Link
                    href={r.href!}
                    aria-current={lienActif(chemin, r.href!) ? 'page' : undefined}
                    className={`inline-flex rounded-md px-3 py-2 text-[0.95rem] font-medium whitespace-nowrap transition ${
                      clair ? 'text-white/90 hover:bg-white/10 hover:text-white' : 'text-encre-douce hover:bg-papier-fonce hover:text-encre'
                    } ${lienActif(chemin, r.href!) ? (clair ? 'text-white' : 'text-encre') : ''}`}
                  >
                    {r.libelle}
                  </Link>
                  {lienActif(chemin, r.href!) && (
                    <span className="absolute inset-x-3 -bottom-[0.95rem] h-0.5 rounded-full bg-accent lg:-bottom-[1.2rem]" aria-hidden />
                  )}
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/connexion"
            className={`hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition lg:inline-flex ${
              clair ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-encre-pale hover:bg-papier-fonce hover:text-encre'
            }`}
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Espace membres
          </Link>
          <Link
            href={LIEN_REJOINDRE.href}
            aria-current={lienActif(chemin, LIEN_REJOINDRE.href) ? 'page' : undefined}
            className="hidden items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-terracotta-600 sm:inline-flex"
          >
            {LIEN_REJOINDRE.libelle}
          </Link>
          <button
            type="button"
            className={`flex h-10 w-10 items-center justify-center rounded-full lg:hidden ${clair ? 'text-white hover:bg-white/15' : 'text-encre hover:bg-papier-fonce'}`}
            onClick={() => setOuvert(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={ouvert}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Menu mobile : plein écran, rubriques regroupées, actions en pied. */}
      <dialog
        ref={tiroir}
        aria-label="Menu du site"
        onCancel={(e) => {
          e.preventDefault()
          setOuvert(false)
        }}
        className="fixed inset-0 m-0 hidden h-dvh max-h-none w-full max-w-none flex-col bg-papier p-0 text-encre backdrop:bg-black/40 open:flex lg:hidden"
      >
        <div className="flex h-(--hauteur-entete) shrink-0 items-center justify-between border-b border-ligne px-4 sm:px-6">
          <span className="titre-display text-lg font-semibold">{nomSite}</span>
          <button type="button" onClick={() => setOuvert(false)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-papier-fonce" aria-label="Fermer le menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Navigation du site" className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <ul className="space-y-6">
            <li>
              <Link href="/" aria-current={chemin === '/' ? 'page' : undefined} className="titre-display block text-2xl font-semibold">
                Accueil
              </Link>
            </li>
            {RUBRIQUES_PUBLIQUES.map((r) =>
              r.liens ? (
                <li key={r.libelle}>
                  <p className="signal text-xs text-encre-pale">{r.libelle}</p>
                  <ul className="mt-2 space-y-1 border-l-2 border-ligne pl-4">
                    {r.liens.map((l) => (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          aria-current={lienActif(chemin, l.href) ? 'page' : undefined}
                          className={`titre-display block py-1 text-2xl font-semibold ${lienActif(chemin, l.href) ? 'text-primaire' : ''}`}
                        >
                          {l.libelle}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={r.href}>
                  <Link
                    href={r.href!}
                    aria-current={lienActif(chemin, r.href!) ? 'page' : undefined}
                    className={`titre-display block text-2xl font-semibold ${lienActif(chemin, r.href!) ? 'text-primaire' : ''}`}
                  >
                    {r.libelle}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
        <div className="grid shrink-0 gap-2 border-t border-ligne p-4 sm:grid-cols-2 sm:px-6">
          <Link href={LIEN_REJOINDRE.href} className="flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 font-semibold text-white">
            {LIEN_REJOINDRE.libelle}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/connexion" className="flex items-center justify-center gap-2 rounded-full border border-ligne-forte px-4 py-3 font-medium">
            <LogIn className="h-4 w-4" aria-hidden />
            Espace membres
          </Link>
        </div>
      </dialog>
    </header>
  )
}
