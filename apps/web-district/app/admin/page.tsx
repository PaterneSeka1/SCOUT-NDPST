'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { lireRapports } from '@/lib/rapports'
import { formatMontantFCFA } from '@scout/shared'
import { GraphiqueUtilisateursParCategorie, GraphiqueCotisations, GraphiqueScoutsParParoisse } from './KpiCharts'
import { ICONES_KPI, ICONE_KPI_DEFAUT } from '@/lib/icons'
import { PERIMETRE_V1 } from '@scout/shared'

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

  const [erreur, setErreur] = useState<string | null>(null)
  const charger = useCallback(() => {
    return fetch('/api/admin/rapports')
      .then(lireRapports)
      .then((data) => { setTotaux(data.totaux); setKpis(data.kpis); setParoisses(data.paroisses) })
      .catch((cause: unknown) => setErreur(cause instanceof Error ? cause.message : 'Connexion impossible. Vérifiez votre connexion puis réessayez.'))
      .finally(() => setChargement(false))
  }, [])

  useEffect(() => { void charger() }, [charger])

  if (chargement) {
    return (
      <div role="status" aria-label="Chargement des indicateurs" className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  if (erreur || !totaux || !kpis) return (
    <section className="space-y-4 rounded-xl border border-red-200 bg-white p-6">
      <h1 className="text-xl font-bold">Indicateurs indisponibles</h1>
      <p role="alert">{erreur ?? 'Les données sont indisponibles.'}</p>
      <button type="button" onClick={() => { setChargement(true); setErreur(null); void charger() }} className="rounded-lg bg-(--cp) px-4 py-2 text-white">Réessayer</button>
      <Link href="/login" className="ml-4 underline">Se reconnecter</Link>
    </section>
  )

  // Palette catégorielle fixe (indépendante du thème par paroisse) — sert
  // uniquement à distinguer visuellement les 8 indicateurs entre eux.
  const cartes = [
    { label: 'Paroisses actives', value: `${totaux.paroissesActives} / ${totaux.paroisses}`, couleur: '#1a4731' },
    { label: 'Scouts (toutes paroisses)', value: totaux.scouts, couleur: '#27ae60' },
    { label: 'Utilisateurs', value: totaux.utilisateurs, couleur: '#f39c12' },
    { label: 'Activités', value: totaux.activites, couleur: '#3498db' },
    { label: 'Taux de présence', value: `${kpis.tauxPresence} %`, couleur: '#27ae60' },
    { label: 'Activités ce mois', value: kpis.activitesMois, couleur: '#3498db' },
    // Montants en FCFA hors périmètre V1 (marquage cotisant / non cotisant uniquement).
    ...(PERIMETRE_V1 ? [] : [
      { label: 'Cotisations payées', value: formatMontantFCFA(kpis.cotisationsPayees), couleur: '#27ae60' },
      { label: 'Cotisations en attente', value: formatMontantFCFA(kpis.cotisationsEnAttente), couleur: '#f39c12' },
    ]),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tableau de bord plateforme</h1>
          <p className="text-sm text-gray-500 mt-0.5">Indicateurs des paroisses de l&apos;installation sélectionnée</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
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
        <div className={`grid grid-cols-2 gap-3 ${PERIMETRE_V1 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          {cartes.map((c) => {
            const Icone = ICONES_KPI[c.label] ?? ICONE_KPI_DEFAUT
            return (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${c.couleur}1a`, color: c.couleur }}
                >
                  <Icone className="h-5 w-5" strokeWidth={2} />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">{c.value}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1.5 leading-tight">{c.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Comptes parents/scouts et montants de cotisation : hors périmètre V1. */}
      {!PERIMETRE_V1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GraphiqueUtilisateursParCategorie
            staff={kpis.utilisateursParCategorie.staff}
            parents={kpis.utilisateursParCategorie.parents}
            comptesScouts={kpis.utilisateursParCategorie.comptesScouts}
          />
          <GraphiqueCotisations payees={kpis.cotisationsPayees} enAttente={kpis.cotisationsEnAttente} />
        </div>
      )}

      <GraphiqueScoutsParParoisse paroisses={paroisses} />
    </div>
  )
}
