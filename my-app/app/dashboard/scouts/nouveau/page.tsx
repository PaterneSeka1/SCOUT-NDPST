'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LABELS_BRANCHES } from '@/lib/branches'
import { useCreerScout } from '@/hooks/useScouts'
import type { DonneesContact } from '@/hooks/useScouts'

const BRANCHES_LISTE = Object.keys(LABELS_BRANCHES)

interface ContactForm {
  nom: string
  prenom: string
  telephone: string
  relation: string
  principal: boolean
}

interface FormErrors {
  nom?: string
  prenom?: string
  dateNaissance?: string
  sexe?: string
  brancheType?: string
  contacts?: string
  contactsItems?: Array<{ nom?: string; telephone?: string }>
}

const contactVide = (): ContactForm => ({
  nom: '',
  prenom: '',
  telephone: '',
  relation: '',
  principal: false,
})

export default function NouveauScoutPage() {
  const router = useRouter()
  const { mutateAsync, isPending } = useCreerScout()

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [sexe, setSexe] = useState('')
  const [brancheType, setBrancheType] = useState('')
  const [photo, setPhoto] = useState('')
  const [contacts, setContacts] = useState<ContactForm[]>([contactVide()])
  const [erreurs, setErreurs] = useState<FormErrors>({})
  const [erreurServeur, setErreurServeur] = useState('')

  const ajouterContact = () => {
    setContacts((prev) => [...prev, contactVide()])
  }

  const supprimerContact = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index))
  }

  const modifierContact = (index: number, champ: keyof ContactForm, valeur: string | boolean) => {
    setContacts((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c
        // Si on coche principal sur ce contact, décoche les autres
        if (champ === 'principal' && valeur === true) {
          return { ...c, principal: true }
        }
        return { ...c, [champ]: valeur }
      }),
    )
    // Si on rend un contact principal, retirer le statut des autres
    if (champ === 'principal' && valeur === true) {
      setContacts((prev) =>
        prev.map((c, i) => (i === index ? { ...c, principal: true } : { ...c, principal: false })),
      )
    }
    // Effacer l'erreur sur ce champ
    if (erreurs.contactsItems?.[index]) {
      setErreurs((prev) => {
        const items = [...(prev.contactsItems ?? [])]
        if (champ === 'nom') items[index] = { ...items[index], nom: undefined }
        if (champ === 'telephone') items[index] = { ...items[index], telephone: undefined }
        return { ...prev, contactsItems: items }
      })
    }
  }

  const valider = (): boolean => {
    const nouvellesErreurs: FormErrors = {}

    if (!nom.trim()) nouvellesErreurs.nom = 'Le nom est requis'
    if (!prenom.trim()) nouvellesErreurs.prenom = 'Le prénom est requis'
    if (!dateNaissance) nouvellesErreurs.dateNaissance = 'La date de naissance est requise'
    if (!sexe) nouvellesErreurs.sexe = 'Le sexe est requis'
    if (!brancheType) nouvellesErreurs.brancheType = 'La branche est requise'

    if (contacts.length === 0) {
      nouvellesErreurs.contacts = 'Au moins un contact d\'urgence est requis'
    } else {
      const itemsErreurs = contacts.map((c) => {
        const e: { nom?: string; telephone?: string } = {}
        if (!c.nom.trim()) e.nom = 'Le nom est requis'
        if (!c.telephone.trim()) e.telephone = 'Le téléphone est requis'
        return e
      })
      const aDesErreurs = itemsErreurs.some((e) => e.nom || e.telephone)
      if (aDesErreurs) {
        nouvellesErreurs.contactsItems = itemsErreurs
      }
    }

    setErreurs(nouvellesErreurs)
    return Object.keys(nouvellesErreurs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreurServeur('')

    if (!valider()) return

    try {
      const donneesContacts: DonneesContact[] = contacts.map((c) => ({
        nom: c.nom.trim(),
        prenom: c.prenom.trim() || undefined,
        telephone: c.telephone.trim(),
        relation: c.relation.trim() || undefined,
        principal: c.principal,
      }))

      await mutateAsync({
        nom: nom.trim(),
        prenom: prenom.trim(),
        dateNaissance,
        sexe,
        brancheType,
        photo: photo.trim() || undefined,
        contactsUrgence: donneesContacts,
      })

      router.push('/dashboard/scouts')
    } catch (err) {
      setErreurServeur(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const champClass = (erreur?: string) =>
    `w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent ${
      erreur ? 'border-red-400' : 'border-gray-300'
    }`

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/scouts" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ← Retour à la liste
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Inscrire un scout</h1>

      {erreurServeur && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {erreurServeur}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Section 1 — Informations de l'enfant */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
            Informations de l&apos;enfant
          </h2>

          {/* Nom */}
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              id="nom" type="text" value={nom} placeholder="Nom de famille"
              onChange={(e) => { setNom(e.target.value); setErreurs((p) => ({ ...p, nom: undefined })) }}
              className={champClass(erreurs.nom)}
            />
            {erreurs.nom && <p className="mt-1 text-xs text-red-600">{erreurs.nom}</p>}
          </div>

          {/* Prénom */}
          <div>
            <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-1">
              Prénom <span className="text-red-500">*</span>
            </label>
            <input
              id="prenom" type="text" value={prenom} placeholder="Prénom"
              onChange={(e) => { setPrenom(e.target.value); setErreurs((p) => ({ ...p, prenom: undefined })) }}
              className={champClass(erreurs.prenom)}
            />
            {erreurs.prenom && <p className="mt-1 text-xs text-red-600">{erreurs.prenom}</p>}
          </div>

          {/* Date de naissance */}
          <div>
            <label htmlFor="dateNaissance" className="block text-sm font-medium text-gray-700 mb-1">
              Date de naissance <span className="text-red-500">*</span>
            </label>
            <input
              id="dateNaissance" type="date" value={dateNaissance}
              onChange={(e) => { setDateNaissance(e.target.value); setErreurs((p) => ({ ...p, dateNaissance: undefined })) }}
              className={champClass(erreurs.dateNaissance)}
            />
            {erreurs.dateNaissance && (
              <p className="mt-1 text-xs text-red-600">{erreurs.dateNaissance}</p>
            )}
          </div>

          {/* Sexe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sexe <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              {[
                { valeur: 'MASCULIN', label: 'Masculin' },
                { valeur: 'FEMININ', label: 'Féminin' },
              ].map((option) => (
                <label key={option.valeur} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sexe"
                    value={option.valeur}
                    checked={sexe === option.valeur}
                    onChange={() => { setSexe(option.valeur); setErreurs((p) => ({ ...p, sexe: undefined })) }}
                    className="accent-[#1a4731]"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
            {erreurs.sexe && <p className="mt-1 text-xs text-red-600">{erreurs.sexe}</p>}
          </div>

          {/* Branche */}
          <div>
            <label htmlFor="brancheType" className="block text-sm font-medium text-gray-700 mb-1">
              Branche <span className="text-red-500">*</span>
            </label>
            <select
              id="brancheType" value={brancheType}
              onChange={(e) => { setBrancheType(e.target.value); setErreurs((p) => ({ ...p, brancheType: undefined })) }}
              className={`${champClass(erreurs.brancheType)} bg-white`}
            >
              <option value="">Sélectionner une branche</option>
              {BRANCHES_LISTE.map((b) => (
                <option key={b} value={b}>{LABELS_BRANCHES[b]}</option>
              ))}
            </select>
            {erreurs.brancheType && (
              <p className="mt-1 text-xs text-red-600">{erreurs.brancheType}</p>
            )}
          </div>

          {/* Photo (URL optionnelle) */}
          <div>
            <label htmlFor="photo" className="block text-sm font-medium text-gray-700 mb-1">
              Photo{' '}
              <span className="text-gray-400 text-xs ml-1">(URL, optionnel)</span>
            </label>
            <input
              id="photo" type="url" value={photo} placeholder="https://…"
              onChange={(e) => setPhoto(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent"
            />
          </div>
        </div>

        {/* Section 2 — Contacts d'urgence */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-base font-semibold text-gray-800">
              Contacts d&apos;urgence
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Ces informations permettent de contacter un responsable en cas d&apos;urgence.
              Au moins un contact est obligatoire.
            </p>
          </div>

          {erreurs.contacts && (
            <p className="text-xs text-red-600">{erreurs.contacts}</p>
          )}

          {contacts.map((contact, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-md p-4 space-y-4 relative"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  Contact {index + 1}
                </p>
                {contacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => supprimerContact(index)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Supprimer
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Nom contact */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" value={contact.nom} placeholder="Nom"
                    onChange={(e) => modifierContact(index, 'nom', e.target.value)}
                    className={champClass(erreurs.contactsItems?.[index]?.nom)}
                  />
                  {erreurs.contactsItems?.[index]?.nom && (
                    <p className="mt-1 text-xs text-red-600">
                      {erreurs.contactsItems[index].nom}
                    </p>
                  )}
                </div>

                {/* Prénom contact */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Prénom
                  </label>
                  <input
                    type="text" value={contact.prenom} placeholder="Prénom (optionnel)"
                    onChange={(e) => modifierContact(index, 'prenom', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent"
                  />
                </div>

                {/* Téléphone contact */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Téléphone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel" value={contact.telephone} placeholder="Ex : 0712345678"
                    onChange={(e) => modifierContact(index, 'telephone', e.target.value)}
                    className={champClass(erreurs.contactsItems?.[index]?.telephone)}
                  />
                  {erreurs.contactsItems?.[index]?.telephone && (
                    <p className="mt-1 text-xs text-red-600">
                      {erreurs.contactsItems[index].telephone}
                    </p>
                  )}
                </div>

                {/* Relation */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Relation
                  </label>
                  <select
                    value={contact.relation}
                    onChange={(e) => modifierContact(index, 'relation', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent"
                  >
                    <option value="">Choisir…</option>
                    <option value="Père">Père</option>
                    <option value="Mère">Mère</option>
                    <option value="Tuteur">Tuteur</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              {/* Principal */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contact.principal}
                  onChange={(e) => modifierContact(index, 'principal', e.target.checked)}
                  className="accent-[#1a4731]"
                />
                <span className="text-xs text-gray-600">Contact principal</span>
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={ajouterContact}
            className="text-sm text-[#1a4731] hover:text-[#163d29] font-medium border border-[#1a4731]/30 hover:border-[#1a4731] px-4 py-2 rounded-md transition-colors"
          >
            + Ajouter un contact
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-[#1a4731] text-white px-5 py-2 rounded-md hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? 'Enregistrement…' : 'Inscrire le scout'}
          </button>
          <Link
            href="/dashboard/scouts"
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors text-sm"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}
