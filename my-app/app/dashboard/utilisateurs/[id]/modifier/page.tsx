'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LABELS_ROLES, ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT_SANS_CHEF, ROLES_BRANCHE } from '@/lib/roles'
import { LABELS_BRANCHES } from '@/lib/branches'
import { useUtilisateur, useModifierUtilisateur, useResetPassword } from '@/hooks/useUtilisateurs'
import { PasswordInput } from '@/app/components/PasswordInput'
import { SelecteurEnfants } from '@/app/components/SelecteurEnfants'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { useGardeModifications } from '@/hooks/useGardeModifications'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_INPUT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_SELECT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_SELECT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

const ROLES_LISTE = ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT_SANS_CHEF

interface FormInfos { nom: string; prenom: string; email: string; role: string; brancheType: string; actif: boolean }
interface FormInfosErrors { nom?: string; prenom?: string; role?: string; brancheType?: string }
interface FormMdp { motDePasse: string; confirmation: string }
interface FormMdpErrors { motDePasse?: string; confirmation?: string }

export default function ModifierUtilisateurPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: utilisateur, isLoading, isError } = useUtilisateur(id)
  const { mutateAsync: modifier, isPending: soumissionInfos } = useModifierUtilisateur(id)
  const { mutateAsync: resetPassword, isPending: soumissionMdp } = useResetPassword(id)

  const [formInfos, setFormInfos] = useState<FormInfos>({ nom: '', prenom: '', email: '', role: '', brancheType: '', actif: true })
  const [erreursInfos, setErreursInfos] = useState<FormInfosErrors>({})
  // Enfants rattachés : indépendant du rôle — un membre du staff (Chef de
  // Groupe, encadrement de branche, Ressources Adultes…) peut tout autant
  // être parent d'un scout de la paroisse qu'un compte PARENT dédié.
  const [scoutIds, setScoutIds] = useState<string[]>([])

  const [formMdp, setFormMdp] = useState<FormMdp>({ motDePasse: '', confirmation: '' })
  const [erreursMdp, setErreursMdp] = useState<FormMdpErrors>({})

  const { estModifie, definirReference, partirVers } = useGardeModifications({ ...formInfos, scoutIds })

  useEffect(() => {
    if (utilisateur) {
      const infosInitiales: FormInfos = { nom: utilisateur.nom, prenom: utilisateur.prenom, email: utilisateur.email ?? '', role: utilisateur.role, brancheType: utilisateur.brancheType ?? '', actif: utilisateur.actif }
      const scoutIdsInitiaux = (utilisateur.enfants ?? []).map((e) => e.id)
      setFormInfos(infosInitiales)
      setScoutIds(scoutIdsInitiaux)
      definirReference({ ...infosInitiales, scoutIds: scoutIdsInitiaux })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilisateur])

  const estBranche = ROLES_BRANCHE.includes(formInfos.role)

  const handleInfosChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setFormInfos((p) => ({ ...p, [name]: val }))
    if (erreursInfos[name as keyof FormInfosErrors]) setErreursInfos((p) => ({ ...p, [name]: undefined }))
  }

  const validerInfos = (): boolean => {
    const e: FormInfosErrors = {}
    if (!formInfos.nom.trim()) e.nom = 'Le nom est requis'
    if (!formInfos.prenom.trim()) e.prenom = 'Le prénom est requis'
    if (!formInfos.role) e.role = 'Le rôle est requis'
    if (estBranche && !formInfos.brancheType) e.brancheType = 'La branche est requise'
    setErreursInfos(e)
    return Object.keys(e).length === 0
  }

  const soumettreInfos = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validerInfos()) return
    try {
      await modifier({ nom: formInfos.nom.trim(), prenom: formInfos.prenom.trim(), email: formInfos.email.trim() || null, role: formInfos.role, brancheType: estBranche ? formInfos.brancheType : null, actif: formInfos.actif, scoutIds })
      definirReference({ ...formInfos, scoutIds })
      toast.success('Modifications enregistrées.')
      router.push('/dashboard/utilisateurs')
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

  if (isError || !utilisateur) return (
    <div className="space-y-4">
      <button type="button" onClick={() => partirVers('/dashboard/utilisateurs')} className="text-sm text-gray-500 hover:text-gray-700">← Retour</button>
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">Membre introuvable.</div>
    </div>
  )

  return (
    <div className="space-y-6 px-1 sm:px-0">
      <button type="button" onClick={() => partirVers('/dashboard/utilisateurs')} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour à la liste
      </button>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Modifier le membre</h1>
        <p className="text-sm text-gray-500 mt-0.5">{utilisateur.prenom} {utilisateur.nom}</p>
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

          <div>
            <label className={CLS_LABEL}>Rôle <span className="text-red-500">*</span></label>
            <select id="role" name="role" value={formInfos.role} onChange={handleInfosChange}
              className={erreursInfos.role ? CLS_SELECT_ERR : CLS_SELECT}>
              <option value="">Sélectionner un rôle</option>
              {ROLES_LISTE.map((r) => <option key={r} value={r}>{LABELS_ROLES[r]}</option>)}
            </select>
            {erreursInfos.role && <p className="mt-1 text-xs text-red-600">{erreursInfos.role}</p>}
          </div>

          {/* Branche — uniquement pour l'encadrement de branche */}
          {estBranche && (
            <div>
              <label className={CLS_LABEL}>Branche <span className="text-red-500">*</span></label>
              <select id="brancheType" name="brancheType" value={formInfos.brancheType} onChange={handleInfosChange}
                className={erreursInfos.brancheType ? CLS_SELECT_ERR : CLS_SELECT}>
                <option value="">Sélectionner une branche</option>
                {Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
              </select>
              {erreursInfos.brancheType && <p className="mt-1 text-xs text-red-600">{erreursInfos.brancheType}</p>}
            </div>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input id="actif" name="actif" type="checkbox" checked={formInfos.actif} onChange={handleInfosChange}
              className="w-4 h-4 accent-[#1a4731] rounded" />
            <span className="text-sm text-gray-700">Compte actif</span>
          </label>

          <div className="border-t border-gray-100 pt-4">
            <SelecteurEnfants scoutIds={scoutIds} onChange={setScoutIds} scoutsInitiaux={utilisateur.enfants} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={soumissionInfos || !estModifie}
              className="w-full rounded-lg bg-[#1a4731] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#163d29] disabled:opacity-60 sm:w-auto">
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
              className="w-full rounded-lg bg-[#1a4731] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#163d29] disabled:opacity-60 sm:w-auto">
              {soumissionMdp ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
