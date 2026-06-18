'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useActivites } from '@/hooks/useActivites'
import { useSupprimerActivite } from '@/hooks/useActivites'
import { LABELS_TYPE_ACTIVITE, COULEURS_TYPE_ACTIVITE } from '@/lib/activites'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'

export default function PageActivites() {
  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const [filtreType, setFiltreType] = useState('')
  const [filtreBranche, setFiltreBranche] = useState('')

  const { data, isLoading, error } = useActivites({ page, recherche, type: filtreType, brancheType: filtreBranche })
  const supprimerActivite = useSupprimerActivite()

  const activites = data?.activites ?? []
  const pagination = data?.pagination

  function formaterDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  async function handleSupprimer(id: string, titre: string) {
    if (!confirm(`Supprimer l'activité "${titre}" ? Cette action est irréversible.`)) return
    try {
      await supprimerActivite.mutateAsync(id)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activités</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez les activités de votre groupe scout</p>
        </div>
        <Link
          href="/dashboard/activites/nouvelle"
          className="inline-flex items-center gap-2 bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#15392a] transition-colors text-sm font-medium"
        >
          <span>+</span>
          <span>Nouvelle activité</span>
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Rechercher une activité..."
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setPage(1) }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
          />
          <select
            value={filtreType}
            onChange={(e) => { setFiltreType(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
          >
            <option value="">Tous les types</option>
            {Object.entries(LABELS_TYPE_ACTIVITE).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select
            value={filtreBranche}
            onChange={(e) => { setFiltreBranche(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
          >
            <option value="">Toutes les branches</option>
            {Object.entries(LABELS_BRANCHES).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">Erreur lors du chargement</div>
        ) : activites.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg font-medium">Aucune activité</p>
            <p className="text-sm mt-1">Créez votre première activité pour commencer</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Titre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Branche</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Présences</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activites.map((activite: {
                  id: string
                  titre: string
                  type: string
                  brancheType: string | null
                  dateDebut: string
                  _count: { presences: number }
                }) => (
                  <tr key={activite.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{activite.titre}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_TYPE_ACTIVITE[activite.type] ?? 'bg-gray-100 text-gray-700'}`}>
                        {LABELS_TYPE_ACTIVITE[activite.type] ?? activite.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {activite.brancheType ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_BRANCHES[activite.brancheType] ?? 'bg-gray-100 text-gray-700'}`}>
                          {LABELS_BRANCHES[activite.brancheType] ?? activite.brancheType}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Toutes</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formaterDate(activite.dateDebut)}</td>
                    <td className="px-4 py-3 text-gray-600">{activite._count.presences} présence(s)</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/activites/${activite.id}`}
                          className="text-[#1a4731] hover:text-[#15392a] font-medium text-xs"
                        >
                          Voir
                        </Link>
                        <Link
                          href={`/dashboard/activites/${activite.id}/modifier`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                        >
                          Modifier
                        </Link>
                        <button
                          onClick={() => handleSupprimer(activite.id, activite.titre)}
                          className="text-red-600 hover:text-red-800 font-medium text-xs"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {pagination.total} activité(s) — page {pagination.page} sur {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
