'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useCreerUtilisateur } from '@/hooks/useUtilisateurs'
import { PasswordInput } from '@/app/components/PasswordInput'
import { SelecteurEnfants } from '@/app/components/SelecteurEnfants'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { useGardeModifications } from '@/hooks/useGardeModifications'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_INPUT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

interface FormData {
  nom: string
  prenom: string
  email: string
  telephone: string
  motDePasse: string
  confirmation: string
  scoutIds: string[]
}

interface FormErrors {
  nom?: string
  prenom?: string
  telephone?: string
  motDePasse?: string
  confirmation?: string
}

const FORM_VIDE: FormData = {
  nom: '', prenom: '', email: '', telephone: '', motDePasse: '', confirmation: '', scoutIds: [],
}

export default function NouveauParentPage() {
  const router = useRouter()
  const { mutateAsync, isPending } = useCreerUtilisateur()

  const [form, setForm] = useState<FormData>(FORM_VIDE)
  const [erreurs, setErreurs] = useState<FormErrors>({})

  const { estModifie, definirReference, partirVers } = useGardeModifications(form)

  useEffect(() => {
    definirReference(FORM_VIDE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    if (erreurs[name as keyof FormErrors]) setErreurs((p) => ({ ...p, [name]: undefined }))
  }

  const valider = (): boolean => {
    const e: FormErrors = {}
    if (!form.nom.trim()) e.nom = 'Le nom est requis'
    if (!form.prenom.trim()) e.prenom = 'Le prénom est requis'
    if (!form.telephone.trim()) e.telephone = 'Le numéro de téléphone est requis'
    if (!form.motDePasse) e.motDePasse = 'Le mot de passe est requis'
    else if (!motDePasseValide(form.motDePasse)) e.motDePasse = REGLE_MOT_DE_PASSE
    if (!form.confirmation) e.confirmation = 'La confirmation est requise'
    else if (form.motDePasse !== form.confirmation) e.confirmation = 'Les mots de passe ne correspondent pas'
    setErreurs(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valider()) return
    try {
      await mutateAsync({
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim() || null,
        matricule: null,
        telephone: form.telephone.trim(),
        role: 'PARENT',
        password: form.motDePasse,
        scoutIds: form.scoutIds,
      })
      definirReference(form)
      router.push('/dashboard/parents')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => partirVers('/dashboard/parents')} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour à la liste
      </button>

      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nouveau parent</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3">Informations générales</h2>

          {/* Nom + Prénom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Nom <span className="text-red-500">*</span></label>
              <input id="nom" name="nom" type="text" value={form.nom} onChange={handleChange} placeholder="Nom de famille"
                className={erreurs.nom ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreurs.nom && <p className="mt-1 text-xs text-red-600">{erreurs.nom}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>Prénom <span className="text-red-500">*</span></label>
              <input id="prenom" name="prenom" type="text" value={form.prenom} onChange={handleChange} placeholder="Prénom"
                className={erreurs.prenom ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreurs.prenom && <p className="mt-1 text-xs text-red-600">{erreurs.prenom}</p>}
            </div>
          </div>

          {/* Téléphone */}
          <div>
            <label className={CLS_LABEL}>Téléphone <span className="text-red-500">*</span></label>
            <input id="telephone" name="telephone" type="tel" value={form.telephone} onChange={handleChange}
              placeholder="07 00 00 00 00" className={erreurs.telephone ? CLS_INPUT_ERR : CLS_INPUT} />
            <p className="mt-1 text-xs text-gray-400">Le parent se connecte avec ce numéro</p>
            {erreurs.telephone && <p className="mt-1 text-xs text-red-600">{erreurs.telephone}</p>}
          </div>

          {/* Email */}
          <div>
            <label className={CLS_LABEL}>Email <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange}
              placeholder="exemple@email.com" className={CLS_INPUT} />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <SelecteurEnfants
              scoutIds={form.scoutIds}
              onChange={(scoutIds) => setForm((p) => ({ ...p, scoutIds }))}
            />
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Mot de passe</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={CLS_LABEL}>Mot de passe <span className="text-red-500">*</span></label>
                <PasswordInput id="motDePasse" name="motDePasse" value={form.motDePasse} onChange={handleChange}
                  placeholder={REGLE_MOT_DE_PASSE} className={erreurs.motDePasse ? CLS_INPUT_ERR : CLS_INPUT} />
                {erreurs.motDePasse && <p className="mt-1 text-xs text-red-600">{erreurs.motDePasse}</p>}
              </div>
              <div>
                <label className={CLS_LABEL}>Confirmation <span className="text-red-500">*</span></label>
                <PasswordInput id="confirmation" name="confirmation" value={form.confirmation} onChange={handleChange}
                  placeholder="Répéter le mot de passe" className={erreurs.confirmation ? CLS_INPUT_ERR : CLS_INPUT} />
                {erreurs.confirmation && <p className="mt-1 text-xs text-red-600">{erreurs.confirmation}</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={isPending || !estModifie}
              className="sm:flex-none bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60">
              {isPending ? 'Enregistrement…' : 'Créer le parent'}
            </button>
            <button type="button" onClick={() => partirVers('/dashboard/parents')}
              className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
              Annuler
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
