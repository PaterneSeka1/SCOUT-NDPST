'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

interface Totaux {
  paroisses: number
  paroissesActives: number
  scouts: number
  utilisateurs: number
  activites: number
}

export default function AdminAccueil() {
  const [totaux, setTotaux] = useState<Totaux | null>(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    fetch('/api/admin/rapports')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data) => setTotaux(data.totaux))
      .catch(() => toast.error('Impossible de charger le tableau de bord.'))
      .finally(() => setChargement(false))
  }, [])

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  const cartes = [
    { label: 'Paroisses actives', value: `${totaux?.paroissesActives ?? 0} / ${totaux?.paroisses ?? 0}`, couleur: '#1a4731' },
    { label: 'Scouts (toutes paroisses)', value: totaux?.scouts ?? 0, couleur: '#27ae60' },
    { label: 'Utilisateurs', value: totaux?.utilisateurs ?? 0, couleur: '#f39c12' },
    { label: 'Activités', value: totaux?.activites ?? 0, couleur: '#3498db' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tableau de bord plateforme</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vue d&apos;ensemble consolidée de toutes les paroisses</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cartes.map((c) => (
          <div key={c.label} className="rounded-xl p-4 text-white text-center" style={{ backgroundColor: c.couleur }}>
            <p className="text-2xl sm:text-3xl font-bold">{c.value}</p>
            <p className="text-xs sm:text-sm opacity-90 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/paroisses/nouvelle"
          className="rounded-lg px-5 py-2.5 text-sm font-bold text-white hover:brightness-110 transition"
          style={{ backgroundColor: 'var(--cp)' }}
        >
          + Nouvelle paroisse
        </Link>
        <Link
          href="/admin/paroisses"
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          Voir toutes les paroisses
        </Link>
      </div>
    </div>
  )
}
