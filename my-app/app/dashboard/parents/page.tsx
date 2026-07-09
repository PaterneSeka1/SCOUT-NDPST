'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUtilisateurs, useModifierUtilisateur } from '@/hooks/useUtilisateurs'
import type { Utilisateur } from '@/hooks/useUtilisateurs'

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse space-y-3">
      <div className="flex justify-between">
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="h-5 bg-gray-100 rounded-full w-12" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-24" />
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 4 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  )
}

function CarteParent({ parent }: { parent: Utilisateur }) {
  const { mutateAsync, isPending } = useModifierUtilisateur(parent.id)
  const handleToggle = async () => { await mutateAsync({ actif: !parent.actif }) }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 leading-tight">
          {parent.nom} {parent.prenom}
        </p>
        <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          parent.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {parent.actif ? 'Actif' : 'Inactif'}
        </span>
      </div>

      <p className="text-xs text-gray-500 font-mono">{parent.telephone ?? '—'}</p>

      <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
        <Link
          href={`/dashboard/parents/${parent.id}/modifier`}
          className="text-[#1a4731] font-medium text-xs hover:underline"
        >
          Modifier
        </Link>
        <span className="text-gray-200">|</span>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`text-xs font-medium disabled:opacity-50 ${
            parent.actif ? 'text-red-600' : 'text-green-600'
          }`}
        >
          {isPending ? '…' : parent.actif ? 'Désactiver' : 'Activer'}
        </button>
      </div>
    </div>
  )
}

function LigneParent({ parent }: { parent: Utilisateur }) {
  const { mutateAsync, isPending } = useModifierUtilisateur(parent.id)
  const handleToggle = async () => { await mutateAsync({ actif: !parent.actif }) }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-gray-800 font-medium text-sm">
        {parent.nom} {parent.prenom}
      </td>
      <td className="px-4 py-3 font-mono text-gray-700 text-sm">{parent.telephone ?? '—'}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          parent.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {parent.actif ? 'Actif' : 'Inactif'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/parents/${parent.id}/modifier`}
            className="text-[#1a4731] hover:underline text-xs font-medium"
          >
            Modifier
          </Link>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleToggle}
            disabled={isPending}
            className={`text-xs font-medium disabled:opacity-50 ${
              parent.actif ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
            }`}
          >
            {isPending ? '…' : parent.actif ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function ParentsPage() {
  const [recherche, setRecherche] = useState('')
  const [rechercheDebounce, setRechercheDebounce] = useState('')
  const [page, setPage] = useState(1)
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleRechercheChange = (valeur: string) => {
    setRecherche(valeur)
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => { setRechercheDebounce(valeur); setPage(1) }, 300)
    setDebounceTimer(timer)
  }

  const { data, isLoading, isError, error } = useUtilisateurs({
    page,
    recherche: rechercheDebounce || undefined,
    role: 'PARENT',
  })

  const parents = data?.utilisateurs ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Parents</h1>
          <p className="text-sm text-gray-500">{total} parent{total !== 1 ? 's' : ''} dans votre paroisse</p>
        </div>
        <Link
          href="/dashboard/parents/nouveau"
          className="inline-flex items-center justify-center bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium"
        >
          + Nouveau parent
        </Link>
      </div>

      {/* Recherche */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Rechercher…"
          value={recherche}
          onChange={(e) => handleRechercheChange(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
        />
      </div>

      {/* Erreur */}
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error instanceof Error ? error.message : 'Une erreur est survenue'}
        </div>
      )}

      {/* Vue mobile — cartes */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : parents.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">Aucun parent trouvé.</p>
        ) : (
          parents.map((p) => <CarteParent key={p.id} parent={p} />)
        )}
      </div>

      {/* Vue desktop — tableau */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Nom Prénom', 'Téléphone', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : parents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-gray-400 text-sm">
                    Aucun parent trouvé.
                  </td>
                </tr>
              ) : (
                parents.map((p) => <LigneParent key={p.id} parent={p} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-gray-500">
            {total} parent{total !== 1 ? 's' : ''} — p. {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 transition-colors hover:bg-gray-50"
            >
              ←
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 transition-colors hover:bg-gray-50"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
