'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useUtilisateur, useModifierUtilisateur, useResetPassword } from '@/hooks/useUtilisateurs'
import { confirmer } from '@/app/components/ConfirmDialog'
import { PasswordInput } from '@/app/components/PasswordInput'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { useGardeModifications } from '@/hooks/useGardeModifications'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_INPUT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

interface FormInfos { nom: string; prenom: string; email: string; actif: boolean }
interface FormInfosErrors { nom?: string; prenom?: string }
interface FormMdp { motDePasse: string; confirmation: string }
interface FormMdpErrors { motDePasse?: string; confirmation?: string }

export default function ModifierParentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: parent, isLoading, isError } = useUtilisateur(id)
  const { mutateAsync: modifier, isPending: soumissionInfos } = useModifierUtilisateur(id)
  const { mutateAsync: resetPassword, isPending: soumissionMdp } = useResetPassword(id)

  const [formInfos, setFormInfos] = useState<FormInfos>({ nom: '', prenom: '', email: '', actif: true })
  const [erreursInfos, setErreursInfos] = useState<FormInfosErrors>({})

  const [formMdp, setFormMdp] = useState<FormMdp>({ motDePasse: '', confirmation: '' })
  const [erreursMdp, setErreursMdp] = useState<FormMdpErrors>({})

  const { estModifie, definirReference, partirVers } = useGardeModifications(formInfos)

  useEffect(() => {
    if (parent) {
      const infos: FormInfos = { nom: parent.nom, prenom: parent.prenom, email: parent.email ?? '', actif: parent.actif }
      setFormInfos(infos)
      definirReference(infos)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent])

  const handleInfosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setFormInfos((p) => ({ ...p, [name]: val }))
    if (erreursInfos[name as keyof FormInfosErrors]) setErreursInfos((p) => ({ ...p, [name]: undefined }))
  }

  const validerInfos = (): boolean => {
    const e: FormInfosErrors = {}
    if (!formInfos.nom.trim()) e.nom = 'Le nom est requis'
    if (!formInfos.prenom.trim()) e.prenom = 'Le prénom est requis'
    setErreursInfos(e)
    return Object.keys(e).length === 0
  }

  const soumettreInfos = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validerInfos()) return
    const ok = await confirmer({
      titre: 'Enregistrer ces modifications ?',
      description: `Les informations de ${parent?.prenom} ${parent?.nom} seront mises à jour.`,
      labelConfirmer: 'Enregistrer',
    })
    if (!ok) return
    try {
      await modifier({ nom: formInfos.nom.trim(), prenom: formInfos.prenom.trim(), email: formInfos.email.trim() || null, actif: formInfos.actif })
      toast.success('Modifications enregistrées.')
      definirReference(formInfos)
      router.push('/dashboard/parents')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const handleMdpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormMdp((p) => ({ ...p, [name]: value }))
    if (erreursMdp[name as keyof FormMdpErrors]) setErreursMdp((p) => ({ ...p, [name]: undefined }))
  }

  const validerMdp = (): boolean => {
    const e: FormMdpErrors = {}
    if (!formMdp.motDePasse) e.motDePasse = 'Le mot de passe est requis'
    else if (!motDePasseValide(formMdp.motDePasse)) e.motDePasse = REGLE_MOT_DE_PASSE
    if (!formMdp.confirmation) e.confirmation = 'La confirmation est requise'
    else if (formMdp.motDePasse !== formMdp.confirmation) e.confirmation = 'Les mots de passe ne correspondent pas'
    setErreursMdp(e)
    return Object.keys(e).length === 0
  }

  const soumettreMdp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validerMdp()) return
    const ok = await confirmer({
      titre: 'Réinitialiser le mot de passe de ce parent ?',
      description: `L'ancien mot de passe de ${parent?.prenom} ${parent?.nom} sera immédiatement invalidé et remplacé par le nouveau mot de passe saisi.`,
      labelConfirmer: 'Réinitialiser',
      danger: true,
    })
    if (!ok) return
    try {
      await resetPassword({ nouveauMotDePasse: formMdp.motDePasse })
      toast.success('Mot de passe réinitialisé.')
      setFormMdp({ motDePasse: '', confirmation: '' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (isError || !parent) return (
    <div className="space-y-4">
      <button type="button" onClick={() => partirVers('/dashboard/parents')} className="text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">Parent introuvable.</div>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-1 sm:px-0">
      <button type="button" onClick={() => partirVers('/dashboard/parents')} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour à la liste
      </button>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Modifier le parent</h1>
        <p className="text-sm text-gray-500 mt-0.5">{parent.prenom} {parent.nom}</p>
      </div>

      {/* Section 1 — Informations générales */}
      <form onSubmit={soumettreInfos} noValidate>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3">Informations générales</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Nom <span className="text-red-500">*</span></label>
              <input id="nom" name="nom" type="text" value={formInfos.nom} onChange={handleInfosChange}
                placeholder="Nom de famille" className={erreursInfos.nom ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreursInfos.nom && <p className="mt-1 text-xs text-red-600">{erreursInfos.nom}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>Prénom <span className="text-red-500">*</span></label>
              <input id="prenom" name="prenom" type="text" value={formInfos.prenom} onChange={handleInfosChange}
                placeholder="Prénom" className={erreursInfos.prenom ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreursInfos.prenom && <p className="mt-1 text-xs text-red-600">{erreursInfos.prenom}</p>}
            </div>
          </div>

          <div>
            <label className={CLS_LABEL}>Email <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
            <input id="email" name="email" type="email" value={formInfos.email} onChange={handleInfosChange}
              placeholder="exemple@email.com" className={CLS_INPUT} />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input id="actif" name="actif" type="checkbox" checked={formInfos.actif} onChange={handleInfosChange}
              className="w-4 h-4 accent-[#1a4731] rounded" />
            <span className="text-sm text-gray-700">Compte actif</span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={soumissionInfos || !estModifie}
              className="w-full sm:w-auto sm:flex-none bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60">
              {soumissionInfos ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </div>
        </div>
      </form>

      {/* Section 2 — Réinitialisation du mot de passe */}
      <form onSubmit={soumettreMdp} noValidate>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3">Réinitialiser le mot de passe</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Nouveau mot de passe <span className="text-red-500">*</span></label>
              <PasswordInput id="motDePasse" name="motDePasse" value={formMdp.motDePasse} onChange={handleMdpChange}
                placeholder={REGLE_MOT_DE_PASSE} className={erreursMdp.motDePasse ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreursMdp.motDePasse && <p className="mt-1 text-xs text-red-600">{erreursMdp.motDePasse}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>Confirmation <span className="text-red-500">*</span></label>
              <PasswordInput id="confirmation" name="confirmation" value={formMdp.confirmation} onChange={handleMdpChange}
                placeholder="Répéter le mot de passe" className={erreursMdp.confirmation ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreursMdp.confirmation && <p className="mt-1 text-xs text-red-600">{erreursMdp.confirmation}</p>}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={soumissionMdp}
              className="w-full sm:w-auto sm:flex-none bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60">
              {soumissionMdp ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
