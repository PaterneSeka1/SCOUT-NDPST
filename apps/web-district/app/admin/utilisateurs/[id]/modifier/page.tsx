'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'
import { LABELS_ROLES, ROLES_ASSIGNABLES_PAROISSE, ROLES_BRANCHE } from '@scout/shared'
import { LABELS_BRANCHES } from '@scout/shared'
import { PasswordInput } from '@/app/components/PasswordInput'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@scout/shared'
import { BackLink } from '@/app/components/ui/BackLink'

const CLS_INPUT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_INPUT_ERR =
  'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_SELECT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_SELECT_ERR =
  'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

const ROLES_LISTE = ROLES_ASSIGNABLES_PAROISSE

interface UtilisateurDetail {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  telephone: string | null
  email: string | null
  role: string
  brancheType: string | null
  actif: boolean
  createdAt: string
  updatedAt?: string
  paroisse: { id: string; nom: string }
}

interface FormInfos {
  nom: string
  prenom: string
  email: string
  role: string
  brancheType: string
  actif: boolean
}
interface FormInfosErrors {
  nom?: string
  prenom?: string
  role?: string
  brancheType?: string
}
interface FormMdp {
  motDePasse: string
  confirmation: string
}
interface FormMdpErrors {
  motDePasse?: string
  confirmation?: string
}

export default function ModifierUtilisateurPlateformePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [utilisateur, setUtilisateur] = useState<UtilisateurDetail | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreurChargement, setErreurChargement] = useState(false)

  const [formInfos, setFormInfos] = useState<FormInfos>({
    nom: '',
    prenom: '',
    email: '',
    role: '',
    brancheType: '',
    actif: true,
  })
  const [erreursInfos, setErreursInfos] = useState<FormInfosErrors>({})
  const [soumissionInfos, setSoumissionInfos] = useState(false)

  const estBranche = ROLES_BRANCHE.includes(formInfos.role)

  const [formMdp, setFormMdp] = useState<FormMdp>({ motDePasse: '', confirmation: '' })
  const [erreursMdp, setErreursMdp] = useState<FormMdpErrors>({})
  const [soumissionMdp, setSoumissionMdp] = useState(false)

  const charger = useCallback(() => {
    fetch(`/api/admin/utilisateurs/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data: UtilisateurDetail) => {
        setErreurChargement(false)
        setUtilisateur(data)
        setFormInfos({
          nom: data.nom,
          prenom: data.prenom,
          email: data.email ?? '',
          role: data.role,
          brancheType: data.brancheType ?? '',
          actif: data.actif,
        })
      })
      .catch(() => {
        setErreurChargement(true)
        toast.error('Impossible de charger cet utilisateur.')
      })
      .finally(() => setChargement(false))
  }, [id])

  useEffect(() => {
    charger()
  }, [charger])

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
    if ((formInfos.role !== utilisateur?.role || (!formInfos.actif && utilisateur?.actif)) && !await confirmer({
      titre: 'Modifier les accès de ce compte ?',
      description: 'Le changement de rôle ou la désactivation révoquera les sessions en cours. Vérifiez les accès avant de confirmer.',
      danger: true,
    })) return
    setSoumissionInfos(true)
    try {
      const res = await fetch(`/api/admin/utilisateurs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: formInfos.nom.trim(),
          prenom: formInfos.prenom.trim(),
          email: formInfos.email.trim() || null,
          role: formInfos.role,
          brancheType: estBranche && formInfos.brancheType ? formInfos.brancheType : null,
          actif: formInfos.actif,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur serveur')
        return
      }
      toast.success('Modifications enregistrées.')
      router.push('/admin/utilisateurs')
    } catch {
      toast.error('Une erreur est survenue')
    } finally {
      setSoumissionInfos(false)
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
    if (!await confirmer({
      titre: 'Réinitialiser les accès ?',
      description: 'Les sessions actuelles seront révoquées. Remettez ce mot de passe temporaire en personne au membre : il devra le remplacer à sa prochaine connexion.',
      labelConfirmer: 'Réinitialiser', danger: true,
    })) return
    setSoumissionMdp(true)
    try {
      const res = await fetch(`/api/admin/utilisateurs/${id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nouveauMotDePasse: formMdp.motDePasse }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur serveur')
        return
      }
      toast.success('Mot de passe réinitialisé.')
      setFormMdp({ motDePasse: '', confirmation: '' })
    } catch {
      toast.error('Une erreur est survenue')
    } finally {
      setSoumissionMdp(false)
    }
  }

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  if (erreurChargement || !utilisateur) {
    return (
      <div className="space-y-4">
        <BackLink href="/admin/utilisateurs">Retour</BackLink>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Utilisateur introuvable.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-1 sm:px-0">
      <BackLink href="/admin/utilisateurs">Retour à la liste</BackLink>

      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Modifier l&apos;utilisateur</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {utilisateur.prenom} {utilisateur.nom} — {utilisateur.paroisse.nom}
        </p>
      </div>

      {/* Section 1 — Informations générales */}
      <form onSubmit={soumettreInfos} noValidate>
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="border-b border-gray-100 pb-3 text-sm font-semibold text-gray-800">Informations générales</h2>

          {/* Paroisse — lecture seule, non réassignable depuis cette page */}
          <div>
            <label htmlFor="paroisse" className={CLS_LABEL}>Paroisse</label>
            <input
              type="text"
              id="paroisse" value={utilisateur.paroisse.nom}
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">La paroisse ne peut pas être modifiée depuis cette page.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nom" className={CLS_LABEL}>
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                id="nom" aria-invalid={Boolean(erreursInfos.nom)} aria-describedby={erreursInfos.nom ? 'nom-erreur' : undefined}
                name="nom"
                type="text"
                value={formInfos.nom}
                onChange={handleInfosChange}
                placeholder="Nom de famille"
                className={erreursInfos.nom ? CLS_INPUT_ERR : CLS_INPUT}
              />
              {erreursInfos.nom && <p id="nom-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreursInfos.nom}</p>}
            </div>
            <div>
              <label htmlFor="prenom" className={CLS_LABEL}>
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                id="prenom" aria-invalid={Boolean(erreursInfos.prenom)} aria-describedby={erreursInfos.prenom ? 'prenom-erreur' : undefined}
                name="prenom"
                type="text"
                value={formInfos.prenom}
                onChange={handleInfosChange}
                placeholder="Prénom"
                className={erreursInfos.prenom ? CLS_INPUT_ERR : CLS_INPUT}
              />
              {erreursInfos.prenom && <p id="prenom-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreursInfos.prenom}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="email" className={CLS_LABEL}>
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

          <div>
            <label htmlFor="role" className={CLS_LABEL}>
              Rôle <span className="text-red-500">*</span>
            </label>
            <select
              id="role" aria-invalid={Boolean(erreursInfos.role)} aria-describedby={erreursInfos.role ? 'role-erreur' : undefined}
              name="role"
              value={formInfos.role}
              onChange={handleInfosChange}
              className={erreursInfos.role ? CLS_SELECT_ERR : CLS_SELECT}
            >
              <option value="">Sélectionner un rôle</option>
              {ROLES_LISTE.map((r) => (
                <option key={r} value={r}>
                  {LABELS_ROLES[r]}
                </option>
              ))}
            </select>
            {erreursInfos.role && <p id="role-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreursInfos.role}</p>}
          </div>

          {/* Branche — requise pour l'encadrement de branche paroissial */}
          {estBranche && (
            <div>
              <label htmlFor="brancheType" className={CLS_LABEL}>
                Branche <span className="text-red-500">*</span>
              </label>
              <select
                id="brancheType" aria-invalid={Boolean(erreursInfos.brancheType)} aria-describedby={erreursInfos.brancheType ? 'brancheType-erreur' : undefined}
                name="brancheType"
                value={formInfos.brancheType}
                onChange={handleInfosChange}
                className={erreursInfos.brancheType ? CLS_SELECT_ERR : CLS_SELECT}
              >
                <option value="">Sélectionner une branche</option>
                {Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))}
              </select>
              {erreursInfos.brancheType && <p id="brancheType-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreursInfos.brancheType}</p>}
            </div>
          )}

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
              className="w-full rounded-lg px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50 sm:w-auto"
              style={{ backgroundColor: 'var(--cp)' }}
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
              <label htmlFor="motDePasse" className={CLS_LABEL}>
                Mot de passe temporaire <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                id="motDePasse" aria-invalid={Boolean(erreursMdp.motDePasse)} aria-describedby={erreursMdp.motDePasse ? 'motDePasse-erreur' : undefined}
                name="motDePasse"
                value={formMdp.motDePasse}
                onChange={handleMdpChange}
                placeholder={REGLE_MOT_DE_PASSE}
                className={erreursMdp.motDePasse ? CLS_INPUT_ERR : CLS_INPUT}
              />
              {erreursMdp.motDePasse && <p id="motDePasse-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreursMdp.motDePasse}</p>}
            </div>
            <div>
              <label htmlFor="confirmation" className={CLS_LABEL}>
                Confirmation <span className="text-red-500">*</span>
              </label>
              <PasswordInput
                id="confirmation" aria-invalid={Boolean(erreursMdp.confirmation)} aria-describedby={erreursMdp.confirmation ? 'confirmation-erreur' : undefined}
                name="confirmation"
                value={formMdp.confirmation}
                onChange={handleMdpChange}
                placeholder="Répéter le mot de passe"
                className={erreursMdp.confirmation ? CLS_INPUT_ERR : CLS_INPUT}
              />
              {erreursMdp.confirmation && <p id="confirmation-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreursMdp.confirmation}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              disabled={soumissionMdp}
              className="w-full rounded-lg px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50 sm:w-auto"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {soumissionMdp ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
