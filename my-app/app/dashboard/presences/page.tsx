'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES } from '@/lib/branches'

const LABELS_TYPE: Record<string, string> = {
  REUNION: 'Réunion', SORTIE: 'Sortie', CAMP: 'Camp', MESSE: 'Messe',
  CEREMONIE: 'Cérémonie', FORMATION: 'Formation', AUTRE: 'Autre',
}

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
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
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
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm text-gray-500">Aucune activité enregistrée</p>
          <Link href="/dashboard/activites/nouvelle" className="mt-4 inline-block text-sm text-[#1a4731] font-medium hover:underline">
            Créer une activité →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {activites.map((a) => {
            const date = new Date(a.dateDebut)
            const passee = date < new Date()
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#1a4731]/10 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-[#1a4731] leading-none">
                    {date.toLocaleDateString('fr-FR', { day: '2-digit' })}
                  </span>
                  <span className="text-xs text-[#1a4731]/70 leading-none mt-0.5">
                    {date.toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{a.titre}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-xs text-gray-500">{LABELS_TYPE[a.type] ?? a.type}</span>
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
                    className="text-sm bg-[#1a4731] text-white px-3 py-1.5 rounded-lg hover:bg-[#163d29] transition-colors font-medium whitespace-nowrap">
                    {passee ? 'Voir / Modifier' : 'Préparer'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {nbPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            ← Précédent
          </button>
          <span className="text-sm text-gray-500">Page {page} / {nbPages}</span>
          <button onClick={() => setPage((p) => Math.min(nbPages, p + 1))} disabled={page === nbPages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
