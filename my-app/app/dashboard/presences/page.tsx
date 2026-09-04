'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES } from '@/lib/branches'
import { LABELS_TYPE_ACTIVITE } from '@/lib/activites'
import { ClipboardList, ArrowRight } from '@/lib/icons'
import { EmptyState } from '@/app/components/ui/EmptyState'
import { Pagination } from '@/app/components/ui/Pagination'

interface Activite {
  id: string; titre: string; dateDebut: string; dateFin: string | null
  type: string; lieu: string | null; brancheType: string | null
  _count: { presences: number }
}

export default function PagePresences() {
  const [activites, setActivites] = useState<Activite[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const parPage = 15

  useEffect(() => {
    setChargement(true)
    fetch(`/api/activites?page=${page}&limite=${parPage}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setErreur(data.error); return }
        setActivites(data.activites ?? [])
        setTotal(data.pagination?.total ?? 0)
      })
      .catch(() => setErreur('Impossible de charger les activités'))
      .finally(() => setChargement(false))
  }, [page])

  const nbPages = Math.ceil(total / parPage)

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[var(--cp)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (erreur) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreur}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Présences</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez les feuilles de présence par activité</p>
      </div>

      {activites.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={ClipboardList}
            title="Aucune activité enregistrée"
            action={
              <Link href="/dashboard/activites/nouvelle" className="inline-flex items-center gap-1 text-sm text-[var(--cp)] font-medium hover:underline">
                Créer une activité
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {activites.map((a) => {
            const date = new Date(a.dateDebut)
            const passee = date < new Date()
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--cp)]/10 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-[var(--cp)] leading-none">
                    {date.toLocaleDateString('fr-FR', { day: '2-digit' })}
                  </span>
                  <span className="text-xs text-[var(--cp)]/70 leading-none mt-0.5">
                    {date.toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{a.titre}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-xs text-gray-500">{LABELS_TYPE_ACTIVITE[a.type] ?? a.type}</span>
                    {a.brancheType && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{LABELS_BRANCHES[a.brancheType] ?? a.brancheType}</span>
                      </>
                    )}
                    {a.lieu && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-500 truncate">{a.lieu}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${passee ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}>
                    {passee ? `${a._count.presences} présent${a._count.presences > 1 ? 's' : ''}` : 'À venir'}
                  </span>
                  <Link href={`/dashboard/activites/${a.id}/presences`}
                    className="text-sm bg-[var(--cp)] text-white px-3 py-1.5 rounded-lg hover:brightness-110 transition-all font-medium whitespace-nowrap">
                    {passee ? 'Voir / Modifier' : 'Préparer'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Pagination page={page} totalPages={nbPages} onPageChange={setPage} total={total} itemLabel="activité" />
    </div>
  )
}
