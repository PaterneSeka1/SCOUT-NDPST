'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Progression pédagogique : référentiel par branche (étapes saisies par le
// groupe à partir des documents officiels), synthèse par branche, et
// validation des étapes d'un scout par l'encadrement de sa branche.

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
  scout: { id: string; nom: string; prenom: string; brancheType: string }
  badges: BadgeProgression[]
}

export interface DonneesValiderBadge {
  badgeId: string
  commentaire?: string
}

/** Étape du référentiel (modèle Badge). */
export interface EtapeReferentiel {
  id: string
  brancheType: string
  nom: string
  description: string | null
  ordre: number
  _count?: { progressions: number }
}

export interface SyntheseBranche {
  brancheType: string
  scouts: number
  etapes: number
  validations: number
  validations90j: number
}

export interface DonneesEtape {
  brancheType: string
  nom: string
  description?: string | null
  ordre?: number
}

// ---- Clés de cache --------------------------------------------------------

export const QUERY_KEYS = {
  progressions: (scoutId: string) => ['progression', 'scout', scoutId] as const,
  referentiel: ['progression', 'referentiel'] as const,
  synthese: ['progression', 'synthese'] as const,
}

// ---- Progression d'un scout -----------------------------------------------

/** Étapes de la branche du scout fusionnées avec ses validations (encadrement de branche). */
export function useProgressionsScout(scoutId: string, actif = true) {
  return useQuery({
    queryKey: QUERY_KEYS.progressions(scoutId),
    queryFn: () => api<ProgressionsScoutResponse>(`/api/scouts/${encodeURIComponent(scoutId)}/progressions`),
    enabled: Boolean(scoutId) && actif,
    retry: false,
  })
}

export function useValiderBadge(scoutId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (donnees: DonneesValiderBadge) =>
      api(`/api/scouts/${encodeURIComponent(scoutId)}/progressions`, { method: 'POST', json: donnees }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progression'] })
    },
  })
}

// ---- Référentiel et synthèse ----------------------------------------------

export function useReferentiel() {
  return useQuery({
    queryKey: QUERY_KEYS.referentiel,
    queryFn: () => api<EtapeReferentiel[]>('/api/progression/referentiel'),
  })
}

export function useSyntheseProgression() {
  return useQuery({
    queryKey: QUERY_KEYS.synthese,
    queryFn: () => api<SyntheseBranche[]>('/api/progression/synthese'),
  })
}

function useInvalidationProgression() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['progression'] })
}

export function useCreerEtape() {
  const invalider = useInvalidationProgression()
  return useMutation({
    mutationFn: (donnees: DonneesEtape) =>
      api<EtapeReferentiel>('/api/progression/referentiel', { method: 'POST', json: donnees }),
    onSuccess: invalider,
  })
}

export function useModifierEtape() {
  const invalider = useInvalidationProgression()
  return useMutation({
    mutationFn: ({ id, ...donnees }: { id: string; nom?: string; description?: string | null; ordre?: number }) =>
      api<EtapeReferentiel>(`/api/progression/referentiel/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        json: donnees,
      }),
    onSuccess: invalider,
  })
}

export function useSupprimerEtape() {
  const invalider = useInvalidationProgression()
  return useMutation({
    mutationFn: (id: string) => api(`/api/progression/referentiel/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: invalider,
  })
}
