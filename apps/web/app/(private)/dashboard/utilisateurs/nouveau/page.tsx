'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_ROLES, ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT, ROLES_BRANCHE } from '@scout/shared'
import { LABELS_BRANCHES } from '@scout/shared'
import { useCreerUtilisateur } from '@/hooks/useUtilisateurs'
import { BackLink } from '@/components/ui/BackLink'

const CLS_INPUT = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_INPUT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_SELECT = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_SELECT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-stone-700 mb-1'

interface FormData {
  nom: string
  prenom: string
  email: string
  matricule: string
  telephone: string
  role: string
  brancheType: string
}

interface FormErrors {
  nom?: string
  prenom?: string
  matricule?: string
  telephone?: string
  role?: string
  brancheType?: string
}

const ROLES_LISTE = ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT

export default function NouvelUtilisateurPage() {
  const [creation, setCreation] = useState<{ id: string; motDePasseTemporaire: string } | null>(null)
  const { mutateAsync, isPending, reset } = useCreerUtilisateur()

  const [form, setForm] = useState<FormData>({
    nom: '', prenom: '', email: '', matricule: '', telephone: '', role: '', brancheType: '',
  })
  const [erreurs, setErreurs] = useState<FormErrors>({})

  const estParent = form.role === 'PARENT'
  const estBranche = ROLES_BRANCHE.includes(form.role)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    if (erreurs[name as keyof FormErrors]) setErreurs((p) => ({ ...p, [name]: undefined }))
  }

  const valider = (): boolean => {
    const e: FormErrors = {}
    if (!form.nom.trim()) e.nom = 'Le nom est requis'
    if (!form.prenom.trim()) e.prenom = 'Le prénom est requis'
    if (!form.role) e.role = 'Le rôle est requis'
    if (estBranche && !form.brancheType) e.brancheType = 'La branche est requise'
    if (estParent) {
      if (!form.telephone.trim()) e.telephone = 'Le numéro de téléphone est requis pour un parent'
    } else {
      if (!form.matricule.trim()) e.matricule = 'Le matricule est requis'
    }
    setErreurs(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valider()) return
    try {
      const resultat = await mutateAsync({
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim() || null,
        matricule: !estParent && form.matricule.trim() ? form.matricule.trim() : null,
        telephone: form.telephone.trim() || null,
        role: form.role,
        brancheType: estBranche ? form.brancheType : null,
      })
      setCreation(resultat)
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  if (creation) return (
    <section className="max-w-2xl space-y-4 rounded-xl border border-stone-200 bg-white p-6" aria-labelledby="creation-titre">
      <h1 id="creation-titre" className="text-xl font-bold">Compte créé</h1>
      <p>Remettez ce mot de passe temporaire en personne au membre. Il ne sera plus affiché après avoir quitté cette page.</p>
      <label htmlFor="secret-temporaire" className="block font-medium">Mot de passe temporaire</label>
      <input id="secret-temporaire" readOnly value={creation.motDePasseTemporaire} autoComplete="off" className="w-full rounded-lg border p-3 font-mono" />
      <p className="text-sm text-stone-600">Le membre devra définir son mot de passe personnel à sa première connexion.</p>
      <Link href="/dashboard/utilisateurs" className="inline-block rounded-lg bg-(--cp) px-4 py-2 text-white">Terminer</Link>
    </section>
  )

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/utilisateurs">Retour à la liste</BackLink>

      <h1 className="text-xl sm:text-2xl font-bold text-stone-900">Nouveau membre</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white rounded-xl border border-stone-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-stone-800 border-b border-stone-100 pb-3">Informations générales</h2>

          {/* Nom + Prénom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nom" className={CLS_LABEL}>Nom <span className="text-red-500">*</span></label>
              <input id="nom" aria-invalid={Boolean(erreurs.nom)} aria-describedby={erreurs.nom ? 'nom-erreur' : undefined} name="nom" type="text" value={form.nom} onChange={handleChange} placeholder="Nom de famille"
                className={erreurs.nom ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreurs.nom && <p id="nom-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreurs.nom}</p>}
            </div>
            <div>
              <label htmlFor="prenom" className={CLS_LABEL}>Prénom <span className="text-red-500">*</span></label>
              <input id="prenom" aria-invalid={Boolean(erreurs.prenom)} aria-describedby={erreurs.prenom ? 'prenom-erreur' : undefined} name="prenom" type="text" value={form.prenom} onChange={handleChange} placeholder="Prénom"
                className={erreurs.prenom ? CLS_INPUT_ERR : CLS_INPUT} />
              {erreurs.prenom && <p id="prenom-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreurs.prenom}</p>}
            </div>
          </div>

          {/* Rôle */}
          <div>
            <label htmlFor="role" className={CLS_LABEL}>Rôle <span className="text-red-500">*</span></label>
            <select id="role" aria-invalid={Boolean(erreurs.role)} aria-describedby={erreurs.role ? 'role-erreur' : undefined} name="role" value={form.role} onChange={handleChange}
              className={erreurs.role ? CLS_SELECT_ERR : CLS_SELECT}>
              <option value="">Sélectionner un rôle</option>
              {ROLES_LISTE.map((r) => <option key={r} value={r}>{LABELS_ROLES[r]}</option>)}
            </select>
            {erreurs.role && <p id="role-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreurs.role}</p>}
          </div>

          {/* Branche — uniquement pour l'encadrement de branche */}
          {estBranche && (
            <div>
              <label htmlFor="brancheType" className={CLS_LABEL}>Branche <span className="text-red-500">*</span></label>
              <select id="brancheType" aria-invalid={Boolean(erreurs.brancheType)} aria-describedby={erreurs.brancheType ? 'brancheType-erreur' : undefined} name="brancheType" value={form.brancheType} onChange={handleChange}
                className={erreurs.brancheType ? CLS_SELECT_ERR : CLS_SELECT}>
                <option value="">Sélectionner une branche</option>
                {Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => <option key={valeur} value={valeur}>{libelle}</option>)}
              </select>
              {erreurs.brancheType && <p id="brancheType-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreurs.brancheType}</p>}
            </div>
          )}

          {/* Matricule — masqué pour les parents */}
          {form.role && !estParent && (
            <div>
              <label htmlFor="matricule" className={CLS_LABEL}>Matricule <span className="text-red-500">*</span></label>
              <input id="matricule" aria-invalid={Boolean(erreurs.matricule)} aria-describedby={erreurs.matricule ? 'matricule-erreur' : undefined} name="matricule" type="text" value={form.matricule} onChange={handleChange}
                placeholder="Ex : 0545247O" className={`${erreurs.matricule ? CLS_INPUT_ERR : CLS_INPUT} font-mono`} />
              <p className="mt-1 text-xs text-stone-400">Fourni par le mouvement scout</p>
              {erreurs.matricule && <p id="matricule-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreurs.matricule}</p>}
            </div>
          )}

          {/* Téléphone */}
          <div>
            <label htmlFor="telephone" className={CLS_LABEL}>
              Téléphone {estParent ? <span className="text-red-500">*</span> : <span className="text-xs text-stone-400 font-normal">(optionnel)</span>}
            </label>
            <input id="telephone" aria-invalid={Boolean(erreurs.telephone)} aria-describedby={erreurs.telephone ? 'telephone-erreur' : undefined} name="telephone" type="tel" value={form.telephone} onChange={handleChange}
              placeholder="07 00 00 00 00" className={erreurs.telephone ? CLS_INPUT_ERR : CLS_INPUT} />
            {estParent && <p className="mt-1 text-xs text-stone-400">Le parent se connecte avec ce numéro</p>}
            {erreurs.telephone && <p id="telephone-erreur" role="alert" className="mt-1 text-xs text-red-600">{erreurs.telephone}</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className={CLS_LABEL}>Email <span className="text-xs text-stone-400 font-normal">(optionnel)</span></label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange}
              placeholder="exemple@email.com" className={CLS_INPUT} />
          </div>

          <p className="text-sm text-stone-600">Un mot de passe temporaire sera généré. Le membre devra le remplacer à sa première connexion.</p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={isPending}
              className="sm:flex-none bg-(--cp) text-white px-5 py-2.5 rounded-lg hover:brightness-110 transition-colors text-sm font-medium disabled:opacity-60">
              {isPending ? 'Enregistrement…' : 'Créer le membre'}
            </button>
            <Link href="/dashboard/utilisateurs"
              className="inline-flex items-center justify-center border border-stone-300 text-stone-700 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors text-sm">
              Annuler
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
