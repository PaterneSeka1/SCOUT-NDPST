'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'
import { useScouts, useModifierScout } from '@/hooks/useScouts'
import type { Scout } from '@/hooks/useScouts'

const ONGLETS = [
  { valeur: '', label: 'Tous' },
  { valeur: 'OISILLONS', label: 'Oisillons' },
  { valeur: 'LOUVETEAUX', label: 'Louveteaux' },
  { valeur: 'ECLAIREURS', label: 'Éclaireurs' },
  { valeur: 'CHEMINOTS', label: 'Cheminots' },
  { valeur: 'COMPAGNONS', label: 'Compagnons' },
]

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  )
}

function LigneScout({ scout }: { scout: Scout }) {
  const { mutateAsync, isPending } = useModifierScout(scout.id)

  const handleToggle = async () => {
    await mutateAsync({ actif: !scout.actif })
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-gray-800 font-medium">
        {scout.nom} {scout.prenom}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            COULEURS_BRANCHES[scout.brancheType] ?? 'bg-gray-100 text-gray-700'
          }`}
        >
          {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-gray-600 text-sm">
        {scout.matricule ?? <span className="text-gray-400 italic">—</span>}
      </td>
      <td className="px-4 py-3">
        {scout.actif ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Actif
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            Inactif
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/scouts/${scout.id}`}
            className="text-[#1a4731] hover:underline text-xs font-medium"
          >
            Voir
          </Link>
          <span className="text-gray-300">|</span>
          <Link
            href={`/dashboard/scouts/${scout.id}/modifier`}
            className="text-[#1a4731] hover:underline text-xs font-medium"
          >
            Modifier
          </Link>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleToggle}
            disabled={isPending}
            className={`text-xs font-medium transition-colors disabled:opacity-50 ${
              scout.actif
                ? 'text-red-600 hover:text-red-700'
                : 'text-green-600 hover:text-green-700'
            }`}
          >
            {isPending ? '…' : scout.actif ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function ScoutsPage() {
  const [brancheFiltre, setBrancheFiltre] = useState('')
  const [recherche, setRecherche] = useState('')
  const [rechercheDebounce, setRechercheDebounce] = useState('')
  const [page, setPage] = useState(1)
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleRechercheChange = (valeur: string) => {
    setRecherche(valeur)
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => {
      setRechercheDebounce(valeur)
      setPage(1)
    }, 300)
    setDebounceTimer(timer)
  }

  const handleBrancheChange = (valeur: string) => {
    setBrancheFiltre(valeur)
    setPage(1)
  }

  const { data, isLoading, isError, error } = useScouts({
    page,
    branche: brancheFiltre || undefined,
    recherche: rechercheDebounce || undefined,
  })

  const scouts = data?.scouts ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Scouts</h1>
        <Link
          href="/dashboard/scouts/nouveau"
          className="bg-[#1a4731] text-white px-4 py-2 rounded-md hover:bg-[#163d29] transition-colors text-sm font-medium"
        >
          + Inscrire un scout
        </Link>
      </div>

      {/* Onglets par branche */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto pb-px">
          {ONGLETS.map((onglet) => {
            const actif = brancheFiltre === onglet.valeur
            return (
              <button
                key={onglet.valeur}
                onClick={() => handleBrancheChange(onglet.valeur)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  actif
                    ? 'border-[#1a4731] text-[#1a4731]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {onglet.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Barre de recherche */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Rechercher par nom, prénom ou matricule…"
          value={recherche}
          onChange={(e) => handleRechercheChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm"
        />
      </div>

      {/* Message d'erreur */}
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error instanceof Error ? error.message : 'Une erreur est survenue'}
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nom Prénom
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Branche
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Matricule
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : scouts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-gray-400 text-sm">
                    Aucun scout trouvé.
                  </td>
                </tr>
              ) : (
                scouts.map((s) => <LigneScout key={s.id} scout={s} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} sur {totalPages} — {total} scout{total !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
