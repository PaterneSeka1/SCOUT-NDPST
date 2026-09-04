'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { SelecteurMembre } from '@/app/components/SelecteurMembre'
import { LABELS_ROLES, ROLES_ASSIGNABLES_DISTRICT } from '@/lib/roles'
import { LABELS_BRANCHES } from '@/lib/branches'
import { useCreerDistrictUtilisateur, useDistrictPersonnelEligible } from '@/hooks/useDistrictUtilisateurs'
import { BackLink } from '@/app/components/ui/BackLink'

const CLS_SELECT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)] focus:border-transparent'
const CLS_SELECT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

interface FormData {
  utilisateurId: string
  role: string
  fonction: string
  brancheType: string
}

interface FormErrors {
  utilisateurId?: string
  role?: string
  brancheType?: string
}

const ROLES_LISTE = ROLES_ASSIGNABLES_DISTRICT

export default function NouveauMembreEquipePage() {
  const router = useRouter()
  const { mutateAsync, isPending } = useCreerDistrictUtilisateur()
  const { data: personnelEligible, isLoading: chargementPersonnel, isError: erreurPersonnel } = useDistrictPersonnelEligible()

  const [form, setForm] = useState<FormData>({ utilisateurId: '', role: '', fonction: '', brancheType: '' })
  const [erreurs, setErreurs] = useState<FormErrors>({})
  const [modeFonction, setModeFonction] = useState<'branche' | 'autre'>('autre')

  const estAssistant = form.role === 'ASSISTANT_DISTRICT'
  const modeBranche = modeFonction === 'branche'
  const personnel = personnelEligible ?? []

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    if (erreurs[name as keyof FormErrors]) setErreurs((p) => ({ ...p, [name]: undefined }))
  }

  const handleMembreChange = (utilisateurId: string) => {
    setForm((p) => ({ ...p, utilisateurId }))
    if (erreurs.utilisateurId) setErreurs((p) => ({ ...p, utilisateurId: undefined }))
  }

  const valider = (): boolean => {
    const e: FormErrors = {}
    if (!form.utilisateurId) e.utilisateurId = 'Le membre du staff à désigner est requis'
    if (!form.role) e.role = 'Le rôle est requis'
    if (estAssistant && modeBranche && !form.brancheType) e.brancheType = 'La branche est requise'
    setErreurs(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valider()) return
    try {
      await mutateAsync({
        utilisateurId: form.utilisateurId,
        role: form.role,
        fonction: estAssistant && !modeBranche && form.fonction.trim() ? form.fonction.trim() : null,
        brancheType: estAssistant && modeBranche && form.brancheType ? form.brancheType : null,
      })
      router.push('/district/equipe')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  return (
    <div className="space-y-6">
      <BackLink href="/district/equipe">Retour à la liste</BackLink>

      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nommer un membre de l&apos;équipe</h1>
      <p className="text-sm text-gray-500 -mt-4">
        Choisi parmi le staff des paroisses du district — il continue d&apos;exercer son rôle paroissial normalement en plus de sa charge de district.
      </p>

      {erreurPersonnel && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          Impossible de charger le personnel éligible du district.
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3">Informations générales</h2>

          <div>
            <SelecteurMembre
              id="utilisateurId"
              label="Membre du staff"
              required
              membres={personnel}
              value={form.utilisateurId}
              onChange={handleMembreChange}
              disabled={chargementPersonnel || personnel.length === 0}
              placeholder={chargementPersonnel ? 'Chargement…' : 'Rechercher le membre à nommer…'}
              emptyMessage="Aucun membre du staff disponible."
              error={erreurs.utilisateurId}
            />
            {!chargementPersonnel && personnel.length === 0 && (
              <p className="mt-1 text-xs text-orange-600">Aucun membre du staff disponible dans les paroisses de ce district.</p>
            )}
          </div>

          {/* Rôle */}
          <div>
            <label className={CLS_LABEL}>Rôle <span className="text-red-500">*</span></label>
            <select id="role" name="role" value={form.role} onChange={handleChange}
              className={erreurs.role ? CLS_SELECT_ERR : CLS_SELECT}>
              <option value="">Sélectionner un rôle</option>
              {ROLES_LISTE.map((r) => <option key={r} value={r}>{LABELS_ROLES[r]}</option>)}
            </select>
            {erreurs.role && <p className="mt-1 text-xs text-red-600">{erreurs.role}</p>}
          </div>

          {/* Fonction — uniquement pour ASSISTANT_DISTRICT : chargé d'une branche (structuré) OU autre fonction (texte libre), mutuellement exclusifs */}
          {estAssistant && (
            <div className="space-y-3">
              <div>
                <label className={CLS_LABEL}>Fonction de l&apos;assistant</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="modeFonction" checked={modeBranche}
                      onChange={() => setModeFonction('branche')} className="accent-[var(--cp)]" />
                    Chargé d&apos;une branche
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="modeFonction" checked={!modeBranche}
                      onChange={() => setModeFonction('autre')} className="accent-[var(--cp)]" />
                    Autre fonction
                  </label>
                </div>
              </div>

              {modeBranche ? (
                <div>
                  <label className={CLS_LABEL}>Branche <span className="text-red-500">*</span></label>
                  <select id="brancheType" name="brancheType" value={form.brancheType} onChange={handleChange}
                    className={erreurs.brancheType ? CLS_SELECT_ERR : CLS_SELECT}>
                    <option value="">Sélectionner une branche</option>
                    {Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => (
                      <option key={valeur} value={valeur}>{libelle}</option>
                    ))}
                  </select>
                  {erreurs.brancheType && <p className="mt-1 text-xs text-red-600">{erreurs.brancheType}</p>}
                </div>
              ) : (
                <div>
                  <label className={CLS_LABEL}>Fonction <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
                  <input id="fonction" name="fonction" type="text" value={form.fonction} onChange={handleChange}
                    placeholder="Ex. Spiritualité, Secrétariat…" className={CLS_SELECT} />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={isPending}
              className="sm:flex-none bg-[var(--cp)] text-white px-5 py-2.5 rounded-lg hover:brightness-110 transition-colors text-sm font-medium disabled:opacity-60">
              {isPending ? 'Enregistrement…' : 'Nommer dans l’équipe'}
            </button>
            <Link href="/district/equipe"
              className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
              Annuler
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
