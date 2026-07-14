'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_BRANCHES, COULEURS_BRANCHES, ORDRE_BRANCHES } from '@/lib/branches'
import { LABELS_TYPE_ACTIVITE } from '@/lib/activites'

interface Activite {
  id: string; titre: string; dateDebut: string; type: string; brancheType: string | null
  _count: { presences: number }
}

interface ReunionStat {
  id: string; titre: string | null; brancheType: string | null
  dateHeure: string; dateReportee: string | null
  totalScouts: number; presents: number; tauxPresence: number
}

interface Rapport {
  scoutsParBranche: { brancheType: string; _count: { id: number } }[]
  scoutsActifs: number
  scoutsInactifs: number
  activitesMois: number
  tauxPresence: number
  dernieresActivites: Activite[]
  reunionsMois: number
  tauxPresenceReunions: number
  dernieresReunions: ReunionStat[]
}

function BarrePourcent({ valeur, max, couleur }: { valeur: number; max: number; couleur: string }) {
  const pct = max > 0 ? Math.round((valeur / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${couleur}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-8 text-right">{valeur}</span>
    </div>
  )
}

function JaugeTaux({ taux }: { taux: number }) {
  const couleur = taux >= 75 ? 'bg-green-500' : taux >= 50 ? 'bg-[#f39c12]' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${couleur}`} style={{ width: `${taux}%` }} />
      </div>
      <span className={`text-xs font-semibold ${taux >= 75 ? 'text-green-600' : taux >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
        {taux}%
      </span>
    </div>
  )
}

export default function PageRapports() {
  const [rapport, setRapport] = useState<Rapport | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/rapports')
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { setErreur(data.erreur); toast.error(data.erreur); return }
        setRapport(data)
      })
      .catch(() => { setErreur('Impossible de charger les rapports.'); toast.error('Impossible de charger les rapports') })
      .finally(() => setChargement(false))
  }, [])

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (erreur || !rapport) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
      {erreur ?? 'Impossible de charger les rapports.'}
    </div>
  )

  const maxScouts = Math.max(...rapport.scoutsParBranche.map((b) => b._count.id), 1)
  const totalScouts = rapport.scoutsActifs + rapport.scoutsInactifs

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Rapports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vue d&apos;ensemble statistique du groupe scout</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Scouts actifs', valeur: rapport.scoutsActifs, couleur: 'bg-[#1a4731]', icone: '⚜️' },
          { label: 'Scouts inactifs', valeur: rapport.scoutsInactifs, couleur: 'bg-gray-500', icone: '⏸️' },
          { label: 'Activités ce mois', valeur: rapport.activitesMois, couleur: 'bg-[#27ae60]', icone: '📅' },
          { label: 'Réunions ce mois', valeur: rapport.reunionsMois, couleur: 'bg-blue-600', icone: '🗓️' },
        ].map(({ label, valeur, couleur, icone }) => (
          <div key={label} className={`${couleur} text-white rounded-xl p-4`}>
            <div className="text-2xl mb-1">{icone}</div>
            <p className="text-2xl font-bold">{valeur}</p>
            <p className="text-xs opacity-90 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Taux de présence global */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-1">Taux de présence — Activités</p>
          <p className="text-xs text-gray-400 mb-3">6 derniers mois</p>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-gray-800">{rapport.tauxPresence}%</p>
          </div>
          <JaugeTaux taux={rapport.tauxPresence} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-1">Taux de présence — Réunions</p>
          <p className="text-xs text-gray-400 mb-3">6 derniers mois (réunions terminées)</p>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-gray-800">{rapport.tauxPresenceReunions}%</p>
          </div>
          <JaugeTaux taux={rapport.tauxPresenceReunions} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scouts par branche */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Scouts par branche</h2>
          <p className="text-xs text-gray-400 mb-4">{totalScouts} scouts au total</p>
          <div className="space-y-3">
            {ORDRE_BRANCHES.map((branche) => {
              const entree = rapport.scoutsParBranche.find((b) => b.brancheType === branche)
              const nb = entree?._count.id ?? 0
              const [bgCls] = (COULEURS_BRANCHES[branche] ?? 'bg-gray-200 text-gray-700').split(' ')
              return (
                <div key={branche}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{LABELS_BRANCHES[branche]}</span>
                  </div>
                  <BarrePourcent valeur={nb} max={maxScouts} couleur={bgCls} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Activités récentes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Activités récentes</h2>
          {rapport.dernieresActivites.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucune activité ces 6 derniers mois</p>
          ) : (
            <div className="space-y-3">
              {rapport.dernieresActivites.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.titre}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {' · '}{LABELS_TYPE_ACTIVITE[a.type] ?? a.type}
                      {a.brancheType ? ` · ${LABELS_BRANCHES[a.brancheType] ?? a.brancheType}` : ''}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                    {a._count.presences} présent{a._count.presences > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Réunions terminées avec taux de présence */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800">Présences aux réunions</h2>
          <Link href="/dashboard/reunions" className="text-xs text-[#1a4731] hover:underline">
            Voir toutes →
          </Link>
        </div>

        {rapport.dernieresReunions.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">Aucune réunion terminée ces 6 derniers mois</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 pb-2">Réunion</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-2">Branche</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-2 min-w-[120px]">Présents</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-2">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rapport.dernieresReunions.map((r) => {
                  const date = new Date(r.dateReportee ?? r.dateHeure)
                  return (
                    <tr key={r.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900 truncate max-w-[160px]">
                          {r.titre || 'Réunion'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        {r.brancheType ? (
                          <span className="text-xs text-gray-600">{LABELS_BRANCHES[r.brancheType] ?? r.brancheType}</span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Inter-branches</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-600">{r.presents} / {r.totalScouts}</p>
                          <JaugeTaux taux={r.tauxPresence} />
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <a href={`/api/reunions/${r.id}/presences/export`}
                          className="text-xs text-[#1a4731] hover:underline whitespace-nowrap">
                          CSV ↓
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
