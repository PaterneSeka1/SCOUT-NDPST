'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'
import {
  LABELS_TYPE_COTISATION,
  LABELS_STATUT_COTISATION,
  COULEURS_STATUT_COTISATION,
  STATUTS_COTISATION_A_FINALISER,
  formatMontantFCFA,
} from '@/lib/cotisations'
import { LABELS_TYPE_ACTIVITE } from '@/lib/activites'
import { LABELS_ROLES } from '@/lib/roles'

const LABELS_STATUT_REUNION: Record<string, { label: string; cls: string; dot: string }> = {
  PRESENT: { label: 'Présent', cls: 'text-green-700 bg-green-50', dot: 'bg-green-500' },
  ABSENT: { label: 'Absent', cls: 'text-red-700 bg-red-50', dot: 'bg-red-400' },
  EXCUSE: { label: 'Excusé', cls: 'text-orange-700 bg-orange-50', dot: 'bg-orange-400' },
}

const LABELS_ROLE: Record<string, string> = {
  RESPONSABLE: 'Responsable', ADJOINT: 'Adjoint', ASSISTANT: 'Assistant',
}

interface PresenceReunion {
  statut: string
  jourReunion: { id: string; titre: string | null; dateHeure: string; dateReportee: string | null; brancheType: string | null }
}

interface CotisationEnfant {
  id: string; type: string; libelle: string | null; montant: number; montantPaye: number
  anneeScolaire: string; statut: string; datePaiement: string | null
  collectePar: { id: string; nom: string; prenom: string; role: string } | null
  enregistrePar: { id: string; nom: string; prenom: string; role: string } | null
}

interface Scout {
  id: string; nom: string; prenom: string; brancheType: string
  photo: string | null; actif: boolean; matricule: string | null
  consentementImage: boolean; consentementImageDate: string | null
  _count: { presences: number; presencesReunion: number }
  presences: { activite: { titre: string; dateDebut: string; type: string } }[]
  presencesReunion: PresenceReunion[]
  cotisations: CotisationEnfant[]
}

interface Activite {
  id: string; titre: string; dateDebut: string; lieu: string | null; type: string; brancheType: string | null
}

interface Reunion {
  id: string; titre: string | null; dateHeure: string; dateReportee: string | null; lieu: string | null; brancheType: string | null
}

interface Responsable {
  id: string; brancheType: string; role: string
  utilisateur: { id: string; prenom: string; nom: string; telephone: string | null; email: string | null; role: string }
}

interface CampAutorisation {
  id: string; titre: string; dateDebut: string; lieu: string | null
  ficheMedicale: boolean; autorisationParentale: boolean
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
        if (data.erreur) { setErreur(data.erreur); return }
        setEnfants(data.enfants ?? [])
        setProchaines(data.prochaines ?? [])
        setProchinesReunions(data.prochinesReunions ?? [])
        setResponsables(data.responsables ?? [])
        setCampsParEnfant(data.campsParEnfant ?? {})
      })
      .catch(() => setErreur('Impossible de charger les données'))
      .finally(() => setChargement(false))
  }

  useEffect(() => { charger() }, [])

  async function basculerConsentementImage(scoutId: string, nouvelleValeur: boolean) {
    setEnCours(`consentement-${scoutId}`)
    try {
      const res = await fetch(`/api/mes-enfants/${scoutId}/consentement-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentement: nouvelleValeur }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.erreur ?? 'Erreur serveur'); return }
      toast.success(nouvelleValeur ? 'Droit à l\'image autorisé' : 'Droit à l\'image révoqué')
      charger()
    } finally {
      setEnCours(null)
    }
  }

  async function confirmerDigitalement(activiteId: string, scoutId: string, type: 'FICHE_MEDICALE' | 'AUTORISATION_PARENTALE') {
    const cle = `${activiteId}-${scoutId}-${type}`
    setEnCours(cle)
    try {
      const res = await fetch(`/api/activites/${activiteId}/autorisations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoutId, type, mode: 'CONFIRMATION' }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.erreur ?? 'Erreur serveur'); return }
      toast.success('Autorisation confirmée')
      charger()
    } finally {
      setEnCours(null)
    }
  }

  async function deposerDocument(activiteId: string, scoutId: string, type: 'FICHE_MEDICALE' | 'AUTORISATION_PARENTALE', fichier: File) {
    const cle = `${activiteId}-${scoutId}-${type}`
    setEnCours(cle)
    try {
      const fd = new FormData()
      fd.append('fichier', fichier)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) { toast.error(uploadData.erreur ?? 'Erreur upload'); return }

      const res = await fetch(`/api/activites/${activiteId}/autorisations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoutId, type, mode: 'DOCUMENT', documentUrl: uploadData.url, documentNomFichier: fichier.name }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.erreur ?? 'Erreur serveur'); return }
      toast.success('Document envoyé')
      charger()
    } finally {
      setEnCours(null)
    }
  }

  const getOnglet = (scoutId: string) => ongletEnfant[scoutId] ?? 'reunions'
  const setOnglet = (scoutId: string, val: 'activites' | 'reunions') =>
    setOngletEnfant((p) => ({ ...p, [scoutId]: val }))

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (erreur) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreur}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mes enfants</h1>
        <p className="text-sm text-gray-500 mt-0.5">Suivez la progression de vos enfants scouts</p>
      </div>

      {enfants.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">👨‍👧‍👦</p>
          <p className="text-sm text-gray-500">Aucun enfant lié à votre compte</p>
          <p className="text-xs text-gray-400 mt-1">Contactez le Chef de Groupe de votre paroisse pour associer vos enfants.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {enfants.map((scout) => {
            const [bgCls, textCls] = (COULEURS_BRANCHES[scout.brancheType] ?? 'bg-gray-100 text-gray-700').split(' ')
            const onglet = getOnglet(scout.id)
            const responsablesBranche = responsables.filter((r) => r.brancheType === scout.brancheType)

            return (
              <div key={scout.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* En-tête scout */}
                <div className="p-5 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-500 flex-shrink-0 overflow-hidden">
                      {scout.photo ? <img src={scout.photo} className="w-full h-full object-cover" alt="" /> : `${scout.prenom[0]}${scout.nom[0]}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{scout.prenom} {scout.nom}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${bgCls} ${textCls}`}>
                          {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${scout.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {scout.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Droit à l'image */}
                <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700">Droit à l&apos;image</p>
                    <p className="text-xs text-gray-400">
                      Autorise l&apos;utilisation de la photo de {scout.prenom} dans l&apos;application et les publications de la paroisse (réseaux sociaux, affichages).
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {scout.consentementImage
                        ? `Autorisé le ${scout.consentementImageDate ? new Date(scout.consentementImageDate).toLocaleDateString('fr-FR') : ''}`
                        : "Photo non autorisée pour l'instant"}
                    </p>
                  </div>
                  <button
                    onClick={() => basculerConsentementImage(scout.id, !scout.consentementImage)}
                    disabled={enCours === `consentement-${scout.id}`}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                      scout.consentementImage
                        ? 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                        : 'bg-[#1a4731] text-white hover:bg-[#163d29]'
                    }`}
                  >
                    {enCours === `consentement-${scout.id}` ? '…' : scout.consentementImage ? 'Révoquer' : 'Autoriser'}
                  </button>
                </div>

                {/* Cotisations */}
                {scout.cotisations.length > 0 && (
                  <div className="border-t border-gray-100 px-5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-700">Cotisations</p>
                      {scout.cotisations.some((c) => STATUTS_COTISATION_A_FINALISER.includes(c.statut) && c.montantPaye < c.montant) && (
                        <p className="text-xs font-semibold text-amber-700">
                          Total dû : {formatMontantFCFA(
                            scout.cotisations
                              .filter((c) => STATUTS_COTISATION_A_FINALISER.includes(c.statut))
                              .reduce((s, c) => s + Math.max(0, c.montant - c.montantPaye), 0),
                          )}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {scout.cotisations.map((c) => {
                        const reste = Math.max(0, c.montant - c.montantPaye)
                        return (
                          <div key={c.id} className="rounded-lg border border-gray-100 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs text-gray-600 truncate">
                                {LABELS_TYPE_COTISATION[c.type] ?? c.type}{c.libelle ? ` — ${c.libelle}` : ''} ({c.anneeScolaire})
                              </span>
                              <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${COULEURS_STATUT_COTISATION[c.statut]}`}>
                                {LABELS_STATUT_COTISATION[c.statut] ?? c.statut}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              Dû : {formatMontantFCFA(c.montant)}
                              {c.montantPaye > 0 ? ` · reçu ${formatMontantFCFA(c.montantPaye)}` : ''}
                              {reste > 0 && STATUTS_COTISATION_A_FINALISER.includes(c.statut) ? ` · reste ${formatMontantFCFA(reste)}` : ''}
                            </p>
                            {c.collectePar && (
                              <p className="mt-1 text-xs text-gray-500">
                                Reçu par {c.collectePar.prenom} {c.collectePar.nom}
                                {LABELS_ROLES[c.collectePar.role] ? ` (${LABELS_ROLES[c.collectePar.role]})` : ''}
                              </p>
                            )}
                            {!c.collectePar && c.enregistrePar && c.statut !== 'EN_ATTENTE' && (
                              <p className="mt-1 text-xs text-gray-500">
                                Mis à jour par {c.enregistrePar.prenom} {c.enregistrePar.nom}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Camps à venir — autorisations à signer */}
                {(campsParEnfant[scout.id]?.length ?? 0) > 0 && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-amber-50/40 space-y-3">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Camps à venir — autorisations</p>
                    {campsParEnfant[scout.id].map((camp) => (
                      <div key={camp.id} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{camp.titre}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(camp.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            {camp.lieu ? ` · ${camp.lieu}` : ''}
                          </p>
                        </div>
                        {(['FICHE_MEDICALE', 'AUTORISATION_PARENTALE'] as const).map((type) => {
                          const signee = type === 'FICHE_MEDICALE' ? camp.ficheMedicale : camp.autorisationParentale
                          const cle = `${camp.id}-${scout.id}-${type}`
                          const chargementLigne = enCours === cle
                          return (
                            <div key={type} className="flex items-center justify-between gap-3">
                              <span className="text-xs text-gray-700">{LABELS_TYPE_AUTORISATION[type]}</span>
                              {signee ? (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700 border border-green-100">
                                  ✓ Signée
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => confirmerDigitalement(camp.id, scout.id, type)}
                                    disabled={chargementLigne}
                                    className="text-xs bg-[#1a4731] text-white px-2.5 py-1 rounded-lg hover:bg-[#163d29] transition-colors disabled:opacity-60"
                                  >
                                    {chargementLigne ? '…' : 'Je confirme'}
                                  </button>
                                  <label className="text-xs text-gray-500 underline cursor-pointer">
                                    ou déposer un document signé
                                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="hidden"
                                      disabled={chargementLigne}
                                      onChange={(e) => { const f = e.target.files?.[0]; if (f) deposerDocument(camp.id, scout.id, type, f); e.target.value = '' }} />
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
                <div className="border-t border-gray-100">
                  <div className="flex px-5 gap-1 pt-3">
                    {([['reunions', `Réunions (${scout._count.presencesReunion})`], ['activites', `Activités (${scout._count.presences})`]] as const).map(([k, label]) => (
                      <button key={k} onClick={() => setOnglet(scout.id, k)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${onglet === k ? 'bg-[#1a4731] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="px-5 py-4">
                    {onglet === 'reunions' && (
                      <>
                        {scout.presencesReunion.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Aucune réunion enregistrée</p>
                        ) : (
                          <div className="space-y-2">
                            {scout.presencesReunion.map((pr, i) => {
                              const date = new Date(pr.jourReunion.dateReportee ?? pr.jourReunion.dateHeure)
                              const cfg = LABELS_STATUT_REUNION[pr.statut] ?? LABELS_STATUT_REUNION.ABSENT
                              return (
                                <div key={i} className="flex items-center gap-3 text-xs">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                  <span className="text-gray-500 flex-shrink-0 w-20">
                                    {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                  </span>
                                  <span className="flex-1 text-gray-700 truncate">
                                    {pr.jourReunion.titre || `Réunion ${pr.jourReunion.brancheType ? (LABELS_BRANCHES[pr.jourReunion.brancheType] ?? pr.jourReunion.brancheType) : ''}`}
                                  </span>
                                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
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
                          <p className="text-xs text-gray-400 italic">Aucune participation enregistrée</p>
                        ) : (
                          <div className="space-y-1.5">
                            {scout.presences.slice(0, 5).map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                                <span className="truncate">{p.activite.titre}</span>
                                <span className="flex-shrink-0 text-gray-400">
                                  {new Date(p.activite.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
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
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                    <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                      Responsables {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
                    </p>
                    <div className="space-y-2">
                      {responsablesBranche.map((r) => (
                        <div key={r.id} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1a4731]/10 flex items-center justify-center text-xs font-bold text-[#1a4731] flex-shrink-0">
                            {r.utilisateur.prenom[0]}{r.utilisateur.nom[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">
                              {r.utilisateur.prenom} {r.utilisateur.nom}
                            </p>
                            <p className="text-xs text-gray-400">{LABELS_ROLE[r.role] ?? r.role}</p>
                          </div>
                          <div className="flex-shrink-0 flex gap-2">
                            {r.utilisateur.telephone && (
                              <a href={`tel:${r.utilisateur.telephone}`}
                                className="w-7 h-7 rounded-lg bg-[#1a4731]/10 flex items-center justify-center hover:bg-[#1a4731]/20 transition-colors"
                                title={r.utilisateur.telephone}>
                                <svg className="w-3.5 h-3.5 text-[#1a4731]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              </a>
                            )}
                            {r.utilisateur.email && (
                              <a href={`mailto:${r.utilisateur.email}`}
                                className="w-7 h-7 rounded-lg bg-[#1a4731]/10 flex items-center justify-center hover:bg-[#1a4731]/20 transition-colors"
                                title={r.utilisateur.email}>
                                <svg className="w-3.5 h-3.5 text-[#1a4731]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Prochaines réunions</h2>
          <div className="space-y-3">
            {prochinesReunions.map((r) => {
              const date = new Date(r.dateReportee ?? r.dateHeure)
              return (
                <div key={r.id} className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#1a4731]/10 flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-[#1a4731] leading-none">
                      {date.toLocaleDateString('fr-FR', { day: '2-digit' })}
                    </span>
                    <span className="text-xs text-[#1a4731]/70 leading-none">
                      {date.toLocaleDateString('fr-FR', { month: 'short' })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {r.titre || `Réunion ${r.brancheType ? (LABELS_BRANCHES[r.brancheType] ?? r.brancheType) : ''}`}
                    </p>
                    <p className="text-xs text-gray-400">
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
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Prochaines activités</h2>
          <div className="space-y-3">
            {prochaines.map((a) => (
              <div key={a.id} className="flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#f39c12]/10 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-[#f39c12] leading-none">
                    {new Date(a.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit' })}
                  </span>
                  <span className="text-xs text-[#f39c12]/70 leading-none">
                    {new Date(a.dateDebut).toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.titre}</p>
                  <p className="text-xs text-gray-400">
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
