'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, requete } from '@/lib/api'

// Comptes gérés par l'administrateur (/api/admin/utilisateurs) : tous les
// rôles, dont ADMINISTRATEUR. L'API revérifie chaque règle (poste unique,
// dernier administrateur, branche requise).

export interface CompteAdmin {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  telephone: string | null
  email: string | null
  role: string
  fonction: string | null
  brancheType: string | null
  actif: boolean
  editeurContenu: boolean
  profilPublic: boolean
  doitChangerMotDePasse: boolean
  createdAt: string
}

export interface FiltresComptes {
  page: number
  recherche?: string
  role?: string
  actif?: 'true' | 'false'
}

export interface DonneesCompte {
  nom: string
  prenom: string
  email: string | null
  matricule?: string | null
  telephone?: string | null
  role: string
  fonction: string | null
  brancheType: string | null
  editeurContenu: boolean
  actif?: boolean
}

export function useComptes(filtres: FiltresComptes) {
  return useQuery({
    queryKey: ['comptes-admin', filtres],
    queryFn: () =>
      api<{ utilisateurs: CompteAdmin[]; total: number; page: number; totalPages: number }>(
        `/api/admin/utilisateurs${requete({ page: filtres.page, limite: 20, recherche: filtres.recherche, role: filtres.role, actif: filtres.actif })}`,
      ),
    placeholderData: keepPreviousData,
  })
}

function useInvalider() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['comptes-admin'] })
}

/** Création : l'API renvoie une seule fois le secret temporaire (jamais mis en cache). */
export function useCreerCompte() {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: (donnees: DonneesCompte) =>
      api<CompteAdmin & { motDePasseTemporaire: string }>('/api/admin/utilisateurs', { method: 'POST', json: donnees }),
    onSuccess: invalider,
  })
}

export function useModifierCompte() {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: ({ id, ...donnees }: Partial<DonneesCompte> & { id: string }) =>
      api<CompteAdmin>(`/api/admin/utilisateurs/${encodeURIComponent(id)}`, { method: 'PUT', json: donnees }),
    onSuccess: invalider,
  })
}

export function useDesactiverCompte() {
  const invalider = useInvalider()
  return useMutation({
    mutationFn: (id: string) => api(`/api/admin/utilisateurs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: invalider,
  })
}

export function useReinitialiserMotDePasse() {
  return useMutation({
    mutationFn: ({ id, nouveauMotDePasse }: { id: string; nouveauMotDePasse: string }) =>
      api(`/api/admin/utilisateurs/${encodeURIComponent(id)}/password`, { method: 'PUT', json: { nouveauMotDePasse } }),
  })
}
