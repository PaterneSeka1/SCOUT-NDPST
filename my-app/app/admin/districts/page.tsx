'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

interface District {
  doyenne: string
  key: string
  nbParoisses: number
  commissaire: { id: string; nom: string; prenom: string; actif: boolean } | null
}

function CommissaireDistrict({ commissaire }: { commissaire: District['commissaire'] }) {
  if (!commissaire) {
    return <span className="text-orange-600 text-xs font-medium">À désigner</span>
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-gray-700">{commissaire.prenom} {commissaire.nom}</span>
      {!commissaire.actif && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Désactivé</span>
      )}
    </span>
  )
}

function EtatVide({ rechercheActive }: { rechercheActive: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center">
      <p className="text-sm font-medium text-gray-700">
        {rechercheActive ? 'Aucun district trouvé' : 'Aucun district enregistré'}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        {rechercheActive ? 'Essayez avec un autre nom.' : 'Un district apparaît automatiquement dès qu’une paroisse a un doyenné renseigné.'}
      </p>
    </div>
  )
}

export default function ListeDistricts() {
  const [districts, setDistricts] = useState<District[]>([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState('')

  useEffect(() => {
    fetch('/api/admin/districts')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data: { districts: District[] }) => setDistricts(data.districts))
      .catch(() => toast.error('Impossible de charger les districts.'))
      .finally(() => setChargement(false))
  }, [])

  const rechercheNorm = recherche.trim().toLowerCase()
  const districtsFiltres = rechercheNorm
    ? districts.filter((d) => d.doyenne.toLowerCase().includes(rechercheNorm))
    : districts

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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Districts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {districts.length} district{districts.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher un district…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
        />
      </div>

      {districtsFiltres.length === 0 ? (
        <EtatVide rechercheActive={Boolean(rechercheNorm)} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {districtsFiltres.map((d) => (
              <Link
                key={d.key}
                href={`/admin/districts/${d.key}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-gray-300 hover:shadow-md active:scale-[0.99] transition"
              >
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 leading-snug break-words">{d.doyenne}</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {d.nbParoisses} paroisse{d.nbParoisses > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="text-[11px] uppercase font-semibold text-gray-400">Commissaire de District</p>
                  <div className="mt-0.5 text-sm font-medium">
                    <CommissaireDistrict commissaire={d.commissaire} />
                  </div>
                </div>

                <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--cp)' }}>Voir le district →</p>
              </Link>
            ))}
          </div>

          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">District</th>
                    <th className="px-4 py-3 text-center">Paroisses</th>
                    <th className="px-4 py-3">Commissaire de District</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {districtsFiltres.map((d) => (
                    <tr key={d.key} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => (window.location.href = `/admin/districts/${d.key}`)}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{d.doyenne}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{d.nbParoisses}</td>
                      <td className="px-4 py-3">
                        <CommissaireDistrict commissaire={d.commissaire} />
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
