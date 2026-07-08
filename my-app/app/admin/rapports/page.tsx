'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface LigneParoisse {
  id: string; nom: string; ville: string; actif: boolean
  scouts: number; utilisateurs: number; activites: number; cotisations: number
}

interface Totaux {
  paroisses: number; paroissesActives: number; scouts: number; utilisateurs: number; activites: number
}

export default function RapportsPlateforme() {
  const [totaux, setTotaux] = useState<Totaux | null>(null)
  const [paroisses, setParoisses] = useState<LigneParoisse[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    fetch('/api/admin/rapports')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data) => { setTotaux(data.totaux); setParoisses(data.paroisses) })
      .catch(() => toast.error('Impossible de charger les rapports.'))
      .finally(() => setChargement(false))
  }, [])

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Rapports consolidés</h1>
        <p className="text-sm text-gray-500 mt-0.5">Comparatif de toutes les paroisses de la plateforme</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#1a4731] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{totaux?.paroissesActives ?? 0} / {totaux?.paroisses ?? 0}</p>
          <p className="text-xs opacity-90 mt-0.5">Paroisses actives</p>
        </div>
        <div className="bg-[#27ae60] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{totaux?.scouts ?? 0}</p>
          <p className="text-xs opacity-90 mt-0.5">Scouts</p>
        </div>
        <div className="bg-[#f39c12] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{totaux?.utilisateurs ?? 0}</p>
          <p className="text-xs opacity-90 mt-0.5">Utilisateurs</p>
        </div>
        <div className="bg-[#3498db] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{totaux?.activites ?? 0}</p>
          <p className="text-xs opacity-90 mt-0.5">Activités</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Paroisse</th>
                <th className="px-4 py-3 text-center">Scouts</th>
                <th className="px-4 py-3 text-center">Utilisateurs</th>
                <th className="px-4 py-3 text-center">Activités</th>
                <th className="px-4 py-3 text-center">Cotisations</th>
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paroisses.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.nom}</p>
                    <p className="text-xs text-gray-500">{p.ville}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{p.scouts}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{p.utilisateurs}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{p.activites}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{p.cotisations}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${p.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                      {p.actif ? 'Active' : 'Désactivée'}
                    </span>
                  </td>
                </tr>
              ))}
              {paroisses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucune paroisse enregistrée</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
