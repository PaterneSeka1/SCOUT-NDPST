'use client'

import Image from 'next/image'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@scout/shared'
import {
  LABELS_TYPE_COTISATION,
  LABELS_STATUT_COTISATION,
  COULEURS_STATUT_COTISATION,
  formatMontantFCFA,
} from '@scout/shared'
import { LABELS_TYPE_ACTIVITE } from '@scout/shared'
import { Baby, Check } from '@/lib/icons'

const LABELS_STATUT_REUNION: Record<string, { label: string; cls: string; dot: string }> = {
  PRESENT: { label: 'Présent', cls: 'text-green-700 bg-green-50', dot: 'bg-green-500' },
  ABSENT: { label: 'Absent', cls: 'text-red-700 bg-red-50', dot: 'bg-red-400' },
  EXCUSE: { label: 'Excusé', cls: 'text-orange-700 bg-orange-50', dot: 'bg-orange-400' },
}

const LABELS_ROLE: Record<string, string> = {
  RESPONSABLE: 'Responsable',
  ADJOINT: 'Adjoint',
  ASSISTANT: 'Assistant',
}

interface PresenceReunion {
  statut: string
  jourReunion: {
    id: string
    titre: string | null
    dateHeure: string
    dateReportee: string | null
    brancheType: string | null
  }
}

interface CotisationEnfant {
  id: string
  type: string
  libelle: string | null
  montant: number
  anneeScolaire: string
  statut: string
  datePaiement: string | null
}

interface Scout {
  id: string
  nom: string
  prenom: string
  brancheType: string
  photo: string | null
  actif: boolean
  matricule: string | null
  consentementImage: boolean
  consentementImageDate: string | null
  _count: { presences: number; presencesReunion: number }
  presences: { activite: { titre: string; dateDebut: string; type: string } }[]
  presencesReunion: PresenceReunion[]
  cotisations: CotisationEnfant[]
}

interface Activite {
  id: string
  titre: string
  dateDebut: string
  lieu: string | null
  type: string
  brancheType: string | null
}

interface Reunion {
  id: string
  titre: string | null
  dateHeure: string
  dateReportee: string | null
  lieu: string | null
  brancheType: string | null
}

interface Responsable {
  id: string
  brancheType: string
  role: string
  utilisateur: { id: string; prenom: string; nom: string; telephone: string | null; email: string | null; role: string }
}

interface CampAutorisation {
  id: string
  titre: string
  dateDebut: string
  lieu: string | null
  ficheMedicale: boolean
  autorisationParentale: boolean
}

const LABELS_TYPE_AUTORISATION: Record<'FICHE_MEDICALE' | 'AUTORISATION_PARENTALE', string> = {
  FICHE_MEDICALE: 'Fiche médicale',
  AUTORISATION_PARENTALE: 'Autorisation parentale',
}

export default function PageMesEnfants() {
  const [enfants, setEnfants] = useState<Scout[]>([])
  const [prochaines, setProchaines] = useState<Activite[]>([])
  const [prochinesReunions, setProchinesReunions] = useState<Reunion[]>([])
  const [responsables, setResponsables] = useState<Responsable[]>([])
  const [campsParEnfant, setCampsParEnfant] = useState<Record<string, CampAutorisation[]>>({})
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [ongletEnfant, setOngletEnfant] = useState<Record<string, 'activites' | 'reunions'>>({})
  const [enCours, setEnCours] = useState<string | null>(null)

  const charger = () => {
    fetch('/api/mes-enfants')
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) {
          setErreur(data.erreur)
          return
        }
        setEnfants(data.enfants ?? [])
        setProchaines(data.prochaines ?? [])
        setProchinesReunions(data.prochinesReunions ?? [])
        setResponsables(data.responsables ?? [])
        setCampsParEnfant(data.campsParEnfant ?? {})
      })
      .catch(() => setErreur('Impossible de charger les données'))
      .finally(() => setChargement(false))
  }

  useEffect(() => {
    charger()
  }, [])

  async function basculerConsentementImage(scoutId: string, nouvelleValeur: boolean) {
    setEnCours(`consentement-${scoutId}`)
    try {
      const res = await fetch(`/api/mes-enfants/${scoutId}/consentement-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentement: nouvelleValeur }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.erreur ?? 'Erreur serveur')
        return
      }
      toast.success(nouvelleValeur ? "Droit à l'image autorisé" : "Droit à l'image révoqué")
      charger()
    } finally {
      setEnCours(null)
    }
  }

  async function confirmerDigitalement(
    activiteId: string,
    scoutId: string,
    type: 'FICHE_MEDICALE' | 'AUTORISATION_PARENTALE',
  ) {
    const cle = `${activiteId}-${scoutId}-${type}`
    setEnCours(cle)
    try {
      const res = await fetch(`/api/activites/${activiteId}/autorisations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoutId, type, mode: 'CONFIRMATION' }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.erreur ?? 'Erreur serveur')
        return
      }
      toast.success('Autorisation confirmée')
      charger()
    } finally {
      setEnCours(null)
    }
  }

  async function deposerDocument(
    activiteId: string,
    scoutId: string,
    type: 'FICHE_MEDICALE' | 'AUTORISATION_PARENTALE',
    fichier: File,
  ) {
    const cle = `${activiteId}-${scoutId}-${type}`
    setEnCours(cle)
    try {
      const fd = new FormData()
      fd.append('fichier', fichier)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) {
        toast.error(uploadData.erreur ?? 'Erreur upload')
        return
      }

      const res = await fetch(`/api/activites/${activiteId}/autorisations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoutId,
          type,
          mode: 'DOCUMENT',
          documentUrl: uploadData.url,
          documentNomFichier: fichier.name,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.erreur ?? 'Erreur serveur')
        return
      }
      toast.success('Document envoyé')
      charger()
    } finally {
      setEnCours(null)
    }
  }

  const getOnglet = (scoutId: string) => ongletEnfant[scoutId] ?? 'reunions'
  const setOnglet = (scoutId: string, val: 'activites' | 'reunions') =>
    setOngletEnfant((p) => ({ ...p, [scoutId]: val }))

  if (chargement)
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
      </div>
    )
  if (erreur)
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">Mes enfants</h1>
        <p className="mt-0.5 text-sm text-stone-500">Suivez la progression de vos enfants scouts</p>
      </div>

      {enfants.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
          <Baby className="mx-auto mb-3 h-10 w-10 text-stone-300" strokeWidth={2} />
          <p className="text-sm text-stone-500">Aucun enfant lié à votre compte</p>
          <p className="mt-1 text-xs text-stone-400">
            Contactez le Chef de Groupe de votre paroisse pour associer vos enfants.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {enfants.map((scout) => {
            const [bgCls, textCls] = (COULEURS_BRANCHES[scout.brancheType] ?? 'bg-stone-100 text-stone-700').split(' ')
            const onglet = getOnglet(scout.id)
            const responsablesBranche = responsables.filter((r) => r.brancheType === scout.brancheType)

            return (
              <div key={scout.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                {/* En-tête scout */}
                <div className="p-5 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 text-xl font-bold text-stone-500">
                      {scout.photo ? (
                        <Image
                          width={56}
                          height={56}
                          unoptimized
                          src={scout.photo}
                          className="h-full w-full object-cover"
                          alt=""
                        />
                      ) : (
                        `${scout.prenom[0]}${scout.nom[0]}`
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-stone-900">
                        {scout.prenom} {scout.nom}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${bgCls} ${textCls}`}>
                          {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${scout.actif ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}
                        >
                          {scout.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Droit à l'image */}
                <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-700">Droit à l&apos;image</p>
                    <p className="text-xs text-stone-400">
                      Autorise l&apos;utilisation de la photo de {scout.prenom} dans l&apos;application et les
                      publications de la paroisse (réseaux sociaux, affichages).
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {scout.consentementImage
                        ? `Autorisé le ${scout.consentementImageDate ? new Date(scout.consentementImageDate).toLocaleDateString('fr-FR') : ''}`
                        : "Photo non autorisée pour l'instant"}
                    </p>
                  </div>
                  <button
                    onClick={() => basculerConsentementImage(scout.id, !scout.consentementImage)}
                    disabled={enCours === `consentement-${scout.id}`}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition-all disabled:opacity-60 ${
                      scout.consentementImage
                        ? 'border border-stone-300 text-stone-600 hover:bg-stone-50'
                        : 'bg-(--cp) text-white hover:brightness-110'
                    }`}
                  >
                    {enCours === `consentement-${scout.id}` ? '…' : scout.consentementImage ? 'Révoquer' : 'Autoriser'}
                  </button>
                </div>

                {/* Cotisations */}
                {scout.cotisations.length > 0 && (
                  <div className="border-t border-stone-100 px-5 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-stone-700">Cotisations</p>
                      {scout.cotisations.some((c) => c.statut === 'EN_ATTENTE') && (
                        <p className="text-xs font-semibold text-amber-700">
                          Total dû :{' '}
                          {formatMontantFCFA(
                            scout.cotisations
                              .filter((c) => c.statut === 'EN_ATTENTE')
                              .reduce((s, c) => s + c.montant, 0),
                          )}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {scout.cotisations.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3">
                          <span className="truncate text-xs text-stone-500">
                            {LABELS_TYPE_COTISATION[c.type] ?? c.type}
                            {c.libelle ? ` — ${c.libelle}` : ''} ({c.anneeScolaire}) · {formatMontantFCFA(c.montant)}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${COULEURS_STATUT_COTISATION[c.statut]}`}
                          >
                            {LABELS_STATUT_COTISATION[c.statut] ?? c.statut}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Camps à venir — autorisations à signer */}
                {(campsParEnfant[scout.id]?.length ?? 0) > 0 && (
                  <div className="space-y-3 border-t border-stone-100 bg-amber-50/40 px-5 py-4">
                    <p className="text-xs font-semibold tracking-wide text-stone-600 uppercase">
                      Camps à venir — autorisations
                    </p>
                    {campsParEnfant[scout.id].map((camp) => (
                      <div key={camp.id} className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">
                        <div>
                          <p className="text-sm font-medium text-stone-900">{camp.titre}</p>
                          <p className="text-xs text-stone-400">
                            {new Date(camp.dateDebut).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                            {camp.lieu ? ` · ${camp.lieu}` : ''}
                          </p>
                        </div>
                        {(['FICHE_MEDICALE', 'AUTORISATION_PARENTALE'] as const).map((type) => {
                          const signee = type === 'FICHE_MEDICALE' ? camp.ficheMedicale : camp.autorisationParentale
                          const cle = `${camp.id}-${scout.id}-${type}`
                          const chargementLigne = enCours === cle
                          return (
                            <div key={type} className="flex items-center justify-between gap-3">
                              <span className="text-xs text-stone-700">{LABELS_TYPE_AUTORISATION[type]}</span>
                              {signee ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                  <Check className="h-3 w-3" strokeWidth={2.5} /> Signée
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => confirmerDigitalement(camp.id, scout.id, type)}
                                    disabled={chargementLigne}
                                    className="rounded-lg bg-(--cp) px-2.5 py-1 text-xs text-white transition-all hover:brightness-110 disabled:opacity-60"
                                  >
                                    {chargementLigne ? '…' : 'Je confirme'}
                                  </button>
                                  <label className="cursor-pointer text-xs text-stone-500 underline">
                                    ou déposer un document signé
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                                      className="hidden"
                                      disabled={chargementLigne}
                                      onChange={(e) => {
                                        const f = e.target.files?.[0]
                                        if (f) deposerDocument(camp.id, scout.id, type, f)
                                        e.target.value = ''
                                      }}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {/* Onglets présences */}
                <div className="border-t border-stone-100">
                  <div className="flex gap-1 px-5 pt-3">
                    {(
                      [
                        ['reunions', `Réunions (${scout._count.presencesReunion})`],
                        ['activites', `Activités (${scout._count.presences})`],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setOnglet(scout.id, k)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${onglet === k ? 'bg-(--cp) text-white' : 'text-stone-500 hover:bg-stone-100'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="px-5 py-4">
                    {onglet === 'reunions' && (
                      <>
                        {scout.presencesReunion.length === 0 ? (
                          <p className="text-xs text-stone-400 italic">Aucune réunion enregistrée</p>
                        ) : (
                          <div className="space-y-2">
                            {scout.presencesReunion.map((pr, i) => {
                              const date = new Date(pr.jourReunion.dateReportee ?? pr.jourReunion.dateHeure)
                              const cfg = LABELS_STATUT_REUNION[pr.statut] ?? LABELS_STATUT_REUNION.ABSENT
                              return (
                                <div key={i} className="flex items-center gap-3 text-xs">
                                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                                  <span className="w-20 shrink-0 text-stone-500">
                                    {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                  </span>
                                  <span className="flex-1 truncate text-stone-700">
                                    {pr.jourReunion.titre ||
                                      `Réunion ${pr.jourReunion.brancheType ? (LABELS_BRANCHES[pr.jourReunion.brancheType] ?? pr.jourReunion.brancheType) : ''}`}
                                  </span>
                                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
                                    {cfg.label}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </>
                    )}

                    {onglet === 'activites' && (
                      <>
                        {scout.presences.length === 0 ? (
                          <p className="text-xs text-stone-400 italic">Aucune participation enregistrée</p>
                        ) : (
                          <div className="space-y-1.5">
                            {scout.presences.slice(0, 5).map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-stone-600">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                                <span className="truncate">{p.activite.titre}</span>
                                <span className="shrink-0 text-stone-400">
                                  {new Date(p.activite.dateDebut).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Responsables de la branche */}
                {responsablesBranche.length > 0 && (
                  <div className="border-t border-stone-100 bg-stone-50/50 px-5 py-4">
                    <p className="mb-3 text-xs font-semibold tracking-wide text-stone-500 uppercase">
                      Responsables {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
                    </p>
                    <div className="space-y-2">
                      {responsablesBranche.map((r) => (
                        <div key={r.id} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--cp)/10 text-xs font-bold text-(--cp)">
                            {r.utilisateur.prenom[0]}
                            {r.utilisateur.nom[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-stone-800">
                              {r.utilisateur.prenom} {r.utilisateur.nom}
                            </p>
                            <p className="text-xs text-stone-400">{LABELS_ROLE[r.role] ?? r.role}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            {r.utilisateur.telephone && (
                              <a
                                href={`tel:${r.utilisateur.telephone}`}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-(--cp)/10 transition-colors hover:bg-(--cp)/20"
                                title={r.utilisateur.telephone}
                              >
                                <svg
                                  className="h-3.5 w-3.5 text-(--cp)"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                  />
                                </svg>
                              </a>
                            )}
                            {r.utilisateur.email && (
                              <a
                                href={`mailto:${r.utilisateur.email}`}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-(--cp)/10 transition-colors hover:bg-(--cp)/20"
                                title={r.utilisateur.email}
                              >
                                <svg
                                  className="h-3.5 w-3.5 text-(--cp)"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                  />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Prochaines réunions */}
      {prochinesReunions.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold text-stone-800">Prochaines réunions</h2>
          <div className="space-y-3">
            {prochinesReunions.map((r) => {
              const date = new Date(r.dateReportee ?? r.dateHeure)
              return (
                <div key={r.id} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-(--cp)/10">
                    <span className="text-xs leading-none font-bold text-(--cp)">
                      {date.toLocaleDateString('fr-FR', { day: '2-digit' })}
                    </span>
                    <span className="text-xs leading-none text-(--cp)/70">
                      {date.toLocaleDateString('fr-FR', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {r.titre || `Réunion ${r.brancheType ? (LABELS_BRANCHES[r.brancheType] ?? r.brancheType) : ''}`}
                    </p>
                    <p className="text-xs text-stone-400">
                      {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      {r.lieu ? ` · ${r.lieu}` : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Prochaines activités */}
      {prochaines.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold text-stone-800">Prochaines activités</h2>
          <div className="space-y-3">
            {prochaines.map((a) => (
              <div key={a.id} className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-(--ca)/10">
                  <span className="text-xs leading-none font-bold text-(--ca)">
                    {new Date(a.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit' })}
                  </span>
                  <span className="text-xs leading-none text-(--ca)/70">
                    {new Date(a.dateDebut).toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">{a.titre}</p>
                  <p className="text-xs text-stone-400">
                    {LABELS_TYPE_ACTIVITE[a.type] ?? a.type}
                    {a.brancheType ? ` · ${LABELS_BRANCHES[a.brancheType] ?? a.brancheType}` : ''}
                    {a.lieu ? ` · ${a.lieu}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
