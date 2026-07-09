'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useCreerUtilisateur } from '@/hooks/useUtilisateurs'
import { useScouts } from '@/hooks/useScouts'
import type { Scout } from '@/hooks/useScouts'
import { PasswordInput } from '@/app/components/PasswordInput'
import { LABELS_BRANCHES, ORDRE_BRANCHES } from '@/lib/branches'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_INPUT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'
const CLS_SELECT = 'sm:w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent bg-white'

// Recherche paginée côté serveur : avec plusieurs milliers d'enfants dans la
// paroisse, on ne charge jamais toute la liste — seulement la page courante.
const LIMITE_SCOUTS_PAGE = 20

const OPTIONS_BRANCHES_SCOUT = [
  { valeur: '', label: 'Toutes les branches' },
  ...ORDRE_BRANCHES.map((branche) => ({ valeur: branche, label: LABELS_BRANCHES[branche] })),
]

type ScoutLeger = Pick<Scout, 'id' | 'nom' | 'prenom' | 'brancheType' | 'matricule'>

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

export default function NouveauParentPage() {
  const router = useRouter()
  const { mutateAsync, isPending } = useCreerUtilisateur()

  const [form, setForm] = useState<FormData>({
    nom: '', prenom: '', email: '', telephone: '', motDePasse: '', confirmation: '', scoutIds: [],
  })
  const [erreurs, setErreurs] = useState<FormErrors>({})
  const [rechercheScout, setRechercheScout] = useState('')
  const [rechercheScoutDebounce, setRechercheScoutDebounce] = useState('')
  const [brancheFiltreScout, setBrancheFiltreScout] = useState('')
  const [pageScouts, setPageScouts] = useState(1)
  // Conserve les enfants déjà cochés même quand ils sortent de la page/recherche
  // affichée, pour que les puces de sélection restent correctes.
  const [scoutsSelectionnesMap, setScoutsSelectionnesMap] = useState<Record<string, ScoutLeger>>({})
  const debounceRechercheScoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    data: scoutsData,
    isLoading: chargementScouts,
    isFetching: rechercheScoutEnCours,
    isError: erreurScouts,
  } = useScouts({
    actif: true,
    recherche: rechercheScoutDebounce || undefined,
    branche: brancheFiltreScout || undefined,
    page: pageScouts,
    limite: LIMITE_SCOUTS_PAGE,
  })

  const scouts = useMemo(() => scoutsData?.scouts ?? [], [scoutsData])
  const totalScouts = scoutsData?.total ?? 0
  const totalPagesScouts = scoutsData?.totalPages ?? 1
  const rechercheScoutActive = Boolean(rechercheScoutDebounce || brancheFiltreScout)
  const scoutsSelectionnes = useMemo(
    () => Object.values(scoutsSelectionnesMap),
    [scoutsSelectionnesMap],
  )

  const handleRechercheScoutChange = (valeur: string) => {
    setRechercheScout(valeur)
    if (debounceRechercheScoutRef.current) clearTimeout(debounceRechercheScoutRef.current)
    debounceRechercheScoutRef.current = setTimeout(() => {
      setRechercheScoutDebounce(valeur)
      setPageScouts(1)
    }, 300)
  }

  const handleBrancheScoutChange = (valeur: string) => {
    setBrancheFiltreScout(valeur)
    setPageScouts(1)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    if (erreurs[name as keyof FormErrors]) setErreurs((p) => ({ ...p, [name]: undefined }))
  }

  const basculerScout = (scout: ScoutLeger) => {
    const estSelectionne = form.scoutIds.includes(scout.id)
    setForm((p) => ({
      ...p,
      scoutIds: estSelectionne
        ? p.scoutIds.filter((id) => id !== scout.id)
        : [...p.scoutIds, scout.id],
    }))
    setScoutsSelectionnesMap((p) => {
      if (!estSelectionne) return { ...p, [scout.id]: scout }
      const reste = { ...p }
      delete reste[scout.id]
      return reste
    })
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
      router.push('/dashboard/parents')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/parents" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour à la liste
      </Link>

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

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h3 className="text-sm font-semibold text-gray-700">Enfants rattachés</h3>
              <span className="text-xs text-gray-400">
                {form.scoutIds.length} enfant{form.scoutIds.length > 1 ? 's' : ''} sélectionné{form.scoutIds.length > 1 ? 's' : ''}
              </span>
            </div>

            {scoutsSelectionnes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {scoutsSelectionnes.map((scout) => (
                  <button
                    key={scout.id}
                    type="button"
                    onClick={() => basculerScout(scout)}
                    className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800 hover:bg-green-100"
                  >
                    {scout.prenom} {scout.nom}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={rechercheScout}
                  onChange={(e) => handleRechercheScoutChange(e.target.value)}
                  placeholder="Rechercher un enfant par nom, prénom ou matricule…"
                  className={CLS_INPUT}
                />
                {rechercheScoutEnCours && !chargementScouts && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-gray-300 border-t-[#1a4731] rounded-full animate-spin" />
                )}
              </div>
              <select
                value={brancheFiltreScout}
                onChange={(e) => handleBrancheScoutChange(e.target.value)}
                className={CLS_SELECT}
              >
                {OPTIONS_BRANCHES_SCOUT.map((opt) => (
                  <option key={opt.valeur} value={opt.valeur}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
              {chargementScouts ? (
                <div className="flex items-center justify-center py-8">
                  <span className="w-5 h-5 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : erreurScouts ? (
                <p className="px-4 py-4 text-sm text-red-600">Impossible de charger les scouts.</p>
              ) : scouts.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-400">
                  {rechercheScoutActive ? 'Aucun enfant ne correspond à la recherche.' : 'Aucun enfant actif dans la paroisse.'}
                </p>
              ) : (
                <>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 bg-white">
                    {scouts.map((scout) => {
                      const selectionne = form.scoutIds.includes(scout.id)
                      return (
                        <label key={scout.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectionne}
                            onChange={() => basculerScout(scout)}
                            className="w-4 h-4 rounded accent-[#1a4731] flex-shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-gray-900 truncate">{scout.prenom} {scout.nom}</span>
                            <span className="block text-xs text-gray-500 truncate">
                              {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
                              {scout.matricule ? ` · ${scout.matricule}` : ''}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-500">
                      {totalScouts} enfant{totalScouts > 1 ? 's' : ''}
                      {totalPagesScouts > 1 ? ` — page ${pageScouts}/${totalPagesScouts}` : ''}
                    </p>
                    {totalPagesScouts > 1 && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPageScouts((p) => p - 1)}
                          disabled={pageScouts <= 1}
                          className="border border-gray-300 text-gray-700 px-2.5 py-1 rounded-md text-xs disabled:opacity-40 transition-colors hover:bg-white"
                        >
                          ← Précédent
                        </button>
                        <button
                          type="button"
                          onClick={() => setPageScouts((p) => p + 1)}
                          disabled={pageScouts >= totalPagesScouts}
                          className="border border-gray-300 text-gray-700 px-2.5 py-1 rounded-md text-xs disabled:opacity-40 transition-colors hover:bg-white"
                        >
                          Suivant →
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
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
            <button type="submit" disabled={isPending}
              className="sm:flex-none bg-[#1a4731] text-white px-5 py-2.5 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60">
              {isPending ? 'Enregistrement…' : 'Créer le parent'}
            </button>
            <Link href="/dashboard/parents"
              className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
              Annuler
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
