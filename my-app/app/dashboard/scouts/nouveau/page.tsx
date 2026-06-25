'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_BRANCHES } from '@/lib/branches'
import { useCreerScout } from '@/hooks/useScouts'
import type { DonneesContact } from '@/hooks/useScouts'

const BRANCHES_LISTE = Object.keys(LABELS_BRANCHES)

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_INPUT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_SELECT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_SELECT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
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
  const [uploadEnCours, setUploadEnCours] = useState(false)
  const [erreurPhoto, setErreurPhoto] = useState('')
  const [contacts, setContacts] = useState<ContactForm[]>([contactVide()])
  const [erreurs, setErreurs] = useState<FormErrors>({})

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
      if (!res.ok) { setErreurPhoto(data.erreur ?? 'Erreur upload'); setPhotoPreview(''); return }
      setPhoto(data.url)
    } catch {
      setErreurPhoto('Erreur lors de l\'envoi du fichier')
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
      e.contacts = 'Au moins un contact d\'urgence est requis'
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
      await mutateAsync({ nom: nom.trim(), prenom: prenom.trim(), dateNaissance, sexe, brancheType, photo: photo.trim() || undefined, contactsUrgence: donneesContacts })
      router.push('/dashboard/scouts')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/scouts" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour à la liste
      </Link>

      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inscrire un scout</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Informations de l'enfant */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3">Informations de l'enfant</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Nom <span className="text-red-500">*</span></label>
              <input type="text" value={nom} placeholder="Nom de famille"
                onChange={(e) => { setNom(e.target.value); setErreurs((p) => ({ ...p, nom: undefined })) }}
                className={erreurs.nom ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreurs.nom && <p className="mt-1 text-xs text-red-600">{erreurs.nom}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>Prénom <span className="text-red-500">*</span></label>
              <input type="text" value={prenom} placeholder="Prénom"
                onChange={(e) => { setPrenom(e.target.value); setErreurs((p) => ({ ...p, prenom: undefined })) }}
                className={erreurs.prenom ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreurs.prenom && <p className="mt-1 text-xs text-red-600">{erreurs.prenom}</p>}
            </div>
          </div>

          <div>
            <label className={CLS_LABEL}>Date de naissance <span className="text-red-500">*</span></label>
            <input type="date" value={dateNaissance}
              onChange={(e) => { setDateNaissance(e.target.value); setErreurs((p) => ({ ...p, dateNaissance: undefined })) }}
              className={erreurs.dateNaissance ? CLS_INPUT_ERR : CLS_INPUT} />
            {erreurs.dateNaissance && <p className="mt-1 text-xs text-red-600">{erreurs.dateNaissance}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Sexe <span className="text-red-500">*</span></label>
              <select value={sexe} onChange={(e) => { setSexe(e.target.value); setErreurs((p) => ({ ...p, sexe: undefined })) }}
                className={erreurs.sexe ? CLS_SELECT_ERR : CLS_SELECT}>
                <option value="">Sélectionner</option>
                <option value="MASCULIN">Garçon</option>
                <option value="FEMININ">Fille</option>
              </select>
              {erreurs.sexe && <p className="mt-1 text-xs text-red-600">{erreurs.sexe}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>Branche <span className="text-red-500">*</span></label>
              <select value={brancheType} onChange={(e) => { setBrancheType(e.target.value); setErreurs((p) => ({ ...p, brancheType: undefined })) }}
                className={erreurs.brancheType ? CLS_SELECT_ERR : CLS_SELECT}>
                <option value="">Sélectionner une branche</option>
                {BRANCHES_LISTE.map((b) => <option key={b} value={b}>{LABELS_BRANCHES[b]}</option>)}
              </select>
              {erreurs.brancheType && <p className="mt-1 text-xs text-red-600">{erreurs.brancheType}</p>}
            </div>
          </div>

          <div>
            <label className={CLS_LABEL}>Photo <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
            <div className="flex items-start gap-4">
              {/* Prévisualisation */}
              <div className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                {photoPreview ? (
                  <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <label className="cursor-pointer inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {uploadEnCours ? 'Envoi…' : 'Choisir une photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhoto} className="sr-only" disabled={uploadEnCours} />
                </label>
                <p className="mt-1.5 text-xs text-gray-400">JPEG, PNG, WebP · Max 5 Mo</p>
                {erreurPhoto && <p className="mt-1 text-xs text-red-600">{erreurPhoto}</p>}
                {photo && !erreurPhoto && <p className="mt-1 text-xs text-green-600">Photo enregistrée</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Contacts d'urgence */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-sm font-semibold text-gray-800">Contacts d'urgence</h2>
            <p className="text-xs text-gray-500 mt-0.5">Au moins un contact est obligatoire.</p>
          </div>

          {erreurs.contacts && <p className="text-xs text-red-600">{erreurs.contacts}</p>}

          {contacts.map((contact, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Contact {idx + 1}</p>
                {contacts.length > 1 && (
                  <button type="button" onClick={() => supprimerContact(idx)} className="text-xs text-red-500 hover:text-red-700">Supprimer</button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={CLS_LABEL}>Nom <span className="text-red-500">*</span></label>
                  <input type="text" value={contact.nom} placeholder="Nom"
                    onChange={(e) => modifierContact(idx, 'nom', e.target.value)}
                    className={erreurs.contactsItems?.[idx]?.nom ? CLS_INPUT_ERR : CLS_INPUT} />
                  {erreurs.contactsItems?.[idx]?.nom && <p className="mt-1 text-xs text-red-600">{erreurs.contactsItems[idx].nom}</p>}
                </div>
                <div>
                  <label className={CLS_LABEL}>Prénom <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
                  <input type="text" value={contact.prenom} placeholder="Prénom"
                    onChange={(e) => modifierContact(idx, 'prenom', e.target.value)} className={CLS_INPUT} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Téléphone <span className="text-red-500">*</span></label>
                  <input type="tel" value={contact.telephone} placeholder="07 00 00 00 00"
                    onChange={(e) => modifierContact(idx, 'telephone', e.target.value)}
                    className={erreurs.contactsItems?.[idx]?.telephone ? CLS_INPUT_ERR : CLS_INPUT} />
                  {erreurs.contactsItems?.[idx]?.telephone && <p className="mt-1 text-xs text-red-600">{erreurs.contactsItems[idx].telephone}</p>}
                </div>
                <div>
                  <label className={CLS_LABEL}>Relation</label>
                  <select value={contact.relation} onChange={(e) => modifierContact(idx, 'relation', e.target.value)} className={CLS_SELECT}>
                    <option value="">Sélectionner</option>
                    <option>Père</option><option>Mère</option><option>Tuteur</option><option>Tutrice</option><option>Autre</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={contact.principal}
                  onChange={(e) => modifierContact(idx, 'principal', e.target.checked)} className="accent-[#1a4731]" />
                <span className="text-xs text-gray-700">Contact principal</span>
              </label>
            </div>
          ))}

          <button type="button" onClick={ajouterContact}
            className="text-sm text-[#1a4731] font-medium border border-[#1a4731]/30 hover:border-[#1a4731] px-4 py-2 rounded-lg transition-colors">
            + Ajouter un contact
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="submit" disabled={isPending}
            className="sm:flex-none bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60">
            {isPending ? 'Enregistrement…' : 'Inscrire le scout'}
          </button>
          <Link href="/dashboard/scouts"
            className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}
