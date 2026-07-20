'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES, COULEURS_BRANCHES, ORDRE_BRANCHES } from '@/lib/branches'
import { useScouts, useModifierScout } from '@/hooks/useScouts'
import type { Scout } from '@/hooks/useScouts'
import { BadgeAdhesion } from '@/app/components/BadgeAdhesion'
import { SkeletonCard, SkeletonRow } from '@/app/components/Skeletons'
import { useRechercheDebounce } from '@/hooks/useRechercheDebounce'
import { confirmer } from '@/app/components/ConfirmDialog'

const BRANCHES_OPTIONS = [
  { valeur: '', label: 'Toutes les branches' },
  ...ORDRE_BRANCHES.map((branche) => ({ valeur: branche, label: LABELS_BRANCHES[branche] })),
]

function CarteScout({ scout }: { scout: Scout }) {
  const { mutateAsync, isPending } = useModifierScout(scout.id)
  const handleToggle = async () => {
    const ok = await confirmer({
      titre: scout.actif ? 'Désactiver ce scout ?' : 'Réactiver ce scout ?',
      description: scout.actif
        ? `${scout.prenom} ${scout.nom} sera désactivé(e) et n'apparaîtra plus comme actif(ve) dans la liste.`
        : `${scout.prenom} ${scout.nom} sera réactivé(e).`,
      labelConfirmer: scout.actif ? 'Désactiver' : 'Réactiver',
      danger: scout.actif,
    })
    if (!ok) return
    await mutateAsync({ actif: !scout.actif })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 leading-tight">
          {scout.nom} {scout.prenom}
        </p>
        <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          scout.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {scout.actif ? 'Actif' : 'Inactif'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          COULEURS_BRANCHES[scout.brancheType] ?? 'bg-gray-100 text-gray-700'
        }`}>
          {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
        </span>
        {scout.matricule && (
          <span className="font-mono text-xs text-gray-500">{scout.matricule}</span>
        )}
        <BadgeAdhesion statut={scout.statutAdhesion ?? null} />
      </div>

      <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
        <Link
          href={`/dashboard/scouts/${scout.id}`}
          className="text-[#1a4731] font-medium text-xs hover:underline"
        >
          Voir
        </Link>
        <span className="text-gray-200">|</span>
        <Link
          href={`/dashboard/scouts/${scout.id}/modifier`}
          className="text-[#1a4731] font-medium text-xs hover:underline"
        >
          Modifier
        </Link>
        <span className="text-gray-200">|</span>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className={`text-xs font-medium disabled:opacity-50 ${
            scout.actif ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
          }`}
        >
          {isPending ? '…' : scout.actif ? 'Désactiver' : 'Activer'}
        </button>
      </div>
    </div>
  )
}

function LigneScout({ scout }: { scout: Scout }) {
  const { mutateAsync, isPending } = useModifierScout(scout.id)
  const handleToggle = async () => {
    const ok = await confirmer({
      titre: scout.actif ? 'Désactiver ce scout ?' : 'Réactiver ce scout ?',
      description: scout.actif
        ? `${scout.prenom} ${scout.nom} sera désactivé(e) et n'apparaîtra plus comme actif(ve) dans la liste.`
        : `${scout.prenom} ${scout.nom} sera réactivé(e).`,
      labelConfirmer: scout.actif ? 'Désactiver' : 'Réactiver',
      danger: scout.actif,
    })
    if (!ok) return
    await mutateAsync({ actif: !scout.actif })
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-gray-800 font-medium text-sm">
        {scout.nom} {scout.prenom}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          COULEURS_BRANCHES[scout.brancheType] ?? 'bg-gray-100 text-gray-700'
        }`}>
          {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-gray-600 text-sm">
        {scout.matricule ?? <span className="text-gray-400 italic">—</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          scout.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {scout.actif ? 'Actif' : 'Inactif'}
        </span>
      </td>
      <td className="px-4 py-3">
        <BadgeAdhesion statut={scout.statutAdhesion ?? null} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/scouts/${scout.id}`} className="text-[#1a4731] hover:underline text-xs font-medium">Voir</Link>
          <span className="text-gray-300">|</span>
          <Link href={`/dashboard/scouts/${scout.id}/modifier`} className="text-[#1a4731] hover:underline text-xs font-medium">Modifier</Link>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleToggle}
            disabled={isPending}
            className={`text-xs font-medium disabled:opacity-50 ${
              scout.actif ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
            }`}
          >
            {isPending ? '…' : scout.actif ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function ScoutsPage() {
  const [brancheFiltre, setBrancheFiltre] = useState('')
  const { recherche, setRecherche, rechercheDebounce } = useRechercheDebounce()
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [rechercheDebounce])

  const handleBrancheChange = (valeur: string) => {
    setBrancheFiltre(valeur)
    setPage(1)
  }

  const { data, isLoading, isError, error } = useScouts({
    page,
    branche: brancheFiltre || undefined,
    recherche: rechercheDebounce || undefined,
  })

  const scouts = data?.scouts ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Scouts</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/scouts/importer"
            className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Importer un fichier
          </Link>
          <Link
            href="/dashboard/scouts/nouveau"
            className="inline-flex items-center justify-center bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium"
          >
            + Inscrire un scout
          </Link>
        </div>
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
          onChange={(e) => handleBrancheChange(e.target.value)}
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
        ) : scouts.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">Aucun scout trouvé.</p>
        ) : (
          scouts.map((s) => <CarteScout key={s.id} scout={s} />)
        )}
      </div>

      {/* Vue desktop — tableau */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Nom Prénom', 'Branche', 'Matricule', 'Statut', 'Adhésion', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : scouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-400 text-sm">
                    Aucun scout trouvé.
                  </td>
                </tr>
              ) : (
                scouts.map((s) => <LigneScout key={s.id} scout={s} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-gray-500">
            {total} scout{total !== 1 ? 's' : ''} — p. {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 transition-colors hover:bg-gray-50"
            >
              ←
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 transition-colors hover:bg-gray-50"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
