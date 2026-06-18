'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LABELS_ROLES } from '@/lib/roles'
import { useCreerUtilisateur } from '@/hooks/useUtilisateurs'

interface FormData {
  nom: string
  prenom: string
  email: string
  matricule: string
  role: string
  motDePasse: string
  confirmation: string
}

interface FormErrors {
  nom?: string
  prenom?: string
  role?: string
  motDePasse?: string
  confirmation?: string
}

function genererMatriculeClient(): string {
  const chiffres = Math.floor(Math.random() * 9000000 + 1000000).toString()
  const lettre = String.fromCharCode(65 + Math.floor(Math.random() * 26))
  return chiffres + lettre
}

const ROLES_LISTE = Object.keys(LABELS_ROLES)

export default function NouvelUtilisateurPage() {
  const router = useRouter()
  const { mutateAsync, isPending } = useCreerUtilisateur()

  const [form, setForm] = useState<FormData>({
    nom: '',
    prenom: '',
    email: '',
    matricule: genererMatriculeClient(),
    role: '',
    motDePasse: '',
    confirmation: '',
  })
  const [erreurs, setErreurs] = useState<FormErrors>({})
  const [erreurServeur, setErreurServeur] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (erreurs[name as keyof FormErrors]) {
      setErreurs((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const valider = (): boolean => {
    const nouvellesErreurs: FormErrors = {}

    if (!form.nom.trim()) nouvellesErreurs.nom = 'Le nom est requis'
    if (!form.prenom.trim()) nouvellesErreurs.prenom = 'Le prénom est requis'
    if (!form.role) nouvellesErreurs.role = 'Le rôle est requis'
    if (!form.motDePasse) {
      nouvellesErreurs.motDePasse = 'Le mot de passe est requis'
    } else if (form.motDePasse.length < 6) {
      nouvellesErreurs.motDePasse = 'Le mot de passe doit contenir au moins 6 caractères'
    }
    if (!form.confirmation) {
      nouvellesErreurs.confirmation = 'La confirmation est requise'
    } else if (form.motDePasse !== form.confirmation) {
      nouvellesErreurs.confirmation = 'Les mots de passe ne correspondent pas'
    }

    setErreurs(nouvellesErreurs)
    return Object.keys(nouvellesErreurs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreurServeur('')

    if (!valider()) return

    try {
      await mutateAsync({
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim() || null,
        matricule: form.matricule.trim(),
        role: form.role,
        password: form.motDePasse,
      })
      router.push('/dashboard/utilisateurs')
    } catch (err) {
      setErreurServeur(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/utilisateurs"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Retour à la liste
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Nouvel utilisateur</h1>

      {erreurServeur && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {erreurServeur}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          {/* Nom */}
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              id="nom"
              name="nom"
              type="text"
              value={form.nom}
              onChange={handleChange}
              placeholder="Nom de famille"
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm ${
                erreurs.nom ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {erreurs.nom && <p className="mt-1 text-xs text-red-600">{erreurs.nom}</p>}
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
              value={form.prenom}
              onChange={handleChange}
              placeholder="Prénom"
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm ${
                erreurs.prenom ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {erreurs.prenom && <p className="mt-1 text-xs text-red-600">{erreurs.prenom}</p>}
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
              value={form.email}
              onChange={handleChange}
              placeholder="exemple@email.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm"
            />
          </div>

          {/* Matricule */}
          <div>
            <label htmlFor="matricule" className="block text-sm font-medium text-gray-700 mb-1">
              Matricule
            </label>
            <input
              id="matricule"
              name="matricule"
              type="text"
              value={form.matricule}
              onChange={handleChange}
              placeholder="Ex: 0545247O"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">
              Format : 7 chiffres suivis d&apos;une lettre majuscule — Ex : 0545247O
            </p>
          </div>

          {/* Rôle */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Rôle <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              name="role"
              value={form.role}
              onChange={handleChange}
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm bg-white ${
                erreurs.role ? 'border-red-400' : 'border-gray-300'
              }`}
            >
              <option value="">Sélectionner un rôle</option>
              {ROLES_LISTE.map((role) => (
                <option key={role} value={role}>
                  {LABELS_ROLES[role]}
                </option>
              ))}
            </select>
            {erreurs.role && <p className="mt-1 text-xs text-red-600">{erreurs.role}</p>}
          </div>

          {/* Mot de passe */}
          <div>
            <label htmlFor="motDePasse" className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe <span className="text-red-500">*</span>
            </label>
            <input
              id="motDePasse"
              name="motDePasse"
              type="password"
              value={form.motDePasse}
              onChange={handleChange}
              placeholder="Minimum 6 caractères"
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm ${
                erreurs.motDePasse ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {erreurs.motDePasse && (
              <p className="mt-1 text-xs text-red-600">{erreurs.motDePasse}</p>
            )}
          </div>

          {/* Confirmation */}
          <div>
            <label
              htmlFor="confirmation"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Confirmation du mot de passe <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type="password"
              value={form.confirmation}
              onChange={handleChange}
              placeholder="Répéter le mot de passe"
              className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent text-sm ${
                erreurs.confirmation ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {erreurs.confirmation && (
              <p className="mt-1 text-xs text-red-600">{erreurs.confirmation}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-[#1a4731] text-white px-4 py-2 rounded-md hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? 'Enregistrement…' : "Créer l'utilisateur"}
            </button>
            <Link
              href="/dashboard/utilisateurs"
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors text-sm"
            >
              Annuler
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
