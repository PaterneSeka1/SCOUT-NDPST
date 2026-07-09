'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES } from '@/lib/branches'

interface ScoutBranche {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  paroisseNom: string
  badgesValides: number
}

interface ActiviteRecente {
  id: string
  titre: string
  dateDebut: string
  lieu: string | null
  paroisse: { nom: string }
}

interface ProgrammeRecent {
  id: string
  titre: string
  periodeDebut: string
  periodeFin: string
  paroisse: { nom: string }
}

interface MaBrancheReponse {
  branche: string
  totalBadges: number
  scouts: ScoutBranche[]
  activitesRecentes: ActiviteRecente[]
  programmesRecents: ProgrammeRecent[]
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MaBranchePage() {
  const [donnees, setDonnees] = useState<MaBrancheReponse | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/district/ma-branche')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.erreur ?? 'Erreur serveur')
        return data
      })
      .then((data) => setDonnees(data))
      .catch((e) => setErreur(e.message ?? 'Impossible de charger votre branche.'))
      .finally(() => setChargement(false))
  }, [])

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  if (erreur || !donnees) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center">
        <p className="text-sm font-medium text-red-600">{erreur ?? 'Impossible de charger votre branche.'}</p>
      </div>
    )
  }

  const { branche, totalBadges, scouts, activitesRecentes, programmesRecents } = donnees
  const labelBranche = LABELS_BRANCHES[branche] ?? branche

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ma branche — {labelBranche}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {scouts.length} scout{scouts.length > 1 ? 's' : ''} dans toutes les paroisses du district
        </p>
      </div>

      {scouts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center">
          <p className="text-sm font-medium text-gray-700">Aucun scout de cette branche dans le district</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Matricule</th>
                  <th className="px-4 py-3">Paroisse</th>
                  <th className="px-4 py-3 text-center">Badges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scouts.map((scout) => (
                  <tr key={scout.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/district/ma-branche/${scout.id}`} className="font-medium text-gray-900 hover:underline">
                        {scout.prenom} {scout.nom}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{scout.matricule ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{scout.paroisseNom}</td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {scout.badgesValides}/{totalBadges} badges
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900">Activités récentes</h2>
            <Link href="/district/ma-branche/activites/nouvelle" className="text-xs font-medium text-[#1a4731] hover:underline whitespace-nowrap">
              + Nouvelle activité de branche
            </Link>
          </div>
          {activitesRecentes.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Aucune activité créée pour l&apos;instant</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {activitesRecentes.map((a) => (
                <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.titre}</p>
                    <p className="text-xs text-gray-500">{a.paroisse.nom}</p>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(a.dateDebut)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900">Programmes récents</h2>
            <Link href="/district/ma-branche/programmes/nouveau" className="text-xs font-medium text-[#1a4731] hover:underline whitespace-nowrap">
              + Nouveau programme de branche
            </Link>
          </div>
          {programmesRecents.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Aucun programme créé pour l&apos;instant</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {programmesRecents.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.titre}</p>
                    <p className="text-xs text-gray-500">{p.paroisse.nom}</p>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(p.periodeDebut)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
