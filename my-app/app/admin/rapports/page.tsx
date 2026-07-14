'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatMontantFCFA } from '@/lib/cotisations'

interface LigneParoisse {
  id: string; nom: string; ville: string; actif: boolean
  scouts: number; utilisateurs: number; activites: number; cotisations: number
}

interface Totaux {
  paroisses: number; paroissesActives: number; scouts: number; utilisateurs: number; activites: number
}

interface KpisRapport {
  activitesMois: number
  tauxPresence: number
  cotisationsPayees: number
  cotisationsEnAttente: number
  utilisateursParCategorie: { staff: number; parents: number; comptesScouts: number }
}

const EXPORTS_RAPPORTS = [
  { type: 'synthese', titre: 'Synthèse paroisses', description: 'Comparatif global par paroisse' },
  { type: 'scouts', titre: 'Scouts', description: 'Liste consolidée des scouts' },
  { type: 'utilisateurs', titre: 'Utilisateurs', description: 'Comptes, rôles et affectations' },
  { type: 'activites', titre: 'Activités', description: 'Historique des activités' },
  { type: 'cotisations', titre: 'Cotisations', description: 'Suivi des paiements' },
]

export default function RapportsPlateforme() {
  const [totaux, setTotaux] = useState<Totaux | null>(null)
  const [kpis, setKpis] = useState<KpisRapport | null>(null)
  const [paroisses, setParoisses] = useState<LigneParoisse[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    fetch('/api/admin/rapports')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data) => { setTotaux(data.totaux); setKpis(data.kpis); setParoisses(data.paroisses) })
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Rapports consolidés</h1>
          <p className="text-sm text-gray-500 mt-0.5">Comparatif de toutes les paroisses de la plateforme</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-[#1a4731] p-3 text-center text-white sm:p-4">
          <p className="text-2xl font-bold">{totaux?.paroissesActives ?? 0} / {totaux?.paroisses ?? 0}</p>
          <p className="text-xs opacity-90 mt-0.5">Paroisses actives</p>
        </div>
        <div className="rounded-xl bg-[#27ae60] p-3 text-center text-white sm:p-4">
          <p className="text-2xl font-bold">{totaux?.scouts ?? 0}</p>
          <p className="text-xs opacity-90 mt-0.5">Scouts</p>
        </div>
        <div className="rounded-xl bg-[#f39c12] p-3 text-center text-white sm:p-4">
          <p className="text-2xl font-bold">{totaux?.utilisateurs ?? 0}</p>
          <p className="text-xs opacity-90 mt-0.5">Utilisateurs</p>
        </div>
        <div className="rounded-xl bg-[#3498db] p-3 text-center text-white sm:p-4">
          <p className="text-2xl font-bold">{totaux?.activites ?? 0}</p>
          <p className="text-xs opacity-90 mt-0.5">Activités</p>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">Exports</h2>
            <p className="mt-0.5 text-xs text-gray-500">Téléchargements CSV compatibles Excel</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {EXPORTS_RAPPORTS.map((exportRapport) => (
            <a
              key={exportRapport.type}
              href={`/api/admin/rapports/export?type=${exportRapport.type}`}
              className="flex min-h-20 flex-col justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-sm transition hover:border-[#1a4731] hover:bg-gray-50"
            >
              <span className="font-semibold text-gray-900">{exportRapport.titre}</span>
              <span className="mt-1 text-xs text-gray-500">{exportRapport.description}</span>
              <span className="mt-2 text-xs font-bold text-[#1a4731]">Télécharger CSV</span>
            </a>
          ))}
        </div>
      </section>

      {kpis && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ce mois</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{kpis.activitesMois}</p>
            <p className="text-sm text-gray-500">activité{kpis.activitesMois > 1 ? 's' : ''} enregistrée{kpis.activitesMois > 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Présence</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{kpis.tauxPresence}%</p>
            <p className="text-sm text-gray-500">taux consolidé</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cotisations validées</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{formatMontantFCFA(kpis.cotisationsPayees)}</p>
            <p className="text-sm text-gray-500">{formatMontantFCFA(kpis.cotisationsEnAttente)} à finaliser</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Comptes</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">Staff : {kpis.utilisateursParCategorie.staff}</p>
            <p className="text-sm text-gray-600">Parents : {kpis.utilisateursParCategorie.parents}</p>
            <p className="text-sm text-gray-600">Scouts : {kpis.utilisateursParCategorie.comptesScouts}</p>
          </div>
        </section>
      )}

      <div className="space-y-3 md:hidden">
        {paroisses.map((p) => (
          <article key={p.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-base font-semibold text-gray-900">{p.nom}</h2>
                <p className="mt-1 text-sm text-gray-500">{p.ville}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${p.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                {p.actif ? 'Active' : 'Désactivée'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Scouts</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{p.scouts}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Utilisateurs</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{p.utilisateurs}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Activités</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{p.activites}</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Cotisations</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{p.cotisations}</p>
              </div>
            </div>
          </article>
        ))}
        {paroisses.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            Aucune paroisse enregistrée
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
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
