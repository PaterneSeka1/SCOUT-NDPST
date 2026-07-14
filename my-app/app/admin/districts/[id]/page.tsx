'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { PasswordInput } from '@/app/components/PasswordInput'
import { libelleRoleAvecFonction } from '@/lib/roles'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-gray-700 mb-1'

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
  createdAt: string
  paroisse: { id: string; nom: string }
}

interface District {
  nom: string
  paroisses: ParoisseDistrict[]
  equipe: MembreEquipe[]
}

interface FormCommissaire {
  paroisseId: string
  nom: string
  prenom: string
  matricule: string
  telephone: string
  email: string
  motDePasse: string
}

const COMMISSAIRE_VIDE: FormCommissaire = { paroisseId: '', nom: '', prenom: '', matricule: '', telephone: '', email: '', motDePasse: '' }

export default function FicheDistrictPage() {
  const { key } = useParams<{ key: string }>()
  const [district, setDistrict] = useState<District | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreurChargement, setErreurChargement] = useState(false)
  const [formCommissaire, setFormCommissaire] = useState<FormCommissaire>(COMMISSAIRE_VIDE)
  const [soumissionCommissaire, setSoumissionCommissaire] = useState(false)

  const charger = useCallback(() => {
    setErreurChargement(false)
    fetch(`/api/admin/districts/${key}`)
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data: District) => setDistrict(data))
      .catch(() => {
        setErreurChargement(true)
        toast.error('Impossible de charger ce district.')
      })
      .finally(() => setChargement(false))
  }, [key])

  useEffect(() => { charger() }, [charger])

  const handleCreerCommissaire = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCommissaire.paroisseId) {
      toast.error('La paroisse d’ancrage est requise.')
      return
    }
    if (!formCommissaire.nom.trim() || !formCommissaire.prenom.trim() || !formCommissaire.matricule.trim() || !formCommissaire.motDePasse) {
      toast.error('Le nom, le prénom, le matricule et le mot de passe sont requis.')
      return
    }
    if (!motDePasseValide(formCommissaire.motDePasse)) {
      toast.error(REGLE_MOT_DE_PASSE)
      return
    }
    setSoumissionCommissaire(true)
    try {
      const res = await fetch(`/api/admin/districts/${key}/commissaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paroisseId: formCommissaire.paroisseId,
          nom: formCommissaire.nom,
          prenom: formCommissaire.prenom,
          matricule: formCommissaire.matricule,
          telephone: formCommissaire.telephone || undefined,
          email: formCommissaire.email || undefined,
          password: formCommissaire.motDePasse,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
      toast.success('Commissaire de District désigné. Communiquez-lui ses identifiants.')
      setFormCommissaire(COMMISSAIRE_VIDE)
      charger()
    } catch {
      toast.error('Erreur lors de la création')
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

  const commissaire = district.equipe.find((m) => m.role === 'COMMISSAIRE_DISTRICT') ?? null
  const membresEquipe = district.equipe.filter((m) => m.role !== 'COMMISSAIRE_DISTRICT')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/admin/districts" className="text-sm text-gray-500 hover:text-gray-800">← Retour aux districts</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">District {district.nom}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {district.paroisses.length} paroisse{district.paroisses.length > 1 ? 's' : ''}
        </p>
      </div>

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
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Commissaire de District</h2>

        {commissaire ? (
          <>
            <div className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{commissaire.prenom} {commissaire.nom}</p>
                <p className="text-xs text-gray-500">{commissaire.matricule ?? commissaire.telephone ?? commissaire.email ?? '—'}</p>
              </div>
              <span className={`text-xs font-medium ${commissaire.actif ? 'text-green-700' : 'text-gray-400'}`}>{commissaire.actif ? 'Actif' : 'Désactivé'}</span>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              La modification de ce compte se fait depuis <Link href="/admin/utilisateurs" className="underline hover:text-gray-600">/admin/utilisateurs</Link>.
            </p>
          </>
        ) : (
          <>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-orange-700">Aucun Commissaire de District désigné.</p>
              <p className="text-sm text-orange-600 mt-0.5">Désignez-en un ci-dessous pour que ce district puisse être piloté.</p>
            </div>

            <form onSubmit={handleCreerCommissaire} className="space-y-3">
              <div>
                <label className={CLS_LABEL}>Paroisse d’ancrage *</label>
                <select
                  className={CLS_INPUT}
                  value={formCommissaire.paroisseId}
                  onChange={(e) => setFormCommissaire({ ...formCommissaire, paroisseId: e.target.value })}
                >
                  <option value="">— Choisir une paroisse —</option>
                  {district.paroisses.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={CLS_LABEL}>Prénom *</label>
                  <input className={CLS_INPUT} value={formCommissaire.prenom} onChange={(e) => setFormCommissaire({ ...formCommissaire, prenom: e.target.value })} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Nom *</label>
                  <input className={CLS_INPUT} value={formCommissaire.nom} onChange={(e) => setFormCommissaire({ ...formCommissaire, nom: e.target.value })} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Matricule *</label>
                  <input className={CLS_INPUT} value={formCommissaire.matricule} onChange={(e) => setFormCommissaire({ ...formCommissaire, matricule: e.target.value })} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Téléphone</label>
                  <input className={CLS_INPUT} value={formCommissaire.telephone} onChange={(e) => setFormCommissaire({ ...formCommissaire, telephone: e.target.value })} />
                </div>
                <div>
                  <label className={CLS_LABEL}>E-mail</label>
                  <input type="email" className={CLS_INPUT} value={formCommissaire.email} onChange={(e) => setFormCommissaire({ ...formCommissaire, email: e.target.value })} />
                </div>
                <div>
                  <label className={CLS_LABEL}>Mot de passe temporaire *</label>
                  <PasswordInput className={CLS_INPUT} value={formCommissaire.motDePasse} onChange={(e) => setFormCommissaire({ ...formCommissaire, motDePasse: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
                <button
                  type="submit"
                  disabled={soumissionCommissaire}
                  className="rounded-lg px-5 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--cp)' }}
                >
                  {soumissionCommissaire && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                  {soumissionCommissaire ? 'Création…' : 'Désigner le Commissaire'}
                </button>
              </div>
            </form>
          </>
        )}
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
                </div>
                <span className={`text-xs font-medium ${m.actif ? 'text-green-700' : 'text-gray-400'}`}>{m.actif ? 'Actif' : 'Désactivé'}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-gray-400 mt-3">
          Les membres de l’équipe sont ajoutés par le Commissaire de District lui-même, via /district/equipe.
        </p>
      </section>
    </div>
  )
}
