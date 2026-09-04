'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_ROLES, ROLES_ASSIGNABLES_DISTRICT, libelleRoleAvecFonction } from '@/lib/roles'
import { confirmer } from '@/app/components/ConfirmDialog'
import { useDistrictUtilisateurs, useRetirerDistrictUtilisateur } from '@/hooks/useDistrictUtilisateurs'
import type { Utilisateur } from '@/hooks/useDistrictUtilisateurs'
import { Pagination } from '@/app/components/ui/Pagination'

const ROLES_FILTRE = ROLES_ASSIGNABLES_DISTRICT

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse space-y-3">
      <div className="flex justify-between">
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="h-5 bg-gray-100 rounded-full w-12" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-24" />
      <div className="flex gap-3 pt-1">
        <div className="h-3 bg-gray-100 rounded w-14" />
        <div className="h-3 bg-gray-100 rounded w-16" />
      </div>
    </div>
  )
}

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

async function retirerAvecConfirmation(
  utilisateur: Utilisateur,
  mutateAsync: (id: string) => Promise<Utilisateur>,
) {
  const ok = await confirmer({
    titre: 'Retirer ce membre de l\'équipe ?',
    description: `${utilisateur.prenom} ${utilisateur.nom} perdra son rôle de district, mais conservera son compte et son rôle paroissial (${LABELS_ROLES[utilisateur.roleParoisse] ?? utilisateur.roleParoisse}).`,
    labelConfirmer: 'Retirer',
    danger: true,
  })
  if (!ok) return
  try {
    await mutateAsync(utilisateur.id)
    toast.success('Membre retiré de l\'équipe du district.')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
  }
}

function CarteUtilisateur({ utilisateur }: { utilisateur: Utilisateur }) {
  const { mutateAsync, isPending } = useRetirerDistrictUtilisateur()

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 leading-tight">
          {utilisateur.nom} {utilisateur.prenom}
        </p>
        <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          utilisateur.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {utilisateur.actif ? 'Compte actif' : 'Compte désactivé'}
        </span>
      </div>

      <p className="text-xs text-gray-500">
        {libelleRoleAvecFonction(utilisateur.role, utilisateur.fonction, utilisateur.brancheType)}
      </p>
      <p className="text-xs text-gray-400">
        {LABELS_ROLES[utilisateur.roleParoisse] ?? utilisateur.roleParoisse}
        {utilisateur.paroisse ? ` — ${utilisateur.paroisse.nom}` : ''}
      </p>
      {utilisateur.matricule && (
        <span className="font-mono text-xs text-gray-500">{utilisateur.matricule}</span>
      )}

      <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
        <Link
          href={`/district/equipe/${utilisateur.id}/modifier`}
          className="text-[var(--cp)] font-medium text-xs hover:underline"
        >
          Modifier
        </Link>
        <span className="text-gray-200">|</span>
        <button
          onClick={() => retirerAvecConfirmation(utilisateur, mutateAsync)}
          disabled={isPending}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {isPending ? '…' : 'Retirer'}
        </button>
      </div>
    </div>
  )
}

function LigneUtilisateur({ utilisateur }: { utilisateur: Utilisateur }) {
  const { mutateAsync, isPending } = useRetirerDistrictUtilisateur()

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 font-mono text-gray-700 text-sm">{utilisateur.matricule ?? '—'}</td>
      <td className="px-4 py-3 text-gray-800 font-medium text-sm">
        {utilisateur.nom} {utilisateur.prenom}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-gray-800">{libelleRoleAvecFonction(utilisateur.role, utilisateur.fonction, utilisateur.brancheType)}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {LABELS_ROLES[utilisateur.roleParoisse] ?? utilisateur.roleParoisse}
          {utilisateur.paroisse ? ` — ${utilisateur.paroisse.nom}` : ''}
        </p>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          utilisateur.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {utilisateur.actif ? 'Compte actif' : 'Compte désactivé'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/district/equipe/${utilisateur.id}/modifier`}
            className="text-[var(--cp)] hover:underline text-xs font-medium"
          >
            Modifier
          </Link>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => retirerAvecConfirmation(utilisateur, mutateAsync)}
            disabled={isPending}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {isPending ? '…' : 'Retirer'}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function EquipeDistrictPage() {
  const [recherche, setRecherche] = useState('')
  const [rechercheDebounce, setRechercheDebounce] = useState('')
  const [roleFiltre, setRoleFiltre] = useState('')
  const [page, setPage] = useState(1)
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleRechercheChange = (valeur: string) => {
    setRecherche(valeur)
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => { setRechercheDebounce(valeur); setPage(1) }, 300)
    setDebounceTimer(timer)
  }

  const { data, isLoading, isError, error } = useDistrictUtilisateurs({
    page,
    recherche: rechercheDebounce || undefined,
    role: roleFiltre || undefined,
  })

  const utilisateurs = data?.utilisateurs ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Équipe du district</h1>
          <p className="text-sm text-gray-500">{total} membre{total !== 1 ? 's' : ''} dans l&apos;équipe du district</p>
        </div>
        <Link
          href="/district/equipe/nouveau"
          className="inline-flex items-center justify-center bg-[var(--cp)] text-white px-4 py-2 rounded-lg hover:brightness-110 transition-colors text-sm font-medium"
        >
          + Nommer un membre
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Rechercher…"
          value={recherche}
          onChange={(e) => handleRechercheChange(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
        />
        <select
          value={roleFiltre}
          onChange={(e) => { setRoleFiltre(e.target.value); setPage(1) }}
          className="sm:w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a4731] bg-white"
        >
          <option value="">Tous les rôles</option>
          {ROLES_FILTRE.map((role) => (
            <option key={role} value={role}>{LABELS_ROLES[role]}</option>
          ))}
        </select>
      </div>

      {/* Erreur */}
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error instanceof Error ? error.message : 'Une erreur est survenue'}
        </div>
      )}

      {/* Vue mobile — cartes */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : utilisateurs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center">
            <p className="text-sm font-medium text-gray-700">Aucun membre dans l&apos;équipe.</p>
            <Link
              href="/district/equipe/nouveau"
              className="mt-4 inline-flex items-center justify-center bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium"
            >
              Nommer un membre
            </Link>
          </div>
        ) : (
          utilisateurs.map((u) => <CarteUtilisateur key={u.id} utilisateur={u} />)
        )}
      </div>

      {/* Vue desktop — tableau */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Matricule', 'Nom Prénom', 'Rôle', 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : utilisateurs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <p className="text-sm font-medium text-gray-700">Aucun membre dans l&apos;équipe.</p>
                    <Link
                      href="/district/equipe/nouveau"
                      className="mt-4 inline-flex items-center justify-center bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium"
                    >
                      Nommer un membre
                    </Link>
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
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-gray-500">
            {total} membre{total !== 1 ? 's' : ''} — p. {page}/{totalPages}
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
