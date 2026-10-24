import Link from 'next/link'
import { ArrowRight } from '@/lib/icons'

/** Dessin au trait : tente et courbes de niveau (décoratif, masqué aux lecteurs d'écran). */
function Illustration() {
  return (
    <svg viewBox="0 0 160 120" className="h-auto w-full max-w-[11rem]" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="1" opacity="0.35">
        <path d="M4 104c26-10 44-6 64-14s34-26 58-24 26 10 30 8" />
        <path d="M4 114c28-8 48-4 70-12s36-22 58-20 22 8 24 6" />
        <path d="M14 92c20-12 40-10 56-18s28-30 52-30 26 12 34 10" />
      </g>
      <g stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M44 98 80 34l36 64" />
        <path d="M80 34v64" />
        <path d="M80 98 68 76M80 98l12-22" />
        <path d="M30 98h100" />
        <path d="M80 34 74 24M80 34l6-10" />
      </g>
      <circle cx="128" cy="26" r="7" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/**
 * État vide du site public : compact (jamais un écran presque blanc),
 * contextualisé, avec des liens vers des contenus voisins réellement publiés.
 */
export function EtatVidePublic({
  titre,
  texte,
  liens = [],
  note,
}: {
  titre: string
  texte: React.ReactNode
  liens?: { libelle: string; href: string }[]
  note?: React.ReactNode
}) {
  return (
    <div className="relative grid items-center gap-8 overflow-hidden rounded-xl border border-ligne bg-white px-6 py-10 sm:grid-cols-[auto_1fr] sm:gap-12 sm:px-12">
      <div className="text-primaire sm:w-44">
        <Illustration />
      </div>
      <div>
        <h2 className="titre-display text-2xl leading-snug font-semibold text-balance text-encre sm:text-3xl">{titre}</h2>
        <div className="mt-3 max-w-xl leading-relaxed text-encre-douce">{texte}</div>
        {liens.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {liens.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="group inline-flex items-center gap-1.5 border-b-2 border-accent pb-0.5 font-semibold text-encre transition hover:text-accent"
                >
                  {l.libelle}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {note && <p className="mt-6 text-sm text-encre-pale">{note}</p>}
      </div>
    </div>
  )
}
