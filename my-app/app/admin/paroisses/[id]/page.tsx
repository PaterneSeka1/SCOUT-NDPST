'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { PasswordInput } from '@/app/components/PasswordInput'
import { confirmer } from '@/app/components/ConfirmDialog'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

interface ChefGroupe {
  id: string; nom: string; prenom: string; matricule: string | null; telephone: string | null; email: string | null; actif: boolean
}

interface Paroisse {
  id: string; nom: string; ville: string; diocese: string
  ocean: string | null; doyenne: string | null
  adresse: string | null; telephone: string | null; email: string | null
  actif: boolean
  counts: { scouts: number; utilisateurs: number; activites: number }
  chefsGroupe: ChefGroupe[]
}

interface FormParoisse {
  nom: string; ville: string; diocese: string; ocean: string; doyenne: string
  adresse: string; telephone: string; email: string
}

interface FormChefGroupe {
  nom: string; prenom: string; matricule: string; telephone: string; email: string; motDePasse: string
}

const CHEF_VIDE: FormChefGroupe = { nom: '', prenom: '', matricule: '', telephone: '', email: '', motDePasse: '' }

export default function FicheParoissePage() {
  const { id } = useParams<{ id: string }>()
  const [paroisse, setParoisse] = useState<Paroisse | null>(null)
  const [chargement, setChargement] = useState(true)
  const [modeEdition, setModeEdition] = useState(false)
  const [form, setForm] = useState<FormParoisse | null>(null)
  const [soumission, setSoumission] = useState(false)
  const [formChef, setFormChef] = useState<FormChefGroupe>(CHEF_VIDE)
  const [soumissionChef, setSoumissionChef] = useState(false)
  const [afficherFormChef, setAfficherFormChef] = useState(false)
  const [erreurChargement, setErreurChargement] = useState(false)
  const [doyennesExistantes, setDoyennesExistantes] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/admin/districts')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { districts?: { doyenne: string }[] } | null) => {
        if (data?.districts) setDoyennesExistantes(data.districts.map((d) => d.doyenne))
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
          ocean: data.ocean ?? '', doyenne: data.doyenne ?? '',
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/paroisses" className="text-sm text-gray-500 hover:text-gray-800">← Retour aux paroisses</Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">{paroisse.nom}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{paroisse.ville} — {paroisse.diocese}</p>
        </div>
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${paroisse.actif ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
          {paroisse.actif ? 'Active' : 'Désactivée'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-[#1a4731] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{paroisse.counts.scouts}</p>
          <p className="text-xs opacity-90 mt-0.5">Scouts</p>
        </div>
        <div className="bg-[#27ae60] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{paroisse.counts.utilisateurs}</p>
          <p className="text-xs opacity-90 mt-0.5">Utilisateurs</p>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-[#f39c12] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{paroisse.counts.activites}</p>
          <p className="text-xs opacity-90 mt-0.5">Activités</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/admin/paroisses/${id}/export/scouts`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          ⬇ Exporter les scouts (CSV)
        </a>
        <a
          href={`/api/admin/paroisses/${id}/export/utilisateurs`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          ⬇ Exporter les utilisateurs (CSV)
        </a>
      </div>

      {/* Chef(s) de Groupe */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Chef de Groupe</h2>
          {!afficherFormChef && (
            <button onClick={() => setAfficherFormChef(true)} className="text-sm font-medium hover:underline" style={{ color: 'var(--cp)' }}>
              + Désigner {paroisse.chefsGroupe.length > 0 ? 'un autre' : 'un Chef de Groupe'}
            </button>
          )}
        </div>

        {paroisse.chefsGroupe.length === 0 && !afficherFormChef && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-orange-700">Aucun Chef de Groupe désigné pour cette paroisse.</p>
            <p className="text-sm text-orange-600 mt-0.5">
              Cette paroisse n&apos;a pas encore de Chef de Groupe — désignez-en un ci-dessous pour qu&apos;elle puisse être utilisée.
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {paroisse.chefsGroupe.map((c) => (
            <li key={c.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{c.prenom} {c.nom}</p>
                <p className="text-xs text-gray-500">{c.matricule ?? c.telephone ?? c.email}</p>
              </div>
              <span className={`text-xs font-medium ${c.actif ? 'text-green-700' : 'text-gray-400'}`}>{c.actif ? 'Actif' : 'Désactivé'}</span>
            </li>
          ))}
        </ul>

        {afficherFormChef && (
          <form onSubmit={handleCreerChef} className="mt-4 border-t border-gray-100 pt-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
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
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
              <button type="button" onClick={() => setAfficherFormChef(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Annuler
              </button>
              <button
                type="submit"
                disabled={soumissionChef}
                className="rounded-lg px-5 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--cp)' }}
              >
                {soumissionChef && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                {soumissionChef ? 'Création…' : 'Créer le compte'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Informations */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">Informations</h2>
          {!modeEdition && (
            <button onClick={() => setModeEdition(true)} className="text-sm font-medium hover:underline" style={{ color: 'var(--cp)' }}>
              Modifier
            </button>
          )}
        </div>

        {modeEdition ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={CLS_LABEL}>Nom *</label><input className={CLS_INPUT} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required /></div>
              <div><label className={CLS_LABEL}>Ville *</label><input className={CLS_INPUT} value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} required /></div>
              <div><label className={CLS_LABEL}>Diocèse *</label><input className={CLS_INPUT} value={form.diocese} onChange={(e) => setForm({ ...form, diocese: e.target.value })} required /></div>
              <div>
                <label className={CLS_LABEL}>Doyenné</label>
                <input className={CLS_INPUT} value={form.doyenne} onChange={(e) => setForm({ ...form, doyenne: e.target.value })} list="doyennes-existantes" />
                <datalist id="doyennes-existantes">
                  {doyennesExistantes.map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div><label className={CLS_LABEL}>Océan / secteur</label><input className={CLS_INPUT} value={form.ocean} onChange={(e) => setForm({ ...form, ocean: e.target.value })} /></div>
              <div><label className={CLS_LABEL}>Téléphone</label><input className={CLS_INPUT} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></div>
              <div><label className={CLS_LABEL}>E-mail</label><input type="email" className={CLS_INPUT} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={CLS_LABEL}>Adresse</label><input className={CLS_INPUT} value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></div>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
              <button type="button" onClick={() => setModeEdition(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                Annuler
              </button>
              <button type="submit" disabled={soumission} className="rounded-lg px-5 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--cp)' }}>
                {soumission && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                {soumission ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-400">Doyenné</dt><dd className="text-gray-800">{paroisse.doyenne || '—'}</dd></div>
            <div><dt className="text-gray-400">Océan / secteur</dt><dd className="text-gray-800">{paroisse.ocean || '—'}</dd></div>
            <div><dt className="text-gray-400">Téléphone</dt><dd className="text-gray-800">{paroisse.telephone || '—'}</dd></div>
            <div><dt className="text-gray-400">E-mail</dt><dd className="text-gray-800">{paroisse.email || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-gray-400">Adresse</dt><dd className="text-gray-800">{paroisse.adresse || '—'}</dd></div>
          </dl>
        )}
      </section>

      {/* Zone sensible */}
      <section className="bg-white rounded-xl border border-red-100 p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-red-500 mb-3">Zone sensible</h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            {paroisse.actif
              ? 'Désactiver bloque la connexion de tous les utilisateurs de cette paroisse, sans supprimer aucune donnée.'
              : 'Réactiver redonne accès à tous les utilisateurs de cette paroisse.'}
          </p>
          <button
            onClick={basculerActif}
            className={`sm:flex-shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${paroisse.actif ? 'border border-red-300 text-red-600 hover:bg-red-50' : 'border border-green-300 text-green-700 hover:bg-green-50'}`}
          >
            {paroisse.actif ? 'Désactiver' : 'Réactiver'}
          </button>
        </div>
      </section>
    </div>
  )
}
