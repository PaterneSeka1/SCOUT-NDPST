'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'
import { LABELS_BRANCHES } from '@/lib/branches'
import {
  LABELS_TYPE_COTISATION,
  LABELS_STATUT_COTISATION,
  COULEURS_STATUT_COTISATION,
  anneeScolaireCourante,
  formatMontantFCFA,
} from '@/lib/cotisations'
import { ROLES_GROUPE } from '@/lib/roles'
import { Wallet, Plus } from '@/lib/icons'

interface Cotisation {
  id: string
  type: string
  libelle: string | null
  montant: number
  montantPaye: number
  anneeScolaire: string
  statut: string
  datePaiement: string | null
  modePaiement: string | null
  notes: string | null
  scout: { id: string; nom: string; prenom: string; brancheType: string; matricule: string | null; actif: boolean }
  enregistrePar: { id: string; nom: string; prenom: string } | null
}

interface ScoutOption {
  id: string
  nom: string
  prenom: string
  brancheType: string
}

const BRANCHES = Object.keys(LABELS_BRANCHES)

function optionsAnnees(): string[] {
  const [debut] = anneeScolaireCourante().split('-').map(Number)
  return [debut - 1, debut, debut + 1].map((a) => `${a}-${a + 1}`)
}

export default function PageCotisations() {
  const { data: session } = useSession()
  const estGroupe = ROLES_GROUPE.includes(session?.user?.role ?? '')

  const [cotisations, setCotisations] = useState<Cotisation[]>([])
  const [anneeScolaire, setAnneeScolaire] = useState(anneeScolaireCourante())
  const [filtreStatut, setFiltreStatut] = useState('')
  const [chargement, setChargement] = useState(true)
  const [enCours, setEnCours] = useState<string | null>(null)

  const [modalOuvert, setModalOuvert] = useState(false)
  const [scoutsBranche, setScoutsBranche] = useState<ScoutOption[]>([])
  const [formGeneration, setFormGeneration] = useState({
    branche: '', type: 'ADHESION_ANNUELLE', libelle: '', montant: '', anneeScolaire: anneeScolaireCourante(),
  })
  const [generationEnCours, setGenerationEnCours] = useState(false)

  const charger = () => {
    setChargement(true)
    const params = new URLSearchParams({ anneeScolaire })
    if (filtreStatut) params.set('statut', filtreStatut)
    fetch(`/api/cotisations?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { toast.error(data.erreur); return }
        setCotisations(data.cotisations ?? [])
      })
      .catch(() => toast.error('Impossible de charger les cotisations'))
      .finally(() => setChargement(false))
  }

  useEffect(charger, [anneeScolaire, filtreStatut])

  const totaux = useMemo(() => {
    const payees = cotisations.filter((c) => c.statut === 'PAYEE').length
    const enAttente = cotisations.filter((c) => c.statut === 'EN_ATTENTE').length
    const montantAttendu = cotisations.reduce((s, c) => s + c.montant, 0)
    const montantPercu = cotisations.reduce((s, c) => s + c.montantPaye, 0)
    return { payees, enAttente, montantAttendu, montantPercu }
  }, [cotisations])

  const changerStatut = async (id: string, statut: string) => {
    setEnCours(id)
    try {
      const res = await fetch(`/api/cotisations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur'); return }
      toast.success('Statut mis à jour')
      charger()
    } finally {
      setEnCours(null)
    }
  }

  const enregistrerPaiementPartiel = async (id: string, montantDu: number) => {
    const saisie = window.prompt(`Montant payé (sur ${formatMontantFCFA(montantDu)}) :`)
    if (saisie === null) return
    const montantPaye = Number(saisie)
    if (!Number.isInteger(montantPaye) || montantPaye <= 0 || montantPaye >= montantDu) {
      toast.error('Montant invalide : doit être un entier positif, inférieur au montant dû')
      return
    }
    setEnCours(id)
    try {
      const res = await fetch(`/api/cotisations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'PARTIELLEMENT_PAYEE', montantPaye }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur'); return }
      toast.success('Paiement partiel enregistré')
      charger()
    } finally {
      setEnCours(null)
    }
  }

  const supprimer = async (id: string) => {
    const cotisation = cotisations.find((c) => c.id === id)
    const ok = await confirmer({
      titre: 'Supprimer cette cotisation ?',
      description: cotisation
        ? `La cotisation de ${formatMontantFCFA(cotisation.montant)} (${cotisation.anneeScolaire}) pour ${cotisation.scout.prenom} ${cotisation.scout.nom} sera définitivement supprimée. Cette action est irréversible.`
        : 'Cette cotisation sera définitivement supprimée. Cette action est irréversible.',
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    setEnCours(id)
    try {
      const res = await fetch(`/api/cotisations/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur'); return }
      toast.success('Cotisation supprimée')
      charger()
    } finally {
      setEnCours(null)
    }
  }

  const ouvrirModal = async () => {
    setModalOuvert(true)
    setFormGeneration((f) => ({ ...f, anneeScolaire }))
  }

  useEffect(() => {
    if (!modalOuvert || !formGeneration.branche) { setScoutsBranche([]); return }
    fetch(`/api/scouts?branche=${formGeneration.branche}&actif=true&limite=200`)
      .then((r) => r.json())
      .then((data) => setScoutsBranche(data.scouts ?? []))
      .catch(() => toast.error('Impossible de charger les scouts de la branche'))
  }, [modalOuvert, formGeneration.branche])

  const genererCotisations = async () => {
    const montant = Number(formGeneration.montant)
    if (!formGeneration.branche) { toast.error('Choisissez une branche'); return }
    if (!Number.isInteger(montant) || montant < 0) { toast.error('Montant invalide'); return }
    if (scoutsBranche.length === 0) { toast.error('Aucun scout actif dans cette branche'); return }

    setGenerationEnCours(true)
    try {
      const res = await fetch('/api/cotisations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoutIds: scoutsBranche.map((s) => s.id),
          type: formGeneration.type,
          libelle: formGeneration.libelle || undefined,
          montant,
          anneeScolaire: formGeneration.anneeScolaire,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur'); return }
      toast.success(`${scoutsBranche.length} cotisation(s) créée(s)`)
      setModalOuvert(false)
      setFormGeneration({ branche: '', type: 'ADHESION_ANNUELLE', libelle: '', montant: '', anneeScolaire })
      charger()
    } finally {
      setGenerationEnCours(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Cotisations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Suivi des adhésions et des paiements par scout</p>
        </div>
        {estGroupe && (
          <button
            onClick={ouvrirModal}
            className="inline-flex items-center gap-1.5 bg-[var(--cp)] text-white px-4 py-2 rounded-lg hover:brightness-110 transition-all text-sm font-medium"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Générer des cotisations
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Payées</p>
          <p className="text-xl font-bold text-green-700">{totaux.payees}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">En attente</p>
          <p className="text-xl font-bold text-amber-700">{totaux.enAttente}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Montant perçu</p>
          <p className="text-lg font-bold text-gray-900">{formatMontantFCFA(totaux.montantPercu)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Montant attendu</p>
          <p className="text-lg font-bold text-gray-900">{formatMontantFCFA(totaux.montantAttendu)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600">Année scolaire :</label>
          <select value={anneeScolaire} onChange={(e) => setAnneeScolaire(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]">
            {optionsAnnees().map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <label className="text-sm text-gray-600 ml-2">Statut :</label>
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]">
            <option value="">Tous</option>
            {Object.entries(LABELS_STATUT_COTISATION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {chargement ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--cp)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cotisations.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="h-10 w-10 mx-auto mb-3 text-gray-300" strokeWidth={2} />
            <p className="text-sm text-gray-500">Aucune cotisation pour cette période.</p>
          </div>
        ) : (
          <>
            {/* Vue mobile : cartes */}
            <div className="sm:hidden space-y-3">
              {cotisations.map((c) => (
                <div key={c.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/dashboard/scouts/${c.scout.id}`} className="text-sm font-medium text-[var(--cp)] hover:underline truncate block">
                        {c.scout.prenom} {c.scout.nom}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">{LABELS_BRANCHES[c.scout.brancheType] ?? c.scout.brancheType}</p>
                    </div>
                    <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${COULEURS_STATUT_COTISATION[c.statut]}`}>
                      {LABELS_STATUT_COTISATION[c.statut] ?? c.statut}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {LABELS_TYPE_COTISATION[c.type] ?? c.type}{c.libelle ? ` — ${c.libelle}` : ''} · {formatMontantFCFA(c.montant)}
                    {c.statut === 'PARTIELLEMENT_PAYEE' && <> (payé : {formatMontantFCFA(c.montantPaye)})</>}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-50">
                    {c.statut !== 'PAYEE' && (
                      <button disabled={enCours === c.id} onClick={() => changerStatut(c.id, 'PAYEE')}
                        className="text-xs text-green-700 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-50 disabled:opacity-50">
                        Marquer payée
                      </button>
                    )}
                    {c.statut !== 'PAYEE' && (
                      <button disabled={enCours === c.id} onClick={() => enregistrerPaiementPartiel(c.id, c.montant)}
                        className="text-xs text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 disabled:opacity-50">
                        Paiement partiel
                      </button>
                    )}
                    {c.statut !== 'EXONEREE' && (
                      <button disabled={enCours === c.id} onClick={() => changerStatut(c.id, 'EXONEREE')}
                        className="text-xs text-gray-600 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                        Exonérer
                      </button>
                    )}
                    {c.statut !== 'EN_ATTENTE' && (
                      <button disabled={enCours === c.id} onClick={() => changerStatut(c.id, 'EN_ATTENTE')}
                        className="text-xs text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-50 disabled:opacity-50">
                        Annuler
                      </button>
                    )}
                    {estGroupe && (
                      <button disabled={enCours === c.id} onClick={() => supprimer(c.id)}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50">
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Vue desktop : tableau */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4 font-medium">Scout</th>
                    <th className="py-2 pr-4 font-medium">Branche</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Montant</th>
                    <th className="py-2 pr-4 font-medium">Statut</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cotisations.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <Link href={`/dashboard/scouts/${c.scout.id}`} className="text-gray-900 font-medium hover:text-[var(--cp)] hover:underline">
                          {c.scout.prenom} {c.scout.nom}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">{LABELS_BRANCHES[c.scout.brancheType] ?? c.scout.brancheType}</td>
                      <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                        {LABELS_TYPE_COTISATION[c.type] ?? c.type}{c.libelle ? ` — ${c.libelle}` : ''}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700 whitespace-nowrap">
                        {formatMontantFCFA(c.montant)}
                        {c.statut === 'PARTIELLEMENT_PAYEE' && (
                          <span className="text-gray-400"> (payé : {formatMontantFCFA(c.montantPaye)})</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${COULEURS_STATUT_COTISATION[c.statut]}`}>
                          {LABELS_STATUT_COTISATION[c.statut] ?? c.statut}
                        </span>
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {c.statut !== 'PAYEE' && (
                            <button disabled={enCours === c.id} onClick={() => changerStatut(c.id, 'PAYEE')}
                              className="text-xs text-green-700 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-50 disabled:opacity-50">
                              Marquer payée
                            </button>
                          )}
                          {c.statut !== 'PAYEE' && (
                            <button disabled={enCours === c.id} onClick={() => enregistrerPaiementPartiel(c.id, c.montant)}
                              className="text-xs text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 disabled:opacity-50">
                              Paiement partiel
                            </button>
                          )}
                          {c.statut !== 'EXONEREE' && (
                            <button disabled={enCours === c.id} onClick={() => changerStatut(c.id, 'EXONEREE')}
                              className="text-xs text-gray-600 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                              Exonérer
                            </button>
                          )}
                          {c.statut !== 'EN_ATTENTE' && (
                            <button disabled={enCours === c.id} onClick={() => changerStatut(c.id, 'EN_ATTENTE')}
                              className="text-xs text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-50 disabled:opacity-50">
                              Annuler
                            </button>
                          )}
                          {estGroupe && (
                            <button disabled={enCours === c.id} onClick={() => supprimer(c.id)}
                              className="text-xs text-red-600 hover:underline disabled:opacity-50">
                              Supprimer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {modalOuvert && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setModalOuvert(false)}>
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900">Générer des cotisations</h2>
            <p className="text-xs text-gray-500">Crée la même cotisation pour tous les scouts actifs d&apos;une branche.</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branche</label>
              <select value={formGeneration.branche} onChange={(e) => setFormGeneration((f) => ({ ...f, branche: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]">
                <option value="">Sélectionner une branche</option>
                {BRANCHES.map((b) => <option key={b} value={b}>{LABELS_BRANCHES[b]}</option>)}
              </select>
              {formGeneration.branche && (
                <p className="text-xs text-gray-400 mt-1">{scoutsBranche.length} scout(s) actif(s) concerné(s)</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={formGeneration.type} onChange={(e) => setFormGeneration((f) => ({ ...f, type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]">
                {Object.entries(LABELS_TYPE_COTISATION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Libellé <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
              <input value={formGeneration.libelle} onChange={(e) => setFormGeneration((f) => ({ ...f, libelle: e.target.value }))}
                placeholder="Ex : Camp de Pâques 2027"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--cp)]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA)</label>
                <input type="number" min="0" step="100" value={formGeneration.montant}
                  onChange={(e) => setFormGeneration((f) => ({ ...f, montant: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--cp)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Année scolaire</label>
                <select value={formGeneration.anneeScolaire} onChange={(e) => setFormGeneration((f) => ({ ...f, anneeScolaire: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]">
                  {optionsAnnees().map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={genererCotisations} disabled={generationEnCours}
                className="flex-1 bg-[var(--cp)] text-white px-4 py-2 rounded-lg hover:brightness-110 transition-all text-sm font-medium disabled:opacity-60">
                {generationEnCours ? 'Génération…' : 'Générer'}
              </button>
              <button onClick={() => setModalOuvert(false)}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
