'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ---- Types ------------------------------------------------------------------
// Reflète la réponse de GET /api/scouts/[id]/parcours-compagnon — voir cette
// route pour la forme exacte (statut recalculé à la volée côté serveur).

export interface EtapeActiviteParcours {
  code: string
  nom: string
  etape: string
  ordre: number
  type: string
  nomAttribut: string | null
  obligatoire: boolean
}

export interface ProgressionCompagnonItem {
  id: string
  etapeActiviteId: string
  etapeActivite: EtapeActiviteParcours
  dateDebutTheorique: string
  dateLimiteTheorique: string
  dateRealisationDeclaree: string | null
  statut: string
  commentaireDeclaration: string | null
  motifRejet: string | null
  preuveUrl: string | null
  numeroSoumission: number
  soumisLe: string | null
  valideLe: string | null
  rejeteLe: string | null
}

export interface AttributCompagnonItem {
  id: string
  nom: string
  obtenuLe: string
}

export interface ParcoursCompagnonInfo {
  id: string
  dateEntreeParcours: string
  ageEntree: number
  trancheAge: string
  dateFinPrevue: string
  dateFinReelle: string | null
  statut: string
  responsableId: string | null
}

export interface ResumeAvancementParcours {
  totalActivitesObligatoires: number
  activitesValidees: number
  activitesSoumises: number
  activitesEnRetard: number
  activitesAVenir: number
  pourcentageAvancement: number
  etapeCourante: string | null
  prochaineActivite: { id: string; nom: string; dateLimite: string } | null
}

export interface ParcoursCompagnonResponse {
  scout: { id: string; nom: string; prenom: string; brancheType: string }
  brancheCompatible: boolean
  parcours: ParcoursCompagnonInfo | null
  progressions: ProgressionCompagnonItem[]
  attributsObtenus: AttributCompagnonItem[]
  avancement: ResumeAvancementParcours | null
}

// Ligne de la liste GET /api/parcours-compagnon (un scout de la paroisse,
// avec son parcours et son avancement s'il en a un).
export interface LigneListeParcoursCompagnon {
  scout: {
    id: string
    nom: string
    prenom: string
    dateNaissance: string
    brancheType: string
    matricule: string | null
    actif: boolean
  }
  parcours: {
    id: string
    trancheAge: string
    statut: string
    dateFinPrevue: string
    ageEntree: number
  } | null
  avancement: ResumeAvancementParcours | null
}

export interface ListeParcoursCompagnonResponse {
  scouts: LigneListeParcoursCompagnon[]
}

// ---- Clés de cache ------------------------------------------------------------

export const QUERY_KEYS = {
  parcoursCompagnon: (scoutId: string) => ['parcours-compagnon', scoutId] as const,
  listeParcoursCompagnon: (branche: string, recherche: string) =>
    ['parcours-compagnon-liste', branche, recherche] as const,
}

// ---- Fonctions fetch -----------------------------------------------------------

async function fetchParcoursCompagnon(scoutId: string): Promise<ParcoursCompagnonResponse> {
  const res = await fetch(`/api/scouts/${scoutId}/parcours-compagnon`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.erreur ?? 'Erreur lors du chargement du parcours de progression')
  }
  return res.json()
}

async function fetchListeParcoursCompagnon(params: {
  branche?: string
  recherche?: string
}): Promise<ListeParcoursCompagnonResponse> {
  const searchParams = new URLSearchParams()
  if (params.branche) searchParams.set('branche', params.branche)
  if (params.recherche) searchParams.set('recherche', params.recherche)
  const qs = searchParams.toString()

  const res = await fetch(`/api/parcours-compagnon${qs ? `?${qs}` : ''}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.erreur ?? 'Erreur lors du chargement de la liste')
  }
  return res.json()
}

// ---- Hooks ----------------------------------------------------------------

/** Parcours de progression individuelle (Compagnons) d'un scout, avec sa timeline et son avancement. */
export function useParcoursCompagnon(scoutId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.parcoursCompagnon(scoutId),
    queryFn: () => fetchParcoursCompagnon(scoutId),
    enabled: Boolean(scoutId),
  })
}

/** Liste des scouts de la paroisse (filtrable par branche/recherche) avec leur parcours et avancement. */
export function useListeParcoursCompagnon(params: { branche?: string; recherche?: string }) {
  return useQuery({
    queryKey: QUERY_KEYS.listeParcoursCompagnon(params.branche ?? '', params.recherche ?? ''),
    queryFn: () => fetchListeParcoursCompagnon(params),
  })
}

/** Génère le parcours (calcul de l'âge/tranche, création de toutes les lignes de progression théorique). */
export function useCreerParcoursCompagnon(scoutId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (donnees: { dateEntreeParcours: string; responsableId?: string }) => {
      const res = await fetch(`/api/scouts/${scoutId}/parcours-compagnon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur ?? 'Erreur lors de la création du parcours')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parcoursCompagnon(scoutId) })
    },
  })
}

/** Déclare une activité réalisée et la soumet à validation (gère aussi la resoumission après rejet). */
export function useSoumettreProgressionCompagnon(scoutId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      progressionId,
      ...donnees
    }: {
      progressionId: string
      dateRealisationDeclaree: string
      commentaire?: string
      preuveUrl?: string
    }) => {
      const res = await fetch(`/api/parcours-compagnon/progressions/${progressionId}/soumettre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur ?? 'Erreur lors de la soumission')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parcoursCompagnon(scoutId) })
    },
  })
}

/** Valide une activité soumise (crée l'attribut associé si applicable, peut clore le parcours). */
export function useValiderProgressionCompagnon(scoutId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (progressionId: string) => {
      const res = await fetch(`/api/parcours-compagnon/progressions/${progressionId}/valider`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur ?? 'Erreur lors de la validation')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parcoursCompagnon(scoutId) })
    },
  })
}

/** Rejette une activité soumise (motif obligatoire) — pourra être corrigée et resoumise ensuite. */
export function useRejeterProgressionCompagnon(scoutId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ progressionId, motifRejet }: { progressionId: string; motifRejet: string }) => {
      const res = await fetch(`/api/parcours-compagnon/progressions/${progressionId}/rejeter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motifRejet }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.erreur ?? 'Erreur lors du rejet')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.parcoursCompagnon(scoutId) })
    },
  })
}
