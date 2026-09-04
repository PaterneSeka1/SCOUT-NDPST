'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LABELS_ROLES } from '@/lib/roles'

export interface MembreRecherche {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  role: string
  paroisse?: { id: string; nom: string } | null
}

interface Props {
  id?: string
  label: string
  membres: MembreRecherche[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  required?: boolean
  placeholder?: string
  emptyMessage?: string
  error?: string
}

function normaliser(valeur: string) {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function libelleMembre(membre: MembreRecherche) {
  return `${membre.prenom} ${membre.nom}`
}

function texteRecherche(membre: MembreRecherche) {
  return normaliser([
    membre.prenom,
    membre.nom,
    membre.matricule,
    LABELS_ROLES[membre.role] ?? membre.role,
    membre.paroisse?.nom,
  ].filter(Boolean).join(' '))
}

export function SelecteurMembre({
  id,
  label,
  membres,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = 'Rechercher par nom, matricule, rôle ou paroisse…',
  emptyMessage = 'Aucun membre trouvé.',
  error,
}: Props) {
  const conteneurRef = useRef<HTMLDivElement>(null)
  const valeurPrecedenteRef = useRef('')
  const listeId = `${id ?? 'selecteur-membre'}-options`
  const [requete, setRequete] = useState('')
  const [ouvert, setOuvert] = useState(false)

  const membreSelectionne = useMemo(
    () => membres.find((membre) => membre.id === value) ?? null,
    [membres, value],
  )

  useEffect(() => {
    const valeurPrecedente = valeurPrecedenteRef.current
    if (value && membreSelectionne && value !== valeurPrecedente) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRequete(libelleMembre(membreSelectionne))
    }
    if (!value && valeurPrecedente && !ouvert) {
      setRequete('')
    }
    valeurPrecedenteRef.current = value
  }, [membreSelectionne, ouvert, value])

  useEffect(() => {
    if (!ouvert) return

    function fermerSiExterieur(event: MouseEvent) {
      if (!conteneurRef.current?.contains(event.target as Node)) setOuvert(false)
    }

    document.addEventListener('mousedown', fermerSiExterieur)
    return () => document.removeEventListener('mousedown', fermerSiExterieur)
  }, [ouvert])

  const membresFiltres = useMemo(() => {
    const recherche = normaliser(requete)
    const resultat = recherche
      ? membres.filter((membre) => texteRecherche(membre).includes(recherche))
      : membres

    return resultat.slice(0, 30)
  }, [membres, requete])

  const choisir = (membre: MembreRecherche) => {
    onChange(membre.id)
    setRequete(libelleMembre(membre))
    setOuvert(false)
  }

  const effacer = () => {
    onChange('')
    setRequete('')
    setOuvert(true)
  }

  return (
    <div ref={conteneurRef} className="relative">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        <input
          id={id}
          type="text"
          value={requete}
          disabled={disabled}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={ouvert}
          aria-controls={listeId}
          aria-autocomplete="list"
          autoComplete="off"
          onFocus={() => setOuvert(true)}
          onChange={(event) => {
            if (value) onChange('')
            setRequete(event.target.value)
            setOuvert(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOuvert(false)
            if (event.key === 'Enter' && ouvert && membresFiltres.length === 1) {
              event.preventDefault()
              choisir(membresFiltres[0])
            }
          }}
          className={`w-full border rounded-lg px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 ${
            error ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={effacer}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Changer de membre"
          >
            Effacer
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {membreSelectionne && (
        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-sm font-medium text-gray-900">{membreSelectionne.prenom} {membreSelectionne.nom}</p>
          <p className="text-xs text-gray-500">
            {membreSelectionne.matricule ?? 'Sans matricule'} — {LABELS_ROLES[membreSelectionne.role] ?? membreSelectionne.role}
            {membreSelectionne.paroisse ? ` — ${membreSelectionne.paroisse.nom}` : ''}
          </p>
        </div>
      )}

      {ouvert && !disabled && (
        <div id={listeId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {membresFiltres.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500">{emptyMessage}</p>
          ) : (
            <ul className="py-1">
              {membresFiltres.map((membre) => (
                <li key={membre.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={membre.id === value}
                    onClick={() => choisir(membre)}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${membre.id === value ? 'bg-green-50' : ''}`}
                  >
                    <span className="block text-sm font-medium text-gray-900">{membre.prenom} {membre.nom}</span>
                    <span className="block text-xs text-gray-500">
                      {membre.matricule ?? 'Sans matricule'} — {LABELS_ROLES[membre.role] ?? membre.role}
                      {membre.paroisse ? ` — ${membre.paroisse.nom}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
