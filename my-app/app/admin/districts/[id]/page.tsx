'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'
import { SelecteurMembre } from '@/app/components/SelecteurMembre'
import { TableauMembres, normaliser } from '@/app/components/TableauMembres'
import { LABELS_ROLES, ROLES_TOUT_STAFF, libelleRoleAvecFonction } from '@/lib/roles'
import { useGardeModifications } from '@/hooks/useGardeModifications'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'

interface ParoisseDistrict {
  id: string
  nom: string
  ville: string
  actif: boolean
  scouts: number
  utilisateurs: number
  chefGroupe: { id: string; nom: string; prenom: string } | null
}

interface MembreEquipe {
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
  roleParoisse: string
  createdAt: string
  paroisse: { id: string; nom: string }
}

interface MembreDistrict {
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
  paroisse: { id: string; nom: string; ville: string }
}

interface PersonnelEligible {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  role: string
  paroisse: { id: string; nom: string }
}

interface District {
  id: string
  nom: string
  personnelEligible: PersonnelEligible[]
  paroisses: ParoisseDistrict[]
  equipe: MembreEquipe[]
  membres: MembreDistrict[]
}

const PROFILS_MEMBRES = [
  { value: '', label: 'Tous les membres' },
  { value: 'equipe-district', label: 'Équipe district' },
  { value: 'staff', label: 'Staff paroissial' },
  { value: 'parents', label: 'Parents' },
  { value: 'scouts', label: 'Scouts' },
  { value: 'inactifs', label: 'Comptes inactifs' },
]

export default function FicheDistrictPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [district, setDistrict] = useState<District | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreurChargement, setErreurChargement] = useState(false)
  const [chefChoisi, setChefChoisi] = useState('')
  const [soumissionCommissaire, setSoumissionCommissaire] = useState(false)
  const [renommage, setRenommage] = useState(false)
  const [nouveauNom, setNouveauNom] = useState('')
  const [soumissionRenommage, setSoumissionRenommage] = useState(false)
  const [suppression, setSuppression] = useState(false)
  const [rechercheMembre, setRechercheMembre] = useState('')
  const [profilMembre, setProfilMembre] = useState('')
  const [paroisseMembre, setParoisseMembre] = useState('')
  const [pageMembres, setPageMembres] = useState(1)
  const [membresParPage, setMembresParPage] = useState(10)

  const { estModifie: renommageModifie, definirReference: definirReferenceRenommage, partirVers } = useGardeModifications(nouveauNom)

  const charger = useCallback(() => {
    setErreurChargement(false)
    fetch(`/api/admin/districts/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data: District) => {
        setDistrict(data)
        setNouveauNom(data.nom)
        definirReferenceRenommage(data.nom)
      })
      .catch(() => {
        setErreurChargement(true)
        toast.error('Impossible de charger ce district.')
      })
      .finally(() => setChargement(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => { charger() }, [charger])

  const handleRenommer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nouveauNom.trim()) { toast.error('Le nom du district est requis.'); return }
    const ok = await confirmer({
      titre: 'Renommer ce district ?',
      description: `"${district?.nom}" sera renommé en "${nouveauNom.trim()}".`,
      labelConfirmer: 'Enregistrer',
    })
    if (!ok) return
    setSoumissionRenommage(true)
    try {
      const res = await fetch(`/api/admin/districts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nouveauNom.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      toast.success('District renommé.')
      definirReferenceRenommage(nouveauNom.trim())
      setRenommage(false)
      charger()
    } catch {
      toast.error('Erreur lors du renommage')
    } finally {
      setSoumissionRenommage(false)
    }
  }

  const handleSupprimer = async () => {
    if (!district) return
    const ok = await confirmer({
      titre: 'Supprimer ce district ?',
      description: `"${district.nom}" sera supprimé définitivement. Cette action est irréversible et n'est possible que si ce district ne contient plus aucune paroisse.`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    setSuppression(true)
    try {
      const res = await fetch(`/api/admin/districts/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      toast.success('District supprimé.')
      router.push('/admin/districts')
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setSuppression(false)
    }
  }

  const handleCreerCommissaire = async (e: React.FormEvent) => {
    e.preventDefault()
    const commissaireActuel = district?.equipe.find((m) => m.role === 'COMMISSAIRE_DISTRICT' && m.actif)
      ?? district?.equipe.find((m) => m.role === 'COMMISSAIRE_DISTRICT')
    if (!chefChoisi) {
      toast.error('Le membre à désigner est requis.')
      return
    }
    if (commissaireActuel) {
      const ok = await confirmer({
        titre: 'Remplacer le Commissaire de District ?',
        description: `${commissaireActuel.prenom} ${commissaireActuel.nom} perdra uniquement son affectation district. Son compte et son rôle paroissial resteront inchangés.`,
        labelConfirmer: 'Remplacer',
      })
      if (!ok) return
    } else {
      const membre = district?.personnelEligible.find((m) => m.id === chefChoisi)
      const ok = await confirmer({
        titre: 'Désigner ce Commissaire de District ?',
        description: membre
          ? `${membre.prenom} ${membre.nom} sera désigné Commissaire de District, en plus de son rôle paroissial actuel.`
          : 'Le membre sélectionné sera désigné Commissaire de District, en plus de son rôle paroissial actuel.',
        labelConfirmer: 'Désigner',
      })
      if (!ok) return
    }
    setSoumissionCommissaire(true)
    try {
      const res = await fetch(`/api/admin/districts/${id}/commissaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utilisateurId: chefChoisi }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      toast.success(commissaireActuel ? 'Commissaire de District remplacé.' : 'Commissaire de District désigné.')
      setChefChoisi('')
      charger()
    } catch {
      toast.error('Erreur lors de la désignation')
    } finally {
      setSoumissionCommissaire(false)
    }
  }

  const handleRetirerCommissaire = async () => {
    if (!district) return
    const commissaireActuel = district.equipe.find((m) => m.role === 'COMMISSAIRE_DISTRICT' && m.actif)
      ?? district.equipe.find((m) => m.role === 'COMMISSAIRE_DISTRICT')
    if (!commissaireActuel) return
    const ok = await confirmer({
      titre: 'Retirer le Commissaire de District ?',
      description: `${commissaireActuel.prenom} ${commissaireActuel.nom} perdra uniquement son affectation district. Son compte et son rôle paroissial resteront inchangés.`,
      labelConfirmer: 'Retirer',
      danger: true,
    })
    if (!ok) return
    setSoumissionCommissaire(true)
    try {
      const res = await fetch(`/api/admin/districts/${id}/commissaire`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      toast.success('Commissaire de District retiré.')
      setChefChoisi('')
      charger()
    } catch {
      toast.error('Erreur lors du retrait')
    } finally {
      setSoumissionCommissaire(false)
    }
  }

  const commissaire = useMemo(() => {
    if (!district) return null
    return district.equipe.find((m) => m.role === 'COMMISSAIRE_DISTRICT' && m.actif)
      ?? district.equipe.find((m) => m.role === 'COMMISSAIRE_DISTRICT')
      ?? null
  }, [district])

  const membresEquipe = useMemo(() => {
    if (!district) return []
    return district.equipe.filter((m) => m.role !== 'COMMISSAIRE_DISTRICT')
  }, [district])

  const statistiques = useMemo(() => {
    if (!district) {
      return { paroissesActives: 0, scouts: 0, utilisateurs: 0, equipe: 0, staff: 0 }
    }
    return {
      paroissesActives: district.paroisses.filter((p) => p.actif).length,
      scouts: district.paroisses.reduce((somme, p) => somme + p.scouts, 0),
      utilisateurs: district.paroisses.reduce((somme, p) => somme + p.utilisateurs, 0),
      equipe: district.equipe.length,
      staff: district.membres.filter((m) => ROLES_TOUT_STAFF.includes(m.role)).length,
    }
  }, [district])

  const membresFiltres = useMemo(() => {
    if (!district) return []
    const requete = normaliser(rechercheMembre.trim())
    return district.membres.filter((membre) => {
      if (paroisseMembre && membre.paroisse.id !== paroisseMembre) return false
      if (profilMembre === 'equipe-district' && !membre.roleDistrict) return false
      if (profilMembre === 'staff' && !ROLES_TOUT_STAFF.includes(membre.role)) return false
      if (profilMembre === 'parents' && membre.role !== 'PARENT') return false
      if (profilMembre === 'scouts' && membre.role !== 'SCOUT') return false
      if (profilMembre === 'inactifs' && membre.actif) return false
      if (!requete) return true
      const texte = normaliser([
        membre.nom,
        membre.prenom,
        membre.matricule,
        membre.telephone,
        membre.email,
        membre.paroisse.nom,
        membre.paroisse.ville,
        LABELS_ROLES[membre.role],
        membre.roleDistrict ? LABELS_ROLES[membre.roleDistrict] : '',
      ].filter(Boolean).join(' '))
      return texte.includes(requete)
    })
  }, [district, rechercheMembre, profilMembre, paroisseMembre])

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  if (erreurChargement || !district) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-gray-600">Impossible de charger ce district.</p>
        <button type="button" onClick={() => partirVers('/admin/districts')} className="text-sm text-gray-500 hover:text-gray-800">← Retour aux districts</button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <button type="button" onClick={() => partirVers('/admin/districts')} className="text-sm text-gray-500 hover:text-gray-800">← Retour aux districts</button>

        {renommage ? (
          <form onSubmit={handleRenommer} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <input className={CLS_INPUT} value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} autoFocus />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={soumissionRenommage || !renommageModifie} className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 transition" style={{ backgroundColor: 'var(--cp)' }}>
                {soumissionRenommage ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" onClick={() => { setRenommage(false); setNouveauNom(district.nom) }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">District</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">{district.nom}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {statistiques.paroissesActives} paroisse{statistiques.paroissesActives > 1 ? 's' : ''} active{statistiques.paroissesActives > 1 ? 's' : ''}
                {' '}sur {district.paroisses.length}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:pt-2">
              <button onClick={() => setRenommage(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                Renommer
              </button>
              <button
                onClick={handleSupprimer}
                disabled={suppression || district.paroisses.length > 0}
                title={district.paroisses.length > 0 ? 'Déplacez les paroisses de ce district avant de le supprimer' : undefined}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
              >
                {suppression ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paroisses</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{district.paroisses.length}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Scouts</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{statistiques.scouts}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Utilisateurs</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{statistiques.utilisateurs}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Staff</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{statistiques.staff}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Équipe district</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{statistiques.equipe}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-6">
      <section className="order-2 space-y-4">
        <TableauMembres
          titre="Membres du district"
          membresFiltres={membresFiltres}
          totalMembres={district.membres.length}
          recherche={rechercheMembre}
          onChangeRecherche={(v) => { setRechercheMembre(v); setPageMembres(1) }}
          profil={profilMembre}
          onChangeProfil={(v) => { setProfilMembre(v); setPageMembres(1) }}
          profils={PROFILS_MEMBRES}
          filtreSupplementaire={{
            value: paroisseMembre,
            onChange: (v) => { setParoisseMembre(v); setPageMembres(1) },
            options: district.paroisses.map((paroisse) => ({ value: paroisse.id, label: paroisse.nom })),
            labelParDefaut: 'Toutes les paroisses',
          }}
          classeGrilleFiltres="lg:grid-cols-[minmax(0,1fr)_220px_260px_150px]"
          page={pageMembres}
          onChangePage={setPageMembres}
          parPage={membresParPage}
          onChangeParPage={(v) => { setMembresParPage(v); setPageMembres(1) }}
          onReinitialiser={() => { setRechercheMembre(''); setProfilMembre(''); setParoisseMembre(''); setPageMembres(1) }}
          obtenirParoisse={(membre) => membre.paroisse}
        />
      </section>

      <div className="order-1 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Paroisses du district</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {district.paroisses.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/paroisses/${p.id}`}
                  className="rounded-xl border border-gray-100 px-4 py-3 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-gray-900">{p.nom}</p>
                      <p className="mt-1 text-xs text-gray-500">{p.ville}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${p.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                      {p.actif ? 'Active' : 'Désactivée'}
                    </span>
                  </div>
                  {p.chefGroupe ? (
                    <p className="mt-2 text-xs text-gray-600">Chef de groupe : {p.chefGroupe.prenom} {p.chefGroupe.nom}</p>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-orange-600">Chef de groupe : à désigner</p>
                  )}
                  <div className="mt-3 flex gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-gray-400">Scouts</p>
                      <p className="text-sm font-bold text-gray-900">{p.scouts}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase text-gray-400">Utilisateurs</p>
                      <p className="text-sm font-bold text-gray-900">{p.utilisateurs}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Affectations district</h2>
            {membresEquipe.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">Aucun membre d’équipe pour ce district.</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Membre</th>
                      <th className="px-3 py-2">Affectation</th>
                      <th className="hidden px-3 py-2 sm:table-cell">Paroisse</th>
                      <th className="px-3 py-2 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {membresEquipe.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{m.prenom} {m.nom}</td>
                        <td className="px-3 py-2 text-gray-600">{libelleRoleAvecFonction(m.role, m.fonction, m.brancheType)}</td>
                        <td className="hidden px-3 py-2 text-gray-500 sm:table-cell">{m.paroisse.nom}</td>
                        <td className={`px-3 py-2 text-right text-xs font-medium ${m.actif ? 'text-green-700' : 'text-gray-400'}`}>{m.actif ? 'Actif' : 'Inactif'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <section id="commissaire" className="rounded-xl border border-gray-200 bg-white p-5 scroll-mt-6 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Commissaire de District</h2>
              <p className="mt-1 text-sm text-gray-500">Nomination ajoutée au compte paroissial existant.</p>
            </div>
            {commissaire && (
              <button
                type="button"
                onClick={handleRetirerCommissaire}
                disabled={soumissionCommissaire}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                Retirer
              </button>
            )}
          </div>

          {commissaire ? (
            <div className="my-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{commissaire.prenom} {commissaire.nom}</p>
                  <p className="mt-1 text-xs text-gray-500">{commissaire.matricule ?? commissaire.telephone ?? commissaire.email ?? '—'}</p>
                  <p className="mt-1 text-xs text-gray-500">{LABELS_ROLES[commissaire.roleParoisse] ?? commissaire.roleParoisse} — {commissaire.paroisse.nom}</p>
                </div>
                <span className={`shrink-0 text-xs font-medium ${commissaire.actif ? 'text-green-700' : 'text-gray-400'}`}>
                  {commissaire.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>
          ) : (
            <div className="my-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-sm font-medium text-orange-700">Aucun Commissaire de District désigné.</p>
            </div>
          )}

          <form onSubmit={handleCreerCommissaire} className="space-y-3">
            <SelecteurMembre
              id="commissaireId"
              label={commissaire ? 'Remplacer par' : 'Membre du staff'}
              required={!commissaire}
              membres={district.personnelEligible}
              value={chefChoisi}
              onChange={setChefChoisi}
              disabled={soumissionCommissaire || district.personnelEligible.length === 0}
              placeholder={commissaire ? 'Rechercher le nouveau Commissaire…' : 'Rechercher le membre à nommer…'}
              emptyMessage="Aucun membre du staff actif disponible dans ce district."
            />
            {district.personnelEligible.length === 0 && (
              <p className="mt-1 text-xs text-orange-600">Aucun membre du staff actif disponible dans les paroisses de ce district.</p>
            )}
            <button
              type="submit"
              disabled={soumissionCommissaire || !chefChoisi}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {soumissionCommissaire && <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />}
              {soumissionCommissaire
                ? 'Enregistrement…'
                : commissaire ? 'Remplacer le Commissaire' : 'Désigner le Commissaire'}
            </button>
          </form>
        </section>
      </div>
      </div>
    </div>
  )
}
