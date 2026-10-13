'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { COULEURS_ROLES, libelleRoleAvecFonction } from '@scout/shared'
import { BackLink } from '@/app/components/ui/BackLink'

interface UtilisateurDetail {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  telephone: string | null
  email: string | null
  role: string
  fonction: string | null
  brancheType: string | null
  actif: boolean
  createdAt: string
  updatedAt: string
  paroisse: { id: string; nom: string }
}

function formaterDateFrancaise(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function FicheUtilisateurPlateformePage() {
  const { id } = useParams<{ id: string }>()
  const [utilisateur, setUtilisateur] = useState<UtilisateurDetail | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreurChargement, setErreurChargement] = useState(false)

  const charger = useCallback(() => {
    fetch(`/api/admin/utilisateurs/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data: UtilisateurDetail) => {
        setErreurChargement(false)
        setUtilisateur(data)
      })
      .catch(() => {
        setErreurChargement(true)
        toast.error('Impossible de charger cet utilisateur.')
      })
      .finally(() => setChargement(false))
  }, [id])

  useEffect(() => {
    charger()
  }, [charger])

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  if (erreurChargement || !utilisateur) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-gray-600">Impossible de charger cet utilisateur.</p>
        <BackLink href="/admin/utilisateurs">Retour aux utilisateurs</BackLink>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackLink href="/admin/utilisateurs">Retour</BackLink>
          <h1 className="text-2xl font-bold text-gray-900">Fiche utilisateur</h1>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/admin/utilisateurs/${utilisateur.id}/modifier`}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-white transition hover:brightness-110"
            style={{ backgroundColor: 'var(--cp)' }}
          >
            Modifier
          </Link>
          <Link
            href={`/admin/utilisateurs/${utilisateur.id}/modifier`}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Réinitialiser le mot de passe
          </Link>
        </div>
      </div>

      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        {/* Identifiant */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <p className="font-mono text-3xl font-bold tracking-wider" style={{ color: 'var(--cp)' }}>
            {utilisateur.matricule ?? utilisateur.telephone ?? '—'}
          </p>
          {utilisateur.actif ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              Actif
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">
              Inactif
            </span>
          )}
        </div>

        {/* Informations */}
        <dl className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <dt className="col-span-1 text-sm font-medium text-gray-500">Nom complet</dt>
            <dd className="col-span-2 text-sm font-medium text-gray-900">
              {utilisateur.nom} {utilisateur.prenom}
            </dd>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <dt className="col-span-1 text-sm font-medium text-gray-500">Paroisse</dt>
            <dd className="col-span-2 text-sm text-gray-900">{utilisateur.paroisse.nom}</dd>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <dt className="col-span-1 text-sm font-medium text-gray-500">Téléphone</dt>
            <dd className="col-span-2 text-sm text-gray-900">
              {utilisateur.telephone ?? <span className="text-gray-400 italic">Non renseigné</span>}
            </dd>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <dt className="col-span-1 text-sm font-medium text-gray-500">Email</dt>
            <dd className="col-span-2 text-sm text-gray-900">
              {utilisateur.email ?? <span className="text-gray-400 italic">Non renseigné</span>}
            </dd>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <dt className="col-span-1 text-sm font-medium text-gray-500">Rôle</dt>
            <dd className="col-span-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  COULEURS_ROLES[utilisateur.role] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {libelleRoleAvecFonction(utilisateur.role, utilisateur.fonction, utilisateur.brancheType)}
              </span>
            </dd>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <dt className="col-span-1 text-sm font-medium text-gray-500">Statut</dt>
            <dd className="col-span-2">
              {utilisateur.actif ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Actif
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  Inactif
                </span>
              )}
            </dd>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <dt className="col-span-1 text-sm font-medium text-gray-500">Créé le</dt>
            <dd className="col-span-2 text-sm text-gray-900">{formaterDateFrancaise(utilisateur.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
