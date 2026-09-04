'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useUtilisateur } from '@/hooks/useUtilisateurs'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'
import { BackLink } from '@/app/components/ui/BackLink'

function formaterDateFrancaise(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function FicheParentPage() {
  const params = useParams()
  const id = params.id as string

  const { data: parent, isLoading: chargement, isError, error } = useUtilisateur(id)
  const enfants = parent?.enfants ?? []

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackLink href="/dashboard/parents">Retour</BackLink>
          <h1 className="text-2xl font-bold text-gray-900">Fiche parent</h1>
        </div>

        {parent && (
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <Link
              href={`/dashboard/parents/${parent.id}/modifier`}
              className="bg-[var(--cp)] text-white px-4 py-2 rounded-md hover:brightness-110 transition-colors text-sm font-medium"
            >
              Modifier
            </Link>
            <Link
              href={`/dashboard/parents/${parent.id}/modifier`}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Réinitialiser le mot de passe
            </Link>
          </div>
        )}
      </div>

      {chargement && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-[var(--cp)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error instanceof Error ? error.message : 'Une erreur est survenue'}
        </div>
      )}

      {parent && !chargement && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
            {/* Téléphone */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <p className="text-2xl font-mono font-bold text-[var(--cp)] tracking-wider">
                {parent.telephone ?? '—'}
              </p>
              {parent.actif ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                  Actif
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-500">
                  Inactif
                </span>
              )}
            </div>

            {/* Informations */}
            <dl className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-gray-500 col-span-1">Nom complet</dt>
                <dd className="text-sm text-gray-900 font-medium col-span-2">
                  {parent.nom} {parent.prenom}
                </dd>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-gray-500 col-span-1">Email</dt>
                <dd className="text-sm text-gray-900 col-span-2">
                  {parent.email ?? (
                    <span className="italic text-gray-400">Non renseigné</span>
                  )}
                </dd>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-gray-500 col-span-1">Statut</dt>
                <dd className="col-span-2">
                  {parent.actif ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Actif
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      Inactif
                    </span>
                  )}
                </dd>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <dt className="text-sm font-medium text-gray-500 col-span-1">Créé le</dt>
                <dd className="text-sm text-gray-900 col-span-2">
                  {formaterDateFrancaise(parent.createdAt)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Enfants rattachés */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Enfants rattachés</h2>
              <span className="text-xs text-gray-400">
                {enfants.length} enfant{enfants.length > 1 ? 's' : ''}
              </span>
            </div>

            {enfants.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucun enfant rattaché à ce compte.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {enfants.map((enfant) => (
                  <li key={enfant.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      href={`/dashboard/scouts/${enfant.id}`}
                      className="flex items-center justify-between gap-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded-md transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900 truncate">
                          {enfant.prenom} {enfant.nom}
                        </span>
                        <span className="block text-xs text-gray-500 truncate">
                          {enfant.matricule ?? 'Sans matricule'}
                          {!enfant.actif && ' · Inactif'}
                        </span>
                      </span>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                        COULEURS_BRANCHES[enfant.brancheType] ?? 'bg-gray-100 text-gray-700'
                      }`}>
                        {LABELS_BRANCHES[enfant.brancheType] ?? enfant.brancheType}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
