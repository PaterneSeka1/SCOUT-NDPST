'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, requete, type Pagination } from '@/lib/api'

// ---- Types (forme renvoyée par apps/api/src/modules/reunions) --------------

export type StatutReunion = 'PLANIFIEE' | 'REPORTEE' | 'ANNULEE' | 'TERMINEE'
export type StatutPresenceReunion = 'PRESENT' | 'ABSENT' | 'EXCUSE'

export const LABELS_STATUT_REUNION: Record<StatutReunion, string> = {
  PLANIFIEE: 'Planifiée',
  REPORTEE: 'Reportée',
  ANNULEE: 'Annulée',
  TERMINEE: 'Terminée',
}

export const TONS_STATUT_REUNION = {
  PLANIFIEE: 'info',
  REPORTEE: 'attention',
  ANNULEE: 'danger',
  TERMINEE: 'neutre',
} as const

export const JOURS_SEMAINE = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export interface Reunion {
  id: string
  brancheType: string | null
  titre: string | null
  dateHeure: string
  dureeMinutes: number | null
  lieu: string | null
  statut: StatutReunion
  dateReportee: string | null
  notes: string | null
  creePar: string
  _count: { presences: number }
  creeParUtilisateur: { prenom: string; nom: string }
}

export interface ConfigReunion {
  id: string
  brancheType: string
  jourSemaine: number
  heureDebut: string
  dureeMinutes: number
  lieu: string | null
}

export interface ScoutFeuille {
  id: string
  prenom: string
  nom: string
  photo: string | null
  brancheType: string
}

export interface FeuillePresencesReunion {
  reunion: Reunion
  scouts: ScoutFeuille[]
  presencesMap: Record<string, { statut: StatutPresenceReunion; note: string | null }>
}

export interface FiltresReunions {
  page?: number
  limite?: number
  branche?: string
  statut?: string
  recherche?: string
}

export interface DonneesCreerReunions {
  dates: string[]
  brancheType: string | null
  titre: string | null
  lieu: string | null
  notes: string | null
  dureeMinutes: number | null
}

export interface DonneesModifierReunion {
  statut?: StatutReunion
  dateReportee?: string | null
  dateHeure?: string
  brancheType?: string | null
  titre?: string | null
  lieu?: string | null
  notes?: string | null
  dureeMinutes?: number | null
}

/** Date effective d'une réunion (date de report si reportée). */
export function dateEffectiveReunion(r: Pick<Reunion, 'dateHeure' | 'dateReportee'>): Date {
  return new Date(r.dateReportee ?? r.dateHeure)
}

function invaliderReunions(client: QueryClient) {
  client.invalidateQueries({ queryKey: ['reunions'] })
  client.invalidateQueries({ queryKey: ['calendrier'] })
  client.invalidateQueries({ queryKey: ['tableau-de-bord'] })
}

// ---- Lectures --------------------------------------------------------------

/** Liste paginée côté serveur (page/limite fournis : réponse { reunions, pagination }). */
export function useReunions(filtres: FiltresReunions = {}) {
  return useQuery({
    queryKey: ['reunions', 'liste', filtres],
    queryFn: () =>
      api<{ reunions: Reunion[]; pagination: Pagination }>(
        `/api/reunions${requete({
          page: filtres.page ?? 1,
          limite: filtres.limite ?? 20,
          branche: filtres.branche,
          statut: filtres.statut,
          recherche: filtres.recherche,
        })}`,
      ),
    placeholderData: keepPreviousData,
  })
}

export function useConfigsReunion() {
  return useQuery({
    queryKey: ['reunions', 'config'],
    queryFn: () => api<ConfigReunion[]>('/api/reunions/config'),
    staleTime: 5 * 60_000,
  })
}

export function useFeuillePresencesReunion(id: string) {
  return useQuery({
    queryKey: ['reunions', 'presences', id],
    queryFn: () => api<FeuillePresencesReunion>(`/api/reunions/${id}/presences`),
    enabled: Boolean(id),
  })
}

// ---- Mutations -------------------------------------------------------------

export function useCreerReunions() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (donnees: DonneesCreerReunions) => api<Reunion[]>('/api/reunions', { method: 'POST', json: donnees }),
    onSuccess: () => invaliderReunions(client),
  })
}

export function useModifierReunion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, donnees }: { id: string; donnees: DonneesModifierReunion }) =>
      api<Reunion>(`/api/reunions/${id}`, { method: 'PATCH', json: donnees }),
    onSuccess: () => invaliderReunions(client),
  })
}

export function useSupprimerReunion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/reunions/${id}`, { method: 'DELETE' }),
    onSuccess: () => invaliderReunions(client),
  })
}

export function useEnregistrerConfigReunion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (donnees: Omit<ConfigReunion, 'id'>) =>
      api<ConfigReunion>('/api/reunions/config', { method: 'PUT', json: donnees }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['reunions', 'config'] }),
  })
}

export function useEnregistrerPresencesReunion(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (presences: { scoutId: string; statut: StatutPresenceReunion; note?: string | null }[]) =>
      api<{ ok: true; count: number }>(`/api/reunions/${id}/presences`, { method: 'POST', json: { presences } }),
    onSuccess: () => {
      invaliderReunions(client)
      client.invalidateQueries({ queryKey: ['presences'] })
    },
  })
}
