'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatMontantFCFA } from '@/lib/cotisations'
import { GraphiqueUtilisateursParCategorie, GraphiqueCotisations, GraphiqueScoutsParParoisse } from './KpiCharts'

interface Totaux {
  paroisses: number
  paroissesActives: number
  scouts: number
  utilisateurs: number
  activites: number
}

interface Kpis {
  activitesMois: number
  tauxPresence: number
  cotisationsPayees: number
  cotisationsEnAttente: number
  utilisateursParCategorie: { staff: number; parents: number; comptesScouts: number }
}

interface LigneParoisse {
  id: string
  nom: string
  scouts: number
}

export default function AdminAccueil() {
  const [totaux, setTotaux] = useState<Totaux | null>(null)
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [paroisses, setParoisses] = useState<LigneParoisse[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    fetch('/api/admin/rapports')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data) => { setTotaux(data.totaux); setKpis(data.kpis); setParoisses(data.paroisses ?? []) })
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
    { label: 'Paroisses actives', value: `${totaux?.paroissesActives ?? 0} / ${totaux?.paroisses ?? 0}`, icone: '⛪', couleur: '#1a4731' },
    { label: 'Scouts (toutes paroisses)', value: totaux?.scouts ?? 0, icone: '⚜️', couleur: '#27ae60' },
    { label: 'Utilisateurs', value: totaux?.utilisateurs ?? 0, icone: '👥', couleur: '#f39c12' },
    { label: 'Activités', value: totaux?.activites ?? 0, icone: '📅', couleur: '#3498db' },
    { label: 'Taux de présence', value: `${kpis?.tauxPresence ?? 0} %`, icone: '✅', couleur: '#27ae60' },
    { label: 'Activités ce mois', value: kpis?.activitesMois ?? 0, icone: '🗓️', couleur: '#3498db' },
    { label: 'Cotisations payées', value: formatMontantFCFA(kpis?.cotisationsPayees ?? 0), icone: '💰', couleur: '#27ae60' },
    { label: 'Cotisations en attente', value: formatMontantFCFA(kpis?.cotisationsEnAttente ?? 0), icone: '⏳', couleur: '#f39c12' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tableau de bord plateforme</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue d&apos;ensemble consolidée de toutes les paroisses</p>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          <Link
            href="/admin/paroisses/nouvelle"
            className="rounded-lg px-4 py-2 text-sm font-bold text-white hover:brightness-110 transition"
            style={{ backgroundColor: 'var(--cp)' }}
          >
            + Nouvelle paroisse
          </Link>
          <Link
            href="/admin/paroisses"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Voir toutes les paroisses
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Indicateurs clés</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cartes.map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg mb-3"
                style={{ backgroundColor: `${c.couleur}1a` }}
              >
                {c.icone}
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">{c.value}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1.5 leading-tight">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GraphiqueUtilisateursParCategorie
          staff={kpis?.utilisateursParCategorie.staff ?? 0}
          parents={kpis?.utilisateursParCategorie.parents ?? 0}
          comptesScouts={kpis?.utilisateursParCategorie.comptesScouts ?? 0}
        />
        <GraphiqueCotisations payees={kpis?.cotisationsPayees ?? 0} enAttente={kpis?.cotisationsEnAttente ?? 0} />
      </div>

      <GraphiqueScoutsParParoisse paroisses={paroisses} />
    </div>
  )
}
