'use client'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api, requete, type Pagination } from '@/lib/api'
import { useSession } from '@/lib/session-client'
export interface BaremeAdhesionVue {
  id: string
  annee: string
  categorie: 'SCOUT' | 'CHEF'
  brancheType: string | null
  montant: number
  libelle: string
  actif: boolean
}
export interface MembreAdhesionVue {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  brancheType?: string | null
}
export interface EncaissementVue {
  id: string
  montant: number
  mode: string
  encaisseLe: string | null
  reference: string | null
  acteurId: string
  annulation: { motif: string } | null
}
export interface AdhesionVue {
  id: string
  annee: string
  categorie: 'SCOUT' | 'CHEF'
  brancheType: string | null
  montantDu: number
  montantEncaisse: number
  solde: number
  aVerifier: boolean
  motifVerification: string | null
  situationLocale: string
  situationReversement: string
  statutNational: string
  eligibleReversement: boolean
  personne: { scout: MembreAdhesionVue | null; utilisateur: MembreAdhesionVue | null }
  bareme: BaremeAdhesionVue | null
  encaissements: EncaissementVue[]
  confirmations: {
    id: string
    createdAt: string
    reference: string | null
    acteurId: string
    correction: { motif: string } | null
  }[]
}
export interface LotNationalVue {
  id: string
  createdAt: string
  annee: string
  statut: string
  montantTotal: number
  verseLe: string | null
  reference: string | null
  justification: string | null
  lignes?: { id: string; adhesionId: string; montant: number; adhesion: AdhesionVue }[]
}
export interface IndicateursAdhesion {
  annee: string
  membres: number
  attendu: number
  encaisse: number
  restant: number
  aReverser: number
  reverse: number
  confirme: number
  aJourLocalement: number
  cotisantsConfirmes: number
  aVerifier: number
}
export const RACINE_ADHESIONS = '/api/adhesions-nationales'
export function useAdhesionsQuery<T>(
  chemin: string,
  params: Record<string, string | number | boolean | undefined> = {},
  enabled = true,
) {
  const { data } = useSession()
  return useQuery({
    queryKey: ['adhesions-nationales', data?.user.id, data?.user.mandatId, chemin, params],
    queryFn: () => api<T>(`${RACINE_ADHESIONS}${chemin}${requete(params)}`),
    enabled,
    placeholderData: keepPreviousData,
  })
}
export function useActionAdhesion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ chemin, donnees, method = 'POST' }: { chemin: string; donnees?: unknown; method?: string }) =>
      api(chemin.startsWith('/api/') ? chemin : `${RACINE_ADHESIONS}${chemin}`, { method, json: donnees }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['adhesions-nationales'] }),
        client.invalidateQueries({ queryKey: ['tableau-de-bord'] }),
        client.invalidateQueries({ queryKey: ['mandats'] }),
      ])
    },
  })
}
export type ListeAdhesions = { adhesions: AdhesionVue[]; pagination: Pagination }

export type ListeLotsNationaux = { lots: LotNationalVue[]; pagination: Pagination }
