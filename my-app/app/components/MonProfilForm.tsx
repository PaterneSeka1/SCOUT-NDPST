'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { libelleRoleAvecFonction } from '@/lib/roles'
import { PasswordInput } from '@/app/components/PasswordInput'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { useGardeModifications } from '@/hooks/useGardeModifications'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_INPUT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'
const CLS_LABEL_LECTURE = 'block text-xs font-medium text-gray-400 mb-1'

interface Profil {
  id: string
  nom: string
  prenom: string
  email: string | null
  telephone: string | null
  matricule: string | null
  role: string
  fonction: string | null
  brancheType: string | null
  roleDistrict: string | null
  fonctionDistrict: string | null
  brancheTypeDistrict: string | null
  paroisse: { id: string; nom: string } | null
}

interface FormInfos { nom: string; prenom: string; email: string; telephone: string }
interface FormInfosErrors { nom?: string; prenom?: string }
interface FormMdp { motDePasseActuel: string; nouveauMotDePasse: string; confirmation: string }
interface FormMdpErrors { motDePasseActuel?: string; nouveauMotDePasse?: string; confirmation?: string }

const FORM_MDP_VIDE: FormMdp = { motDePasseActuel: '', nouveauMotDePasse: '', confirmation: '' }

// Partagé par /dashboard/profil et /district/profil : les deux pointent vers
// le même compte et la même API (/api/me) — aucune raison de dupliquer ce
// formulaire entre les deux shells. Affiche en plus l'affectation district
// (roleDistrict) quand elle est renseignée, qu'on arrive ici depuis l'espace
// paroisse ou l'espace district.
export function MonProfilForm() {
  const [profil, setProfil] = useState<Profil | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreurChargement, setErreurChargement] = useState(false)

  const [formInfos, setFormInfos] = useState<FormInfos>({ nom: '', prenom: '', email: '', telephone: '' })
  const [erreursInfos, setErreursInfos] = useState<FormInfosErrors>({})
  const [soumissionInfos, setSoumissionInfos] = useState(false)

  const [formMdp, setFormMdp] = useState<FormMdp>(FORM_MDP_VIDE)
  const [erreursMdp, setErreursMdp] = useState<FormMdpErrors>({})
  const [soumissionMdp, setSoumissionMdp] = useState(false)

  const { estModifie, definirReference } = useGardeModifications(formInfos)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data: Profil) => {
        setProfil(data)
        const infos: FormInfos = {
          nom: data.nom,
          prenom: data.prenom,
          email: data.email ?? '',
          telephone: data.telephone ?? '',
        }
        setFormInfos(infos)
        definirReference(infos)
      })
      .catch(() => setErreurChargement(true))
      .finally(() => setChargement(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInfosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormInfos((p) => ({ ...p, [name]: value }))
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
    setSoumissionInfos(true)
    try {
      const res = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: formInfos.nom.trim(),
          prenom: formInfos.prenom.trim(),
          email: formInfos.email.trim() || null,
          telephone: formInfos.telephone.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erreur ?? 'Une erreur est survenue')
      setProfil(data)
      const infos: FormInfos = { nom: data.nom, prenom: data.prenom, email: data.email ?? '', telephone: data.telephone ?? '' }
      setFormInfos(infos)
      definirReference(infos)
      toast.success('Profil mis à jour avec succès.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
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
    if (!formMdp.motDePasseActuel) e.motDePasseActuel = 'Le mot de passe actuel est requis'
    if (!formMdp.nouveauMotDePasse) e.nouveauMotDePasse = 'Le nouveau mot de passe est requis'
    else if (!motDePasseValide(formMdp.nouveauMotDePasse)) e.nouveauMotDePasse = REGLE_MOT_DE_PASSE
    if (!formMdp.confirmation) e.confirmation = 'La confirmation est requise'
    else if (formMdp.nouveauMotDePasse !== formMdp.confirmation) e.confirmation = 'Les mots de passe ne correspondent pas'
    setErreursMdp(e)
    return Object.keys(e).length === 0
  }

  const soumettreMdp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validerMdp()) return
    setSoumissionMdp(true)
    try {
      const res = await fetch('/api/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motDePasseActuel: formMdp.motDePasseActuel,
          nouveauMotDePasse: formMdp.nouveauMotDePasse,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erreur ?? 'Une erreur est survenue')
      setFormMdp(FORM_MDP_VIDE)
      toast.success('Mot de passe mis à jour avec succès.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSoumissionMdp(false)
    }
  }

  if (chargement) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (erreurChargement || !profil) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
      Impossible de charger votre profil.
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mon profil</h1>
          {estModifie && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              Modifications non enregistrées
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{profil.prenom} {profil.nom}</p>
      </div>

      {/* Section 1 — Mes informations */}
      <form onSubmit={soumettreInfos} noValidate>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3">Mes informations</h2>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Email <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
              <input id="email" name="email" type="email" value={formInfos.email} onChange={handleInfosChange}
                placeholder="exemple@email.com" className={CLS_INPUT} />
            </div>
            <div>
              <label className={CLS_LABEL}>Téléphone <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
              <input id="telephone" name="telephone" type="tel" value={formInfos.telephone} onChange={handleInfosChange}
                placeholder="Numéro de téléphone" className={CLS_INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div>
              <label className={CLS_LABEL_LECTURE}>Matricule</label>
              <p className="text-sm text-gray-700">{profil.matricule || '—'}</p>
            </div>
            <div>
              <label className={CLS_LABEL_LECTURE}>Rôle</label>
              <p className="text-sm text-gray-700">{libelleRoleAvecFonction(profil.role, profil.fonction, profil.brancheType)}</p>
            </div>
            {profil.paroisse && (
              <div className="sm:col-span-2">
                <label className={CLS_LABEL_LECTURE}>Paroisse</label>
                <p className="text-sm text-gray-700">{profil.paroisse.nom}</p>
              </div>
            )}
            {profil.roleDistrict && (
              <div className="sm:col-span-2">
                <label className={CLS_LABEL_LECTURE}>Affectation district</label>
                <p className="text-sm text-gray-700">
                  {libelleRoleAvecFonction(profil.roleDistrict, profil.fonctionDistrict, profil.brancheTypeDistrict)}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={soumissionInfos || !estModifie}
              className="sm:flex-none bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60">
              {soumissionInfos ? 'Enregistrement…' : estModifie ? 'Enregistrer les modifications' : 'Aucune modification'}
            </button>
          </div>
        </div>
      </form>

      {/* Section 2 — Changer mon mot de passe */}
      <form onSubmit={soumettreMdp} noValidate>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3">Changer mon mot de passe</h2>

          <div>
            <label className={CLS_LABEL}>Mot de passe actuel <span className="text-red-500">*</span></label>
            <PasswordInput id="motDePasseActuel" name="motDePasseActuel" value={formMdp.motDePasseActuel} onChange={handleMdpChange}
              placeholder="Votre mot de passe actuel" className={erreursMdp.motDePasseActuel ? CLS_INPUT_ERR : CLS_INPUT} />
            {erreursMdp.motDePasseActuel && <p className="mt-1 text-xs text-red-600">{erreursMdp.motDePasseActuel}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={CLS_LABEL}>Nouveau mot de passe <span className="text-red-500">*</span></label>
              <PasswordInput id="nouveauMotDePasse" name="nouveauMotDePasse" value={formMdp.nouveauMotDePasse} onChange={handleMdpChange}
                placeholder={REGLE_MOT_DE_PASSE} className={erreursMdp.nouveauMotDePasse ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreursMdp.nouveauMotDePasse && <p className="mt-1 text-xs text-red-600">{erreursMdp.nouveauMotDePasse}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>Confirmation <span className="text-red-500">*</span></label>
              <PasswordInput id="confirmation" name="confirmation" value={formMdp.confirmation} onChange={handleMdpChange}
                placeholder="Répéter le nouveau mot de passe" className={erreursMdp.confirmation ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreursMdp.confirmation && <p className="mt-1 text-xs text-red-600">{erreursMdp.confirmation}</p>}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={soumissionMdp}
              className="sm:flex-none bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60">
              {soumissionMdp ? 'Modification…' : 'Changer le mot de passe'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
