'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES } from '@scout/shared'
import { LABELS_TYPE_ACTIVITE } from '@scout/shared'
import { ClipboardList, ArrowRight } from '@/lib/icons'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'

interface Activite {
  id: string
  titre: string
  dateDebut: string
  dateFin: string | null
  type: string
  lieu: string | null
  brancheType: string | null
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
    fetch(`/api/activites?page=${page}&limite=${parPage}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) {
          setErreur(data.erreur)
          return
        }
        setErreur('')
        setActivites(data.activites ?? [])
        setTotal(data.pagination?.total ?? 0)
      })
      .catch(() => setErreur('Impossible de charger les activités'))
      .finally(() => setChargement(false))
  }, [page])

  const nbPages = Math.ceil(total / parPage)

  if (chargement)
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
      </div>
    )

  if (erreur)
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Présences</h1>
        <p className="mt-0.5 text-sm text-gray-500">Gérez les feuilles de présence par activité</p>
      </div>

      {activites.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            icon={ClipboardList}
            title="Aucune activité enregistrée"
            action={
              <Link
                href="/dashboard/activites/nouvelle"
                className="inline-flex items-center gap-1 text-sm font-medium text-(--cp) hover:underline"
              >
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
              <div key={a.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-(--cp)/10">
                  <span className="text-xs leading-none font-bold text-(--cp)">
                    {date.toLocaleDateString('fr-FR', { day: '2-digit' })}
                  </span>
                  <span className="mt-0.5 text-xs leading-none text-(--cp)/70">
                    {date.toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{a.titre}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                        <span className="truncate text-xs text-gray-500">{a.lieu}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${passee ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}`}
                  >
                    {passee ? `${a._count.presences} présent${a._count.presences > 1 ? 's' : ''}` : 'À venir'}
                  </span>
                  <Link
                    href={`/dashboard/activites/${a.id}/presences`}
                    className="rounded-lg bg-(--cp) px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white transition-all hover:brightness-110"
                  >
                    {passee ? 'Voir / Modifier' : 'Préparer'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={nbPages}
        onPageChange={(suivante) => {
          setChargement(true)
          setErreur('')
          setPage(suivante)
        }}
        total={total}
        itemLabel="activité"
      />
    </div>
  )
}
