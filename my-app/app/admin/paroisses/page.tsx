'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MONO_PAROISSE } from '@/lib/monoParoisse'
import { ArrowRight } from '@/lib/icons'

interface Paroisse {
  id: string
  nom: string
  ville: string
  diocese: string
  actif: boolean
  counts: { scouts: number; utilisateurs: number; activites: number }
  chefGroupe: { id: string; nom: string; prenom: string } | null
}

function StatutParoisse({ actif }: { actif: boolean }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
      {actif ? 'Active' : 'Désactivée'}
    </span>
  )
}

function EtatVide({ rechercheActive }: { rechercheActive: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center">
      <p className="text-sm font-medium text-gray-700">
        {rechercheActive ? 'Aucune paroisse trouvée' : 'Aucune paroisse enregistrée'}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        {rechercheActive ? 'Essayez avec un autre nom, une ville ou un diocèse.' : 'Ajoutez une première paroisse pour démarrer.'}
      </p>
    </div>
  )
}

export default function ListeParoisses() {
  const [paroisses, setParoisses] = useState<Paroisse[]>([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState('')

  useEffect(() => {
    fetch('/api/admin/paroisses')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then(setParoisses)
      .catch(() => toast.error('Impossible de charger les paroisses.'))
      .finally(() => setChargement(false))
  }, [])

  const rechercheNorm = recherche.trim().toLowerCase()
  const paroissesFiltrees = rechercheNorm
    ? paroisses.filter((p) =>
        p.nom.toLowerCase().includes(rechercheNorm) ||
        p.ville.toLowerCase().includes(rechercheNorm) ||
        p.diocese.toLowerCase().includes(rechercheNorm)
      )
    : paroisses

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Paroisses</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {paroisses.length} paroisse{paroisses.length > 1 ? 's' : ''} enregistrée{paroisses.length > 1 ? 's' : ''}
          </p>
        </div>
        {(!MONO_PAROISSE || paroisses.length === 0) && (
          <Link
            href="/admin/paroisses/nouvelle"
            className="w-full sm:w-auto flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-bold text-white hover:brightness-110 transition text-center"
            style={{ backgroundColor: 'var(--cp)' }}
          >
            + Nouvelle paroisse
          </Link>
        )}
      </div>

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher une paroisse…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--cp)] bg-white"
        />
      </div>

      {paroissesFiltrees.length === 0 ? (
        <EtatVide rechercheActive={Boolean(rechercheNorm)} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {paroissesFiltrees.map((p) => (
              <Link
                key={p.id}
                href={`/admin/paroisses/${p.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-gray-300 hover:shadow-md active:scale-[0.99] transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-gray-900 leading-snug break-words">{p.nom}</h2>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed break-words">
                      {p.ville} — {p.diocese}
                    </p>
                  </div>
                  <StatutParoisse actif={p.actif} />
                </div>

                <div className="mt-4 border-t border-gray-100 pt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] uppercase font-semibold text-gray-400">Scouts</p>
                    <p className="text-lg font-bold text-gray-900">{p.counts.scouts}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase font-semibold text-gray-400">Utilisateurs</p>
                    <p className="text-lg font-bold text-gray-900">{p.counts.utilisateurs}</p>
                  </div>
                </div>

                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-[11px] uppercase font-semibold text-gray-400">Chef de groupe</p>
                  {p.chefGroupe ? (
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{p.chefGroupe.prenom} {p.chefGroupe.nom}</p>
                  ) : (
                    <p className="text-sm font-medium text-orange-600 mt-0.5">À désigner</p>
                  )}
                </div>

                <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--cp)' }}>
                  Voir la fiche
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </p>
              </Link>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Paroisse</th>
                    <th className="px-4 py-3">Chef de groupe</th>
                    <th className="px-4 py-3 text-center">Scouts</th>
                    <th className="px-4 py-3 text-center">Utilisateurs</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paroissesFiltrees.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => (window.location.href = `/admin/paroisses/${p.id}`)}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.nom}</p>
                        <p className="text-xs text-gray-500">{p.ville} — {p.diocese}</p>
                      </td>
                      <td className="px-4 py-3">
                        {p.chefGroupe ? (
                          <span className="text-gray-700">{p.chefGroupe.prenom} {p.chefGroupe.nom}</span>
                        ) : (
                          <span className="text-orange-600 text-xs font-medium">À désigner</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{p.counts.scouts}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{p.counts.utilisateurs}</td>
                      <td className="px-4 py-3 text-center">
                        <StatutParoisse actif={p.actif} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
