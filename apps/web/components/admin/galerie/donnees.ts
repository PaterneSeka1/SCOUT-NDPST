'use client'

// Types et requêtes de la galerie (routes /api/admin/albums et /api/admin/medias).
// La règle de consentement à l'image est revérifiée par l'API.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, requete } from '@/lib/api'

export interface AlbumListe {
  id: string
  titre: string
  slug: string
  description: string | null
  categorie: string | null
  dateEvenement: string | null
  publie: boolean
  createdAt: string
  updatedAt: string
  activiteId: string | null
  _count: { medias: number }
  couverture: string | null
  photosSansConsentement: number
}

export interface Media {
  id: string
  url: string
  legende: string | null
  texteAlt: string | null
  ordre: number
  publie: boolean
  contientMineurs: boolean
  consentementVerifie: boolean
  createdAt: string
  updatedAt: string
  albumId: string
}

export interface Album {
  id: string
  titre: string
  slug: string
  description: string | null
  categorie: string | null
  dateEvenement: string | null
  publie: boolean
  createdAt: string
  updatedAt: string
  activiteId: string | null
  activite: { id: string; titre: string; dateDebut: string } | null
  medias: Media[]
}

export interface ActiviteResume {
  id: string
  titre: string
  dateDebut: string
}

export const CLE_ALBUMS = ['admin', 'albums'] as const

export function useAlbums(filtres: { page: number; q: string }) {
  return useQuery({
    queryKey: [...CLE_ALBUMS, 'liste', filtres],
    queryFn: () =>
      api<{ albums: AlbumListe[]; pagination: { page: number; limite: number; total: number; totalPages: number } }>(
        `/api/admin/albums${requete(filtres)}`,
      ),
    placeholderData: keepPreviousData,
  })
}

export function useAlbum(id: string) {
  return useQuery({
    queryKey: [...CLE_ALBUMS, 'detail', id],
    queryFn: () => api<Album>(`/api/admin/albums/${encodeURIComponent(id)}`),
  })
}

/** Activités pour lier un album (route réservée à la maîtrise : 403 possible). */
export function useActivitesLiables() {
  return useQuery({
    queryKey: ['admin', 'albums', 'activites'],
    queryFn: () => api<{ activites: ActiviteResume[] }>('/api/activites?limite=100'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

/** Une photo de mineurs ne peut être publiée qu'après vérification des consentements. */
export function publicationAutorisee(m: { contientMineurs: boolean; consentementVerifie: boolean }): boolean {
  return !m.contientMineurs || m.consentementVerifie
}
