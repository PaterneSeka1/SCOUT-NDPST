'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ---- Types ----------------------------------------------------------------

export interface BadgeProgression {
  id: string
  nom: string
  description: string | null
  ordre: number
  icone: string | null
  valide: boolean
  dateValidation: string | null
  valideParNomComplet: string | null
  progressionId: string | null
}

export interface ProgressionsScoutResponse {
  scout: {
    id: string
    nom: string
    prenom: string
    brancheType: string
  }
  badges: BadgeProgression[]
}

export interface DonneesValiderBadge {
  badgeId: string
  commentaire?: string
}

// ---- Clés de cache --------------------------------------------------------

export const QUERY_KEYS = {
  progressions: (scoutId: string) => ['progressions', scoutId] as const,
}

// ---- Fonctions fetch -------------------------------------------------------

async function fetchProgressionsScout(scoutId: string): Promise<ProgressionsScoutResponse> {
  const res = await fetch(`/api/scouts/${scoutId}/progressions`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.erreur ?? 'Erreur lors du chargement de la progression')
  }
  return res.json()
}

// ---- Hooks ----------------------------------------------------------------

/**
 * Badges de la branche du scout, fusionnés avec sa progression validée.
 */
export function useProgressionsScout(scoutId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.progressions(scoutId),
    queryFn: () => fetchProgressionsScout(scoutId),
    enabled: Boolean(scoutId),
  })
}

/**
 * Validation d'un badge pour un scout.
 */
export function useValiderBadge(scoutId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (donnees: DonneesValiderBadge) => {
      const res = await fetch(`/api/scouts/${scoutId}/progressions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur ?? 'Erreur lors de la validation du badge')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.progressions(scoutId) })
    },
  })
}
