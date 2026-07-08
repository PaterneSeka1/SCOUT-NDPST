'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Paroisse {
  id: string
  nom: string
  ville: string
  diocese: string
  actif: boolean
  counts: { scouts: number; utilisateurs: number; activites: number }
  chefGroupe: { id: string; nom: string; prenom: string } | null
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Paroisses</h1>
          <p className="text-sm text-gray-500 mt-0.5">{paroisses.length} paroisse{paroisses.length > 1 ? 's' : ''} enregistrée{paroisses.length > 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/admin/paroisses/nouvelle"
          className="flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-bold text-white hover:brightness-110 transition"
          style={{ backgroundColor: 'var(--cp)' }}
        >
          + Nouvelle paroisse
        </Link>
      </div>

      <input
        type="text"
        placeholder="Rechercher…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="w-full sm:max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Paroisse</th>
                <th className="px-4 py-3">Chef de Groupe</th>
                <th className="px-4 py-3 text-center">Scouts</th>
                <th className="px-4 py-3 text-center">Utilisateurs</th>
                <th className="px-4 py-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paroissesFiltrees.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => (window.location.href = `/admin/paroisses/${p.id}`)}>
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
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${p.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                      {p.actif ? 'Active' : 'Désactivée'}
                    </span>
                  </td>
                </tr>
              ))}
              {paroisses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Aucune paroisse enregistrée</td>
                </tr>
              )}
              {paroisses.length > 0 && paroissesFiltrees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Aucune paroisse ne correspond à votre recherche.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
