'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LABELS_ROLES } from '@/lib/roles'
import {
  useUtilisateur,
  useModifierUtilisateur,
  useResetPassword,
} from '@/hooks/useUtilisateurs'

interface FormInfos {
  nom: string
  prenom: string
  email: string
  role: string
  actif: boolean
}

interface FormInfosErrors {
  nom?: string
  prenom?: string
  role?: string
}

interface FormMotDePasse {
  motDePasse: string
  confirmation: string
}

interface FormMotDePasseErrors {
  motDePasse?: string
  confirmation?: string
}

const ROLES_LISTE = Object.keys(LABELS_ROLES)

export default function ModifierUtilisateurPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: utilisateur, isLoading, isError } = useUtilisateur(id)
  const { mutateAsync: modifier, isPending: soumissionInfos } = useModifierUtilisateur(id)
  const { mutateAsync: resetPassword, isPending: soumissionMdp } = useResetPassword(id)

  // Section infos générales
  const [formInfos, setFormInfos] = useState<FormInfos>({
    nom: '',
    prenom: '',
    email: '',
    role: '',
    actif: true,
  })
  const [erreursInfos, setErreursInfos] = useState<FormInfosErrors>({})
  const [erreurServeurInfos, setErreurServeurInfos] = useState('')
  const [succesInfos, setSuccesInfos] = useState(false)

  // Section mot de passe
  const [formMdp, setFormMdp] = useState<FormMotDePasse>({
    motDePasse: '',
    confirmation: '',
  })
  const [erreursMdp, setErreursMdp] = useState<FormMotDePasseErrors>({})
  const [erreurServeurMdp, setErreurServeurMdp] = useState('')
  const [succesMdp, setSuccesMdp] = useState(false)

  // Pré-remplissage du formulaire une fois les données chargées
  useEffect(() => {
    if (utilisateur) {
      setFormInfos({
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email ?? '',
        role: utilisateur.role,
        actif: utilisateur.actif,
      })
    }
  }, [utilisateur])

  // Handlers infos générales
  const handleInfosChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setFormInfos((prev) => ({ ...prev, [name]: val }))
    if (erreursInfos[name as keyof FormInfosErrors]) {
      setErreursInfos((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validerInfos = (): boolean => {
    const nouvellesErreurs: FormInfosErrors = {}
    if (!formInfos.nom.trim()) nouvellesErreurs.nom = 'Le nom est requis'
    if (!formInfos.prenom.trim()) nouvellesErreurs.prenom = 'Le prénom est requis'
    if (!formInfos.role) nouvellesErreurs.role = 'Le rôle est requis'
    setErreursInfos(nouvellesErreurs)
    return Object.keys(nouvellesErreurs).length === 0
  }

  const soumettreInfos = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreurServeurInfos('')
    setSuccesInfos(false)
    if (!validerInfos()) return

    try {
      await modifier({
        nom: formInfos.nom.trim(),
        prenom: formInfos.prenom.trim(),
        email: formInfos.email.trim() || null,
        role: formInfos.role,
        actif: formInfos.actif,
      })
      setSuccesInfos(true)
      setTimeout(() => router.push('/dashboard/utilisateurs'), 1500)
    } catch (err) {
      setErreurServeurInfos(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  // Handlers mot de passe
  const handleMdpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormMdp((prev) => ({ ...prev, [name]: value }))
    if (erreursMdp[name as keyof FormMotDePasseErrors]) {
      setErreursMdp((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validerMdp = (): boolean => {
    const nouvellesErreurs: FormMotDePasseErrors = {}
    if (!formMdp.motDePasse) {
      nouvellesErreurs.motDePasse = 'Le mot de passe est requis'
    } else if (formMdp.motDePasse.length < 6) {
      nouvellesErreurs.motDePasse = 'Le mot de passe doit contenir au moins 6 caractères'
    }
    if (!formMdp.confirmation) {
      nouvellesErreurs.confirmation = 'La confirmation est requise'
    } else if (formMdp.motDePasse !== formMdp.confirmation) {
      nouvellesErreurs.confirmation = 'Les mots de passe ne correspondent pas'
    }
    setErreursMdp(nouvellesErreurs)
    return Object.keys(nouvellesErreurs).length === 0
  }

  const soumettreMdp = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreurServeurMdp('')
    setSuccesMdp(false)
    if (!validerMdp()) return

    try {
      await resetPassword({ nouveauMotDePasse: formMdp.motDePasse })
      setSuccesMdp(true)
      setFormMdp({ motDePasse: '', confirmation: '' })
    } catch (err) {
      setErreurServeurMdp(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isError || !utilisateur) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/utilisateurs"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Retour à la liste
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          Utilisateur introuvable ou erreur lors du chargement.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/utilisateurs"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Retour à la liste
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Modifier l&apos;utilisateur</h1>

      {/* Section 1 — Informations générales */}
      <form onSubmit={soumettreInfos} noValidate>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 pb-2 border-b border-gray-100">
            Informations générales
          </h2>

          {succesInfos && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
              Modifications enregistrées. Redirection en cours…
            </div>
          )}

          {erreurServeurInfos && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {erreurServeurInfos}
            </div>
          )}

          {/* Nom */}
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              id="nom"
              name="nom"
              type="text"
              value={formInfos.nom}
              onChange={handleInfosChange}
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm ${
                erreursInfos.nom ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {erreursInfos.nom && (
              <p className="mt-1 text-xs text-red-600">{erreursInfos.nom}</p>
            )}
          </div>

          {/* Prénom */}
          <div>
            <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-1">
              Prénom <span className="text-red-500">*</span>
            </label>
            <input
              id="prenom"
              name="prenom"
              type="text"
              value={formInfos.prenom}
              onChange={handleInfosChange}
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm ${
                erreursInfos.prenom ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {erreursInfos.prenom && (
              <p className="mt-1 text-xs text-red-600">{erreursInfos.prenom}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formInfos.email}
              onChange={handleInfosChange}
              placeholder="exemple@email.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm"
            />
          </div>

          {/* Rôle */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Rôle <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              name="role"
              value={formInfos.role}
              onChange={handleInfosChange}
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm bg-white ${
                erreursInfos.role ? 'border-red-400' : 'border-gray-300'
              }`}
            >
              <option value="">Sélectionner un rôle</option>
              {ROLES_LISTE.map((role) => (
                <option key={role} value={role}>
                  {LABELS_ROLES[role]}
                </option>
              ))}
            </select>
            {erreursInfos.role && (
              <p className="mt-1 text-xs text-red-600">{erreursInfos.role}</p>
            )}
          </div>

          {/* Statut actif */}
          <div className="flex items-center gap-3">
            <input
              id="actif"
              name="actif"
              type="checkbox"
              checked={formInfos.actif}
              onChange={handleInfosChange}
              className="w-4 h-4 text-[#1a4731] border-gray-300 rounded focus:ring-[#1a4731]"
            />
            <label htmlFor="actif" className="text-sm font-medium text-gray-700 cursor-pointer">
              Compte actif
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={soumissionInfos || succesInfos}
              className="bg-[#1a4731] text-white px-4 py-2 rounded-md hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {soumissionInfos ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </div>
        </div>
      </form>

      {/* Section 2 — Réinitialisation du mot de passe */}
      <form onSubmit={soumettreMdp} noValidate>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 pb-2 border-b border-gray-100">
            Réinitialisation du mot de passe
          </h2>

          {succesMdp && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
              Mot de passe réinitialisé avec succès.
            </div>
          )}

          {erreurServeurMdp && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {erreurServeurMdp}
            </div>
          )}

          {/* Nouveau mot de passe */}
          <div>
            <label
              htmlFor="motDePasse"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nouveau mot de passe <span className="text-red-500">*</span>
            </label>
            <input
              id="motDePasse"
              name="motDePasse"
              type="password"
              value={formMdp.motDePasse}
              onChange={handleMdpChange}
              placeholder="Minimum 6 caractères"
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm ${
                erreursMdp.motDePasse ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {erreursMdp.motDePasse && (
              <p className="mt-1 text-xs text-red-600">{erreursMdp.motDePasse}</p>
            )}
          </div>

          {/* Confirmation */}
          <div>
            <label
              htmlFor="confirmation"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirmation <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type="password"
              value={formMdp.confirmation}
              onChange={handleMdpChange}
              placeholder="Répéter le mot de passe"
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm ${
                erreursMdp.confirmation ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {erreursMdp.confirmation && (
              <p className="mt-1 text-xs text-red-600">{erreursMdp.confirmation}</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={soumissionMdp}
              className="bg-[#1a4731] text-white px-4 py-2 rounded-md hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {soumissionMdp ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
