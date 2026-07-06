import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Activite {
  id: string
  titre: string
  description: string | null
  dateDebut: string
  dateFin: string | null
  lieu: string | null
  type: string
  brancheType: string | null
  paroisseId: string
  creePar: string
  _count: { presences: number }
  createdAt: string
}

export interface PresenceScout {
  id: string
  present: boolean
  commentaire: string | null
  scout: {
    id: string
    nom: string
    prenom: string
    numeroAdhesion: string | null
    brancheType: string | null
    autorisationCamp?: { ficheMedicale: boolean; autorisationParentale: boolean }
  }
}

export interface FiltresActivites {
  page?: number
  recherche?: string
  type?: string
  brancheType?: string
}

export interface DonneesCreerActivite {
  titre: string
  description?: string
  dateDebut: string
  dateFin?: string
  lieu?: string
  type: string
  brancheType?: string
}

async function fetchAvecErreur(url: string, options?: RequestInit) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const corps = await res.json().catch(() => ({}))
    throw new Error(corps.error ?? `Erreur ${res.status}`)
  }
  return res.json()
}

export function useActivites(filtres: FiltresActivites = {}) {
  const params = new URLSearchParams()
  if (filtres.page) params.set('page', String(filtres.page))
  if (filtres.recherche) params.set('recherche', filtres.recherche)
  if (filtres.type) params.set('type', filtres.type)
  if (filtres.brancheType) params.set('brancheType', filtres.brancheType)

  return useQuery({
    queryKey: ['activites', filtres],
    queryFn: () => fetchAvecErreur(`/api/activites?${params.toString()}`),
  })
}

export function useActivite(id: string) {
  return useQuery({
    queryKey: ['activites', id],
    queryFn: () => fetchAvecErreur(`/api/activites/${id}`),
    enabled: !!id,
  })
}

export function useCreerActivite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (donnees: DonneesCreerActivite) =>
      fetchAvecErreur('/api/activites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activites'] })
    },
  })
}

export function useModifierActivite(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (donnees: Partial<DonneesCreerActivite>) =>
      fetchAvecErreur(`/api/activites/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activites'] })
    },
  })
}

export function useSupprimerActivite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetchAvecErreur(`/api/activites/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activites'] })
    },
  })
}

export function usePresencesActivite(id: string) {
  return useQuery({
    queryKey: ['presences', id],
    queryFn: () => fetchAvecErreur(`/api/activites/${id}/presences`),
    enabled: !!id,
  })
}

export function useEnregistrerPresences(activiteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (presences: Array<{ scoutId: string; present: boolean; commentaire?: string }>) =>
      fetchAvecErreur(`/api/activites/${activiteId}/presences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presences }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presences', activiteId] })
      queryClient.invalidateQueries({ queryKey: ['activites'] })
    },
  })
}
