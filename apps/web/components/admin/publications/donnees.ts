'use client'

// Types et requêtes du CMS des actualités (routes /api/admin/publications et
// /api/admin/categories). Les droits sont revérifiés par l'API.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, requete } from '@/lib/api'

export interface Categorie {
  id: string
  nom: string
  slug: string
  createdAt?: string
  _count?: { publications: number }
}

export interface PublicationListe {
  id: string
  titre: string
  slug: string
  resume: string | null
  imageCouverture: string | null
  imageAlt: string | null
  statut: string
  datePublication: string | null
  updatedAt: string
  categorie: { id: string; nom: string; slug: string } | null
  auteur: { prenom: string; nom: string } | null
}

export interface Publication {
  id: string
  titre: string
  slug: string
  resume: string | null
  contenu: string
  imageCouverture: string | null
  imageAlt: string | null
  statut: string
  datePublication: string | null
  seoTitre: string | null
  seoDescription: string | null
  categorieId: string | null
  createdAt: string
  updatedAt: string
  categorie: Categorie | null
  auteur: { id: string; prenom: string; nom: string } | null
}

export interface ReponseListePublications {
  publications: PublicationListe[]
  pagination: { page: number; limite: number; total: number; totalPages: number }
}

export interface FiltresPublications {
  page: number
  statut: string
  categorieId: string
  q: string
}

export const CLE_PUBLICATIONS = ['admin', 'publications'] as const
export const CLE_CATEGORIES = ['admin', 'categories'] as const

export function usePublications(filtres: FiltresPublications) {
  return useQuery({
    queryKey: [...CLE_PUBLICATIONS, 'liste', filtres],
    queryFn: () => api<ReponseListePublications>(`/api/admin/publications${requete({ ...filtres })}`),
    placeholderData: keepPreviousData,
  })
}

export function usePublication(id: string) {
  return useQuery({
    queryKey: [...CLE_PUBLICATIONS, 'detail', id],
    queryFn: () => api<Publication>(`/api/admin/publications/${encodeURIComponent(id)}`),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: CLE_CATEGORIES,
    queryFn: () => api<Categorie[]>('/api/admin/categories'),
  })
}
