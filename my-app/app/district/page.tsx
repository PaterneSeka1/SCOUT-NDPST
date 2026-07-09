'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface ChefGroupe {
  nom: string
  prenom: string
}

interface ParoisseApercu {
  id: string
  nom: string
  ville: string
  actif: boolean
  scouts: number
  utilisateurs: number
  chefGroupe: ChefGroupe | null
}

interface Totaux {
  paroisses: number
  paroissesActives: number
  scouts: number
  utilisateurs: number
  activitesMois: number
}

interface Apercu {
  doyenne: string
  totaux: Totaux
  paroisses: ParoisseApercu[]
}

function StatutParoisse({ actif }: { actif: boolean }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
      {actif ? 'Active' : 'Désactivée'}
    </span>
  )
}

export default function ApercuDistrict() {
  const [apercu, setApercu] = useState<Apercu | null>(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    fetch('/api/district/apercu')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then(setApercu)
      .catch(() => toast.error("Impossible de charger la vue d'ensemble."))
      .finally(() => setChargement(false))
  }, [])

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  if (!apercu) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center">
        <p className="text-sm font-medium text-gray-700">Impossible de charger la vue d&apos;ensemble.</p>
      </div>
    )
  }

  const { doyenne, totaux, paroisses } = apercu

  const cartes = [
    { label: 'Paroisses actives', value: `${totaux.paroissesActives} / ${totaux.paroisses}`, couleur: '#1a4731' },
    { label: 'Scouts', value: totaux.scouts, couleur: '#27ae60' },
    { label: 'Utilisateurs', value: totaux.utilisateurs, couleur: '#f39c12' },
    { label: 'Activités ce mois', value: totaux.activitesMois, couleur: '#3498db' },
  ]

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Vue d&apos;ensemble</h1>
        <p className="text-sm text-gray-500 mt-0.5">District {doyenne}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cartes.map((c) => (
          <div key={c.label} className="rounded-xl p-4 text-center text-white" style={{ backgroundColor: c.couleur }}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs opacity-90 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {paroisses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-700">Aucune paroisse dans ce district</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Paroisse</th>
                  <th className="px-4 py-3">Ville</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Chef de Groupe</th>
                  <th className="px-4 py-3 text-center">Scouts</th>
                  <th className="px-4 py-3 text-center">Utilisateurs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paroisses.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.nom}</td>
                    <td className="px-4 py-3 text-gray-700">{p.ville}</td>
                    <td className="px-4 py-3">
                      <StatutParoisse actif={p.actif} />
                    </td>
                    <td className="px-4 py-3">
                      {p.chefGroupe ? (
                        <span className="text-gray-700">{p.chefGroupe.prenom} {p.chefGroupe.nom}</span>
                      ) : (
                        <span className="text-orange-600 text-xs font-medium">À désigner</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{p.scouts}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{p.utilisateurs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
