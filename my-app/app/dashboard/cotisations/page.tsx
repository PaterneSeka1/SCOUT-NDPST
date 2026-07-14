'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'
import { LABELS_BRANCHES } from '@/lib/branches'
import {
  LABELS_TYPE_COTISATION,
  LABELS_STATUT_COTISATION,
  COULEURS_STATUT_COTISATION,
  STATUTS_COTISATION_A_FINALISER,
  STATUTS_COTISATION_ARGENT_RECU,
  anneeScolaireCourante,
  formatMontantFCFA,
} from '@/lib/cotisations'
import { LABELS_ROLES, ROLES_GROUPE, ROLES_GESTION } from '@/lib/roles'

type CibleGeneration = 'SCOUTS_BRANCHE' | 'STAFF_BRANCHE' | 'TOUS_STAFF'

interface ParticipantScout {
  id: string
  nom: string
  prenom: string
  brancheType: string
  matricule: string | null
  actif: boolean
}

interface ParticipantUtilisateur {
  id: string
  nom: string
  prenom: string
  role: string
  brancheType: string | null
  matricule: string | null
  actif: boolean
}

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
  scout: ParticipantScout | null
  utilisateur: ParticipantUtilisateur | null
  enregistrePar: { id: string; nom: string; prenom: string; role: string } | null
  collectePar: { id: string; nom: string; prenom: string; role: string } | null
}

interface ScoutOption {
  id: string
  nom: string
  prenom: string
  brancheType: string
}

const BRANCHES = Object.keys(LABELS_BRANCHES)

const CIBLES_GENERATION: { value: CibleGeneration; label: string; brancheRequise: boolean }[] = [
  { value: 'SCOUTS_BRANCHE', label: 'Scouts d’une branche', brancheRequise: true },
  { value: 'STAFF_BRANCHE', label: 'Chefs d’une branche', brancheRequise: true },
  { value: 'TOUS_STAFF', label: 'Tous les chefs', brancheRequise: false },
]

const STATUTS_FINAUX = ['PAYEE', 'EXONEREE']

function optionsAnnees(): string[] {
  const [debut] = anneeScolaireCourante().split('-').map(Number)
  return [debut - 1, debut, debut + 1].map((a) => `${a}-${a + 1}`)
}

function formulaireInitial(annee = anneeScolaireCourante()) {
  return {
    cible: 'SCOUTS_BRANCHE' as CibleGeneration,
    branche: '',
    type: 'ADHESION_ANNUELLE',
    libelle: '',
    montant: '',
    anneeScolaire: annee,
  }
}

function cibleCotisation(cotisation: Cotisation) {
  if (cotisation.scout) {
    const scout = cotisation.scout
    return {
      id: scout.id,
      nomComplet: `${scout.prenom} ${scout.nom}`,
      href: `/dashboard/scouts/${scout.id}`,
      role: 'Scout',
      branche: LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType,
      matricule: scout.matricule,
    }
  }

  if (cotisation.utilisateur) {
    const utilisateur = cotisation.utilisateur
    return {
      id: utilisateur.id,
      nomComplet: `${utilisateur.prenom} ${utilisateur.nom}`,
      href: `/dashboard/utilisateurs/${utilisateur.id}`,
      role: LABELS_ROLES[utilisateur.role] ?? utilisateur.role,
      branche: utilisateur.brancheType ? LABELS_BRANCHES[utilisateur.brancheType] ?? utilisateur.brancheType : 'Sans branche',
      matricule: utilisateur.matricule,
    }
  }

  return {
    id: '',
    nomComplet: 'Participant supprimé',
    href: '#',
    role: 'Ancien compte',
    branche: '—',
    matricule: null,
  }
}

function libelleCotisation(cotisation: Cotisation) {
  const type = LABELS_TYPE_COTISATION[cotisation.type] ?? cotisation.type
  return cotisation.libelle ? `${type} — ${cotisation.libelle}` : type
}

function couleurStatut(statut: string) {
  return COULEURS_STATUT_COTISATION[statut] ?? 'bg-gray-100 text-gray-700'
}

export default function PageCotisations() {
  const { data: session } = useSession()
  const estGroupe = ROLES_GROUPE.includes(session?.user?.role ?? '')
  // PUT /api/cotisations/[id] (changement de statut) exige ROLES_GESTION —
  // plus restrictif que ROLES_TOUT_STAFF qui donne accès à cette page
  // (ADJOINT_GROUPE/ASSISTANT_GROUPE peuvent voir la liste mais pas modifier).
  const estGestion = ROLES_GESTION.includes(session?.user?.role ?? '')

  const [cotisations, setCotisations] = useState<Cotisation[]>([])
  const [anneeScolaire, setAnneeScolaire] = useState(anneeScolaireCourante())
  const [filtreStatut, setFiltreStatut] = useState('')
  const [filtreBranche, setFiltreBranche] = useState('')
  const [chargement, setChargement] = useState(true)
  const [enCours, setEnCours] = useState<string | null>(null)

  const [modalOuvert, setModalOuvert] = useState(false)
  const [scoutsBranche, setScoutsBranche] = useState<ScoutOption[]>([])
  const [formGeneration, setFormGeneration] = useState(formulaireInitial())
  const [generationEnCours, setGenerationEnCours] = useState(false)

  const charger = useCallback(() => {
    setChargement(true)
    const params = new URLSearchParams({ anneeScolaire })
    if (filtreStatut) params.set('statut', filtreStatut)
    if (filtreBranche) params.set('branche', filtreBranche)

    fetch(`/api/cotisations?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) {
          toast.error(data.erreur)
          return
        }
        setCotisations(data.cotisations ?? [])
      })
      .catch(() => toast.error('Impossible de charger les cotisations'))
      .finally(() => setChargement(false))
  }, [anneeScolaire, filtreStatut, filtreBranche])

  useEffect(() => {
    charger()
  }, [charger])

  const totaux = useMemo(() => {
    const validees = cotisations.filter((c) => c.statut === 'PAYEE').length
    const aFinaliser = cotisations.filter((c) => STATUTS_COTISATION_A_FINALISER.includes(c.statut)).length
    const argentRecu = cotisations
      .filter((c) => STATUTS_COTISATION_ARGENT_RECU.includes(c.statut))
      .reduce((s, c) => s + c.montantPaye, 0)
    const aPayerSite = cotisations.filter((c) => c.statut === 'ARGENT_RECU').reduce((s, c) => s + c.montantPaye, 0)
    return { validees, aFinaliser, argentRecu, aPayerSite }
  }, [cotisations])

  const changerStatut = async (id: string, statut: string) => {
    const messages: Record<string, string> = {
      EN_ATTENTE: 'Cotisation réinitialisée',
      ARGENT_RECU: 'Argent reçu enregistré',
      PAYE_SITE: 'Paiement sur le site enregistré',
      PAYEE: 'Adhésion validée',
      EXONEREE: 'Exonération enregistrée',
    }

    setEnCours(id)
    try {
      const res = await fetch(`/api/cotisations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur')
        return
      }
      toast.success(messages[statut] ?? 'Statut mis à jour')
      charger()
    } finally {
      setEnCours(null)
    }
  }

  const enregistrerPaiementPartiel = async (id: string, montantDu: number) => {
    const saisie = window.prompt(`Montant reçu (sur ${formatMontantFCFA(montantDu)}) :`)
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
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur')
        return
      }
      toast.success('Montant partiel enregistré')
      charger()
    } finally {
      setEnCours(null)
    }
  }

  const supprimer = async (id: string) => {
    const cotisation = cotisations.find((c) => c.id === id)
    const cible = cotisation ? cibleCotisation(cotisation) : null
    const ok = await confirmer({
      titre: 'Supprimer cette cotisation ?',
      description: cotisation
        ? `La cotisation de ${formatMontantFCFA(cotisation.montant)} (${cotisation.anneeScolaire}) pour ${cible?.nomComplet} sera définitivement supprimée.`
        : 'Cette cotisation sera définitivement supprimée.',
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return

    setEnCours(id)
    try {
      const res = await fetch(`/api/cotisations/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur')
        return
      }
      toast.success('Cotisation supprimée')
      charger()
    } finally {
      setEnCours(null)
    }
  }

  const urlExport = () => {
    const params = new URLSearchParams({ anneeScolaire })
    if (filtreStatut) params.set('statut', filtreStatut)
    if (filtreBranche) params.set('branche', filtreBranche)
    return `/api/cotisations/export?${params.toString()}`
  }

  const ouvrirModal = () => {
    setFormGeneration((f) => ({ ...f, anneeScolaire }))
    setModalOuvert(true)
  }

  useEffect(() => {
    if (!modalOuvert || formGeneration.cible !== 'SCOUTS_BRANCHE' || !formGeneration.branche) {
      setScoutsBranche([])
      return
    }

    const params = new URLSearchParams({ branche: formGeneration.branche, actif: 'true', limite: '200' })
    fetch(`/api/scouts?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setScoutsBranche(data.scouts ?? []))
      .catch(() => toast.error('Impossible de charger les scouts de la branche'))
  }, [modalOuvert, formGeneration.cible, formGeneration.branche])

  const genererCotisations = async () => {
    const cibleConfig = CIBLES_GENERATION.find((c) => c.value === formGeneration.cible)
    const montant = Number(formGeneration.montant)

    if (cibleConfig?.brancheRequise && !formGeneration.branche) {
      toast.error('Choisissez une branche')
      return
    }
    if (!Number.isInteger(montant) || montant < 0) {
      toast.error('Montant invalide')
      return
    }
    if (formGeneration.cible === 'SCOUTS_BRANCHE' && scoutsBranche.length === 0) {
      toast.error('Aucun scout actif dans cette branche')
      return
    }

    setGenerationEnCours(true)
    try {
      const res = await fetch('/api/cotisations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cible: formGeneration.cible,
          branche: cibleConfig?.brancheRequise ? formGeneration.branche : undefined,
          type: formGeneration.type,
          libelle: formGeneration.libelle || undefined,
          montant,
          anneeScolaire: formGeneration.anneeScolaire,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur')
        return
      }
      toast.success(`${data.cotisations?.length ?? 0} cotisation(s) créée(s)`)
      setModalOuvert(false)
      setFormGeneration(formulaireInitial(anneeScolaire))
      charger()
    } finally {
      setGenerationEnCours(false)
    }
  }

  const rendreActions = (cotisation: Cotisation) => {
    const traitement = enCours === cotisation.id
    const peutRecevoirPartiel = !['ARGENT_RECU', 'PAYE_SITE', ...STATUTS_FINAUX].includes(cotisation.statut)
    const peutRecevoirComplet = !['ARGENT_RECU', 'PAYE_SITE', ...STATUTS_FINAUX].includes(cotisation.statut)
    const peutPayerSite = cotisation.statut === 'ARGENT_RECU'
    const peutValider = cotisation.statut === 'PAYE_SITE'

    return (
      <div className="flex flex-wrap items-center gap-2">
        {estGestion && peutRecevoirPartiel && (
          <button
            disabled={traitement}
            onClick={() => enregistrerPaiementPartiel(cotisation.id, cotisation.montant)}
            className="text-xs text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            Partiel
          </button>
        )}
        {estGestion && peutRecevoirComplet && (
          <button
            disabled={traitement}
            onClick={() => changerStatut(cotisation.id, 'ARGENT_RECU')}
            className="text-xs text-orange-700 border border-orange-200 px-2.5 py-1 rounded-lg hover:bg-orange-50 disabled:opacity-50"
          >
            Argent reçu
          </button>
        )}
        {estGestion && peutPayerSite && (
          <button
            disabled={traitement}
            onClick={() => changerStatut(cotisation.id, 'PAYE_SITE')}
            className="text-xs text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
          >
            Payé site
          </button>
        )}
        {estGestion && peutValider && (
          <button
            disabled={traitement}
            onClick={() => changerStatut(cotisation.id, 'PAYEE')}
            className="text-xs text-green-700 border border-green-200 px-2.5 py-1 rounded-lg hover:bg-green-50 disabled:opacity-50"
          >
            Valider
          </button>
        )}
        {estGestion && cotisation.statut !== 'EXONEREE' && (
          <button
            disabled={traitement}
            onClick={() => changerStatut(cotisation.id, 'EXONEREE')}
            className="text-xs text-gray-600 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Exonérer
          </button>
        )}
        {estGestion && cotisation.statut !== 'EN_ATTENTE' && (
          <button
            disabled={traitement}
            onClick={() => changerStatut(cotisation.id, 'EN_ATTENTE')}
            className="text-xs text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-50 disabled:opacity-50"
          >
            Réinitialiser
          </button>
        )}
        {estGroupe && (
          <button disabled={traitement} onClick={() => supprimer(cotisation.id)} className="text-xs text-red-600 hover:underline disabled:opacity-50">
            Supprimer
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Droits d’adhésion</h1>
          <p className="text-sm text-gray-500 mt-0.5">Année pastorale {anneeScolaire} · scouts et chefs</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={urlExport()}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Exporter CSV
          </a>
          {estGroupe && (
            <button
              onClick={ouvrirModal}
              className="bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium"
            >
              + Générer
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Validées</p>
          <p className="text-xl font-bold text-green-700">{totaux.validees}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">À finaliser</p>
          <p className="text-xl font-bold text-amber-700">{totaux.aFinaliser}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Argent reçu</p>
          <p className="text-lg font-bold text-gray-900">{formatMontantFCFA(totaux.argentRecu)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">À payer site</p>
          <p className="text-lg font-bold text-gray-900">{formatMontantFCFA(totaux.aPayerSite)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Année pastorale</span>
            <select
              value={anneeScolaire}
              onChange={(e) => setAnneeScolaire(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
            >
              {optionsAnnees().map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Statut</span>
            <select
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(LABELS_STATUT_COTISATION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Branche</span>
            <select
              value={filtreBranche}
              onChange={(e) => setFiltreBranche(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
            >
              <option value="">Toutes les branches</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{LABELS_BRANCHES[b]}</option>)}
            </select>
          </label>
        </div>

        {chargement ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cotisations.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm font-medium text-gray-700">Aucune cotisation trouvée</p>
            <p className="text-sm text-gray-500 mt-1">Changez les filtres ou générez les droits de l’année.</p>
          </div>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {cotisations.map((cotisation) => {
                const cible = cibleCotisation(cotisation)
                return (
                  <div key={cotisation.id} className="border border-gray-100 rounded-lg p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={cible.href} className="text-sm font-medium text-[#1a4731] hover:underline truncate block">
                          {cible.nomComplet}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5">{cible.role} · {cible.branche}</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${couleurStatut(cotisation.statut)}`}>
                        {LABELS_STATUT_COTISATION[cotisation.statut] ?? cotisation.statut}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>{libelleCotisation(cotisation)}</p>
                      <p>
                        {formatMontantFCFA(cotisation.montant)}
                        {cotisation.montantPaye > 0 && <span className="text-gray-400"> · reçu {formatMontantFCFA(cotisation.montantPaye)}</span>}
                      </p>
                      {cotisation.collectePar && (
                        <p className="text-gray-500">
                          Reçu par {cotisation.collectePar.prenom} {cotisation.collectePar.nom}
                          {LABELS_ROLES[cotisation.collectePar.role] ? ` (${LABELS_ROLES[cotisation.collectePar.role]})` : ''}
                        </p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-gray-50">{rendreActions(cotisation)}</div>
                  </div>
                )
              })}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4 font-medium">Membre</th>
                    <th className="py-2 pr-4 font-medium">Branche / rôle</th>
                    <th className="py-2 pr-4 font-medium">Cotisation</th>
                    <th className="py-2 pr-4 font-medium">Montant</th>
                    <th className="py-2 pr-4 font-medium">Statut</th>
                    <th className="py-2 pr-4 font-medium">Collecte</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cotisations.map((cotisation) => {
                    const cible = cibleCotisation(cotisation)
                    return (
                      <tr key={cotisation.id} className="border-b border-gray-50 last:border-0 align-top">
                        <td className="py-3 pr-4 min-w-[180px]">
                          <Link href={cible.href} className="text-gray-900 font-medium hover:text-[#1a4731] hover:underline">
                            {cible.nomComplet}
                          </Link>
                          {cible.matricule && <p className="text-xs text-gray-400 mt-0.5">{cible.matricule}</p>}
                        </td>
                        <td className="py-3 pr-4 min-w-[170px] text-gray-600">
                          <p>{cible.branche}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{cible.role}</p>
                        </td>
                        <td className="py-3 pr-4 min-w-[180px] text-gray-600">{libelleCotisation(cotisation)}</td>
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-700">
                          <p>{formatMontantFCFA(cotisation.montant)}</p>
                          {cotisation.montantPaye > 0 && <p className="text-xs text-gray-400">Reçu : {formatMontantFCFA(cotisation.montantPaye)}</p>}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${couleurStatut(cotisation.statut)}`}>
                            {LABELS_STATUT_COTISATION[cotisation.statut] ?? cotisation.statut}
                          </span>
                        </td>
                        <td className="py-3 pr-4 min-w-[140px] text-xs text-gray-500">
                          {cotisation.collectePar
                            ? `Reçu par ${cotisation.collectePar.prenom} ${cotisation.collectePar.nom}${LABELS_ROLES[cotisation.collectePar.role] ? ` (${LABELS_ROLES[cotisation.collectePar.role]})` : ''}`
                            : cotisation.enregistrePar
                              ? `Saisi par ${cotisation.enregistrePar.prenom} ${cotisation.enregistrePar.nom}`
                              : '—'}
                        </td>
                        <td className="py-3 min-w-[320px]">{rendreActions(cotisation)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {modalOuvert && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-3 sm:p-4 z-50" onClick={() => setModalOuvert(false)}>
          <div className="bg-white rounded-t-xl sm:rounded-xl p-5 sm:p-6 w-full max-w-lg space-y-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Générer des droits</h2>
              <p className="text-xs text-gray-500 mt-1">Crée les cotisations de l’année pour les scouts ou les chefs concernés.</p>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Public concerné</span>
              <select
                value={formGeneration.cible}
                onChange={(e) => setFormGeneration((f) => ({ ...f, cible: e.target.value as CibleGeneration, branche: '' }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
              >
                {CIBLES_GENERATION.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>

            {CIBLES_GENERATION.find((c) => c.value === formGeneration.cible)?.brancheRequise && (
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Branche</span>
                <select
                  value={formGeneration.branche}
                  onChange={(e) => setFormGeneration((f) => ({ ...f, branche: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
                >
                  <option value="">Sélectionner une branche</option>
                  {BRANCHES.map((b) => <option key={b} value={b}>{LABELS_BRANCHES[b]}</option>)}
                </select>
                {formGeneration.cible === 'SCOUTS_BRANCHE' && formGeneration.branche && (
                  <span className="block text-xs text-gray-400 mt-1">{scoutsBranche.length} scout(s) actif(s) concerné(s)</span>
                )}
              </label>
            )}

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Type</span>
              <select
                value={formGeneration.type}
                onChange={(e) => setFormGeneration((f) => ({ ...f, type: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
              >
                {Object.entries(LABELS_TYPE_COTISATION).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Libellé <span className="text-xs text-gray-400 font-normal">(optionnel)</span></span>
              <input
                value={formGeneration.libelle}
                onChange={(e) => setFormGeneration((f) => ({ ...f, libelle: e.target.value }))}
                placeholder="Ex : Adhésion 2026-2027"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Montant (FCFA)</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formGeneration.montant}
                  onChange={(e) => setFormGeneration((f) => ({ ...f, montant: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Année pastorale</span>
                <select
                  value={formGeneration.anneeScolaire}
                  onChange={(e) => setFormGeneration((f) => ({ ...f, anneeScolaire: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
                >
                  {optionsAnnees().map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                onClick={() => setModalOuvert(false)}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Annuler
              </button>
              <button
                onClick={genererCotisations}
                disabled={generationEnCours}
                className="sm:flex-1 bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60"
              >
                {generationEnCours ? 'Génération…' : 'Générer les droits'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
