'use client'

import { useId, useRef } from 'react'

/** Onglets accessibles (flèches gauche/droite, rôle tablist). */
export function Tabs<T extends string>({
  onglets,
  actif,
  onChange,
  label,
}: {
  onglets: { valeur: T; libelle: string; compteur?: number }[]
  actif: T
  onChange: (valeur: T) => void
  label: string
}) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = onglets.findIndex((o) => o.valeur === actif)

  function clavier(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const suivant = (index + (e.key === 'ArrowRight' ? 1 : onglets.length - 1)) % onglets.length
    onChange(onglets[suivant].valeur)
    refs.current[suivant]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className="scrollbar-fine flex gap-1 overflow-x-auto border-b border-stone-200" onKeyDown={clavier}>
      {onglets.map((o, i) => {
        const selectionne = o.valeur === actif
        return (
          <button
            key={o.valeur}
            ref={(el) => {
              refs.current[i] = el
            }}
            id={`${id}-${o.valeur}`}
            role="tab"
            type="button"
            aria-selected={selectionne}
            tabIndex={selectionne ? 0 : -1}
            onClick={() => onChange(o.valeur)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              selectionne ? 'border-primaire text-primaire' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {o.libelle}
            {o.compteur !== undefined && (
              <span className="rounded-full bg-stone-100 px-1.5 text-xs text-stone-600 tabular-nums">{o.compteur}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
