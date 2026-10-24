'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, requete, type Pagination } from '@/lib/api'

// Cotisations et barèmes — contrats de apps/api/src/modules/cotisations.

export interface Cotisation {
  id: string
  type: string
  libelle: string | null
  montant: number
  montantPaye: number
  anneeScolaire: string
  statut: string
  datePaiement: string | null
  modePaiement: string | null
  notes: string | null
  scoutId: string
  activiteId: string | null
  scout: { id: string; nom: string; prenom: string; brancheType: string; matricule: string | null; actif: boolean }
  activite: { id: string; titre: string; dateDebut: string } | null
  enregistrePar: { id: string; nom: string; prenom: string } | null
}

export interface FiltresCotisations {
  anneeScolaire: string
  statut?: string
  branche?: string
  recherche?: string
  page?: number
  limite?: number
}

export interface ScoutStatutCotisation {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  brancheType: string
  cotisant: boolean
}

export interface Bareme {
  id: string
  anneeScolaire: string
  type: string
  brancheType: string | null
  libelle: string | null
  montant: number
}

export interface DonneesCreationCotisation {
  scoutIds: string[]
  type: string
  montant: number
  libelle?: string | null
  anneeScolaire?: string | null
  activiteId?: string | null
}

export interface DonneesModificationCotisation {
  statut?: string
  montantPaye?: number
  modePaiement?: string | null
  notes?: string | null
}

export interface DonneesBareme {
  anneeScolaire: string
  type: string
  brancheType: string | null
  libelle: string | null
  montant: number
}

function useInvalider() {
  const client = useQueryClient()
  return () => {
    client.invalidateQueries({ queryKey: ['cotisations'] })
    client.invalidateQueries({ queryKey: ['tableau-de-bord'] })
  }
}

/** Liste paginée (serveur) des cotisations d'une année scolaire. */
export function useCotisations(filtres: FiltresCotisations) {
  return useQuery({
    queryKey: ['cotisations', 'liste', filtres],
    queryFn: () =>
      api<{ cotisations: Cotisation[]; pagination: Pagination }>(
        `/api/cotisations${requete({ ...filtres })}`,
      ),
    placeholderData: keepPreviousData,
  })
}

/** Scouts actifs avec leur statut d'adhésion annuelle (cotisant ou non). */
export function useStatutsCotisation(anneeScolaire: string, branche?: string, actif = true) {
  return useQuery({
    queryKey: ['cotisations', 'statuts', anneeScolaire, branche ?? ''],
    queryFn: () =>
      api<{ anneeScolaire: string; scouts: ScoutStatutCotisation[] }>(
        `/api/cotisations/statuts${requete({ anneeScolaire, branche })}`,
      ),
    enabled: actif,
  })
}

/** Barèmes de référence d'une année (réservé aux rôles finances). */
export function useBaremes(anneeScolaire: string, actif = true) {
  return useQuery({
    queryKey: ['cotisations', 'baremes', anneeScolaire],
    queryFn: () =>
      api<{ anneeScolaire: string; baremes: Bareme[] }>(`/api/cotisations/baremes${requete({ anneeScolaire })}`),
    enabled: actif,
  })
}

export function useCreerCotisation() {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: (donnees: DonneesCreationCotisation) =>
      api<{ cotisations: Cotisation[] }>('/api/cotisations', { method: 'POST', json: donnees }),
    onSuccess: invalider,
  })
}

export function useModifierCotisation() {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: ({ id, ...donnees }: DonneesModificationCotisation & { id: string }) =>
      api<Cotisation>(`/api/cotisations/${id}`, { method: 'PUT', json: donnees }),
    onSuccess: invalider,
  })
}

export function useSupprimerCotisation() {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/cotisations/${id}`, { method: 'DELETE' }),
    onSuccess: invalider,
  })
}

export function useDefinirStatutCotisant() {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: (donnees: { scoutId: string; cotisant: boolean; anneeScolaire: string }) =>
      api('/api/cotisations/statuts', { method: 'PUT', json: donnees }),
    onSuccess: invalider,
  })
}

export function useEnregistrerBareme() {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: ({ id, ...donnees }: DonneesBareme & { id?: string }) =>
      id
        ? api<Bareme>(`/api/cotisations/baremes/${id}`, { method: 'PATCH', json: donnees })
        : api<Bareme>('/api/cotisations/baremes', { method: 'POST', json: donnees }),
    onSuccess: invalider,
  })
}

export function useSupprimerBareme() {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/cotisations/baremes/${id}`, { method: 'DELETE' }),
    onSuccess: invalider,
  })
}
