'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useUtilisateur, useModifierUtilisateur, useResetPassword, type Utilisateur } from '@/hooks/useUtilisateurs'
import { PasswordInput } from '@/components/PasswordInput'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@scout/shared'
import { BackLink } from '@/components/ui/BackLink'

const CLS_INPUT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_INPUT_ERR =
  'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

interface FormInfos {
  nom: string
  prenom: string
  email: string
  actif: boolean
}
interface FormInfosErrors {
  nom?: string
  prenom?: string
}
interface FormMdp {
  motDePasse: string
  confirmation: string
}
interface FormMdpErrors {
  motDePasse?: string
  confirmation?: string
}

export default function ModifierParentPage() {
  const { id } = useParams<{ id: string }>()
  const { data: parent, isLoading, isError } = useUtilisateur(id)

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--cp) border-t-transparent" />
      </div>
    )

  if (isError || !parent)
    return (
      <div className="space-y-4">
        <BackLink href="/dashboard/parents">Retour</BackLink>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Parent introuvable.
        </div>
      </div>
    )

  return <FormulaireParent key={id} id={id} parent={parent} />
}

function FormulaireParent({ id, parent }: { id: string; parent: Utilisateur }) {
  const router = useRouter()

  const { mutateAsync: modifier, isPending: soumissionInfos } = useModifierUtilisateur(id)
  const { mutateAsync: resetPassword, isPending: soumissionMdp } = useResetPassword(id)

  const [formInfos, setFormInfos] = useState<FormInfos>({
    nom: parent.nom,
    prenom: parent.prenom,
    email: parent.email ?? '',
    actif: parent.actif,
  })
  const [erreursInfos, setErreursInfos] = useState<FormInfosErrors>({})

  const [formMdp, setFormMdp] = useState<FormMdp>({ motDePasse: '', confirmation: '' })
  const [erreursMdp, setErreursMdp] = useState<FormMdpErrors>({})

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
    try {
      await modifier({
        nom: formInfos.nom.trim(),
        prenom: formInfos.prenom.trim(),
        email: formInfos.email.trim() || null,
        actif: formInfos.actif,
      })
      toast.success('Modifications enregistrées.')
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
    try {
      await resetPassword({ nouveauMotDePasse: formMdp.motDePasse })
      toast.success('Mot de passe réinitialisé.')
      setFormMdp({ motDePasse: '', confirmation: '' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-1 sm:px-0">
      <BackLink href="/dashboard/parents">Retour à la liste</BackLink>

      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Modifier le parent</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {parent.prenom} {parent.nom}
        </p>
      </div>

      {/* Section 1 — Informations générales */}
      <form onSubmit={soumettreInfos} noValidate>
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="border-b border-gray-100 pb-3 text-sm font-semibold text-gray-800">Informations générales</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                id="nom"
                name="nom"
                type="text"
                value={formInfos.nom}
                onChange={handleInfosChange}
                placeholder="Nom de famille"
                className={erreursInfos.nom ? CLS_INPUT_ERR : CLS_INPUT}
              />
              {erreursInfos.nom && <p className="mt-1 text-xs text-red-600">{erreursInfos.nom}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                id="prenom"
                name="prenom"
                type="text"
                value={formInfos.prenom}
                onChange={handleInfosChange}
                placeholder="Prénom"
                className={erreursInfos.prenom ? CLS_INPUT_ERR : CLS_INPUT}
              />
              {erreursInfos.prenom && <p className="mt-1 text-xs text-red-600">{erreursInfos.prenom}</p>}
            </div>
          </div>

          <div>
            <label className={CLS_LABEL}>
              Email <span className="text-xs font-normal text-gray-400">(optionnel)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formInfos.email}
              onChange={handleInfosChange}
              placeholder="exemple@email.com"
              className={CLS_INPUT}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              id="actif"
              name="actif"
              type="checkbox"
              checked={formInfos.actif}
              onChange={handleInfosChange}
              className="h-4 w-4 rounded accent-(--cp)"
            />
            <span className="text-sm text-gray-700">Compte actif</span>
          </label>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              disabled={soumissionInfos}
              className="w-full rounded-lg bg-(--cp) px-5 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-60 sm:w-auto sm:flex-none"
            >
              {soumissionInfos ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </div>
        </div>
      </form>

      {/* Section 2 — Réinitialisation du mot de passe */}
      <form onSubmit={soumettreMdp} noValidate>
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="border-b border-gray-100 pb-3 text-sm font-semibold text-gray-800">
            Réinitialiser le mot de passe
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>
                Nouveau mot de passe <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                id="motDePasse"
                name="motDePasse"
                value={formMdp.motDePasse}
                onChange={handleMdpChange}
                placeholder={REGLE_MOT_DE_PASSE}
                className={erreursMdp.motDePasse ? CLS_INPUT_ERR : CLS_INPUT}
              />
              {erreursMdp.motDePasse && <p className="mt-1 text-xs text-red-600">{erreursMdp.motDePasse}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>
                Confirmation <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                id="confirmation"
                name="confirmation"
                value={formMdp.confirmation}
                onChange={handleMdpChange}
                placeholder="Répéter le mot de passe"
                className={erreursMdp.confirmation ? CLS_INPUT_ERR : CLS_INPUT}
              />
              {erreursMdp.confirmation && <p className="mt-1 text-xs text-red-600">{erreursMdp.confirmation}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              disabled={soumissionMdp}
              className="w-full rounded-lg bg-(--cp) px-5 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-60 sm:w-auto sm:flex-none"
            >
              {soumissionMdp ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
