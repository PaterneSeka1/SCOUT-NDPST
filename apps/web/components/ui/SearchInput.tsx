'use client'

import { useEffect, useState } from 'react'
import { Search, X } from '@/lib/icons'

/** Recherche avec temporisation : `onChange` n'est appelé qu'après la saisie. */
export function SearchInput({
  valeur,
  onChange,
  placeholder = 'Rechercher…',
  label = 'Rechercher',
  delai = 300,
  className = '',
}: {
  valeur: string
  onChange: (valeur: string) => void
  placeholder?: string
  label?: string
  delai?: number
  className?: string
}) {
  const [saisie, setSaisie] = useState(valeur)
  const [valeurPrecedente, setValeurPrecedente] = useState(valeur)

  if (valeur !== valeurPrecedente) {
    setValeurPrecedente(valeur)
    setSaisie(valeur)
  }

  useEffect(() => {
    if (saisie === valeur) return
    const minuteur = setTimeout(() => onChange(saisie), delai)
    return () => clearTimeout(minuteur)
  }, [saisie, valeur, onChange, delai])

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        placeholder={placeholder}
        className="block h-10 w-full rounded-lg border border-stone-300 bg-white pr-9 pl-9 text-sm shadow-sm placeholder:text-stone-400 focus:border-primaire focus:ring-2 focus:ring-primaire/20 focus:outline-none"
      />
      {saisie && (
        <button
          type="button"
          onClick={() => {
            setSaisie('')
            onChange('')
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700"
          aria-label="Effacer la recherche"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
