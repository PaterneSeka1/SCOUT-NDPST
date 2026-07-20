'use client'

import Link from 'next/link'
import { LABELS_BRANCHES, COULEURS_BRANCHES, ORDRE_BRANCHES, calculerAge } from '@/lib/branches'
import {
  LABELS_TRANCHE_AGE_COMPAGNON,
} from '@/lib/parcoursCompagnon'
import { useListeParcoursCompagnon, type LigneListeParcoursCompagnon } from '@/hooks/useParcoursCompagnon'
import { useRechercheDebounce } from '@/hooks/useRechercheDebounce'
import { SkeletonCard, SkeletonRow } from '@/app/components/Skeletons'
import { useState } from 'react'

const BRANCHES_OPTIONS = [
  { valeur: '', label: 'Toutes les branches' },
  ...ORDRE_BRANCHES.map((branche) => ({ valeur: branche, label: LABELS_BRANCHES[branche] })),
]

function StatutParcoursBadge({ ligne }: { ligne: LigneListeParcoursCompagnon }) {
  if (!ligne.parcours) {
    return <span className="text-xs text-gray-400 italic">Aucun parcours</span>
  }
  if (ligne.parcours.statut === 'TERMINE') {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Terminé</span>
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      {LABELS_TRANCHE_AGE_COMPAGNON[ligne.parcours.trancheAge] ?? ligne.parcours.trancheAge}
    </span>
  )
}

function AvancementCellule({ ligne }: { ligne: LigneListeParcoursCompagnon }) {
  if (!ligne.avancement) return <span className="text-xs text-gray-300">—</span>
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
        <div className="h-full bg-[#1a4731]" style={{ width: `${ligne.avancement.pourcentageAvancement}%` }} />
      </div>
      <span className="text-xs text-gray-600">{ligne.avancement.pourcentageAvancement}%</span>
      {ligne.avancement.activitesEnRetard > 0 && (
        <span className="text-xs text-red-600 font-medium">{ligne.avancement.activitesEnRetard} en retard</span>
      )}
    </div>
  )
}

function CarteLigne({ ligne }: { ligne: LigneListeParcoursCompagnon }) {
  const { scout } = ligne
  return (
    <Link
      href={`/dashboard/scouts/${scout.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 space-y-2.5 hover:border-[#1a4731]/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 leading-tight">{scout.nom} {scout.prenom}</p>
        <StatutParcoursBadge ligne={ligne} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_BRANCHES[scout.brancheType] ?? 'bg-gray-100 text-gray-700'}`}>
          {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
        </span>
        <span className="text-xs text-gray-500">
          {new Date(scout.dateNaissance).toLocaleDateString('fr-FR')} ({calculerAge(new Date(scout.dateNaissance), new Date())} ans)
        </span>
      </div>
      <AvancementCellule ligne={ligne} />
    </Link>
  )
}

function LigneTableau({ ligne }: { ligne: LigneListeParcoursCompagnon }) {
  const { scout } = ligne
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-gray-800 font-medium text-sm">{scout.nom} {scout.prenom}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_BRANCHES[scout.brancheType] ?? 'bg-gray-100 text-gray-700'}`}>
          {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {new Date(scout.dateNaissance).toLocaleDateString('fr-FR')}
        <span className="text-gray-400"> ({calculerAge(new Date(scout.dateNaissance), new Date())} ans)</span>
      </td>
      <td className="px-4 py-3"><StatutParcoursBadge ligne={ligne} /></td>
      <td className="px-4 py-3"><AvancementCellule ligne={ligne} /></td>
      <td className="px-4 py-3">
        <Link href={`/dashboard/scouts/${scout.id}`} className="text-[#1a4731] hover:underline text-xs font-medium">
          Voir la fiche
        </Link>
      </td>
    </tr>
  )
}

export default function ParcoursCompagnonsPage() {
  const [brancheFiltre, setBrancheFiltre] = useState('')
  const { recherche, setRecherche, rechercheDebounce } = useRechercheDebounce()

  const { data, isLoading, isError, error } = useListeParcoursCompagnon({
    branche: brancheFiltre || undefined,
    recherche: rechercheDebounce || undefined,
  })

  const lignes = data?.scouts ?? []

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Progression Compagnons</h1>
        <p className="text-sm text-gray-500 mt-1">
          Suivi du parcours de progression individuelle (parcours Route) des Compagnons de la paroisse.
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Rechercher par nom, prénom ou matricule…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
        />
        <select
          value={brancheFiltre}
          onChange={(e) => setBrancheFiltre(e.target.value)}
          className="sm:w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
        >
          {BRANCHES_OPTIONS.map((opt) => (
            <option key={opt.valeur} value={opt.valeur}>{opt.label}</option>
          ))}
        </select>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error instanceof Error ? error.message : 'Une erreur est survenue'}
        </div>
      )}

      {/* Vue mobile — cartes */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : lignes.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">Aucun scout trouvé.</p>
        ) : (
          lignes.map((l) => <CarteLigne key={l.scout.id} ligne={l} />)
        )}
      </div>

      {/* Vue desktop — tableau */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Nom Prénom', 'Branche', 'Date de naissance', 'Parcours', 'Avancement', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : lignes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-400 text-sm">
                    Aucun scout trouvé.
                  </td>
                </tr>
              ) : (
                lignes.map((l) => <LigneTableau key={l.scout.id} ligne={l} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
