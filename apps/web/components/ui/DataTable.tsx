'use client'

import { ChevronDown, ChevronUp } from '@/lib/icons'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { Skeleton } from './Skeleton'
import type { LucideIcon } from '@/lib/icons'

export interface Colonne<T> {
  cle: string
  titre: string
  rendu: (ligne: T) => React.ReactNode
  /** Clé de tri envoyée à l'API (tri serveur). */
  tri?: string
  className?: string
  /** Masquée sous ce point de rupture (les cartes mobiles l'affichent quand même). */
  masquee?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** Libellé principal de la carte mobile. */
  principale?: boolean
}

export interface Tri {
  cle: string
  sens: 'asc' | 'desc'
}

const MASQUE: Record<string, string> = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell', '2xl': 'hidden 2xl:table-cell' }

/**
 * Tableau de données : tri serveur, chargement, erreur, état vide, actions
 * contextuelles, et rendu en cartes sur mobile (aucun défilement horizontal).
 */
export function DataTable<T>({
  colonnes,
  lignes,
  cleLigne,
  chargement,
  erreur,
  onReessayer,
  tri,
  onTri,
  actions,
  onLigne,
  vide,
  legende,
}: {
  colonnes: Colonne<T>[]
  lignes: T[] | undefined
  cleLigne: (ligne: T) => string
  chargement?: boolean
  erreur?: string | null
  onReessayer?: () => void
  tri?: Tri
  onTri?: (tri: Tri) => void
  actions?: (ligne: T) => React.ReactNode
  onLigne?: (ligne: T) => void
  vide: { icone: LucideIcon; titre: string; description?: string; action?: React.ReactNode }
  legende: string
}) {
  if (erreur) return <ErrorState message={erreur} onReessayer={onReessayer} />

  if (chargement && !lignes) {
    return (
      <div role="status" aria-label="Chargement" className="space-y-2 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!lignes || lignes.length === 0) {
    return <EmptyState icon={vide.icone} title={vide.titre} description={vide.description} action={vide.action} />
  }

  const trier = (cle: string) => {
    if (!onTri) return
    onTri({ cle, sens: tri?.cle === cle && tri.sens === 'asc' ? 'desc' : 'asc' })
  }
  const principale = colonnes.find((c) => c.principale) ?? colonnes[0]

  return (
    <div className={chargement ? 'opacity-60 transition-opacity' : ''} aria-busy={chargement || undefined}>
      {/* Bureau */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{legende}</caption>
          <thead className="border-b border-stone-200 bg-stone-50/70 text-xs font-medium tracking-wide text-stone-500 uppercase">
            <tr>
              {colonnes.map((c) => (
                <th
                  key={c.cle}
                  scope="col"
                  className={`px-4 py-3 ${c.masquee ? MASQUE[c.masquee] : ''} ${c.className ?? ''}`}
                  aria-sort={tri?.cle === c.tri ? (tri?.sens === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.tri && onTri ? (
                    <button type="button" onClick={() => trier(c.tri!)} className="inline-flex items-center gap-1 uppercase hover:text-stone-800">
                      {c.titre}
                      {tri?.cle === c.tri &&
                        (tri.sens === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
                    </button>
                  ) : (
                    c.titre
                  )}
                </th>
              ))}
              {actions && (
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lignes.map((ligne) => (
              <tr
                key={cleLigne(ligne)}
                onClick={onLigne ? () => onLigne(ligne) : undefined}
                className={`bg-white ${onLigne ? 'cursor-pointer hover:bg-sable-50/60' : ''}`}
              >
                {colonnes.map((c) => (
                  <td key={c.cle} className={`px-4 py-3 align-middle text-stone-700 ${c.masquee ? MASQUE[c.masquee] : ''} ${c.className ?? ''}`}>
                    {c.rendu(ligne)}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">{actions(ligne)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile : cartes */}
      <ul className="divide-y divide-stone-100 md:hidden" aria-label={legende}>
        {lignes.map((ligne) => (
          <li key={cleLigne(ligne)} className="px-4 py-3">
            <div
              role={onLigne ? 'button' : undefined}
              tabIndex={onLigne ? 0 : undefined}
              onClick={onLigne ? () => onLigne(ligne) : undefined}
              onKeyDown={onLigne ? (e) => e.key === 'Enter' && onLigne(ligne) : undefined}
            >
              <div className="font-medium text-stone-900">{principale.rendu(ligne)}</div>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {colonnes
                  .filter((c) => c !== principale)
                  .map((c) => (
                    <div key={c.cle} className="min-w-0">
                      <dt className="text-stone-500">{c.titre}</dt>
                      <dd className="truncate text-stone-800">{c.rendu(ligne)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            {actions && <div className="mt-2 flex flex-wrap gap-1">{actions(ligne)}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}
