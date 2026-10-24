'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ROLES_GROUPE } from '@scout/shared'
import { api, requete } from '@/lib/api'

// Équipes (sous-groupes d'une branche) : GET/POST/PATCH /api/equipes.

export interface Equipe {
  id: string
  nom: string
  brancheType: string
  description: string | null
  actif: boolean
  createdAt: string
  updatedAt: string
  _count: { scouts: number }
}

export interface FiltresEquipes {
  brancheType?: string
  actif?: boolean
}

/** Rôles de branche autorisés à gérer les équipes de leur branche (miroir de l'API). */
export const ROLES_BRANCHE_GESTION_EQUIPES = ['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE']

/** Indication d'interface : l'API vérifie en plus la branche de l'équipe. */
export function peutGererEquipes(role: string | undefined): boolean {
  return !!role && (ROLES_GROUPE.includes(role) || ROLES_BRANCHE_GESTION_EQUIPES.includes(role))
}

export function useEquipes(filtres: FiltresEquipes = {}, actif = true) {
  return useQuery({
    queryKey: ['equipes', filtres],
    queryFn: () =>
      api<{ equipes: Equipe[] }>(`/api/equipes${requete({ brancheType: filtres.brancheType, actif: filtres.actif })}`).then(
        (r) => r.equipes,
      ),
    enabled: actif,
  })
}

function useInvalidationEquipes() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['equipes'] })
    queryClient.invalidateQueries({ queryKey: ['scouts'] })
  }
}

export function useCreerEquipe() {
  const invalider = useInvalidationEquipes()
  return useMutation({
    mutationFn: (donnees: { nom: string; brancheType: string; description?: string | null }) =>
      api<Equipe>('/api/equipes', { method: 'POST', json: donnees }),
    onSuccess: invalider,
  })
}

export function useModifierEquipe() {
  const invalider = useInvalidationEquipes()
  return useMutation({
    mutationFn: ({ id, ...donnees }: { id: string; nom?: string; description?: string | null; actif?: boolean }) =>
      api<Equipe>(`/api/equipes/${encodeURIComponent(id)}`, { method: 'PATCH', json: donnees }),
    onSuccess: invalider,
  })
}
