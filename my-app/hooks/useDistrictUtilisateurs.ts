'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'

// ---- Types ----------------------------------------------------------------

export interface Utilisateur {
  id: string
  matricule: string | null
  telephone: string | null
  nom: string
  prenom: string
  role: string
  fonction: string | null
  actif: boolean
  email: string | null
  paroisseId?: string
  createdAt: string
  updatedAt?: string
}

export interface PaginationMeta {
  page: number
  total: number
  totalPages: number
  perPage?: number
}

export interface ListeUtilisateursResponse {
  utilisateurs: Utilisateur[]
  total: number
  page: number
  totalPages: number
}

export interface FiltresUtilisateurs {
  page?: number
  recherche?: string
  role?: string
}

export interface DonneesCreerUtilisateur {
  nom: string
  prenom: string
  email?: string | null
  matricule: string
  telephone?: string | null
  role: string
  fonction?: string | null
  password: string
}

export interface DonneesModifierUtilisateur {
  nom?: string
  prenom?: string
  email?: string | null
  role?: string
  fonction?: string | null
  actif?: boolean
}

export interface DonneesResetPassword {
  nouveauMotDePasse: string
}

// ---- Clés de cache --------------------------------------------------------

export const QUERY_KEYS = {
  utilisateurs: (filtres?: FiltresUtilisateurs) =>
    ['district-utilisateurs', filtres] as const,
  utilisateur: (id: string) => ['district-utilisateurs', id] as const,
}

// ---- Fonctions fetch -------------------------------------------------------

async function fetchUtilisateurs(
  filtres: FiltresUtilisateurs,
): Promise<ListeUtilisateursResponse> {
  const params = new URLSearchParams()
  if (filtres.page) params.set('page', String(filtres.page))
  if (filtres.recherche) params.set('recherche', filtres.recherche)
  if (filtres.role) params.set('role', filtres.role)

  const res = await fetch(`/api/district/utilisateurs?${params.toString()}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.erreur ?? 'Erreur lors du chargement de l\'équipe')
  }
  return res.json()
}

async function fetchUtilisateur(id: string): Promise<Utilisateur> {
  const res = await fetch(`/api/district/utilisateurs/${id}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.erreur ?? 'Membre de l\'équipe introuvable')
  }
  return res.json()
}

// ---- Hooks ----------------------------------------------------------------

/**
 * Liste paginée de l'équipe du district (Adjoint + Assistants) avec filtres optionnels.
 */
export function useDistrictUtilisateurs(filtres: FiltresUtilisateurs = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.utilisateurs(filtres),
    queryFn: () => fetchUtilisateurs(filtres),
    placeholderData: keepPreviousData,
  })
}

/**
 * Détail d'un membre de l'équipe du district par son id.
 */
export function useDistrictUtilisateur(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.utilisateur(id),
    queryFn: () => fetchUtilisateur(id),
    enabled: Boolean(id),
  })
}

/**
 * Création d'un nouveau membre de l'équipe du district.
 */
export function useCreerDistrictUtilisateur() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (donnees: DonneesCreerUtilisateur): Promise<Utilisateur> => {
      const res = await fetch('/api/district/utilisateurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur ?? 'Erreur lors de la création du membre')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['district-utilisateurs'] })
    },
  })
}

/**
 * Modification d'un membre existant de l'équipe du district.
 */
export function useModifierDistrictUtilisateur(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (donnees: DonneesModifierUtilisateur): Promise<Utilisateur> => {
      const res = await fetch(`/api/district/utilisateurs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur ?? 'Erreur lors de la modification du membre')
      }
      return res.json()
    },
    onSuccess: (utilisateur) => {
      queryClient.setQueryData(QUERY_KEYS.utilisateur(id), utilisateur)
      queryClient.invalidateQueries({ queryKey: ['district-utilisateurs'] })
    },
  })
}

/**
 * Désactivation (soft-delete) d'un membre de l'équipe du district via DELETE.
 */
export function useDesactiverDistrictUtilisateur() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<Utilisateur> => {
      const res = await fetch(`/api/district/utilisateurs/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur ?? 'Erreur lors de la désactivation du membre')
      }
      return res.json()
    },
    onSuccess: (utilisateur) => {
      queryClient.setQueryData(QUERY_KEYS.utilisateur(utilisateur.id), utilisateur)
      queryClient.invalidateQueries({ queryKey: ['district-utilisateurs'] })
    },
  })
}

/**
 * Réinitialisation du mot de passe d'un membre de l'équipe du district.
 */
export function useResetDistrictPassword(id: string) {
  return useMutation({
    mutationFn: async (donnees: DonneesResetPassword): Promise<{ message: string }> => {
      const res = await fetch(`/api/district/utilisateurs/${id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          data.erreur ?? 'Erreur lors de la réinitialisation du mot de passe',
        )
      }
      return res.json()
    },
  })
}
