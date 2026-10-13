'use client'

import Image from 'next/image'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/session-client'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_BRANCHES } from '@scout/shared'
import { ROLES_BRANCHE } from '@scout/shared'
import { useCreerScout } from '@/hooks/useScouts'
import type { DonneesContact } from '@/hooks/useScouts'
import { BackLink } from '@/app/components/ui/BackLink'

const BRANCHES_LISTE = Object.keys(LABELS_BRANCHES)

const CLS_INPUT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_INPUT_ERR =
  'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_SELECT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_SELECT_ERR =
  'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

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

const contactVide = (): ContactForm => ({ nom: '', prenom: '', telephone: '', relation: '', principal: false })

export default function NouveauScoutPage() {
  const router = useRouter()
  const { mutateAsync, isPending } = useCreerScout()

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [sexe, setSexe] = useState('')
  const [brancheType, setBrancheType] = useState('')
  const [photo, setPhoto] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [allergies, setAllergies] = useState('')
  const [traitementsMedicaux, setTraitementsMedicaux] = useState('')
  const [uploadEnCours, setUploadEnCours] = useState(false)
  const [erreurPhoto, setErreurPhoto] = useState('')
  const [contacts, setContacts] = useState<ContactForm[]>([contactVide()])
  const [erreurs, setErreurs] = useState<FormErrors>({})

  // L'encadrement de branche ne peut inscrire que dans sa propre branche (le
  // serveur l'impose) : on présélectionne et verrouille la branche.
  const { data: session } = useSession()
  const estRoleBranche = ROLES_BRANCHE.includes(session?.user?.role ?? '')
  const [brancheImposee, setBrancheImposee] = useState<string | null>(null)

  useEffect(() => {
    if (!estRoleBranche) return
    fetch('/api/me/branche')
      .then((r) => r.json())
      .then((data) => {
        if (data.brancheType) {
          setBrancheImposee(data.brancheType)
          setBrancheType(data.brancheType)
        }
      })
      .catch(() => toast.error('Impossible de charger votre branche'))
  }, [estRoleBranche])

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreurPhoto('')
    const preview = URL.createObjectURL(fichier)
    setPhotoPreview(preview)
    setUploadEnCours(true)
    try {
      const fd = new FormData()
      fd.append('fichier', fichier)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setErreurPhoto(data.erreur ?? 'Erreur upload')
        setPhotoPreview('')
        return
      }
      setPhoto(data.url)
    } catch {
      setErreurPhoto("Erreur lors de l'envoi du fichier")
      setPhotoPreview('')
    } finally {
      setUploadEnCours(false)
    }
  }

  const ajouterContact = () => setContacts((p) => [...p, contactVide()])
  const supprimerContact = (i: number) => setContacts((p) => p.filter((_, idx) => idx !== i))

  const modifierContact = (index: number, champ: keyof ContactForm, valeur: string | boolean) => {
    setContacts((prev) =>
      prev.map((c, i) => {
        if (i !== index) return champ === 'principal' && valeur === true ? { ...c, principal: false } : c
        return { ...c, [champ]: valeur }
      }),
    )
    if (erreurs.contactsItems?.[index]) {
      setErreurs((p) => {
        const items = [...(p.contactsItems ?? [])]
        if (champ === 'nom') items[index] = { ...items[index], nom: undefined }
        if (champ === 'telephone') items[index] = { ...items[index], telephone: undefined }
        return { ...p, contactsItems: items }
      })
    }
  }

  const valider = (): boolean => {
    const e: FormErrors = {}
    if (!nom.trim()) e.nom = 'Le nom est requis'
    if (!prenom.trim()) e.prenom = 'Le prénom est requis'
    if (!dateNaissance) e.dateNaissance = 'La date de naissance est requise'
    if (!sexe) e.sexe = 'Le sexe est requis'
    if (!brancheType) e.brancheType = 'La branche est requise'
    if (contacts.length === 0) {
      e.contacts = "Au moins un contact d'urgence est requis"
    } else {
      const items = contacts.map((c) => {
        const ce: { nom?: string; telephone?: string } = {}
        if (!c.nom.trim()) ce.nom = 'Le nom est requis'
        if (!c.telephone.trim()) ce.telephone = 'Le téléphone est requis'
        return ce
      })
      if (items.some((ce) => ce.nom || ce.telephone)) e.contactsItems = items
    }
    setErreurs(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
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
        allergies: allergies.trim() || undefined,
        traitementsMedicaux: traitementsMedicaux.trim() || undefined,
        contactsUrgence: donneesContacts,
      })
      router.push('/dashboard/scouts')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/scouts">Retour à la liste</BackLink>

      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Inscrire un scout</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Informations de l'enfant */}
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="border-b border-gray-100 pb-3 text-sm font-semibold text-gray-800">
            Informations de l&apos;enfant
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nom}
                placeholder="Nom de famille"
                onChange={(e) => {
                  setNom(e.target.value)
                  setErreurs((p) => ({ ...p, nom: undefined }))
                }}
                className={erreurs.nom ? CLS_INPUT_ERR : CLS_INPUT}
              />
              {erreurs.nom && <p className="mt-1 text-xs text-red-600">{erreurs.nom}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={prenom}
                placeholder="Prénom"
                onChange={(e) => {
                  setPrenom(e.target.value)
                  setErreurs((p) => ({ ...p, prenom: undefined }))
                }}
                className={erreurs.prenom ? CLS_INPUT_ERR : CLS_INPUT}
              />
              {erreurs.prenom && <p className="mt-1 text-xs text-red-600">{erreurs.prenom}</p>}
            </div>
          </div>

          <div>
            <label className={CLS_LABEL}>
              Date de naissance <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dateNaissance}
              onChange={(e) => {
                setDateNaissance(e.target.value)
                setErreurs((p) => ({ ...p, dateNaissance: undefined }))
              }}
              className={erreurs.dateNaissance ? CLS_INPUT_ERR : CLS_INPUT}
            />
            {erreurs.dateNaissance && <p className="mt-1 text-xs text-red-600">{erreurs.dateNaissance}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>
                Sexe <span className="text-red-500">*</span>
              </label>
              <select
                value={sexe}
                onChange={(e) => {
                  setSexe(e.target.value)
                  setErreurs((p) => ({ ...p, sexe: undefined }))
                }}
                className={erreurs.sexe ? CLS_SELECT_ERR : CLS_SELECT}
              >
                <option value="">Sélectionner</option>
                <option value="MASCULIN">Garçon</option>
                <option value="FEMININ">Fille</option>
              </select>
              {erreurs.sexe && <p className="mt-1 text-xs text-red-600">{erreurs.sexe}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>
                Branche <span className="text-red-500">*</span>
              </label>
              <select
                value={brancheType}
                onChange={(e) => {
                  setBrancheType(e.target.value)
                  setErreurs((p) => ({ ...p, brancheType: undefined }))
                }}
                disabled={brancheImposee !== null}
                className={`${erreurs.brancheType ? CLS_SELECT_ERR : CLS_SELECT} disabled:bg-gray-50 disabled:text-gray-500`}
              >
                <option value="">Sélectionner une branche</option>
                {BRANCHES_LISTE.map((b) => (
                  <option key={b} value={b}>
                    {LABELS_BRANCHES[b]}
                  </option>
                ))}
              </select>
              {brancheImposee && <p className="mt-1 text-xs text-gray-400">Inscription limitée à votre branche.</p>}
              {erreurs.brancheType && <p className="mt-1 text-xs text-red-600">{erreurs.brancheType}</p>}
            </div>
          </div>

          <div>
            <label className={CLS_LABEL}>
              Photo <span className="text-xs font-normal text-gray-400">(optionnel)</span>
            </label>
            <div className="flex items-start gap-4">
              {/* Prévisualisation */}
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
                {photoPreview ? (
                  <Image
                    width={80}
                    height={80}
                    unoptimized
                    src={photoPreview}
                    alt="Aperçu"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {uploadEnCours ? 'Envoi…' : 'Choisir une photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhoto}
                    className="sr-only"
                    disabled={uploadEnCours}
                  />
                </label>
                <p className="mt-1.5 text-xs text-gray-400">JPEG, PNG, WebP · Max 5 Mo</p>
                {erreurPhoto && <p className="mt-1 text-xs text-red-600">{erreurPhoto}</p>}
                {photo && !erreurPhoto && <p className="mt-1 text-xs text-green-600">Photo enregistrée</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Informations médicales */}
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-sm font-semibold text-gray-800">Informations médicales</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              À connaître en cas d&apos;urgence (activité, camp) — en complément du certificat médical.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>
                Allergies <span className="text-xs font-normal text-gray-400">(optionnel)</span>
              </label>
              <textarea
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                rows={2}
                placeholder="Ex : arachides, pénicilline…"
                className={CLS_INPUT}
              />
            </div>
            <div>
              <label className={CLS_LABEL}>
                Traitements en cours <span className="text-xs font-normal text-gray-400">(optionnel)</span>
              </label>
              <textarea
                value={traitementsMedicaux}
                onChange={(e) => setTraitementsMedicaux(e.target.value)}
                rows={2}
                placeholder="Ex : inhalateur pour asthme, à prendre matin et soir"
                className={CLS_INPUT}
              />
            </div>
          </div>
        </div>

        {/* Contacts d'urgence */}
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-sm font-semibold text-gray-800">Contacts d&apos;urgence</h2>
            <p className="mt-0.5 text-xs text-gray-500">Au moins un contact est obligatoire.</p>
          </div>

          {erreurs.contacts && <p className="text-xs text-red-600">{erreurs.contacts}</p>}

          {contacts.map((contact, idx) => (
            <div key={idx} className="space-y-3 rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-gray-700 uppercase">Contact {idx + 1}</p>
                {contacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => supprimerContact(idx)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Supprimer
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={CLS_LABEL}>
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contact.nom}
                    placeholder="Nom"
                    onChange={(e) => modifierContact(idx, 'nom', e.target.value)}
                    className={erreurs.contactsItems?.[idx]?.nom ? CLS_INPUT_ERR : CLS_INPUT}
                  />
                  {erreurs.contactsItems?.[idx]?.nom && (
                    <p className="mt-1 text-xs text-red-600">{erreurs.contactsItems[idx].nom}</p>
                  )}
                </div>
                <div>
                  <label className={CLS_LABEL}>
                    Prénom <span className="text-xs font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={contact.prenom}
                    placeholder="Prénom"
                    onChange={(e) => modifierContact(idx, 'prenom', e.target.value)}
                    className={CLS_INPUT}
                  />
                </div>
                <div>
                  <label className={CLS_LABEL}>
                    Téléphone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={contact.telephone}
                    placeholder="07 00 00 00 00"
                    onChange={(e) => modifierContact(idx, 'telephone', e.target.value)}
                    className={erreurs.contactsItems?.[idx]?.telephone ? CLS_INPUT_ERR : CLS_INPUT}
                  />
                  {erreurs.contactsItems?.[idx]?.telephone && (
                    <p className="mt-1 text-xs text-red-600">{erreurs.contactsItems[idx].telephone}</p>
                  )}
                </div>
                <div>
                  <label className={CLS_LABEL}>Relation</label>
                  <select
                    value={contact.relation}
                    onChange={(e) => modifierContact(idx, 'relation', e.target.value)}
                    className={CLS_SELECT}
                  >
                    <option value="">Sélectionner</option>
                    <option>Père</option>
                    <option>Mère</option>
                    <option>Tuteur</option>
                    <option>Tutrice</option>
                    <option>Autre</option>
                  </select>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={contact.principal}
                  onChange={(e) => modifierContact(idx, 'principal', e.target.checked)}
                  className="accent-(--cp)"
                />
                <span className="text-xs text-gray-700">Contact principal</span>
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={ajouterContact}
            className="rounded-lg border border-(--cp)/30 px-4 py-2 text-sm font-medium text-(--cp) transition-colors hover:border-(--cp)"
          >
            + Ajouter un contact
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-(--cp) px-5 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60 sm:flex-none"
          >
            {isPending ? 'Enregistrement…' : 'Inscrire le scout'}
          </button>
          <Link
            href="/dashboard/scouts"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}
