'use client'

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { api, requete } from '@/lib/api'

// Événement renvoyé par GET /api/calendrier?mois=AAAA-MM
// (apps/api/src/modules/calendrier/calendrier.service.ts).
export interface EvenementAgenda {
  id: string
  source: 'activite' | 'reunion'
  titre: string
  description: string | null
  debut: string
  fin: string | null
  lieu: string | null
  brancheType: string | null
  /** Type d'activité (source « activite ») ou statut de réunion (source « reunion »). */
  meta: string
}

/** Clé de mois attendue par l'API (AAAA-MM). */
export function cleMois(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function useEvenementsCalendrier(mois: string) {
  return useQuery({
    queryKey: ['calendrier', mois],
    queryFn: () => api<{ evenements: EvenementAgenda[] }>(`/api/calendrier${requete({ mois })}`),
    placeholderData: keepPreviousData,
  })
}

/** Génère (ou relit) le lien personnel d'abonnement iCal. */
export function useLienAbonnementCalendrier() {
  return useMutation({
    mutationFn: () => api<{ url: string }>('/api/calendrier/token', { method: 'POST' }),
  })
}

/** Révoque le jeton : les abonnements existants cessent de fonctionner. */
export function useRevoquerAbonnementCalendrier() {
  return useMutation({
    mutationFn: () => api<{ ok: true }>('/api/calendrier/token', { method: 'DELETE' }),
  })
}
