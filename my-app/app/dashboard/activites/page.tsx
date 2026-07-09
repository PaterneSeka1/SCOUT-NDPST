'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useActivites, useSupprimerActivite } from '@/hooks/useActivites'
import { LABELS_TYPE_ACTIVITE, COULEURS_TYPE_ACTIVITE } from '@/lib/activites'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'
import { confirmer } from '@/app/components/ConfirmDialog'

type Activite = {
  id: string
  titre: string
  type: string
  brancheType: string | null
  dateDebut: string
  lieu: string | null
  _count: { presences: number }
}

const ICONES_TYPE: Record<string, string> = {
  CAMP: '⛺', SORTIE: '🥾', SERVICE: '🤝', CELEBRATION: '🎉', FORMATION: '📚', REUNION: '📋', AUTRE: '📌',
}

function formaterDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-40" />
      <div className="flex gap-2">
        <div className="h-5 bg-gray-100 rounded-full w-16" />
        <div className="h-5 bg-gray-100 rounded-full w-20" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-24" />
      <div className="flex gap-3 pt-1">
        <div className="h-3 bg-gray-100 rounded w-10" />
        <div className="h-3 bg-gray-100 rounded w-14" />
        <div className="h-3 bg-gray-100 rounded w-16" />
      </div>
    </div>
  )
}

function CarteActivite({ activite, onSupprimer }: { activite: Activite; onSupprimer: (id: string, titre: string) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0 mt-0.5">{ICONES_TYPE[activite.type] ?? '📋'}</span>
        <p className="text-sm font-semibold text-gray-900 leading-tight">{activite.titre}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_TYPE_ACTIVITE[activite.type] ?? 'bg-gray-100 text-gray-700'}`}>
          {LABELS_TYPE_ACTIVITE[activite.type] ?? activite.type}
        </span>
        {activite.brancheType ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_BRANCHES[activite.brancheType] ?? 'bg-gray-100 text-gray-700'}`}>
            {LABELS_BRANCHES[activite.brancheType] ?? activite.brancheType}
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic">Toutes branches</span>
        )}
      </div>

      <p className="text-xs text-gray-500">
        {formaterDate(activite.dateDebut)}
        {activite.lieu && ` · ${activite.lieu}`}
        {' · '}{activite._count.presences} présence{activite._count.presences !== 1 ? 's' : ''}
      </p>

      <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
        <Link href={`/dashboard/activites/${activite.id}`} className="text-[#1a4731] font-medium text-xs hover:underline">Voir</Link>
        <span className="text-gray-200">|</span>
        <Link href={`/dashboard/activites/${activite.id}/modifier`} className="text-blue-600 font-medium text-xs hover:underline">Modifier</Link>
        <span className="text-gray-200">|</span>
        <button onClick={() => onSupprimer(activite.id, activite.titre)} className="text-red-600 font-medium text-xs hover:text-red-700 hover:underline">Supprimer</button>
      </div>
    </div>
  )
}

export default function PageActivites() {
  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const [filtreType, setFiltreType] = useState('')
  const [filtreBranche, setFiltreBranche] = useState('')

  const { data, isLoading, error } = useActivites({ page, recherche, type: filtreType, brancheType: filtreBranche })
  const supprimerActivite = useSupprimerActivite()

  const activites: Activite[] = data?.activites ?? []
  const pagination = data?.pagination

  async function handleSupprimer(id: string, titre: string) {
    const ok = await confirmer({
      titre: `Supprimer "${titre}" ?`,
      description: 'Cette activité et toutes les présences qui y sont enregistrées seront définitivement supprimées. Cette action est irréversible.',
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try { await supprimerActivite.mutateAsync(id) } catch (err) { toast.error((err as Error).message) }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Activités</h1>
        <Link
          href="/dashboard/activites/nouvelle"
          className="inline-flex items-center justify-center gap-2 bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#15392a] transition-colors text-sm font-medium"
        >
          + Nouvelle activité
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Rechercher une activité…"
          value={recherche}
          onChange={(e) => { setRecherche(e.target.value); setPage(1) }}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
        />
        <div className="flex gap-2">
          <select
            value={filtreType}
            onChange={(e) => { setFiltreType(e.target.value); setPage(1) }}
            className="flex-1 sm:flex-none sm:w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
          >
            <option value="">Tous types</option>
            {Object.entries(LABELS_TYPE_ACTIVITE).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select
            value={filtreBranche}
            onChange={(e) => { setFiltreBranche(e.target.value); setPage(1) }}
            className="flex-1 sm:flex-none sm:w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
          >
            <option value="">Toutes branches</option>
            {Object.entries(LABELS_BRANCHES).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Erreur */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">Erreur lors du chargement</div>}

      {/* Vue mobile — cartes */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : activites.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="font-medium">Aucune activité</p>
            <p className="text-sm mt-1">Créez votre première activité pour commencer</p>
          </div>
        ) : (
          activites.map((a) => <CarteActivite key={a.id} activite={a} onSupprimer={handleSupprimer} />)
        )}
      </div>

      {/* Vue desktop — tableau */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
        ) : activites.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="font-medium">Aucune activité</p>
            <p className="text-sm mt-1">Créez votre première activité pour commencer</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Titre', 'Type', 'Branche', 'Date', 'Présences', ''].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activites.map((activite) => (
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
                      ) : <span className="text-gray-400 text-xs italic">Toutes</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formaterDate(activite.dateDebut)}</td>
                    <td className="px-4 py-3 text-gray-600">{activite._count.presences}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/activites/${activite.id}`} className="text-[#1a4731] hover:text-[#15392a] font-medium text-xs">Voir</Link>
                        <Link href={`/dashboard/activites/${activite.id}/modifier`} className="text-blue-600 hover:text-blue-800 font-medium text-xs">Modifier</Link>
                        <button onClick={() => handleSupprimer(activite.id, activite.titre)} className="text-red-600 hover:text-red-800 font-medium text-xs">Supprimer</button>
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
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-gray-600">
            {pagination.total} activité{pagination.total !== 1 ? 's' : ''} — p. {pagination.page}/{pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">←</button>
            <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">→</button>
          </div>
        </div>
      )}
    </div>
  )
}
