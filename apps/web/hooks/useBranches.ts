'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Synthèse des branches (GET /api/branches) et branche de l'utilisateur
// connecté (GET /api/me/branche).

export interface PosteBranche {
  id: string
  brancheType: string | null
  /** RESPONSABLE, ADJOINT ou ASSISTANT (rôle sans le suffixe _BRANCHE). */
  role: string
  fonction: string | null
  utilisateur: { id: string; nom: string; prenom: string; email: string | null; telephone: string | null }
}

export interface SyntheseBranches {
  postes: PosteBranche[]
  comptesParBranche: Record<string, number>
}

export const LIBELLES_POSTE: Record<string, string> = {
  RESPONSABLE: 'Responsable',
  ADJOINT: 'Adjoint',
  ASSISTANT: 'Assistant',
}

export function useBranches(actif = true) {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => api<SyntheseBranches>('/api/branches'),
    enabled: actif,
  })
}

export function useMaBranche(actif = true) {
  return useQuery({
    queryKey: ['branches', 'moi'],
    queryFn: () => api<{ brancheType: string | null; role: string | null }>('/api/me/branche'),
    enabled: actif,
  })
}
