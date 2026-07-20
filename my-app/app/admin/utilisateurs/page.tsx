'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  LABELS_ROLES,
  COULEURS_ROLES,
  ROLES_ASSIGNABLES_PAROISSE,
  ROLES_BRANCHE,
  ROLES_TOUT_STAFF,
  ROLES_DISTRICT_ETENDU,
  libelleRoleAvecFonction,
} from '@/lib/roles'
import { LABELS_BRANCHES } from '@/lib/branches'
import { estAssujettiAdhesion, LABELS_STATUT_COTISATION, COULEURS_STATUT_COTISATION } from '@/lib/cotisations'
import { confirmer } from '@/app/components/ConfirmDialog'

interface UtilisateurListe {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  telephone: string | null
  email: string | null
  role: string
  fonction: string | null
  brancheType: string | null
  roleDistrict: string | null
  fonctionDistrict: string | null
  brancheTypeDistrict: string | null
  actif: boolean
  createdAt: string
  paroisse: { id: string; nom: string; district?: { id: string; nom: string } | null }
  // Statut de la cotisation ADHESION_ANNUELLE de l'année pastorale en cours ;
  // null = non applicable (rôle hors ROLES_TOUT_STAFF) ou pas encore générée.
  statutAdhesion: string | null
}

interface ParoisseOption {
  id: string
  nom: string
  ville: string
  diocese: string
  actif: boolean
}

interface DistrictOption {
  id: string
  nom: string
  nbParoisses: number
}

const ROLES_FILTRE = ROLES_ASSIGNABLES_PAROISSE
const CATEGORIES_FILTRE = [
  { value: '', label: 'Tous les profils' },
  { value: 'staff', label: 'Staff paroissial' },
  { value: 'nommables-district', label: 'Nommables au district' },
  { value: 'equipe-district', label: 'Équipe district' },
  { value: 'commissaires-branche', label: 'Commissaires de branche' },
]
const AFFECTATIONS_DISTRICT_FILTRE = [
  { value: '', label: 'Toutes les affectations' },
  { value: 'AUCUNE', label: 'Sans affectation district' },
  { value: 'EQUIPE_DISTRICT', label: 'Toute l’équipe district' },
  { value: 'COMMISSAIRE_DISTRICT', label: 'Commissaire de District' },
  { value: 'ADJOINT_DISTRICT', label: 'Commissaire adjoint' },
  { value: 'COMMISSAIRES_BRANCHE', label: 'Commissaires de branche' },
  { value: 'ASSISTANT_DISTRICT', label: 'Assistants de district' },
]
const LIMITES_PAGE = [20, 50, 100]
const CLS_SELECT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_SELECT_ERR = 'w-full border border-red-400 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

interface FormNomination {
  role: string
  brancheType: string
  roleDistrict: string
  modeDistrict: 'branche' | 'fonction'
  brancheTypeDistrict: string
  fonctionDistrict: string
}

interface FormNominationErrors {
  role?: string
  brancheType?: string
  roleDistrict?: string
  brancheTypeDistrict?: string
}

function SelectStatutAdhesion({
  statut,
  enCours,
  onChange,
}: {
  statut: string | null
  enCours: boolean
  onChange: (statut: string) => void
}) {
  // null (aucune cotisation générée) s'affiche et se pilote comme NON_A_JOUR —
  // même sens pratique, voir BadgeAdhesion.
  const valeur = statut ?? 'NON_A_JOUR'
  return (
    <select
      value={valeur}
      disabled={enCours}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`text-xs font-medium rounded-full border-0 pl-2 pr-6 py-1 focus:outline-none focus:ring-2 focus:ring-[#1a4731] disabled:opacity-50 ${
        COULEURS_STATUT_COTISATION[valeur] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {Object.entries(LABELS_STATUT_COTISATION).map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  )
}

function libelleAffectationDistrict(role: string, fonction?: string | null, brancheType?: string | null): string {
  if (role === 'ASSISTANT_DISTRICT' && brancheType) {
    return `Commissaire de branche — ${LABELS_BRANCHES[brancheType] ?? brancheType}`
  }
  return libelleRoleAvecFonction(role, fonction, brancheType)
}

export default function UtilisateursPlateformePage() {
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurListe[]>([])
  const [paroisses, setParoisses] = useState<ParoisseOption[]>([])
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [limite, setLimite] = useState(20)
  const [chargement, setChargement] = useState(true)

  const [recherche, setRecherche] = useState('')
  const [rechercheDebounce, setRechercheDebounce] = useState('')
  const [categorieFiltre, setCategorieFiltre] = useState('')
  const [statutFiltre, setStatutFiltre] = useState('')
  const [districtFiltre, setDistrictFiltre] = useState('')
  const [roleFiltre, setRoleFiltre] = useState('')
  const [roleDistrictFiltre, setRoleDistrictFiltre] = useState('')
  const [brancheFiltre, setBrancheFiltre] = useState('')
  const [paroisseFiltre, setParoisseFiltre] = useState('')
  const [filtresMobilesOuverts, setFiltresMobilesOuverts] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [utilisateurNomination, setUtilisateurNomination] = useState<UtilisateurListe | null>(null)
  const [formNomination, setFormNomination] = useState<FormNomination>({
    role: '',
    brancheType: '',
    roleDistrict: '',
    modeDistrict: 'fonction',
    brancheTypeDistrict: '',
    fonctionDistrict: '',
  })
  const [erreursNomination, setErreursNomination] = useState<FormNominationErrors>({})
  const [soumissionNomination, setSoumissionNomination] = useState(false)
  const [enCoursAdhesion, setEnCoursAdhesion] = useState<string | null>(null)

  const roleNominationEstBranche = ROLES_BRANCHE.includes(formNomination.role)
  const nominationDistrictActive = !!formNomination.roleDistrict
  const nominationEstAssistantDistrict = formNomination.roleDistrict === 'ASSISTANT_DISTRICT'
  const nominationModeBranche = formNomination.modeDistrict === 'branche'
  const nbFiltresActifs = [
    recherche.trim() || rechercheDebounce,
    categorieFiltre,
    statutFiltre,
    districtFiltre,
    paroisseFiltre,
    roleFiltre,
    roleDistrictFiltre,
    brancheFiltre,
  ].filter(Boolean).length
  const libelleStatutActif = statutFiltre === 'actifs' ? 'Actifs' : statutFiltre === 'inactifs' ? 'Inactifs' : ''
  const etiquettesFiltresActifs = [
    recherche.trim() ? `Recherche : ${recherche.trim()}` : '',
    categorieFiltre ? CATEGORIES_FILTRE.find((categorie) => categorie.value === categorieFiltre)?.label : '',
    libelleStatutActif ? `Statut : ${libelleStatutActif}` : '',
    districtFiltre ? `District : ${districts.find((district) => district.id === districtFiltre)?.nom ?? 'sélectionné'}` : '',
    paroisseFiltre ? `Paroisse : ${paroisses.find((paroisse) => paroisse.id === paroisseFiltre)?.nom ?? 'sélectionnée'}` : '',
    roleFiltre ? `Rôle : ${LABELS_ROLES[roleFiltre] ?? roleFiltre}` : '',
    roleDistrictFiltre ? AFFECTATIONS_DISTRICT_FILTRE.find((option) => option.value === roleDistrictFiltre)?.label : '',
    brancheFiltre ? `Branche : ${LABELS_BRANCHES[brancheFiltre] ?? brancheFiltre}` : '',
  ].filter(Boolean)

  const handleRechercheChange = (valeur: string) => {
    setRecherche(valeur)
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => { setRechercheDebounce(valeur); setPage(1) }, 300)
    setDebounceTimer(timer)
  }

  useEffect(() => {
    fetch('/api/admin/paroisses')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then(setParoisses)
      .catch(() => toast.error('Impossible de charger la liste des paroisses.'))

    fetch('/api/admin/districts')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data) => setDistricts(data.districts ?? []))
      .catch(() => toast.error('Impossible de charger la liste des districts.'))
  }, [])

  const charger = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limite', String(limite))
    if (rechercheDebounce) params.set('recherche', rechercheDebounce)
    if (categorieFiltre) params.set('categorie', categorieFiltre)
    if (statutFiltre) params.set('statut', statutFiltre)
    if (districtFiltre) params.set('districtId', districtFiltre)
    if (roleFiltre) params.set('role', roleFiltre)
    if (roleDistrictFiltre) params.set('roleDistrict', roleDistrictFiltre)
    if (brancheFiltre) params.set('brancheType', brancheFiltre)
    if (paroisseFiltre) params.set('paroisseId', paroisseFiltre)

    fetch(`/api/admin/utilisateurs?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data) => {
        setUtilisateurs(data.utilisateurs)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      })
      .catch(() => toast.error('Impossible de charger les utilisateurs.'))
      .finally(() => setChargement(false))
  }, [page, limite, rechercheDebounce, categorieFiltre, statutFiltre, districtFiltre, roleFiltre, roleDistrictFiltre, brancheFiltre, paroisseFiltre])

  useEffect(() => { charger() }, [charger])

  const changerFiltre = (setter: (valeur: string) => void) => (valeur: string) => {
    setter(valeur)
    setPage(1)
  }

  const reinitialiserFiltres = () => {
    setRecherche('')
    setRechercheDebounce('')
    setCategorieFiltre('')
    setStatutFiltre('')
    setDistrictFiltre('')
    setParoisseFiltre('')
    setRoleFiltre('')
    setRoleDistrictFiltre('')
    setBrancheFiltre('')
    setPage(1)
    if (debounceTimer) clearTimeout(debounceTimer)
  }

  const ouvrirNomination = (utilisateur: UtilisateurListe) => {
    setUtilisateurNomination(utilisateur)
    setErreursNomination({})
    setFormNomination({
      role: utilisateur.role,
      brancheType: utilisateur.brancheType ?? '',
      roleDistrict: utilisateur.roleDistrict ?? '',
      modeDistrict: utilisateur.brancheTypeDistrict ? 'branche' : 'fonction',
      brancheTypeDistrict: utilisateur.brancheTypeDistrict ?? '',
      fonctionDistrict: utilisateur.fonctionDistrict ?? '',
    })
  }

  const fermerNomination = () => {
    if (soumissionNomination) return
    setUtilisateurNomination(null)
    setErreursNomination({})
  }

  const handleNominationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormNomination((p) => {
      const prochain = { ...p, [name]: value }
      if (name === 'role' && !ROLES_BRANCHE.includes(value)) prochain.brancheType = ''
      if (name === 'roleDistrict' && value !== 'ASSISTANT_DISTRICT') {
        prochain.brancheTypeDistrict = ''
        prochain.fonctionDistrict = ''
      }
      return prochain
    })
    if (erreursNomination[name as keyof FormNominationErrors]) {
      setErreursNomination((p) => ({ ...p, [name]: undefined }))
    }
    if (name === 'role' && erreursNomination.roleDistrict) {
      setErreursNomination((p) => ({ ...p, roleDistrict: undefined }))
    }
  }

  const validerNomination = (): boolean => {
    const e: FormNominationErrors = {}
    if (!formNomination.role) e.role = 'Le rôle paroissial est requis'
    if (roleNominationEstBranche && !formNomination.brancheType) e.brancheType = 'La branche est requise'
    if (nominationDistrictActive && !ROLES_TOUT_STAFF.includes(formNomination.role)) {
      e.roleDistrict = 'Seul un membre du staff peut recevoir une affectation district'
    }
    if (nominationDistrictActive && utilisateurNomination && !utilisateurNomination.actif) {
      e.roleDistrict = 'Le compte doit être actif pour une affectation district'
    }
    if (nominationEstAssistantDistrict && nominationModeBranche && !formNomination.brancheTypeDistrict) {
      e.brancheTypeDistrict = 'La branche est requise'
    }
    setErreursNomination(e)
    return Object.keys(e).length === 0
  }

  const soumettreNomination = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!utilisateurNomination || !validerNomination()) return
    const ok = await confirmer({
      titre: 'Enregistrer cette nomination ?',
      description: `Le rôle paroissial et l'affectation district de ${utilisateurNomination.prenom} ${utilisateurNomination.nom} seront mis à jour.`,
      labelConfirmer: 'Enregistrer',
    })
    if (!ok) return
    setSoumissionNomination(true)
    try {
      const res = await fetch(`/api/admin/utilisateurs/${utilisateurNomination.id}/nominations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: formNomination.role,
          brancheType: roleNominationEstBranche ? formNomination.brancheType : null,
          roleDistrict: formNomination.roleDistrict || null,
          fonctionDistrict:
            nominationEstAssistantDistrict && !nominationModeBranche && formNomination.fonctionDistrict.trim()
              ? formNomination.fonctionDistrict.trim()
              : null,
          brancheTypeDistrict:
            nominationEstAssistantDistrict && nominationModeBranche && formNomination.brancheTypeDistrict
              ? formNomination.brancheTypeDistrict
              : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur serveur')
        return
      }
      toast.success('Nominations enregistrées.')
      setUtilisateurs((liste) => liste.map((u) => (u.id === data.id ? data : u)))
      setUtilisateurNomination(null)
      charger()
    } catch {
      toast.error('Une erreur est survenue')
    } finally {
      setSoumissionNomination(false)
    }
  }

  const changerStatutAdhesion = async (utilisateur: UtilisateurListe, statut: string) => {
    const ok = await confirmer({
      titre: 'Modifier le statut d’adhésion ?',
      description: `Le statut d’adhésion de ${utilisateur.prenom} ${utilisateur.nom} passera à « ${LABELS_STATUT_COTISATION[statut] ?? statut} ».`,
      labelConfirmer: 'Confirmer',
    })
    if (!ok) {
      // Le <select> est un composant contrôlé (value dérivé de u.statutAdhesion,
      // cf. SelectStatutAdhesion) : le DOM natif a déjà affiché la nouvelle
      // option choisie par l'utilisateur avant l'ouverture de la confirmation.
      // On force ici un re-render (nouvelle référence d'objet/array) pour que
      // React réaffirme la valeur réelle et que le select revienne visuellement
      // à son option précédente sans modification effective du state.
      setUtilisateurs((liste) => liste.map((u) => (u.id === utilisateur.id ? { ...u } : u)))
      return
    }
    setEnCoursAdhesion(utilisateur.id)
    try {
      const res = await fetch(`/api/admin/utilisateurs/${utilisateur.id}/adhesion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur serveur')
        return
      }
      setUtilisateurs((liste) =>
        liste.map((u) => (u.id === utilisateur.id ? { ...u, statutAdhesion: data.statutAdhesion } : u)),
      )
      toast.success('Statut d’adhésion mis à jour.')
    } catch {
      toast.error('Une erreur est survenue')
    } finally {
      setEnCoursAdhesion(null)
    }
  }

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} utilisateur{total !== 1 ? 's' : ''} sur l&apos;ensemble des paroisses
          </p>
        </div>
        <Link
          href="/admin/utilisateurs/nouveau"
          className="flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-bold text-white hover:brightness-110 transition"
          style={{ backgroundColor: 'var(--cp)' }}
        >
          + Nouvel utilisateur
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm md:hidden">
        <label className={CLS_LABEL}>Recherche</label>
        <input
          type="text"
          placeholder="Nom, matricule, téléphone…"
          value={recherche}
          onChange={(e) => handleRechercheChange(e.target.value)}
          className={CLS_INPUT}
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFiltresMobilesOuverts(true)}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 active:bg-gray-50"
          >
            Filtres
            {nbFiltresActifs > 0 && (
              <span
                className="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: 'var(--cp)' }}
              >
                {nbFiltresActifs}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={reinitialiserFiltres}
            disabled={nbFiltresActifs === 0}
            className="h-11 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 active:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Effacer
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {etiquettesFiltresActifs.length > 0 ? (
            etiquettesFiltresActifs.map((etiquette) => (
              <span
                key={etiquette}
                className="inline-flex shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
              >
                {etiquette}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-500">Aucun filtre actif</span>
          )}
        </div>
      </div>

      {filtresMobilesOuverts && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 md:hidden">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-gray-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Filtres</h2>
                  <p className="text-xs text-gray-500">
                    {nbFiltresActifs > 0
                      ? `${nbFiltresActifs} filtre${nbFiltresActifs > 1 ? 's' : ''} actif${nbFiltresActifs > 1 ? 's' : ''}`
                      : 'Affinez la liste des utilisateurs'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFiltresMobilesOuverts(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-500 active:bg-gray-100"
                >
                  Fermer
                </button>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4 pb-24">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={CLS_LABEL}>Statut</label>
                  <select
                    value={statutFiltre}
                    onChange={(e) => changerFiltre(setStatutFiltre)(e.target.value)}
                    className={CLS_SELECT}
                  >
                    <option value="">Tous</option>
                    <option value="actifs">Actifs</option>
                    <option value="inactifs">Inactifs</option>
                  </select>
                </div>
                <div>
                  <label className={CLS_LABEL}>Affichage</label>
                  <select
                    value={limite}
                    onChange={(e) => {
                      setLimite(Number(e.target.value))
                      setPage(1)
                    }}
                    className={CLS_SELECT}
                  >
                    {LIMITES_PAGE.map((valeur) => (
                      <option key={valeur} value={valeur}>{valeur} / page</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={CLS_LABEL}>Profil rapide</label>
                <select
                  value={categorieFiltre}
                  onChange={(e) => changerFiltre(setCategorieFiltre)(e.target.value)}
                  className={CLS_SELECT}
                >
                  {CATEGORIES_FILTRE.map((categorie) => (
                    <option key={categorie.value} value={categorie.value}>{categorie.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={CLS_LABEL}>District</label>
                <select
                  value={districtFiltre}
                  onChange={(e) => changerFiltre(setDistrictFiltre)(e.target.value)}
                  className={CLS_SELECT}
                >
                  <option value="">Tous les districts</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>{district.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={CLS_LABEL}>Paroisse</label>
                <select
                  value={paroisseFiltre}
                  onChange={(e) => changerFiltre(setParoisseFiltre)(e.target.value)}
                  className={CLS_SELECT}
                >
                  <option value="">Toutes les paroisses</option>
                  {paroisses.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={CLS_LABEL}>Rôle paroissial</label>
                <select
                  value={roleFiltre}
                  onChange={(e) => changerFiltre(setRoleFiltre)(e.target.value)}
                  className={CLS_SELECT}
                >
                  <option value="">Tous les rôles</option>
                  {ROLES_FILTRE.map((role) => (
                    <option key={role} value={role}>{LABELS_ROLES[role]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={CLS_LABEL}>Affectation district</label>
                <select
                  value={roleDistrictFiltre}
                  onChange={(e) => changerFiltre(setRoleDistrictFiltre)(e.target.value)}
                  className={CLS_SELECT}
                >
                  {AFFECTATIONS_DISTRICT_FILTRE.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={CLS_LABEL}>Branche</label>
                <select
                  value={brancheFiltre}
                  onChange={(e) => changerFiltre(setBrancheFiltre)(e.target.value)}
                  className={CLS_SELECT}
                >
                  <option value="">Toutes les branches</option>
                  {Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>{libelle}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={reinitialiserFiltres}
                disabled={nbFiltresActifs === 0}
                className="h-11 flex-1 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Effacer
              </button>
              <button
                type="button"
                onClick={() => setFiltresMobilesOuverts(false)}
                className="h-11 flex-[1.4] rounded-lg px-3 text-sm font-bold text-white"
                style={{ backgroundColor: 'var(--cp)' }}
              >
                Voir les résultats
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden rounded-xl border border-gray-200 bg-white p-4 md:block">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <label className={CLS_LABEL}>Recherche</label>
            <input
              type="text"
              placeholder="Nom, prénom, matricule, téléphone, email…"
              value={recherche}
              onChange={(e) => handleRechercheChange(e.target.value)}
              className={CLS_INPUT}
            />
          </div>

          <div className="sm:col-span-1 lg:col-span-3">
            <label className={CLS_LABEL}>Profil rapide</label>
            <select
              value={categorieFiltre}
              onChange={(e) => changerFiltre(setCategorieFiltre)(e.target.value)}
              className={CLS_SELECT}
            >
              {CATEGORIES_FILTRE.map((categorie) => (
                <option key={categorie.value} value={categorie.value}>{categorie.label}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1 lg:col-span-2">
            <label className={CLS_LABEL}>Statut</label>
            <select
              value={statutFiltre}
              onChange={(e) => changerFiltre(setStatutFiltre)(e.target.value)}
              className={CLS_SELECT}
            >
              <option value="">Tous</option>
              <option value="actifs">Actifs</option>
              <option value="inactifs">Inactifs</option>
            </select>
          </div>

          <div className="sm:col-span-1 lg:col-span-2">
            <label className={CLS_LABEL}>Affichage</label>
            <select
              value={limite}
              onChange={(e) => {
                setLimite(Number(e.target.value))
                setPage(1)
              }}
              className={CLS_SELECT}
            >
              {LIMITES_PAGE.map((valeur) => (
                <option key={valeur} value={valeur}>{valeur} / page</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className={CLS_LABEL}>District</label>
            <select
              value={districtFiltre}
              onChange={(e) => changerFiltre(setDistrictFiltre)(e.target.value)}
              className={CLS_SELECT}
            >
              <option value="">Tous les districts</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>{district.nom}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className={CLS_LABEL}>Paroisse</label>
            <select
              value={paroisseFiltre}
              onChange={(e) => changerFiltre(setParoisseFiltre)(e.target.value)}
              className={CLS_SELECT}
            >
              <option value="">Toutes les paroisses</option>
              {paroisses.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className={CLS_LABEL}>Rôle paroissial</label>
            <select
              value={roleFiltre}
              onChange={(e) => changerFiltre(setRoleFiltre)(e.target.value)}
              className={CLS_SELECT}
            >
              <option value="">Tous les rôles</option>
              {ROLES_FILTRE.map((role) => (
                <option key={role} value={role}>{LABELS_ROLES[role]}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className={CLS_LABEL}>Affectation district</label>
            <select
              value={roleDistrictFiltre}
              onChange={(e) => changerFiltre(setRoleDistrictFiltre)(e.target.value)}
              className={CLS_SELECT}
            >
              {AFFECTATIONS_DISTRICT_FILTRE.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className={CLS_LABEL}>Branche</label>
            <select
              value={brancheFiltre}
              onChange={(e) => changerFiltre(setBrancheFiltre)(e.target.value)}
              className={CLS_SELECT}
            >
              <option value="">Toutes les branches</option>
              {Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => (
                <option key={valeur} value={valeur}>{libelle}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end lg:col-span-9">
            <div className="min-h-10 flex-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {nbFiltresActifs > 0
                ? `${nbFiltresActifs} filtre${nbFiltresActifs > 1 ? 's' : ''} actif${nbFiltresActifs > 1 ? 's' : ''}`
                : 'Aucun filtre actif'}
            </div>
            <button
              type="button"
              onClick={reinitialiserFiltres}
              disabled={nbFiltresActifs === 0}
              className="h-10 w-full rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {utilisateurs.map((u) => (
          <div
            key={u.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <button
              type="button"
              onClick={() => (window.location.href = `/admin/utilisateurs/${u.id}`)}
              className="block w-full text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-base font-semibold text-gray-900">{u.nom} {u.prenom}</p>
                  <p className="mt-1 break-words text-sm text-gray-500">{u.paroisse.nom}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  u.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                }`}>
                  {u.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  COULEURS_ROLES[u.role] ?? 'bg-gray-100 text-gray-700'
                }`}>
                  <span className="break-words">{libelleRoleAvecFonction(u.role, u.fonction, u.brancheType)}</span>
                </span>
                {u.roleDistrict && (
                  <span className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    COULEURS_ROLES[u.roleDistrict] ?? 'bg-gray-100 text-gray-700'
                  }`}>
                    <span className="break-words">{libelleAffectationDistrict(u.roleDistrict, u.fonctionDistrict, u.brancheTypeDistrict)}</span>
                  </span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-gray-600">
                <p>
                  <span className="text-gray-400">Identifiant : </span>
                  {u.matricule ? <span className="font-mono">{u.matricule}</span> : (u.telephone ?? '—')}
                </p>
                {u.paroisse.district && (
                  <p><span className="text-gray-400">District : </span>{u.paroisse.district.nom}</p>
                )}
              </div>
            </button>

            {estAssujettiAdhesion(u.role) && (
              <div className="mt-3 flex items-center gap-2 border-t border-gray-50 pt-3">
                <span className="text-xs text-gray-500">Adhésion :</span>
                <SelectStatutAdhesion
                  statut={u.statutAdhesion}
                  enCours={enCoursAdhesion === u.id}
                  onChange={(statut) => changerStatutAdhesion(u, statut)}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => ouvrirNomination(u)}
              className="mt-4 flex h-10 w-full items-center justify-center rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Nommer
            </button>
          </div>
        ))}
        {utilisateurs.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            Aucun utilisateur trouvé.
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Nom / Prénom</th>
                <th className="px-4 py-3">Paroisse</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Matricule / Téléphone</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-center">Adhésion</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {utilisateurs.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => (window.location.href = `/admin/utilisateurs/${u.id}`)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{u.nom} {u.prenom}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{u.paroisse.nom}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        COULEURS_ROLES[u.role] ?? 'bg-gray-100 text-gray-700'
                      }`}>
                        {libelleRoleAvecFonction(u.role, u.fonction, u.brancheType)}
                      </span>
                      {u.roleDistrict && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          COULEURS_ROLES[u.roleDistrict] ?? 'bg-gray-100 text-gray-700'
                        }`}>
                          {libelleAffectationDistrict(u.roleDistrict, u.fonctionDistrict, u.brancheTypeDistrict)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {u.matricule ? <span className="font-mono">{u.matricule}</span> : (u.telephone ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {u.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {estAssujettiAdhesion(u.role) ? (
                      <SelectStatutAdhesion
                        statut={u.statutAdhesion}
                        enCours={enCoursAdhesion === u.id}
                        onChange={(statut) => changerStatutAdhesion(u, statut)}
                      />
                    ) : (
                      <span className="text-xs text-gray-400 text-center">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        ouvrirNomination(u)
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Nommer
                    </button>
                  </td>
                </tr>
              ))}
              {utilisateurs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucun utilisateur trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-gray-500">
            {total} utilisateur{total !== 1 ? 's' : ''} — p. {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 transition-colors hover:bg-gray-50"
            >
              ←
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 transition-colors hover:bg-gray-50"
            >
              →
            </button>
          </div>
        </div>
      )}

      {utilisateurNomination && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-0 py-0 sm:items-center sm:px-4 sm:py-6">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl">
            <form onSubmit={soumettreNomination} noValidate>
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-bold text-gray-900">Nommer {utilisateurNomination.prenom} {utilisateurNomination.nom}</h2>
                    <p className="break-words text-sm text-gray-500">
                      {utilisateurNomination.paroisse.nom}
                      {utilisateurNomination.paroisse.district ? ` — District ${utilisateurNomination.paroisse.district.nom}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fermerNomination}
                    disabled={soumissionNomination}
                    className="flex-shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
                  >
                    Fermer
                  </button>
                </div>
              </div>

              <div className="space-y-5 px-5 py-5">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800">Rôle paroissial</h3>
                  <div>
                    <label className={CLS_LABEL}>Rôle <span className="text-red-500">*</span></label>
                    <select
                      name="role"
                      value={formNomination.role}
                      onChange={handleNominationChange}
                      className={erreursNomination.role ? CLS_SELECT_ERR : CLS_SELECT}
                    >
                      <option value="">Sélectionner un rôle</option>
                      {ROLES_ASSIGNABLES_PAROISSE.map((role) => (
                        <option key={role} value={role}>{LABELS_ROLES[role]}</option>
                      ))}
                    </select>
                    {erreursNomination.role && <p className="mt-1 text-xs text-red-600">{erreursNomination.role}</p>}
                  </div>

                  {roleNominationEstBranche && (
                    <div>
                      <label className={CLS_LABEL}>Branche <span className="text-red-500">*</span></label>
                      <select
                        name="brancheType"
                        value={formNomination.brancheType}
                        onChange={handleNominationChange}
                        className={erreursNomination.brancheType ? CLS_SELECT_ERR : CLS_SELECT}
                      >
                        <option value="">Sélectionner une branche</option>
                        {Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => (
                          <option key={valeur} value={valeur}>{libelle}</option>
                        ))}
                      </select>
                      {erreursNomination.brancheType && <p className="mt-1 text-xs text-red-600">{erreursNomination.brancheType}</p>}
                    </div>
                  )}
                </section>

                <section className="space-y-3 border-t border-gray-100 pt-5">
                  <h3 className="text-sm font-semibold text-gray-800">Affectation district</h3>
                  <div>
                    <label className={CLS_LABEL}>Nomination</label>
                    <select
                      name="roleDistrict"
                      value={formNomination.roleDistrict}
                      onChange={handleNominationChange}
                      className={erreursNomination.roleDistrict ? CLS_SELECT_ERR : CLS_SELECT}
                    >
                      <option value="">Aucune affectation district</option>
                      {ROLES_DISTRICT_ETENDU.map((role) => (
                        <option key={role} value={role}>
                          {role === 'ASSISTANT_DISTRICT'
                            ? 'Commissaire de branche / Assistant de district'
                            : LABELS_ROLES[role]}
                        </option>
                      ))}
                    </select>
                    {erreursNomination.roleDistrict && <p className="mt-1 text-xs text-red-600">{erreursNomination.roleDistrict}</p>}
                  </div>

                  {nominationEstAssistantDistrict && (
                    <div className="space-y-3">
                      <div>
                        <label className={CLS_LABEL}>Type d&apos;assistant</label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:gap-5">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="radio"
                              name="modeDistrict"
                              checked={nominationModeBranche}
                              onChange={() => setFormNomination((p) => ({ ...p, modeDistrict: 'branche', fonctionDistrict: '' }))}
                              className="accent-[#1a4731]"
                            />
                            Commissaire de branche
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="radio"
                              name="modeDistrict"
                              checked={!nominationModeBranche}
                              onChange={() => setFormNomination((p) => ({ ...p, modeDistrict: 'fonction', brancheTypeDistrict: '' }))}
                              className="accent-[#1a4731]"
                            />
                            Autre fonction
                          </label>
                        </div>
                      </div>

                      {nominationModeBranche ? (
                        <div>
                          <label className={CLS_LABEL}>Branche de district <span className="text-red-500">*</span></label>
                          <select
                            name="brancheTypeDistrict"
                            value={formNomination.brancheTypeDistrict}
                            onChange={handleNominationChange}
                            className={erreursNomination.brancheTypeDistrict ? CLS_SELECT_ERR : CLS_SELECT}
                          >
                            <option value="">Sélectionner une branche</option>
                            {Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => (
                              <option key={valeur} value={valeur}>{libelle}</option>
                            ))}
                          </select>
                          {erreursNomination.brancheTypeDistrict && <p className="mt-1 text-xs text-red-600">{erreursNomination.brancheTypeDistrict}</p>}
                        </div>
                      ) : (
                        <div>
                          <label className={CLS_LABEL}>Fonction <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
                          <input
                            name="fonctionDistrict"
                            value={formNomination.fonctionDistrict}
                            onChange={handleNominationChange}
                            placeholder="Ex. Spiritualité, Secrétariat…"
                            className={CLS_INPUT}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>

              <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={fermerNomination}
                  disabled={soumissionNomination}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={soumissionNomination}
                  className="rounded-lg px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--cp)' }}
                >
                  {soumissionNomination ? 'Enregistrement…' : 'Enregistrer la nomination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
