'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_ROLES, COULEURS_ROLES } from '@/lib/roles'

interface UtilisateurDetail {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  telephone: string | null
  email: string | null
  role: string
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
    setErreurChargement(false)
    fetch(`/api/admin/utilisateurs/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data: UtilisateurDetail) => setUtilisateur(data))
      .catch(() => {
        setErreurChargement(true)
        toast.error('Impossible de charger cet utilisateur.')
      })
      .finally(() => setChargement(false))
  }, [id])

  useEffect(() => { charger() }, [charger])

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  if (erreurChargement || !utilisateur) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <p className="text-sm text-gray-600">Impossible de charger cet utilisateur.</p>
        <Link href="/admin/utilisateurs" className="text-sm text-gray-500 hover:text-gray-800">← Retour aux utilisateurs</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Navigation */}
      <Link href="/admin/utilisateurs" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour à la liste
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Fiche utilisateur</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-5">
        {/* Identifiant */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <p className="text-3xl font-mono font-bold tracking-wider" style={{ color: 'var(--cp)' }}>
            {utilisateur.matricule ?? utilisateur.telephone ?? '—'}
          </p>
          {utilisateur.actif ? (
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
              {utilisateur.nom} {utilisateur.prenom}
            </dd>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <dt className="text-sm font-medium text-gray-500 col-span-1">Paroisse</dt>
            <dd className="text-sm text-gray-900 col-span-2">{utilisateur.paroisse.nom}</dd>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <dt className="text-sm font-medium text-gray-500 col-span-1">Téléphone</dt>
            <dd className="text-sm text-gray-900 col-span-2">
              {utilisateur.telephone ?? (
                <span className="italic text-gray-400">Non renseigné</span>
              )}
            </dd>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <dt className="text-sm font-medium text-gray-500 col-span-1">Email</dt>
            <dd className="text-sm text-gray-900 col-span-2">
              {utilisateur.email ?? (
                <span className="italic text-gray-400">Non renseigné</span>
              )}
            </dd>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <dt className="text-sm font-medium text-gray-500 col-span-1">Rôle</dt>
            <dd className="col-span-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  COULEURS_ROLES[utilisateur.role] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {LABELS_ROLES[utilisateur.role] ?? utilisateur.role}
              </span>
            </dd>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <dt className="text-sm font-medium text-gray-500 col-span-1">Statut</dt>
            <dd className="col-span-2">
              {utilisateur.actif ? (
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
              {formaterDateFrancaise(utilisateur.createdAt)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/utilisateurs/${utilisateur.id}/modifier`}
          className="rounded-lg px-4 py-2 text-sm font-bold text-white hover:brightness-110 transition"
          style={{ backgroundColor: 'var(--cp)' }}
        >
          Modifier
        </Link>
        <Link
          href={`/admin/utilisateurs/${utilisateur.id}/modifier`}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          Réinitialiser le mot de passe
        </Link>
        <Link
          href="/admin/utilisateurs"
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          Retour
        </Link>
      </div>
    </div>
  )
}
