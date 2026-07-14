'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { PasswordInput } from '@/app/components/PasswordInput'
import { confirmer } from '@/app/components/ConfirmDialog'
import { COULEURS_ROLES, LABELS_ROLES, ROLES_BRANCHE, ROLES_TOUT_STAFF, libelleRoleAvecFonction } from '@/lib/roles'

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
  actif: boolean
  counts: { scouts: number; utilisateurs: number; activites: number }
  chefsGroupe: ChefGroupe[]
  membres: MembreParoisse[]
}

interface DistrictOption { id: string; nom: string }

interface FormParoisse {
  nom: string; ville: string; diocese: string; ocean: string; districtId: string
  adresse: string; telephone: string; email: string
}

interface FormChefGroupe {
  nom: string; prenom: string; matricule: string; telephone: string; email: string; motDePasse: string
}

const CHEF_VIDE: FormChefGroupe = { nom: '', prenom: '', matricule: '', telephone: '', email: '', motDePasse: '' }
const OPTIONS_MEMBRES_PAR_PAGE = [10, 20, 50]
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

function normaliser(valeur: string): string {
  return valeur.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
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
  const [erreurChargement, setErreurChargement] = useState(false)
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [suppression, setSuppression] = useState(false)
  const [rechercheMembre, setRechercheMembre] = useState('')
  const [profilMembre, setProfilMembre] = useState('')
  const [statutMembre, setStatutMembre] = useState('')
  const [pageMembres, setPageMembres] = useState(1)
  const [membresParPage, setMembresParPage] = useState(10)

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
        setForm({
          nom: data.nom, ville: data.ville, diocese: data.diocese,
          ocean: data.ocean ?? '', districtId: data.district.id,
          adresse: data.adresse ?? '', telephone: data.telephone ?? '', email: data.email ?? '',
        })
      })
      .catch(() => {
        setErreurChargement(true)
        toast.error('Impossible de charger cette paroisse.')
      })
      .finally(() => setChargement(false))
  }, [id])

  useEffect(() => { charger() }, [charger])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
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

  const totalPagesMembres = Math.max(1, Math.ceil(membresFiltres.length / membresParPage))
  const pageMembresCourante = Math.min(pageMembres, totalPagesMembres)
  const indexDebutMembres = (pageMembresCourante - 1) * membresParPage
  const indexFinMembres = Math.min(indexDebutMembres + membresParPage, membresFiltres.length)
  const membresPage = membresFiltres.slice(indexDebutMembres, indexFinMembres)
  const premierMembreAffiche = membresFiltres.length === 0 ? 0 : indexDebutMembres + 1

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
        <Link href="/admin/paroisses" className="text-sm text-gray-500 hover:text-gray-800">← Retour aux paroisses</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link href="/admin/paroisses" className="text-sm text-gray-500 hover:text-gray-800">← Retour aux paroisses</Link>
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
            {!afficherFormChef && (
              <button onClick={() => setAfficherFormChef(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                {paroisse.chefsGroupe.length > 0 ? 'Désigner un autre' : 'Désigner un Chef'}
              </button>
            )}
          </div>

          {paroisse.chefsGroupe.length === 0 && !afficherFormChef && (
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
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setModeEdition(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" disabled={soumission} className="flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50" style={{ backgroundColor: 'var(--cp)' }}>
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
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Membres de la paroisse</h2>
              <p className="mt-1 text-sm text-gray-500">
                {membresFiltres.length} résultat{membresFiltres.length > 1 ? 's' : ''} sur {paroisse.membres.length} compte{paroisse.membres.length > 1 ? 's' : ''}
                {membresFiltres.length > 0 && (
                  <> · {premierMembreAffiche}-{indexFinMembres} affiché{membresPage.length > 1 ? 's' : ''}</>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setRechercheMembre(''); setProfilMembre(''); setStatutMembre(''); setPageMembres(1) }}
              disabled={!rechercheMembre && !profilMembre && !statutMembre}
              className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Réinitialiser
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_170px_150px]">
            <input
              type="search"
              value={rechercheMembre}
              onChange={(e) => { setRechercheMembre(e.target.value); setPageMembres(1) }}
              placeholder="Rechercher nom, matricule, téléphone, rôle…"
              className={CLS_INPUT}
            />
            <select value={profilMembre} onChange={(e) => { setProfilMembre(e.target.value); setPageMembres(1) }} className={CLS_INPUT}>
              {PROFILS_MEMBRES.map((profil) => (
                <option key={profil.value} value={profil.value}>{profil.label}</option>
              ))}
            </select>
            <select value={statutMembre} onChange={(e) => { setStatutMembre(e.target.value); setPageMembres(1) }} className={CLS_INPUT}>
              <option value="">Tous les statuts</option>
              <option value="actifs">Actifs</option>
              <option value="inactifs">Inactifs</option>
            </select>
            <select
              value={membresParPage}
              onChange={(e) => { setMembresParPage(Number(e.target.value)); setPageMembres(1) }}
              aria-label="Nombre de membres par page"
              className={CLS_INPUT}
            >
              {OPTIONS_MEMBRES_PAR_PAGE.map((option) => (
                <option key={option} value={option}>{option} / page</option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Membre</th>
                  <th className="px-4 py-3">Rôle paroissial</th>
                  <th className="px-4 py-3">Affectation district</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {membresPage.map((membre) => (
                  <tr key={membre.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{membre.prenom} {membre.nom}</p>
                      <p className="text-xs text-gray-500">{membre.matricule ?? membre.telephone ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex max-w-xs rounded-full px-2 py-0.5 text-xs font-medium ${COULEURS_ROLES[membre.role] ?? 'bg-gray-100 text-gray-700'}`}>
                        {libelleRoleAvecFonction(membre.role, membre.fonction, membre.brancheType)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {membre.roleDistrict ? (
                        <span className={`inline-flex max-w-xs rounded-full px-2 py-0.5 text-xs font-medium ${COULEURS_ROLES[membre.roleDistrict] ?? 'bg-gray-100 text-gray-700'}`}>
                          {libelleRoleAvecFonction(membre.roleDistrict, membre.fonctionDistrict, membre.brancheTypeDistrict)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <p>{membre.email ?? '—'}</p>
                      {membre.telephone && <p className="text-xs text-gray-500">{membre.telephone}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${membre.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                        {membre.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/utilisateurs/${membre.id}`} className="text-xs font-semibold text-[#1a4731] hover:underline">
                        Fiche
                      </Link>
                    </td>
                  </tr>
                ))}
                {membresFiltres.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucun membre ne correspond aux filtres.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {membresPage.map((membre) => (
            <article key={membre.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-semibold text-gray-900">{membre.prenom} {membre.nom}</h3>
                  <p className="mt-1 text-sm text-gray-500">{membre.matricule ?? membre.telephone ?? '—'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${membre.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                  {membre.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-xs font-medium ${COULEURS_ROLES[membre.role] ?? 'bg-gray-100 text-gray-700'}`}>
                  <span className="break-words">{libelleRoleAvecFonction(membre.role, membre.fonction, membre.brancheType)}</span>
                </span>
                {membre.roleDistrict && (
                  <span className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-xs font-medium ${COULEURS_ROLES[membre.roleDistrict] ?? 'bg-gray-100 text-gray-700'}`}>
                    <span className="break-words">{libelleRoleAvecFonction(membre.roleDistrict, membre.fonctionDistrict, membre.brancheTypeDistrict)}</span>
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-1 text-sm text-gray-600">
                <p><span className="text-gray-400">E-mail : </span>{membre.email ?? '—'}</p>
                <p><span className="text-gray-400">Téléphone : </span>{membre.telephone ?? '—'}</p>
              </div>
              <Link href={`/admin/utilisateurs/${membre.id}`} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Ouvrir la fiche
              </Link>
            </article>
          ))}
          {membresFiltres.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
              Aucun membre ne correspond aux filtres.
            </div>
          )}
        </div>

        {membresFiltres.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              {premierMembreAffiche}-{indexFinMembres} sur {membresFiltres.length} membre{membresFiltres.length > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => setPageMembres(Math.max(1, pageMembresCourante - 1))}
                disabled={pageMembresCourante <= 1}
                className="h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="min-w-24 text-center text-sm font-semibold text-gray-700">
                {pageMembresCourante} / {totalPagesMembres}
              </span>
              <button
                type="button"
                onClick={() => setPageMembres(Math.min(totalPagesMembres, pageMembresCourante + 1))}
                disabled={pageMembresCourante >= totalPagesMembres}
                className="h-10 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
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
