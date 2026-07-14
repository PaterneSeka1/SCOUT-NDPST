'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'

// ---- Types ----------------------------------------------------------------

export interface ContactUrgence {
  id: string
  nom: string
  prenom: string | null
  telephone: string
  relation: string | null
  principal: boolean
  scoutId: string
  utilisateurId: string | null
}

export interface ParentLie {
  parentId: string
  scoutId: string
  parent: {
    id: string
    nom: string
    prenom: string
    telephone: string | null
    email: string | null
    role: string
  }
}

export interface UtilisateurLie {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  actif: boolean
}

export interface DocumentScout {
  id: string
  type: string
  nomFichier: string
  url: string
  dateUpload: string
  dateExpiration: string | null
  valide: boolean
  scoutId: string
}

export interface CotisationScout {
  id: string
  type: string
  libelle: string | null
  montant: number
  montantPaye: number
  anneeScolaire: string
  statut: string
  datePaiement: string | null
  collectePar: { id: string; nom: string; prenom: string; role: string } | null
  enregistrePar: { id: string; nom: string; prenom: string; role: string } | null
}

export interface Scout {
  id: string
  nom: string
  prenom: string
  dateNaissance: string
  sexe: string
  brancheType: string
  matricule: string | null
  actif: boolean
  photo: string | null
  allergies: string | null
  traitementsMedicaux: string | null
  consentementImage: boolean
  consentementImageDate: string | null
  paroisseId: string
  utilisateurId: string | null
  contactsUrgence: ContactUrgence[]
  liensParents: ParentLie[]
  documents: DocumentScout[]
  cotisations: CotisationScout[]
  // Uniquement renvoyé par la liste paginée (GET /api/scouts), pas par le
  // détail — statut de la cotisation ADHESION_ANNUELLE de l'année pastorale
  // en cours ; null = aucune cotisation générée cette année pour ce scout.
  statutAdhesion?: string | null
  utilisateur?: UtilisateurLie | null
  createdAt: string
  _count?: { contactsUrgence: number }
}

export interface ListeScoutsResponse {
  scouts: Scout[]
  total: number
  page: number
  totalPages: number
}

export interface FiltresScouts {
  page?: number
  limite?: number
  branche?: string
  recherche?: string
  actif?: boolean
}

export interface DonneesContact {
  nom: string
  prenom?: string
  telephone: string
  relation?: string
  principal?: boolean
}

export interface DonneesCreerScout {
  nom: string
  prenom: string
  dateNaissance: string
  sexe: string
  brancheType: string
  photo?: string
  allergies?: string
  traitementsMedicaux?: string
  contactsUrgence: DonneesContact[]
}

export interface DonneesModifierScout {
  nom?: string
  prenom?: string
  dateNaissance?: string
  sexe?: string
  brancheType?: string
  actif?: boolean
  photo?: string
  allergies?: string
  traitementsMedicaux?: string
  consentementImage?: boolean
}

// ---- Clés de cache --------------------------------------------------------

export const QUERY_KEYS = {
  scouts: (filtres?: FiltresScouts) => ['scouts', filtres] as const,
  scout: (id: string) => ['scouts', id] as const,
}

// ---- Fonctions fetch -------------------------------------------------------

async function fetchScouts(filtres: FiltresScouts): Promise<ListeScoutsResponse> {
  const params = new URLSearchParams()
  if (filtres.page) params.set('page', String(filtres.page))
  if (filtres.limite) params.set('limite', String(filtres.limite))
  if (filtres.branche) params.set('branche', filtres.branche)
  if (filtres.recherche) params.set('recherche', filtres.recherche)
  if (filtres.actif !== undefined) params.set('actif', String(filtres.actif))

  const res = await fetch(`/api/scouts?${params.toString()}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Erreur lors du chargement des scouts')
  }
  return res.json()
}

async function fetchScout(id: string): Promise<Scout> {
  const res = await fetch(`/api/scouts/${id}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Scout introuvable')
  }
  return res.json()
}

// ---- Hooks ----------------------------------------------------------------

/**
 * Liste paginée des scouts avec filtres optionnels.
 */
export function useScouts(filtres: FiltresScouts = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.scouts(filtres),
    queryFn: () => fetchScouts(filtres),
    placeholderData: keepPreviousData,
  })
}

/**
 * Détail d'un scout par son id (avec contacts et parents).
 */
export function useScout(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.scout(id),
    queryFn: () => fetchScout(id),
    enabled: Boolean(id),
  })
}

/**
 * Inscription d'un nouveau scout avec ses contacts d'urgence.
 */
export function useCreerScout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (donnees: DonneesCreerScout): Promise<Scout> => {
      const res = await fetch('/api/scouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Erreur lors de l'inscription du scout")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scouts'] })
    },
  })
}

/**
 * Modification des informations d'un scout.
 */
export function useModifierScout(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (donnees: DonneesModifierScout): Promise<Scout> => {
      const res = await fetch(`/api/scouts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erreur lors de la modification du scout')
      }
      return res.json()
    },
    onSuccess: (scout) => {
      queryClient.setQueryData(QUERY_KEYS.scout(id), scout)
      queryClient.invalidateQueries({ queryKey: ['scouts'] })
    },
  })
}

/**
 * Attribution ou modification du matricule d'un scout.
 */
export function useAttribuerMatricule(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (matricule: string): Promise<Scout> => {
      const res = await fetch(`/api/scouts/${id}/matricule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Erreur lors de l'attribution du matricule")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scout(id) })
      queryClient.invalidateQueries({ queryKey: ['scouts'] })
    },
  })
}

/**
 * Ajout d'un contact d'urgence à un scout.
 */
export function useAjouterContact(scoutId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (donnees: DonneesContact): Promise<ContactUrgence> => {
      const res = await fetch(`/api/scouts/${scoutId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Erreur lors de l'ajout du contact")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scout(scoutId) })
    },
  })
}

/**
 * Suppression d'un contact d'urgence.
 */
export function useSupprimerContact(scoutId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contactId: string): Promise<void> => {
      const res = await fetch(`/api/scouts/${scoutId}/contacts/${contactId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erreur lors de la suppression du contact')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scout(scoutId) })
    },
  })
}

/**
 * Ajout d'un document (fiche médicale, autorisation…) à un scout.
 */
export function useAjouterDocument(scoutId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (donnees: { type: string; nomFichier: string; url: string; dateExpiration?: string | null }): Promise<DocumentScout> => {
      const res = await fetch(`/api/scouts/${scoutId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Erreur lors de l'ajout du document")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scout(scoutId) })
    },
  })
}

/**
 * Suppression d'un document d'un scout.
 */
export function useSupprimerDocument(scoutId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (documentId: string): Promise<void> => {
      const res = await fetch(`/api/scouts/${scoutId}/documents/${documentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erreur lors de la suppression du document')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scout(scoutId) })
    },
  })
}

/**
 * Création d'un compte utilisateur pour un scout (nécessite un matricule).
 */
export function useCreerCompteScout(scoutId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (donnees: {
      password: string
      telephone?: string
    }): Promise<UtilisateurLie> => {
      const res = await fetch(`/api/scouts/${scoutId}/compte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donnees),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erreur lors de la création du compte')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scout(scoutId) })
      queryClient.invalidateQueries({ queryKey: ['scouts'] })
    },
  })
}
