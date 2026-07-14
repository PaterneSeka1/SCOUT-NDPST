'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'
import { SelecteurMembre } from '@/app/components/SelecteurMembre'
import { LABELS_ROLES, libelleRoleAvecFonction } from '@/lib/roles'

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
}

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

  const charger = useCallback(() => {
    setErreurChargement(false)
    fetch(`/api/admin/districts/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data: District) => { setDistrict(data); setNouveauNom(data.nom) })
      .catch(() => {
        setErreurChargement(true)
        toast.error('Impossible de charger ce district.')
      })
      .finally(() => setChargement(false))
  }, [id])

  useEffect(() => { charger() }, [charger])

  const handleRenommer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nouveauNom.trim()) { toast.error('Le nom du district est requis.'); return }
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
        <Link href="/admin/districts" className="text-sm text-gray-500 hover:text-gray-800">← Retour aux districts</Link>
      </div>
    )
  }

  const commissaire = district.equipe.find((m) => m.role === 'COMMISSAIRE_DISTRICT' && m.actif)
    ?? district.equipe.find((m) => m.role === 'COMMISSAIRE_DISTRICT')
    ?? null
  const membresEquipe = district.equipe.filter((m) => m.role !== 'COMMISSAIRE_DISTRICT')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/admin/districts" className="text-sm text-gray-500 hover:text-gray-800">← Retour aux districts</Link>

        {renommage ? (
          <form onSubmit={handleRenommer} className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
            <input className={CLS_INPUT} value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button type="submit" disabled={soumissionRenommage} className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 transition" style={{ backgroundColor: 'var(--cp)' }}>
                {soumissionRenommage ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" onClick={() => { setRenommage(false); setNouveauNom(district.nom) }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-3 mt-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">District {district.nom}</h1>
            <div className="flex gap-3 flex-shrink-0 pt-1">
              <button onClick={() => setRenommage(true)} className="text-sm font-medium hover:underline" style={{ color: 'var(--cp)' }}>
                Renommer
              </button>
              <button
                onClick={handleSupprimer}
                disabled={suppression || district.paroisses.length > 0}
                title={district.paroisses.length > 0 ? 'Déplacez les paroisses de ce district avant de le supprimer' : undefined}
                className="text-sm font-medium text-red-600 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
              >
                {suppression ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-500 mt-0.5">
          {district.paroisses.length} paroisse{district.paroisses.length > 1 ? 's' : ''}
        </p>
      </div>

      <section id="commissaire" className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 scroll-mt-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Commissaire de District</h2>
            <p className="text-sm text-gray-500 mt-1">Affectation district ajoutée au compte paroissial existant.</p>
          </div>
          {commissaire && (
            <button
              type="button"
              onClick={handleRetirerCommissaire}
              disabled={soumissionCommissaire}
              className="self-start rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
            >
              Retirer
            </button>
          )}
        </div>

        {commissaire ? (
          <div className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-3 mb-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{commissaire.prenom} {commissaire.nom}</p>
              <p className="text-xs text-gray-500">{commissaire.matricule ?? commissaire.telephone ?? commissaire.email ?? '—'}</p>
              <p className="text-xs text-gray-400 mt-0.5">{LABELS_ROLES[commissaire.roleParoisse] ?? commissaire.roleParoisse} — {commissaire.paroisse.nom}</p>
            </div>
            <span className={`flex-shrink-0 text-xs font-medium ${commissaire.actif ? 'text-green-700' : 'text-gray-400'}`}>
              {commissaire.actif ? 'Actif' : 'Désactivé'}
            </span>
          </div>
        ) : (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
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
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
            <button
              type="submit"
              disabled={soumissionCommissaire || !chefChoisi}
              className="rounded-lg px-5 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {soumissionCommissaire && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
              {soumissionCommissaire
                ? 'Enregistrement…'
                : commissaire ? 'Remplacer le Commissaire' : 'Désigner le Commissaire'}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Paroisses du district</h2>
        <ul className="space-y-2">
          {district.paroisses.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/paroisses/${p.id}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-gray-100 rounded-lg px-3 py-3 hover:border-gray-300 hover:bg-gray-50 transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{p.nom}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                      {p.actif ? 'Active' : 'Désactivée'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.ville}</p>
                  {p.chefGroupe ? (
                    <p className="text-xs text-gray-600 mt-1">Chef de groupe : {p.chefGroupe.prenom} {p.chefGroupe.nom}</p>
                  ) : (
                    <p className="text-xs text-orange-600 font-medium mt-1">Chef de groupe : à désigner</p>
                  )}
                </div>
                <div className="flex gap-4 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-[11px] uppercase font-semibold text-gray-400">Scouts</p>
                    <p className="text-sm font-bold text-gray-900">{p.scouts}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] uppercase font-semibold text-gray-400">Utilisateurs</p>
                    <p className="text-sm font-bold text-gray-900">{p.utilisateurs}</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Équipe du district</h2>

        {membresEquipe.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun membre d’équipe pour ce district.</p>
        ) : (
          <ul className="space-y-2">
            {membresEquipe.map((m) => (
              <li key={m.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.prenom} {m.nom}</p>
                  <p className="text-xs text-gray-500">
                    {libelleRoleAvecFonction(m.role, m.fonction, m.brancheType)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{LABELS_ROLES[m.roleParoisse] ?? m.roleParoisse} — {m.paroisse.nom}</p>
                </div>
                <span className={`text-xs font-medium ${m.actif ? 'text-green-700' : 'text-gray-400'}`}>{m.actif ? 'Actif' : 'Désactivé'}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-gray-400 mt-3">
          Les membres de l’équipe sont ajoutés par le Commissaire de District depuis son espace district.
        </p>
      </section>
    </div>
  )
}
