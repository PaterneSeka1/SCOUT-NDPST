'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, requete } from '@/lib/api'

// Programmes d'activités et leurs lignes (thèmes) — contrats de
// apps/api/src/modules/programmes.

export interface ProgrammeResume {
  id: string
  titre: string
  description: string | null
  periodeDebut: string
  periodeFin: string
  brancheType: string | null
  _count: { lignes: number }
  creeParUtilisateur: { prenom: string; nom: string } | null
}

export interface LigneProgramme {
  id: string
  theme: string
  objectif: string | null
  datePrevue: string | null
  ordre: number
  activite: { id: string; titre: string; dateDebut: string } | null
}

export interface Programme extends Omit<ProgrammeResume, '_count'> {
  lignes: LigneProgramme[]
}

export interface DonneesProgramme {
  titre: string
  description: string | null
  periodeDebut: string
  periodeFin: string
  brancheType?: string | null
}

export interface DonneesLigne {
  theme?: string
  objectif?: string | null
  datePrevue?: string | null
  ordre?: number
  activiteId?: string | null
}

function useInvalider() {
  const client = useQueryClient()
  return () => {
    client.invalidateQueries({ queryKey: ['programmes'] })
    client.invalidateQueries({ queryKey: ['tableau-de-bord'] })
  }
}

export function useProgrammes(branche?: string) {
  return useQuery({
    queryKey: ['programmes', 'liste', branche ?? ''],
    queryFn: () => api<ProgrammeResume[]>(`/api/programmes${requete({ branche })}`),
  })
}

export function useProgramme(id: string) {
  return useQuery({
    queryKey: ['programmes', id],
    queryFn: () => api<Programme>(`/api/programmes/${id}`),
    enabled: Boolean(id),
  })
}

/** Branche de l'utilisateur connecté (encadrement de branche). */
export function useMaBranche(actif: boolean) {
  return useQuery({
    queryKey: ['me', 'branche'],
    queryFn: () => api<{ brancheType: string | null; role: string | null }>('/api/me/branche'),
    enabled: actif,
  })
}

export function useCreerProgramme() {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: (donnees: DonneesProgramme) => api<ProgrammeResume>('/api/programmes', { method: 'POST', json: donnees }),
    onSuccess: invalider,
  })
}

export function useModifierProgramme(id: string) {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: (donnees: Omit<DonneesProgramme, 'brancheType'>) =>
      api(`/api/programmes/${id}`, { method: 'PATCH', json: donnees }),
    onSuccess: invalider,
  })
}

export function useSupprimerProgramme() {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: (id: string) => api(`/api/programmes/${id}`, { method: 'DELETE' }),
    onSuccess: invalider,
  })
}

export function useAjouterLigne(programmeId: string) {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: (donnees: DonneesLigne) => api(`/api/programmes/${programmeId}/lignes`, { method: 'POST', json: donnees }),
    onSuccess: invalider,
  })
}

export function useModifierLigne(programmeId: string) {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: ({ ligneId, ...donnees }: DonneesLigne & { ligneId: string }) =>
      api(`/api/programmes/${programmeId}/lignes/${ligneId}`, { method: 'PATCH', json: donnees }),
    onSuccess: invalider,
  })
}

export function useSupprimerLigne(programmeId: string) {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: (ligneId: string) => api(`/api/programmes/${programmeId}/lignes/${ligneId}`, { method: 'DELETE' }),
    onSuccess: invalider,
  })
}
