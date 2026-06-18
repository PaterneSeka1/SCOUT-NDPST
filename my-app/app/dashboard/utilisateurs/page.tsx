'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LABELS_ROLES, COULEURS_ROLES } from '@/lib/roles'
import { useUtilisateurs, useModifierUtilisateur } from '@/hooks/useUtilisateurs'
import type { Utilisateur } from '@/hooks/useUtilisateurs'

const ROLES_FILTRE = Object.keys(LABELS_ROLES)

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  )
}

// Composant séparé afin d'appeler useModifierUtilisateur en haut de composant
function LigneUtilisateur({ utilisateur }: { utilisateur: Utilisateur }) {
  const { mutateAsync, isPending } = useModifierUtilisateur(utilisateur.id)

  const handleToggle = async () => {
    await mutateAsync({ actif: !utilisateur.actif })
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 font-mono text-gray-700 font-medium">{utilisateur.matricule}</td>
      <td className="px-4 py-3 text-gray-800 font-medium">
        {utilisateur.nom} {utilisateur.prenom}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            COULEURS_ROLES[utilisateur.role] ?? 'bg-gray-100 text-gray-700'
          }`}
        >
          {LABELS_ROLES[utilisateur.role] ?? utilisateur.role}
        </span>
      </td>
      <td className="px-4 py-3">
        {utilisateur.actif ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Actif
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            Inactif
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/utilisateurs/${utilisateur.id}/modifier`}
            className="text-[#1a4731] hover:underline text-xs font-medium"
          >
            Modifier
          </Link>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleToggle}
            disabled={isPending}
            className={`text-xs font-medium transition-colors disabled:opacity-50 ${
              utilisateur.actif
                ? 'text-red-600 hover:text-red-700'
                : 'text-green-600 hover:text-green-700'
            }`}
          >
            {isPending ? '…' : utilisateur.actif ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function UtilisateursPage() {
  const [recherche, setRecherche] = useState('')
  const [rechercheDebounce, setRechercheDebounce] = useState('')
  const [roleFiltre, setRoleFiltre] = useState('')
  const [page, setPage] = useState(1)
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleRechercheChange = (valeur: string) => {
    setRecherche(valeur)
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => {
      setRechercheDebounce(valeur)
      setPage(1)
    }, 300)
    setDebounceTimer(timer)
  }

  const handleRoleFiltreChange = (valeur: string) => {
    setRoleFiltre(valeur)
    setPage(1)
  }

  const { data, isLoading, isError, error } = useUtilisateurs({
    page,
    recherche: rechercheDebounce || undefined,
    role: roleFiltre || undefined,
  })

  const utilisateurs = data?.utilisateurs ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
        <Link
          href="/dashboard/utilisateurs/nouveau"
          className="bg-[#1a4731] text-white px-4 py-2 rounded-md hover:bg-[#163d29] transition-colors text-sm font-medium"
        >
          + Nouvel utilisateur
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Rechercher par nom, prénom ou matricule…"
              value={recherche}
              onChange={(e) => handleRechercheChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm"
            />
          </div>
          <div className="sm:w-56">
            <select
              value={roleFiltre}
              onChange={(e) => handleRoleFiltreChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm bg-white"
            >
              <option value="">Tous les rôles</option>
              {ROLES_FILTRE.map((role) => (
                <option key={role} value={role}>
                  {LABELS_ROLES[role]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Message d'erreur */}
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error instanceof Error ? error.message : 'Une erreur est survenue'}
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Matricule
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nom Prénom
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : utilisateurs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-gray-400 text-sm">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                utilisateurs.map((u) => <LigneUtilisateur key={u.id} utilisateur={u} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} sur {totalPages} — {total} utilisateur{total !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
