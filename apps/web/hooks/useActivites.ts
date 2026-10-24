'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, requete, type Pagination } from '@/lib/api'

// ---- Types (forme renvoyée par apps/api/src/modules/activites) -------------

export type StatutActivite = 'PREVUE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE'

/** Ton du badge de statut (le libellé vient de LABELS_STATUT_ACTIVITE). */
export const TONS_STATUT_ACTIVITE = {
  PREVUE: 'info',
  EN_COURS: 'attention',
  TERMINEE: 'succes',
  ANNULEE: 'neutre',
} as const

export interface ResponsableActivite {
  id: string
  nom: string
  prenom: string
  role: string
  brancheType: string | null
}

export interface Activite {
  id: string
  titre: string
  description: string | null
  dateDebut: string
  dateFin: string | null
  lieu: string | null
  type: string
  brancheType: string | null
  statut: StatutActivite
  bilan: string | null
  publique: boolean
  descriptionPublique: string | null
  responsableId: string | null
  responsable: ResponsableActivite | null
  creePar: string
  _count: { presences: number }
  createdAt: string
  updatedAt: string
}

export interface ListeActivites {
  activites: Activite[]
  pagination: Pagination
}

export interface FiltresActivites {
  page?: number
  limite?: number
  recherche?: string
  type?: string
  statut?: string
  brancheType?: string
  aVenir?: boolean
}

export interface PresenceActivite {
  id: string | null
  present: boolean
  commentaire: string | null
  scout: {
    id: string
    nom: string
    prenom: string
    matricule: string | null
    brancheType: string | null
    autorisationCamp?: { ficheMedicale: boolean; autorisationParentale: boolean }
  }
}

/** Corps de création (POST /api/activites) ; dates en ISO. */
export interface DonneesActivite {
  titre: string
  dateDebut: string
  dateFin?: string | null
  type?: string
  brancheType?: string | null
  description?: string | null
  lieu?: string | null
  statut?: StatutActivite
  bilan?: string | null
  publique?: boolean
  descriptionPublique?: string | null
  responsableId?: string | null
}

/** Modification partielle (PUT /api/activites/:id) : un champ absent est conservé. */
export type DonneesModifierActivite = Partial<DonneesActivite>

export interface MembreMaitrise {
  id: string
  nom: string
  prenom: string
  role: string
  fonction: string | null
  brancheType: string | null
}

interface OrganigrammeMaitrise {
  direction: MembreMaitrise[]
  branches: { brancheType: string; libelle: string; membres: MembreMaitrise[] }[]
}

// ---- Invalidation ----------------------------------------------------------

function invaliderActivites(client: QueryClient) {
  client.invalidateQueries({ queryKey: ['activites'] })
  client.invalidateQueries({ queryKey: ['calendrier'] })
  client.invalidateQueries({ queryKey: ['tableau-de-bord'] })
}

// ---- Lectures --------------------------------------------------------------

export function useActivites(filtres: FiltresActivites = {}) {
  return useQuery({
    queryKey: ['activites', 'liste', filtres],
    queryFn: () =>
      api<ListeActivites>(
        `/api/activites${requete({
          page: filtres.page,
          limite: filtres.limite,
          recherche: filtres.recherche,
          type: filtres.type,
          statut: filtres.statut,
          brancheType: filtres.brancheType,
          aVenir: filtres.aVenir ? 1 : undefined,
        })}`,
      ),
    placeholderData: keepPreviousData,
  })
}

export function useActivite(id: string) {
  return useQuery({
    queryKey: ['activites', 'detail', id],
    queryFn: () => api<Activite>(`/api/activites/${id}`),
    enabled: Boolean(id),
  })
}

export function usePresencesActivite(id: string) {
  return useQuery({
    queryKey: ['activites', 'presences', id],
    queryFn: () => api<PresenceActivite[]>(`/api/activites/${id}/presences`),
    enabled: Boolean(id),
  })
}

/** Branche du compte connecté (GET /api/me/branche), pour les rôles de branche. */
export function useMaBranche(actif = true) {
  return useQuery({
    queryKey: ['profil', 'branche'],
    queryFn: () => api<{ brancheType: string | null; role: string }>('/api/me/branche'),
    enabled: actif,
    staleTime: 5 * 60_000,
  })
}

/** Membres actifs de la maîtrise, candidats au rôle de responsable d'activité. */
export function useMembresMaitrise() {
  return useQuery({
    queryKey: ['utilisateurs', 'maitrise'],
    queryFn: () => api<OrganigrammeMaitrise>('/api/utilisateurs/maitrise'),
    select: (o): MembreMaitrise[] => [...o.direction, ...o.branches.flatMap((b) => b.membres)],
    staleTime: 5 * 60_000,
  })
}

// ---- Mutations -------------------------------------------------------------

export function useCreerActivite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (donnees: DonneesActivite) => api<Activite>('/api/activites', { method: 'POST', json: donnees }),
    onSuccess: () => invaliderActivites(client),
  })
}

export function useModifierActivite(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (donnees: DonneesModifierActivite) =>
      api<Activite>(`/api/activites/${id}`, { method: 'PUT', json: donnees }),
    onSuccess: (activite) => {
      client.setQueryData(['activites', 'detail', id], activite)
      invaliderActivites(client)
    },
  })
}

export function useSupprimerActivite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<{ message: string }>(`/api/activites/${id}`, { method: 'DELETE' }),
    onSuccess: () => invaliderActivites(client),
  })
}

export function useEnregistrerPresences(activiteId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (presences: { scoutId: string; present: boolean; commentaire?: string | null }[]) =>
      api<{ enregistrees: number }>(`/api/activites/${activiteId}/presences`, {
        method: 'POST',
        json: { presences },
      }),
    onSuccess: () => {
      invaliderActivites(client)
      client.invalidateQueries({ queryKey: ['presences'] })
    },
  })
}
