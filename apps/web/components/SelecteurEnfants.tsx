'use client'

import { useMemo, useRef, useState } from 'react'
import { useScouts } from '@/hooks/useScouts'
import type { Scout } from '@/hooks/useScouts'
import { LABELS_BRANCHES, ORDRE_CATEGORIES_SCOUTS } from '@scout/shared'
import { ChevronLeft, ChevronRight, X } from '@/lib/icons'

const CLS_INPUT =
  'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_SELECT =
  'sm:w-48 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent bg-white'

// Recherche paginée côté serveur : avec plusieurs milliers d'enfants dans la
// paroisse, on ne charge jamais toute la liste — seulement la page courante.
const LIMITE_SCOUTS_PAGE = 20

const OPTIONS_BRANCHES_SCOUT = [
  { valeur: '', label: 'Toutes les branches' },
  ...ORDRE_CATEGORIES_SCOUTS.map((branche) => ({ valeur: branche, label: LABELS_BRANCHES[branche] })),
]

export type ScoutLeger = Pick<Scout, 'id' | 'nom' | 'prenom' | 'brancheType' | 'matricule'>

interface Props {
  scoutIds: string[]
  onChange: (scoutIds: string[]) => void
  // Enfants déjà rattachés à préremplir au montage (édition d'un compte
  // existant) — sans ça, les puces resteraient vides jusqu'à ce que ces
  // scouts apparaissent dans une page de résultats de recherche.
  scoutsInitiaux?: ScoutLeger[]
}

// Sélecteur d'enfants (Scout) par nom/prénom/matricule/branche, avec recherche
// et pagination côté serveur. Utilisé partout où un compte Utilisateur (parent
// dédié, mais aussi un membre du staff qui est par ailleurs parent d'un scout
// de la paroisse) doit être rattaché à un ou plusieurs enfants.
export function SelecteurEnfants({ scoutIds, onChange, scoutsInitiaux }: Props) {
  const [rechercheScout, setRechercheScout] = useState('')
  const [rechercheScoutDebounce, setRechercheScoutDebounce] = useState('')
  const [brancheFiltreScout, setBrancheFiltreScout] = useState('')
  const [pageScouts, setPageScouts] = useState(1)
  // Conserve les enfants déjà cochés même quand ils sortent de la page/recherche
  // affichée, pour que les puces de sélection restent correctes.
  const [scoutsSelectionnesMap, setScoutsSelectionnesMap] = useState<Record<string, ScoutLeger>>(() =>
    Object.fromEntries((scoutsInitiaux ?? []).map((s) => [s.id, s])),
  )
  const debounceRechercheScoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Les enfants chargés après le montage complètent la sélection locale.
  const scoutsConnus = useMemo(
    () => ({ ...Object.fromEntries((scoutsInitiaux ?? []).map((s) => [s.id, s])), ...scoutsSelectionnesMap }),
    [scoutsInitiaux, scoutsSelectionnesMap],
  )

  const {
    data: scoutsData,
    isLoading: chargementScouts,
    isFetching: rechercheScoutEnCours,
    isError: erreurScouts,
  } = useScouts({
    actif: true,
    recherche: rechercheScoutDebounce || undefined,
    branche: brancheFiltreScout || undefined,
    page: pageScouts,
    limite: LIMITE_SCOUTS_PAGE,
  })

  const scouts = useMemo(() => scoutsData?.scouts ?? [], [scoutsData])
  const totalScouts = scoutsData?.total ?? 0
  const totalPagesScouts = scoutsData?.totalPages ?? 1
  const rechercheScoutActive = Boolean(rechercheScoutDebounce || brancheFiltreScout)
  const scoutsSelectionnes = useMemo(
    () => scoutIds.map((id) => scoutsConnus[id]).filter((s): s is ScoutLeger => Boolean(s)),
    [scoutIds, scoutsConnus],
  )

  const handleRechercheScoutChange = (valeur: string) => {
    setRechercheScout(valeur)
    if (debounceRechercheScoutRef.current) clearTimeout(debounceRechercheScoutRef.current)
    debounceRechercheScoutRef.current = setTimeout(() => {
      setRechercheScoutDebounce(valeur)
      setPageScouts(1)
    }, 300)
  }

  const handleBrancheScoutChange = (valeur: string) => {
    setBrancheFiltreScout(valeur)
    setPageScouts(1)
  }

  const basculerScout = (scout: ScoutLeger) => {
    const estSelectionne = scoutIds.includes(scout.id)
    onChange(estSelectionne ? scoutIds.filter((id) => id !== scout.id) : [...scoutIds, scout.id])
    setScoutsSelectionnesMap((p) => {
      if (!estSelectionne) return { ...p, [scout.id]: scout }
      const reste = { ...p }
      delete reste[scout.id]
      return reste
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-stone-700">Enfants rattachés</h3>
        <span className="text-xs text-stone-400">
          {scoutIds.length} enfant{scoutIds.length > 1 ? 's' : ''} sélectionné{scoutIds.length > 1 ? 's' : ''}
        </span>
      </div>

      {scoutsSelectionnes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {scoutsSelectionnes.map((scout) => (
            <button
              key={scout.id}
              type="button"
              onClick={() => basculerScout(scout)}
              className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800 hover:bg-green-100"
            >
              {scout.prenom} {scout.nom}
              <X className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={rechercheScout}
            onChange={(e) => handleRechercheScoutChange(e.target.value)}
            placeholder="Rechercher un enfant par nom, prénom ou matricule…"
            className={CLS_INPUT}
          />
          {rechercheScoutEnCours && !chargementScouts && (
            <span className="absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-stone-300 border-t-(--cp)" />
          )}
        </div>
        <select
          value={brancheFiltreScout}
          onChange={(e) => handleBrancheScoutChange(e.target.value)}
          className={CLS_SELECT}
        >
          {OPTIONS_BRANCHES_SCOUT.map((opt) => (
            <option key={opt.valeur} value={opt.valeur}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
        {chargementScouts ? (
          <div className="flex items-center justify-center py-8">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
          </div>
        ) : erreurScouts ? (
          <p className="px-4 py-4 text-sm text-red-600">Impossible de charger les scouts.</p>
        ) : scouts.length === 0 ? (
          <p className="px-4 py-4 text-sm text-stone-400">
            {rechercheScoutActive
              ? 'Aucun enfant ne correspond à la recherche.'
              : 'Aucun enfant actif dans la paroisse.'}
          </p>
        ) : (
          <>
            <div className="max-h-64 divide-y divide-stone-100 overflow-y-auto bg-white">
              {scouts.map((scout) => {
                const selectionne = scoutIds.includes(scout.id)
                return (
                  <label key={scout.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={selectionne}
                      onChange={() => basculerScout(scout)}
                      className="h-4 w-4 shrink-0 rounded accent-(--cp)"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-900">
                        {scout.prenom} {scout.nom}
                      </span>
                      <span className="block truncate text-xs text-stone-500">
                        {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
                        {scout.matricule ? ` · ${scout.matricule}` : ''}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-stone-100 bg-stone-50 px-4 py-2">
              <p className="text-xs text-stone-500">
                {totalScouts} enfant{totalScouts > 1 ? 's' : ''}
                {totalPagesScouts > 1 ? ` — page ${pageScouts}/${totalPagesScouts}` : ''}
              </p>
              {totalPagesScouts > 1 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPageScouts((p) => p - 1)}
                    disabled={pageScouts <= 1}
                    className="inline-flex items-center gap-1 rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-700 transition-colors hover:bg-white disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageScouts((p) => p + 1)}
                    disabled={pageScouts >= totalPagesScouts}
                    className="inline-flex items-center gap-1 rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-700 transition-colors hover:bg-white disabled:opacity-40"
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
