'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { LABELS_BRANCHES } from '@/lib/branches'
import { useProgressionsScout, useValiderBadge } from '@/hooks/useProgressions'
import { BackLink } from '@/app/components/ui/BackLink'

export default function ProgressionScoutBranchePage() {
  const { scoutId } = useParams<{ scoutId: string }>()
  const { data: progressions, isLoading, isError, error } = useProgressionsScout(scoutId)
  const { mutateAsync: validerBadge, isPending: validationEnCours } = useValiderBadge(scoutId)
  const [badgeEnCours, setBadgeEnCours] = useState<string | null>(null)

  const handleValiderBadge = async (badgeId: string) => {
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
      <BackLink href="/district/ma-branche">Retour à ma branche</BackLink>

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
                        className="text-sm bg-[var(--cp)] text-white px-3 py-1.5 rounded-lg hover:brightness-110 transition-colors disabled:opacity-60 flex-shrink-0 ml-2"
                      >
                        {validationEnCours && badgeEnCours === badge.id ? '…' : 'Valider'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
