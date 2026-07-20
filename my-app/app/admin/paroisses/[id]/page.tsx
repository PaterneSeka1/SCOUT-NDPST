'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { PasswordInput } from '@/app/components/PasswordInput'
import { confirmer } from '@/app/components/ConfirmDialog'
import { TableauMembres, normaliser } from '@/app/components/TableauMembres'
import { LABELS_ROLES, ROLES_BRANCHE, ROLES_TOUT_STAFF } from '@/lib/roles'
import { useGardeModifications } from '@/hooks/useGardeModifications'

// Un membre ne peut être désigné Chef de Groupe que s'il fait déjà partie du
// staff paroissial (encadrement de groupe ou de branche) — un parent ou un
// scout ne peut pas être désigné directement, cohérent avec la validation de
// POST /api/admin/paroisses/[id]/chef-groupe/designer.
const ROLES_ELIGIBLES_CHEF = ROLES_TOUT_STAFF.filter((r) => r !== 'CHEF_GROUPE')

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

interface ChefGroupe {
  id: string; nom: string; prenom: string; matricule: string | null; telephone: string | null; email: string | null; actif: boolean
}

interface MembreParoisse {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  telephone: string | null
  email: string | null
  actif: boolean
  role: string
  fonction: string | null
  brancheType: string | null
  roleDistrict: string | null
  fonctionDistrict: string | null
  brancheTypeDistrict: string | null
  createdAt: string
}

interface Paroisse {
  id: string; nom: string; ville: string; diocese: string
  ocean: string | null; district: { id: string; nom: string }
  adresse: string | null; telephone: string | null; email: string | null
  logo: string | null
  couleurPrimaire: string | null; couleurAccent: string | null; couleurFond: string | null; couleurHover: string | null
  actif: boolean
  counts: { scouts: number; utilisateurs: number; activites: number }
  chefsGroupe: ChefGroupe[]
  membres: MembreParoisse[]
}

interface DistrictOption { id: string; nom: string }

interface FormParoisse {
  nom: string; ville: string; diocese: string; ocean: string; districtId: string
  adresse: string; telephone: string; email: string
  logo: string; couleurPrimaire: string; couleurAccent: string; couleurFond: string; couleurHover: string
}

// Construit l'état du formulaire d'édition à partir de la paroisse chargée —
// utilisé au chargement initial ET pour réinitialiser le formulaire quand
// l'utilisateur clique sur "Annuler" (évite de laisser des champs modifiés
// mais non sauvegardés visibles la prochaine fois qu'il rouvre l'édition).
function construireForm(data: Paroisse): FormParoisse {
  return {
    nom: data.nom, ville: data.ville, diocese: data.diocese,
    ocean: data.ocean ?? '', districtId: data.district.id,
    adresse: data.adresse ?? '', telephone: data.telephone ?? '', email: data.email ?? '',
    logo: data.logo ?? '',
    couleurPrimaire: data.couleurPrimaire ?? '', couleurAccent: data.couleurAccent ?? '',
    couleurFond: data.couleurFond ?? '', couleurHover: data.couleurHover ?? '',
  }
}

interface FormChefGroupe {
  nom: string; prenom: string; matricule: string; telephone: string; email: string; motDePasse: string
}

const CHEF_VIDE: FormChefGroupe = { nom: '', prenom: '', matricule: '', telephone: '', email: '', motDePasse: '' }
const PROFILS_MEMBRES = [
  { value: '', label: 'Tous les membres' },
  { value: 'staff', label: 'Staff paroissial' },
  { value: 'chefs', label: 'Chefs de Groupe' },
  { value: 'branches', label: 'Encadrement branche' },
  { value: 'parents', label: 'Parents' },
  { value: 'scouts', label: 'Scouts' },
  { value: 'district', label: 'Affectation district' },
  { value: 'inactifs', label: 'Comptes inactifs' },
]

// Couleurs d'identité visuelle propres à la paroisse — nullables (contrairement
// à ConfigurationPlateforme) : un champ vide n'impose pas de couleur par défaut,
// il signifie simplement "pas personnalisé, utilise le thème de la plateforme".
type ChampCouleurParoisse = 'couleurPrimaire' | 'couleurAccent' | 'couleurFond' | 'couleurHover'
interface CouleurDefParoisse { key: ChampCouleurParoisse; label: string; hint: string }

const COULEURS_PAROISSE: CouleurDefParoisse[] = [
  { key: 'couleurPrimaire', label: 'Couleur primaire', hint: 'Sidebar, boutons, avatar' },
  { key: 'couleurHover', label: 'Couleur des hovers', hint: 'Liens actifs, survol menu' },
  { key: 'couleurAccent', label: "Couleur d'accentuation", hint: 'Badges, détails secondaires' },
  { key: 'couleurFond', label: 'Couleur de fond', hint: 'Arrière-plan pages auth' },
]

// Couleur affichée dans le sélecteur natif <input type="color"> quand le champ
// est vide (le widget exige une valeur hexadécimale valide) — purement pour
// l'affichage du picker, jamais enregistrée tant que l'utilisateur ne choisit
// pas explicitement une couleur.
const COULEUR_APERCU_DEFAUT = '#1a4731'

// Contraste WCAG (relative luminance), dupliqué depuis app/admin/apparence/page.tsx
// — pas assez de réutilisation ailleurs pour justifier une extraction partagée.
function luminanceCanal(c: number): number {
  const cs = c / 255
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length !== 6) return 0
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * luminanceCanal(r) + 0.7152 * luminanceCanal(g) + 0.0722 * luminanceCanal(b)
}

function ratioContraste(hex1: string, hex2: string): number {
  const l1 = luminance(hex1)
  const l2 = luminance(hex2)
  const [clair, sombre] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (clair + 0.05) / (sombre + 0.05)
}

function niveauContraste(ratio: number): { label: string; classe: string } {
  if (ratio >= 4.5) return { label: `${ratio.toFixed(1)}:1 — conforme AA`, classe: 'text-emerald-600' }
  if (ratio >= 3) return { label: `${ratio.toFixed(1)}:1 — limite (grand texte)`, classe: 'text-amber-600' }
  return { label: `${ratio.toFixed(1)}:1 — contraste insuffisant`, classe: 'text-red-600' }
}

export default function FicheParoissePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [paroisse, setParoisse] = useState<Paroisse | null>(null)
  const [chargement, setChargement] = useState(true)
  const [modeEdition, setModeEdition] = useState(false)
  const [form, setForm] = useState<FormParoisse | null>(null)
  const [soumission, setSoumission] = useState(false)
  const [formChef, setFormChef] = useState<FormChefGroupe>(CHEF_VIDE)
  const [soumissionChef, setSoumissionChef] = useState(false)
  const [afficherFormChef, setAfficherFormChef] = useState(false)
  const [afficherDesignation, setAfficherDesignation] = useState(false)
  const [utilisateurDesigne, setUtilisateurDesigne] = useState('')
  const [soumissionDesignation, setSoumissionDesignation] = useState(false)
  const [erreurChargement, setErreurChargement] = useState(false)
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [suppression, setSuppression] = useState(false)
  const [rechercheMembre, setRechercheMembre] = useState('')
  const [profilMembre, setProfilMembre] = useState('')
  const [statutMembre, setStatutMembre] = useState('')
  const [pageMembres, setPageMembres] = useState(1)
  const [membresParPage, setMembresParPage] = useState(10)

  const { estModifie, definirReference, partirVers } = useGardeModifications(form)

  useEffect(() => {
    fetch('/api/admin/districts')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { districts?: DistrictOption[] } | null) => {
        if (data?.districts) setDistricts(data.districts)
      })
      .catch(() => {})
  }, [])

  const charger = useCallback(() => {
    setErreurChargement(false)
    fetch(`/api/admin/paroisses/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data: Paroisse) => {
        setParoisse(data)
        const formCharge = construireForm(data)
        setForm(formCharge)
        definirReference(formCharge)
      })
      .catch(() => {
        setErreurChargement(true)
        toast.error('Impossible de charger cette paroisse.')
      })
      .finally(() => setChargement(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => { charger() }, [charger])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const ok = await confirmer({
      titre: 'Enregistrer ces modifications ?',
      description: `Les informations de "${form.nom}" seront mises à jour.`,
      labelConfirmer: 'Enregistrer',
    })
    if (!ok) return
    setSoumission(true)
    try {
      const res = await fetch(`/api/admin/paroisses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      toast.success('Paroisse mise à jour.')
      definirReference(form)
      setModeEdition(false)
      charger()
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSoumission(false)
    }
  }

  const basculerActif = async () => {
    if (!paroisse) return
    if (paroisse.actif) {
      const ok = await confirmer({
        titre: 'Désactiver cette paroisse ?',
        description: `Tous les utilisateurs de "${paroisse.nom}" perdront immédiatement l'accès à leur compte. Aucune donnée (scouts, activités, historique) ne sera supprimée — vous pourrez réactiver la paroisse à tout moment.`,
        labelConfirmer: 'Désactiver',
        danger: true,
      })
      if (!ok) return
    } else {
      const ok = await confirmer({
        titre: 'Réactiver cette paroisse ?',
        description: `Tous les utilisateurs de "${paroisse.nom}" retrouveront l'accès à leur compte.`,
        labelConfirmer: 'Réactiver',
      })
      if (!ok) return
    }
    try {
      const res = await fetch(`/api/admin/paroisses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: !paroisse.actif }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.erreur ?? 'Erreur serveur'); return }
      toast.success(paroisse.actif ? 'Paroisse désactivée.' : 'Paroisse réactivée.')
      charger()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const handleSupprimer = async () => {
    if (!paroisse) return
    const ok = await confirmer({
      titre: 'Supprimer définitivement cette paroisse ?',
      description: `"${paroisse.nom}" sera supprimée pour de bon. Cette action est irréversible et n'est possible que si la paroisse n'a encore aucune donnée (scouts, membres, activités…) — sinon, désactivez-la plutôt.`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    setSuppression(true)
    try {
      const res = await fetch(`/api/admin/paroisses/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      toast.success('Paroisse supprimée.')
      router.push('/admin/paroisses')
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setSuppression(false)
    }
  }

  const handleCreerChef = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formChef.nom.trim() || !formChef.prenom.trim() || !formChef.matricule.trim() || !formChef.motDePasse) {
      toast.error('Le nom, le prénom, le matricule et le mot de passe sont requis.')
      return
    }
    if (!motDePasseValide(formChef.motDePasse)) {
      toast.error(REGLE_MOT_DE_PASSE)
      return
    }
    const ok = await confirmer({
      titre: 'Créer ce compte Chef de Groupe ?',
      description: `Un compte sera créé pour ${formChef.prenom} ${formChef.nom} avec le mot de passe temporaire renseigné ci-dessus. Vous devrez le communiquer au nouveau Chef de Groupe.`,
      labelConfirmer: 'Créer le compte',
    })
    if (!ok) return
    setSoumissionChef(true)
    try {
      const res = await fetch(`/api/admin/paroisses/${id}/chef-groupe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: formChef.nom, prenom: formChef.prenom, matricule: formChef.matricule,
          telephone: formChef.telephone || undefined, email: formChef.email || undefined,
          password: formChef.motDePasse,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      toast.success('Chef de Groupe créé. Communiquez-lui ses identifiants.')
      setFormChef(CHEF_VIDE)
      setAfficherFormChef(false)
      charger()
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setSoumissionChef(false)
    }
  }

  const membresEligiblesChef = useMemo(() => {
    if (!paroisse) return []
    return paroisse.membres.filter((m) => m.actif && ROLES_ELIGIBLES_CHEF.includes(m.role))
  }, [paroisse])

  const handleDesignerChef = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paroisse) return
    const membre = membresEligiblesChef.find((m) => m.id === utilisateurDesigne)
    if (!membre) { toast.error('Sélectionnez un membre à désigner.'); return }

    const chefActuel = paroisse.chefsGroupe.find((c) => c.actif)
    const ok = await confirmer({
      titre: 'Désigner ce membre comme Chef de Groupe ?',
      description: chefActuel
        ? `${membre.prenom} ${membre.nom} deviendra Chef de Groupe de "${paroisse.nom}". ${chefActuel.prenom} ${chefActuel.nom}, chef actuel, deviendra automatiquement Assistant de Groupe.`
        : `${membre.prenom} ${membre.nom} deviendra Chef de Groupe de "${paroisse.nom}".`,
      labelConfirmer: 'Désigner',
    })
    if (!ok) return

    setSoumissionDesignation(true)
    try {
      const res = await fetch(`/api/admin/paroisses/${id}/chef-groupe/designer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utilisateurId: membre.id }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      toast.success('Chef de Groupe désigné.')
      setUtilisateurDesigne('')
      setAfficherDesignation(false)
      charger()
    } catch {
      toast.error('Erreur lors de la désignation')
    } finally {
      setSoumissionDesignation(false)
    }
  }

  const statistiques = useMemo(() => {
    if (!paroisse) {
      return { scouts: 0, utilisateurs: 0, activites: 0, staff: 0, equipeDistrict: 0, inactifs: 0 }
    }

    return {
      scouts: paroisse.counts.scouts,
      utilisateurs: paroisse.counts.utilisateurs,
      activites: paroisse.counts.activites,
      staff: paroisse.membres.filter((membre) => ROLES_TOUT_STAFF.includes(membre.role)).length,
      equipeDistrict: paroisse.membres.filter((membre) => !!membre.roleDistrict).length,
      inactifs: paroisse.membres.filter((membre) => !membre.actif).length,
    }
  }, [paroisse])

  const membresFiltres = useMemo(() => {
    if (!paroisse) return []
    const requete = normaliser(rechercheMembre.trim())

    return paroisse.membres.filter((membre) => {
      if (statutMembre === 'actifs' && !membre.actif) return false
      if (statutMembre === 'inactifs' && membre.actif) return false
      if (profilMembre === 'staff' && !ROLES_TOUT_STAFF.includes(membre.role)) return false
      if (profilMembre === 'chefs' && membre.role !== 'CHEF_GROUPE') return false
      if (profilMembre === 'branches' && !ROLES_BRANCHE.includes(membre.role)) return false
      if (profilMembre === 'parents' && membre.role !== 'PARENT') return false
      if (profilMembre === 'scouts' && membre.role !== 'SCOUT') return false
      if (profilMembre === 'district' && !membre.roleDistrict) return false
      if (profilMembre === 'inactifs' && membre.actif) return false
      if (!requete) return true

      const texte = normaliser([
        membre.nom,
        membre.prenom,
        membre.matricule,
        membre.telephone,
        membre.email,
        LABELS_ROLES[membre.role],
        membre.roleDistrict ? LABELS_ROLES[membre.roleDistrict] : '',
        membre.fonction,
        membre.fonctionDistrict,
      ].filter(Boolean).join(' '))

      return texte.includes(requete)
    })
  }, [paroisse, rechercheMembre, profilMembre, statutMembre])

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  if (erreurChargement || !paroisse || !form) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-gray-600">Impossible de charger cette paroisse.</p>
        <button type="button" onClick={() => partirVers('/admin/paroisses')} className="text-sm text-gray-500 hover:text-gray-800">← Retour aux paroisses</button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <button type="button" onClick={() => partirVers('/admin/paroisses')} className="text-sm text-gray-500 hover:text-gray-800">← Retour aux paroisses</button>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Paroisse</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${paroisse.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                {paroisse.actif ? 'Active' : 'Désactivée'}
              </span>
            </div>
            <h1 className="mt-1 break-words text-2xl font-bold text-gray-900 sm:text-3xl">{paroisse.nom}</h1>
            <p className="mt-1 text-sm text-gray-500">{paroisse.ville} — {paroisse.diocese}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={`/api/admin/paroisses/${id}/export/scouts`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <span aria-hidden="true">↓</span>
              Scouts CSV
            </a>
            <a
              href={`/api/admin/paroisses/${id}/export/utilisateurs`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <span aria-hidden="true">↓</span>
              Membres CSV
            </a>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Scouts</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{statistiques.scouts}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Membres</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{statistiques.utilisateurs}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Staff</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{statistiques.staff}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">District</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{statistiques.equipeDistrict}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Activités</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{statistiques.activites}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inactifs</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{statistiques.inactifs}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Chef de Groupe</h2>
              <p className="mt-1 text-sm text-gray-500">Compte de référence pour piloter la paroisse.</p>
            </div>
            {!afficherFormChef && !afficherDesignation && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button onClick={() => setAfficherDesignation(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                  Désigner un membre existant
                </button>
                <button onClick={() => setAfficherFormChef(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                  Créer un compte
                </button>
              </div>
            )}
          </div>

          {paroisse.chefsGroupe.length === 0 && !afficherFormChef && !afficherDesignation && (
            <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-sm font-medium text-orange-700">Aucun Chef de Groupe désigné pour cette paroisse.</p>
            </div>
          )}

          {paroisse.chefsGroupe.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {paroisse.chefsGroupe.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/utilisateurs/${c.id}`}
                  className="rounded-lg border border-gray-100 px-4 py-3 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-gray-900">{c.prenom} {c.nom}</p>
                      <p className="mt-1 text-xs text-gray-500">{c.matricule ?? c.telephone ?? c.email ?? '—'}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium ${c.actif ? 'text-green-700' : 'text-gray-400'}`}>{c.actif ? 'Actif' : 'Inactif'}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {afficherDesignation && (
            <form onSubmit={handleDesignerChef} className="mt-5 border-t border-gray-100 pt-5">
              <div>
                <label className={CLS_LABEL}>Membre de la paroisse *</label>
                <select
                  className={CLS_INPUT}
                  value={utilisateurDesigne}
                  onChange={(e) => setUtilisateurDesigne(e.target.value)}
                >
                  <option value="">— Choisir un membre —</option>
                  {membresEligiblesChef.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.prenom} {m.nom} — {LABELS_ROLES[m.role] ?? m.role}
                    </option>
                  ))}
                </select>
                {membresEligiblesChef.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">Aucun membre du staff éligible dans cette paroisse.</p>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => { setAfficherDesignation(false); setUtilisateurDesigne('') }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={soumissionDesignation || !utilisateurDesigne}
                  className="flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--cp)' }}
                >
                  {soumissionDesignation && <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />}
                  {soumissionDesignation ? 'Désignation…' : 'Désigner'}
                </button>
              </div>
            </form>
          )}

          {afficherFormChef && (
            <form onSubmit={handleCreerChef} className="mt-5 border-t border-gray-100 pt-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={CLS_LABEL}>Prénom *</label>
                  <input className={CLS_INPUT} value={formChef.prenom} onChange={(e) => setFormChef({ ...formChef, prenom: e.target.value })} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Nom *</label>
                  <input className={CLS_INPUT} value={formChef.nom} onChange={(e) => setFormChef({ ...formChef, nom: e.target.value })} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Matricule *</label>
                  <input className={CLS_INPUT} value={formChef.matricule} onChange={(e) => setFormChef({ ...formChef, matricule: e.target.value })} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Téléphone</label>
                  <input className={CLS_INPUT} value={formChef.telephone} onChange={(e) => setFormChef({ ...formChef, telephone: e.target.value })} />
                </div>
                <div>
                  <label className={CLS_LABEL}>E-mail</label>
                  <input type="email" className={CLS_INPUT} value={formChef.email} onChange={(e) => setFormChef({ ...formChef, email: e.target.value })} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Mot de passe temporaire *</label>
                  <PasswordInput className={CLS_INPUT} value={formChef.motDePasse} onChange={(e) => setFormChef({ ...formChef, motDePasse: e.target.value })} />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setAfficherFormChef(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={soumissionChef}
                  className="flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--cp)' }}
                >
                  {soumissionChef && <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />}
                  {soumissionChef ? 'Création…' : 'Créer le compte'}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Informations</h2>
              <p className="mt-1 text-sm text-gray-500">Identité administrative de la paroisse.</p>
            </div>
            {!modeEdition && (
              <button onClick={() => setModeEdition(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                Modifier
              </button>
            )}
          </div>

          {modeEdition ? (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={CLS_LABEL}>Nom *</label><input className={CLS_INPUT} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
                <div><label className={CLS_LABEL}>Ville *</label><input className={CLS_INPUT} value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} required /></div>
                <div><label className={CLS_LABEL}>Diocèse *</label><input className={CLS_INPUT} value={form.diocese} onChange={(e) => setForm({ ...form, diocese: e.target.value })} required /></div>
                <div>
                  <label className={CLS_LABEL}>District *</label>
                  <select className={CLS_INPUT} value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value })} required>
                    <option value="">— Choisir un district —</option>
                    {districts.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                  </select>
                </div>
                <div><label className={CLS_LABEL}>Océan / secteur</label><input className={CLS_INPUT} value={form.ocean} onChange={(e) => setForm({ ...form, ocean: e.target.value })} /></div>
                <div><label className={CLS_LABEL}>Téléphone</label><input className={CLS_INPUT} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></div>
                <div><label className={CLS_LABEL}>E-mail</label><input type="email" className={CLS_INPUT} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="sm:col-span-2"><label className={CLS_LABEL}>Adresse</label><input className={CLS_INPUT} value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Identité visuelle de la paroisse</h3>
                <p className="mt-1 text-xs text-gray-400">
                  Optionnel — un champ laissé vide n&apos;impose rien : la paroisse utilise alors le thème de la plateforme.
                </p>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex-shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
                    {form.logo ? (
                      <Image src={form.logo} alt="Logo de la paroisse" width={60} height={60} unoptimized className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-2xl text-gray-300">🖼</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className={CLS_LABEL}>Logo de la paroisse</label>
                    <input
                      type="text"
                      value={form.logo}
                      onChange={(e) => setForm({ ...form, logo: e.target.value })}
                      className={CLS_INPUT}
                      placeholder="/uploads/logo-paroisse.png (vide = logo de la plateforme)"
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {COULEURS_PAROISSE.map(({ key, label, hint }) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-gray-600 mb-2 block">
                        {label}
                        <span className="ml-1 font-normal text-gray-400">({hint})</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={form[key] || COULEUR_APERCU_DEFAUT}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                          className="h-10 w-12 cursor-pointer rounded-lg border border-gray-300 p-0.5 flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={form[key]}
                          onChange={(e) => {
                            const v = e.target.value
                            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setForm({ ...form, [key]: v })
                          }}
                          placeholder="Non personnalisé"
                          className="flex-1 rounded-lg border border-gray-300 px-2 py-2 text-xs font-mono focus:outline-none focus:ring-1 text-gray-900 placeholder:text-gray-400"
                          maxLength={7}
                        />
                        {form[key] && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, [key]: '' })}
                            className="shrink-0 text-xs text-red-500 hover:text-red-700"
                          >
                            Réinitialiser
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {form[key] ? 'Couleur personnalisée pour cette paroisse.' : 'Non personnalisé — utilise le thème de la plateforme.'}
                      </p>
                    </div>
                  ))}
                </div>

                {(form.couleurPrimaire || form.couleurHover) && (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {[
                      { label: 'Texte blanc sur couleur primaire', bg: form.couleurPrimaire },
                      { label: 'Texte blanc sur couleur hover', bg: form.couleurHover },
                    ].filter((c) => !!c.bg).map(({ label, bg }) => {
                      const niveau = niveauContraste(ratioContraste(bg, '#ffffff'))
                      return (
                        <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                          <span className="text-xs text-gray-500">{label}</span>
                          <span className={`text-xs font-semibold whitespace-nowrap ${niveau.classe}`}>{niveau.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => { setForm(construireForm(paroisse)); setModeEdition(false) }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" disabled={soumission || !estModifie} className="flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50" style={{ backgroundColor: 'var(--cp)' }}>
                  {soumission && <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />}
                  {soumission ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-400">District</dt>
                <dd className="font-medium text-gray-800">
                  <Link href={`/admin/districts/${paroisse.district.id}`} className="hover:underline">{paroisse.district.nom}</Link>
                </dd>
              </div>
              <div><dt className="text-gray-400">Océan / secteur</dt><dd className="text-gray-800">{paroisse.ocean || '—'}</dd></div>
              <div><dt className="text-gray-400">Téléphone</dt><dd className="text-gray-800">{paroisse.telephone || '—'}</dd></div>
              <div><dt className="text-gray-400">E-mail</dt><dd className="break-words text-gray-800">{paroisse.email || '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-gray-400">Adresse</dt><dd className="text-gray-800">{paroisse.adresse || '—'}</dd></div>
            </dl>
          )}
        </section>
      </div>

      <section className="space-y-4">
        <TableauMembres
          titre="Membres de la paroisse"
          membresFiltres={membresFiltres}
          totalMembres={paroisse.membres.length}
          recherche={rechercheMembre}
          onChangeRecherche={(v) => { setRechercheMembre(v); setPageMembres(1) }}
          profil={profilMembre}
          onChangeProfil={(v) => { setProfilMembre(v); setPageMembres(1) }}
          profils={PROFILS_MEMBRES}
          filtreSupplementaire={{
            value: statutMembre,
            onChange: (v) => { setStatutMembre(v); setPageMembres(1) },
            options: [
              { value: 'actifs', label: 'Actifs' },
              { value: 'inactifs', label: 'Inactifs' },
            ],
            labelParDefaut: 'Tous les statuts',
          }}
          classeGrilleFiltres="lg:grid-cols-[minmax(0,1fr)_220px_170px_150px]"
          page={pageMembres}
          onChangePage={setPageMembres}
          parPage={membresParPage}
          onChangeParPage={(v) => { setMembresParPage(v); setPageMembres(1) }}
          onReinitialiser={() => { setRechercheMembre(''); setProfilMembre(''); setStatutMembre(''); setPageMembres(1) }}
        />
      </section>

      <section className="rounded-xl border border-red-100 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-red-500">Zone sensible</h2>
        <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-gray-600">
            {paroisse.actif
              ? 'Désactiver bloque la connexion de tous les utilisateurs de cette paroisse, sans supprimer aucune donnée.'
              : 'Réactiver redonne accès à tous les utilisateurs de cette paroisse.'}
          </p>
          <button
            onClick={basculerActif}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${paroisse.actif ? 'border border-red-300 text-red-600 hover:bg-red-50' : 'border border-green-300 text-green-700 hover:bg-green-50'}`}
          >
            {paroisse.actif ? 'Désactiver' : 'Réactiver'}
          </button>
        </div>

        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-red-100 pt-4 sm:flex-row sm:items-center">
          <p className="text-sm text-gray-600">
            Supprimer définitivement n&apos;est possible que si cette paroisse n&apos;a encore aucune donnée (scouts, membres, activités…). Dans tous les autres cas, désactivez-la plutôt.
          </p>
          <button
            onClick={handleSupprimer}
            disabled={suppression}
            className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            {suppression ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </section>
    </div>
  )
}
