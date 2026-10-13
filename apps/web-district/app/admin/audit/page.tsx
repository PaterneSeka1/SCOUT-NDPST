'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LABELS_ACTIONS_AUDIT } from '@scout/shared'
import { LABELS_ROLES } from '@scout/shared'
import { History } from '@/lib/icons'
import { EmptyState } from '@/app/components/ui/EmptyState'
import { PERIMETRE_V1 } from '@scout/shared'

interface EntreeAudit {
  id: string
  action: string
  entite: string
  entiteId: string | null
  details: Record<string, unknown> | null
  createdAt: string
  acteur: { id: string; nom: string; prenom: string; role: string } | null
  paroisse: { id: string; nom: string } | null
}

interface ParoisseOption {
  id: string
  nom: string
}

// Toutes les entités tracées dans le journal, tous rôles confondus (paroisse
// et plateforme) — voir les appels à enregistrerAudit() dans app/api.
// Documents et rapports plateforme : fonctionnalités hors périmètre V1.
const ENTITES_HORS_V1 = ['Document', 'RapportPlateforme']
const ENTITES = [
  'Utilisateur',
  'Scout',
  'Document',
  'Cotisation',
  'JourReunion',
  'Paroisse',
  'District',
  'RapportPlateforme',
].filter((e) => !(PERIMETRE_V1 && ENTITES_HORS_V1.includes(e)))

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return ''
  return Object.entries(details)
    .map(([cle, valeur]) => `${cle} : ${valeur}`)
    .join(' · ')
}

export default function PageJournalAuditPlateforme() {
  const [entrees, setEntrees] = useState<EntreeAudit[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filtreEntite, setFiltreEntite] = useState('')
  const [filtreParoisse, setFiltreParoisse] = useState('')
  const [paroisses, setParoisses] = useState<ParoisseOption[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    fetch('/api/admin/paroisses')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ParoisseOption[]) => setParoisses(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limite: '30' })
    if (filtreEntite) params.set('entite', filtreEntite)
    if (filtreParoisse) params.set('paroisseId', filtreParoisse)
    fetch(`/api/admin/audit?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) {
          toast.error(data.erreur)
          return
        }
        setEntrees(data.entrees ?? [])
        setTotalPages(data.pagination?.totalPages ?? 1)
      })
      .catch(() => toast.error('Impossible de charger le journal'))
      .finally(() => setChargement(false))
  }, [page, filtreEntite, filtreParoisse])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Journal d&apos;audit</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Historique des actions sensibles, toutes paroisses confondues (comptes, scouts, documents, paroisses,
          districts…)
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600">Filtrer par type :</label>
          <select
            value={filtreEntite}
            onChange={(e) => {
              setChargement(true)
              setFiltreEntite(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-(--cp) focus:outline-none"
          >
            <option value="">Tout</option>
            {ENTITES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>

          <label className="text-sm text-gray-600">Paroisse :</label>
          <select
            value={filtreParoisse}
            onChange={(e) => {
              setChargement(true)
              setFiltreParoisse(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-(--cp) focus:outline-none"
          >
            <option value="">Toutes</option>
            {paroisses.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </div>

        {chargement ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
          </div>
        ) : entrees.length === 0 ? (
          <EmptyState icon={History} title="Aucune action enregistrée pour le moment." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Paroisse</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Auteur</th>
                  <th className="py-2 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody>
                {entrees.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-gray-500">
                      {new Date(e.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">
                      {e.paroisse ? e.paroisse.nom : <span className="text-gray-400 italic">Plateforme</span>}
                    </td>
                    <td className="py-2.5 pr-4 font-medium whitespace-nowrap text-gray-900">
                      {LABELS_ACTIONS_AUDIT[e.action] ?? e.action}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">
                      {e.acteur ? (
                        <>
                          {e.acteur.prenom} {e.acteur.nom}
                          <span className="ml-1 text-xs text-gray-400">
                            ({LABELS_ROLES[e.acteur.role] ?? e.acteur.role})
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400 italic">Compte supprimé</span>
                      )}
                    </td>
                    <td className="py-2.5 text-xs text-gray-500">{formatDetails(e.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => {
                setChargement(true)
                setPage((p) => Math.max(1, p - 1))
              }}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              Précédent
            </button>
            <span className="text-sm text-gray-500">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => {
                setChargement(true)
                setPage((p) => Math.min(totalPages, p + 1))
              }}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
