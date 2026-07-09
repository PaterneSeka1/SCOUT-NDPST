'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LABELS_ROLES, COULEURS_ROLES } from '@/lib/roles'

interface Utilisateur {
  id: string
  matricule: string
  nom: string
  prenom: string
  email: string | null
  role: string
  actif: boolean
  createdAt: string
}

function formaterDateFrancaise(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function FicheUtilisateurPage() {
  const params = useParams()
  const id = params.id as string

  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    if (!id) return
    const charger = async () => {
      setChargement(true)
      setErreur('')
      try {
        const res = await fetch(`/api/utilisateurs/${id}`)
        if (res.status === 404) throw new Error('Membre introuvable')
        if (!res.ok) throw new Error('Erreur lors du chargement')
        const data: Utilisateur = await res.json()
        setUtilisateur(data)
      } catch (err) {
        setErreur(err instanceof Error ? err.message : 'Une erreur est survenue')
      } finally {
        setChargement(false)
      }
    }
    charger()
  }, [id])

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/utilisateurs"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Retour
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Fiche membre</h1>
        </div>

        {utilisateur && (
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <Link
              href={`/dashboard/utilisateurs/${utilisateur.id}/modifier`}
              className="bg-[#1a4731] text-white px-4 py-2 rounded-md hover:bg-[#163d29] transition-colors text-sm font-medium"
            >
              Modifier
            </Link>
            <Link
              href={`/dashboard/utilisateurs/${utilisateur.id}/modifier`}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Réinitialiser le mot de passe
            </Link>
          </div>
        )}
      </div>

      {chargement && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {erreur && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {erreur}
        </div>
      )}

      {utilisateur && !chargement && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
            {/* Matricule */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <p className="text-3xl font-mono font-bold text-[#1a4731] tracking-wider">
                {utilisateur.matricule}
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
        </>
      )}
    </div>
  )
}
