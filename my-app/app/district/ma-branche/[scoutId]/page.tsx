'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'
import { LABELS_BRANCHES } from '@/lib/branches'
import { useProgressionsScout, useValiderBadge } from '@/hooks/useProgressions'
import {
  useParcoursCompagnon,
  useValiderProgressionCompagnon,
  useRejeterProgressionCompagnon,
} from '@/hooks/useParcoursCompagnon'
import {
  LABELS_ETAPE_COMPAGNON,
  LABELS_TRANCHE_AGE_COMPAGNON,
  LABELS_STATUT_PROGRESSION_COMPAGNON,
  COULEURS_STATUT_PROGRESSION_COMPAGNON,
} from '@/lib/parcoursCompagnon'

export default function ProgressionScoutBranchePage() {
  const { scoutId } = useParams<{ scoutId: string }>()
  const { data: session } = useSession()
  const { data: progressions, isLoading, isError, error } = useProgressionsScout(scoutId)
  const { mutateAsync: validerBadge, isPending: validationEnCours } = useValiderBadge(scoutId)
  const [badgeEnCours, setBadgeEnCours] = useState<string | null>(null)

  const { data: parcoursCompagnon } = useParcoursCompagnon(scoutId)
  const { mutateAsync: validerProgression } = useValiderProgressionCompagnon(scoutId)
  const { mutateAsync: rejeterProgression, isPending: rejetEnCours } = useRejeterProgressionCompagnon(scoutId)
  // Contrôle serveur faisant foi (lib/parcoursCompagnonPermissions.ts) — cette
  // page n'est de toute façon accessible qu'à l'équipe de district ; toute
  // affectation district (roleDistrict) suffit ici à afficher les actions.
  const peutValiderOuRejeterProgression = Boolean(session?.user?.roleDistrict)
  const [progressionEnRejet, setProgressionEnRejet] = useState<string | null>(null)
  const [motifRejetSaisi, setMotifRejetSaisi] = useState('')
  const [progressionEnValidation, setProgressionEnValidation] = useState<string | null>(null)

  const handleValiderProgression = async (progressionId: string, nomActivite: string) => {
    const ok = await confirmer({
      titre: 'Valider cette activité ?',
      description: `L'activité "${nomActivite}" sera marquée comme validée.`,
      labelConfirmer: 'Valider',
    })
    if (!ok) return
    setProgressionEnValidation(progressionId)
    try {
      await validerProgression(progressionId)
      toast.success('Activité validée.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setProgressionEnValidation(null)
    }
  }

  const handleRejeterProgression = async (e: React.FormEvent, progressionId: string) => {
    e.preventDefault()
    try {
      await rejeterProgression({ progressionId, motifRejet: motifRejetSaisi })
      toast.success('Activité rejetée.')
      setProgressionEnRejet(null)
      setMotifRejetSaisi('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleValiderBadge = async (badgeId: string) => {
    const ok = await confirmer({
      titre: 'Valider ce badge ?',
      description: 'Cette validation sera enregistrée avec la date du jour et votre nom, comme indiqué dans l\'historique de progression du scout.',
      labelConfirmer: 'Valider',
    })
    if (!ok) return
    setBadgeEnCours(badgeId)
    try {
      await validerBadge({ badgeId })
      toast.success('Badge validé')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBadgeEnCours(null)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Link href="/district/ma-branche" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour à ma branche
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--cp)' }} />
        </div>
      ) : isError || !progressions ? (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-10 text-center">
          <p className="text-sm font-medium text-red-600">{error instanceof Error ? error.message : 'Scout introuvable'}</p>
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {progressions.scout.prenom} {progressions.scout.nom}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Branche {LABELS_BRANCHES[progressions.scout.brancheType] ?? progressions.scout.brancheType}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Progression / Badges</h2>
            <p className="text-sm text-gray-500 mb-4">Parcours de badges de la branche.</p>

            {progressions.badges.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun badge défini pour cette branche.</p>
            ) : (
              <ul className="space-y-2">
                {progressions.badges.map((badge) => (
                  <li key={badge.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                    <div className="flex items-start gap-2 min-w-0">
                      {badge.valide && <span className="mt-1.5 w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
                      <div className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900 truncate">{badge.nom}</span>
                        {badge.description && <span className="block text-xs text-gray-500 truncate">{badge.description}</span>}
                        {badge.valide && (
                          <span className="block text-xs text-gray-400 mt-0.5">
                            {badge.dateValidation && new Date(badge.dateValidation).toLocaleDateString('fr-FR')}
                            {badge.valideParNomComplet ? ` — validé par ${badge.valideParNomComplet}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    {!badge.valide && (
                      <button
                        onClick={() => handleValiderBadge(badge.id)}
                        disabled={validationEnCours && badgeEnCours === badge.id}
                        className="text-sm bg-[#1a4731] text-white px-3 py-1.5 rounded-lg hover:bg-[#163d29] transition-colors disabled:opacity-60 flex-shrink-0 ml-2"
                      >
                        {validationEnCours && badgeEnCours === badge.id ? '…' : 'Valider'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Progression individuelle — parcours Route (branche Compagnons uniquement) */}
          {parcoursCompagnon?.brancheCompatible && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Progression individuelle — Parcours Route</h2>
              <p className="text-sm text-gray-500 mb-4">Suivi individuel des étapes du parcours Compagnons.</p>

              {!parcoursCompagnon.parcours ? (
                <p className="text-sm text-gray-500">Aucun parcours créé pour l&apos;instant par la paroisse.</p>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-700">
                      {LABELS_TRANCHE_AGE_COMPAGNON[parcoursCompagnon.parcours.trancheAge] ?? parcoursCompagnon.parcours.trancheAge}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      parcoursCompagnon.parcours.statut === 'TERMINE' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {parcoursCompagnon.parcours.statut === 'TERMINE' ? 'Parcours terminé' : 'Parcours actif'}
                    </span>
                  </div>

                  {parcoursCompagnon.avancement && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>
                          {parcoursCompagnon.avancement.activitesValidees} / {parcoursCompagnon.avancement.totalActivitesObligatoires} activités validées
                        </span>
                        <span className="font-semibold text-gray-900">{parcoursCompagnon.avancement.pourcentageAvancement}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1a4731] transition-all"
                          style={{ width: `${parcoursCompagnon.avancement.pourcentageAvancement}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <ul className="space-y-2">
                    {parcoursCompagnon.progressions.map((p) => (
                      <li key={p.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-400">{p.etapeActivite.ordre}.</span>
                              <span className="text-sm font-medium text-gray-900">{p.etapeActivite.nom}</span>
                              <span className="text-xs text-gray-400">
                                {LABELS_ETAPE_COMPAGNON[p.etapeActivite.etape] ?? p.etapeActivite.etape}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(p.dateDebutTheorique).toLocaleDateString('fr-FR')} → {new Date(p.dateLimiteTheorique).toLocaleDateString('fr-FR')}
                            </p>
                            {p.dateRealisationDeclaree && (
                              <p className="text-xs text-gray-500">
                                Réalisée le {new Date(p.dateRealisationDeclaree).toLocaleDateString('fr-FR')}
                              </p>
                            )}
                            {p.commentaireDeclaration && (
                              <p className="text-xs text-gray-500 italic mt-0.5">« {p.commentaireDeclaration} »</p>
                            )}
                          </div>
                          <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${COULEURS_STATUT_PROGRESSION_COMPAGNON[p.statut] ?? 'bg-gray-100 text-gray-600'}`}>
                            {LABELS_STATUT_PROGRESSION_COMPAGNON[p.statut] ?? p.statut}
                          </span>
                        </div>

                        {peutValiderOuRejeterProgression && p.statut === 'SOUMISE' && (
                          progressionEnRejet === p.id ? (
                            <form onSubmit={(e) => handleRejeterProgression(e, p.id)} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Motif du rejet <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text" value={motifRejetSaisi} onChange={e => setMotifRejetSaisi(e.target.value)} required
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button type="submit" disabled={rejetEnCours} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-700 transition-colors disabled:opacity-60">
                                  {rejetEnCours ? '…' : 'Confirmer le rejet'}
                                </button>
                                <button type="button" onClick={() => setProgressionEnRejet(null)} className="text-sm text-gray-500 px-2 hover:text-gray-700">
                                  Annuler
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className="mt-2 flex gap-3">
                              <button
                                onClick={() => handleValiderProgression(p.id, p.etapeActivite.nom)}
                                disabled={progressionEnValidation === p.id}
                                className="text-sm bg-[#1a4731] text-white px-3 py-1.5 rounded-lg hover:bg-[#163d29] transition-colors disabled:opacity-60"
                              >
                                {progressionEnValidation === p.id ? '…' : 'Valider'}
                              </button>
                              <button onClick={() => setProgressionEnRejet(p.id)} className="text-sm text-red-600 font-medium hover:underline">
                                Rejeter
                              </button>
                            </div>
                          )
                        )}
                      </li>
                    ))}
                  </ul>

                  {parcoursCompagnon.attributsObtenus.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Attributs obtenus</h3>
                      <div className="flex flex-wrap gap-2">
                        {parcoursCompagnon.attributsObtenus.map((a) => (
                          <span key={a.id} className="text-xs bg-[#1a4731]/10 text-[#1a4731] px-2 py-1 rounded-full font-medium">
                            {a.nom}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
