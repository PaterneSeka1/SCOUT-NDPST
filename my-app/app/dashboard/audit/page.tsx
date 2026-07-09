'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LABELS_ACTIONS_AUDIT } from '@/lib/audit-labels'
import { LABELS_ROLES } from '@/lib/roles'

interface EntreeAudit {
  id: string
  action: string
  entite: string
  entiteId: string | null
  details: Record<string, unknown> | null
  createdAt: string
  acteur: { id: string; nom: string; prenom: string; role: string } | null
}

const ENTITES = ['Utilisateur', 'Scout', 'Document', 'Cotisation']

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return ''
  return Object.entries(details)
    .map(([cle, valeur]) => `${cle} : ${valeur}`)
    .join(' · ')
}

export default function PageJournalAudit() {
  const [entrees, setEntrees] = useState<EntreeAudit[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filtreEntite, setFiltreEntite] = useState('')
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    setChargement(true)
    const params = new URLSearchParams({ page: String(page), limite: '30' })
    if (filtreEntite) params.set('entite', filtreEntite)
    fetch(`/api/audit?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { toast.error(data.erreur); return }
        setEntrees(data.entrees ?? [])
        setTotalPages(data.pagination?.totalPages ?? 1)
      })
      .catch(() => toast.error('Impossible de charger le journal'))
      .finally(() => setChargement(false))
  }, [page, filtreEntite])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Journal d&apos;audit</h1>
        <p className="text-sm text-gray-500 mt-0.5">Historique des actions sensibles (comptes, scouts, documents)</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Filtrer par type :</label>
          <select
            value={filtreEntite}
            onChange={(e) => { setFiltreEntite(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
          >
            <option value="">Tout</option>
            {ENTITES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {chargement ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entrees.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🗒️</p>
            <p className="text-sm text-gray-500">Aucune action enregistrée pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Auteur</th>
                  <th className="py-2 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody>
                {entrees.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-900 font-medium whitespace-nowrap">
                      {LABELS_ACTIONS_AUDIT[e.action] ?? e.action}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 whitespace-nowrap">
                      {e.acteur ? (
                        <>
                          {e.acteur.prenom} {e.acteur.nom}
                          <span className="text-xs text-gray-400 ml-1">({LABELS_ROLES[e.acteur.role] ?? e.acteur.role})</span>
                        </>
                      ) : (
                        <span className="text-gray-400 italic">Compte supprimé</span>
                      )}
                    </td>
                    <td className="py-2.5 text-gray-500 text-xs">{formatDetails(e.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Précédent
            </button>
            <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
