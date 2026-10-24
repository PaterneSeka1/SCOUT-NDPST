'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Organigramme de la maîtrise (GET /api/utilisateurs/maitrise) et profil
// public affiché sur la page « La maîtrise » du site
// (PATCH /api/utilisateurs/:id/profil-public, direction du groupe et admin).

export interface MembreMaitrise {
  id: string
  nom: string
  prenom: string
  role: string
  fonction: string | null
  brancheType: string | null
  profilPublic: boolean
}

export interface Maitrise {
  direction: MembreMaitrise[]
  branches: { brancheType: string; libelle: string; membres: MembreMaitrise[] }[]
}

export interface ProfilPublic {
  profilPublic: boolean
  fonctionPublique: string | null
  photoPublique: string | null
  biographie: string | null
  ordrePublic: number
}

export function useMaitrise() {
  return useQuery({ queryKey: ['maitrise'], queryFn: () => api<Maitrise>('/api/utilisateurs/maitrise') })
}

/** Profil public d'un membre (lu sur sa fiche détaillée). */
export function useProfilPublic(id: string | null) {
  return useQuery({
    queryKey: ['utilisateur', id, 'profil-public'],
    enabled: !!id,
    queryFn: async () => {
      const u = await api<Partial<ProfilPublic>>(`/api/utilisateurs/${encodeURIComponent(id!)}`)
      return {
        profilPublic: u.profilPublic ?? false,
        fonctionPublique: u.fonctionPublique ?? null,
        photoPublique: u.photoPublique ?? null,
        biographie: u.biographie ?? null,
        ordrePublic: u.ordrePublic ?? 0,
      } satisfies ProfilPublic
    },
  })
}

export function useModifierProfilPublic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...donnees }: Partial<ProfilPublic> & { id: string }) =>
      api(`/api/utilisateurs/${encodeURIComponent(id)}/profil-public`, { method: 'PATCH', json: donnees }),
    onSuccess: (_r, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['maitrise'] })
      queryClient.invalidateQueries({ queryKey: ['utilisateur', id] })
    },
  })
}
