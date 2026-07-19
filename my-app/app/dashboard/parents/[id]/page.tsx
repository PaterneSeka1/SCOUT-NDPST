'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'
import { useUtilisateur } from '@/hooks/useUtilisateurs'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'

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
  const router = useRouter()
  const { data: session } = useSession()
  const [suppression, setSuppression] = useState(false)
  const [reinitialisationMdp, setReinitialisationMdp] = useState(false)
  const [motDePasseTemporaire, setMotDePasseTemporaire] = useState<string | null>(null)

  const { data: parent, isLoading: chargement, isError, error } = useUtilisateur(id)
  const enfants = parent?.enfants ?? []

  const estSoiMeme = !!session?.user?.id && !!parent && session.user.id === parent.id

  const handleSupprimer = async () => {
    if (!parent) return
    const ok = await confirmer({
      titre: 'Supprimer ce compte parent ?',
      description: `Le compte de ${parent.prenom} ${parent.nom} sera désactivé : son accès sera immédiatement bloqué, mais aucune donnée (dont le rattachement aux enfants) ne sera supprimée. Il pourra être réactivé à tout moment.`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    setSuppression(true)
    try {
      const res = await fetch(`/api/utilisateurs/${parent.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Erreur serveur'); return }
      toast.success('Compte supprimé.')
      router.push('/dashboard/parents')
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setSuppression(false)
    }
  }

  const handleReinitialiserMotDePasse = async () => {
    if (!parent) return
    const ok = await confirmer({
      titre: 'Réinitialiser le mot de passe ?',
      description: `L'ancien mot de passe de ${parent.prenom} ${parent.nom} sera immédiatement invalidé. Un nouveau mot de passe temporaire sera généré, à communiquer manuellement.`,
      labelConfirmer: 'Réinitialiser',
      danger: true,
    })
    if (!ok) return
    setReinitialisationMdp(true)
    try {
      const res = await fetch(`/api/utilisateurs/${parent.id}/reinitialiser-mot-de-passe`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Erreur serveur'); return }
      setMotDePasseTemporaire(data.motDePasseTemporaire)
    } catch {
      toast.error('Erreur lors de la réinitialisation du mot de passe')
    } finally {
      setReinitialisationMdp(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/parents"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Retour
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Fiche parent</h1>
        </div>

        {parent && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/parents/${parent.id}/modifier`}
              className="bg-[#1a4731] text-white px-4 py-2 rounded-md hover:bg-[#163d29] transition-colors text-sm font-medium"
            >
              Modifier
            </Link>
            <button
              type="button"
              onClick={handleReinitialiserMotDePasse}
              disabled={reinitialisationMdp}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {reinitialisationMdp ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
            </button>
          </div>
        )}
      </div>

      {motDePasseTemporaire && parent && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900">Nouveau mot de passe temporaire</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-white border border-amber-200 px-3 py-2 font-mono text-sm text-gray-900 break-all">
              {motDePasseTemporaire}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(motDePasseTemporaire)
                toast.success('Copié dans le presse-papiers.')
              }}
              className="shrink-0 rounded-md border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition"
            >
              Copier
            </button>
          </div>
          <p className="text-xs text-amber-700">
            Ce mot de passe ne sera plus affiché après avoir quitté cette page — communiquez-le maintenant à {parent.prenom} {parent.nom}.
          </p>
        </div>
      )}

      {chargement && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
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
              <p className="text-2xl font-mono font-bold text-[#1a4731] tracking-wider">
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

          {!estSoiMeme && (
            <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-red-500">Zone sensible</h2>
              <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-sm text-gray-600">
                  Le compte sera désactivé : l&apos;accès de {parent.prenom} {parent.nom} sera bloqué immédiatement, sans qu&apos;aucune donnée ne soit supprimée. Le compte pourra être réactivé à tout moment.
                </p>
                <button
                  onClick={handleSupprimer}
                  disabled={suppression}
                  className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {suppression ? 'Suppression…' : 'Supprimer le compte'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
