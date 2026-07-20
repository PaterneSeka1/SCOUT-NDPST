'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { LABELS_ROLES } from '@/lib/roles'
import { PasswordInput } from '@/app/components/PasswordInput'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { useGardeModifications } from '@/hooks/useGardeModifications'
import { confirmer } from '@/app/components/ConfirmDialog'

const CLS_INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400'
const CLS_INPUT_ERR = 'w-full rounded-lg border border-red-400 px-3 py-2 text-sm focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400'
const CLS_LABEL = 'text-xs font-semibold text-gray-600 mb-1.5 block'
const CLS_LABEL_LECTURE = 'text-xs font-semibold text-gray-400 mb-1 block'

interface Profil {
  id: string
  nom: string
  prenom: string
  email: string | null
  telephone: string | null
  matricule: string | null
  role: string
  paroisse: { id: string; nom: string } | null
}

interface FormInfos { nom: string; prenom: string; email: string; telephone: string }
interface FormInfosErrors { nom?: string; prenom?: string }
interface FormMdp { motDePasseActuel: string; nouveauMotDePasse: string; confirmation: string }
interface FormMdpErrors { motDePasseActuel?: string; nouveauMotDePasse?: string; confirmation?: string }

const FORM_MDP_VIDE: FormMdp = { motDePasseActuel: '', nouveauMotDePasse: '', confirmation: '' }

export default function MonProfilAdminPage() {
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
    const ok = await confirmer({
      titre: 'Enregistrer ces modifications ?',
      description: 'Vos informations de profil seront mises à jour.',
      labelConfirmer: 'Enregistrer',
    })
    if (!ok) return
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
    const ok = await confirmer({
      titre: 'Changer votre mot de passe ?',
      description: 'Votre mot de passe sera immédiatement modifié. Vos autres sessions actives pourraient être déconnectées.',
      labelConfirmer: 'Changer',
      danger: true,
    })
    if (!ok) return
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

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  if (erreurChargement || !profil) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-gray-600">Impossible de charger votre profil.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black text-gray-900">Mon profil</h1>
          {estModifie && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              Modifications non enregistrées
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">{profil.prenom} {profil.nom}</p>
      </div>

      {/* ── Mes informations ── */}
      <form onSubmit={soumettreInfos}>
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">Mes informations</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>Nom</label>
              <input id="nom" name="nom" type="text" value={formInfos.nom} onChange={handleInfosChange}
                className={erreursInfos.nom ? CLS_INPUT_ERR : CLS_INPUT} placeholder="Nom de famille" />
              {erreursInfos.nom && <p className="mt-1 text-xs text-red-600">{erreursInfos.nom}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>Prénom</label>
              <input id="prenom" name="prenom" type="text" value={formInfos.prenom} onChange={handleInfosChange}
                className={erreursInfos.prenom ? CLS_INPUT_ERR : CLS_INPUT} placeholder="Prénom" />
              {erreursInfos.prenom && <p className="mt-1 text-xs text-red-600">{erreursInfos.prenom}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>E-mail</label>
              <input id="email" name="email" type="email" value={formInfos.email} onChange={handleInfosChange}
                className={CLS_INPUT} placeholder="exemple@email.com" />
            </div>
            <div>
              <label className={CLS_LABEL}>Téléphone</label>
              <input id="telephone" name="telephone" type="tel" value={formInfos.telephone} onChange={handleInfosChange}
                className={CLS_INPUT} placeholder="Numéro de téléphone" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-gray-100">
            <div>
              <label className={CLS_LABEL_LECTURE}>Matricule</label>
              <p className="text-sm text-gray-700">{profil.matricule || '—'}</p>
            </div>
            <div>
              <label className={CLS_LABEL_LECTURE}>Rôle</label>
              <p className="text-sm text-gray-700">{LABELS_ROLES[profil.role] ?? profil.role}</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={soumissionInfos || !estModifie}
              className="rounded-lg px-6 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50 transition flex items-center gap-2"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {soumissionInfos && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
              {soumissionInfos ? 'Enregistrement…' : estModifie ? 'Enregistrer les modifications' : 'Aucune modification'}
            </button>
          </div>
        </section>
      </form>

      {/* ── Changer mon mot de passe ── */}
      <form onSubmit={soumettreMdp}>
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">Changer mon mot de passe</h2>

          <div>
            <label className={CLS_LABEL}>Mot de passe actuel</label>
            <PasswordInput id="motDePasseActuel" name="motDePasseActuel" value={formMdp.motDePasseActuel} onChange={handleMdpChange}
              className={erreursMdp.motDePasseActuel ? CLS_INPUT_ERR : CLS_INPUT} placeholder="Votre mot de passe actuel" />
            {erreursMdp.motDePasseActuel && <p className="mt-1 text-xs text-red-600">{erreursMdp.motDePasseActuel}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>Nouveau mot de passe</label>
              <PasswordInput id="nouveauMotDePasse" name="nouveauMotDePasse" value={formMdp.nouveauMotDePasse} onChange={handleMdpChange}
                className={erreursMdp.nouveauMotDePasse ? CLS_INPUT_ERR : CLS_INPUT} placeholder={REGLE_MOT_DE_PASSE} />
              {erreursMdp.nouveauMotDePasse && <p className="mt-1 text-xs text-red-600">{erreursMdp.nouveauMotDePasse}</p>}
            </div>
            <div>
              <label className={CLS_LABEL}>Confirmation</label>
              <PasswordInput id="confirmation" name="confirmation" value={formMdp.confirmation} onChange={handleMdpChange}
                className={erreursMdp.confirmation ? CLS_INPUT_ERR : CLS_INPUT} placeholder="Répéter le nouveau mot de passe" />
              {erreursMdp.confirmation && <p className="mt-1 text-xs text-red-600">{erreursMdp.confirmation}</p>}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={soumissionMdp}
              className="rounded-lg px-6 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50 transition flex items-center gap-2"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {soumissionMdp && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
              {soumissionMdp ? 'Modification…' : 'Changer le mot de passe'}
            </button>
          </div>
        </section>
      </form>
    </div>
  )
}
