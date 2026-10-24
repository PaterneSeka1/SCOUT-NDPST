'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, requete } from '@/lib/api'

// Hooks du domaine « scouts » (GET/POST/PUT /api/scouts…). Les droits sont
// revérifiés par l'API (cloisonnement par branche pour l'encadrement).

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
  anneeScolaire: string
  statut: string
  datePaiement: string | null
}

export interface EquipeScout {
  id: string
  nom: string
  brancheType?: string
  actif?: boolean
}

/** Ligne de la liste paginée (GET /api/scouts). */
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
  utilisateurId: string | null
  createdAt: string
  equipeId: string | null
  equipe: EquipeScout | null
  _count?: { contactsUrgence: number }
}

/** Fiche complète (GET /api/scouts/:id). */
export interface FicheScout extends Scout {
  allergies: string | null
  traitementsMedicaux: string | null
  consentementImage: boolean
  consentementImageDate: string | null
  consentementSante: boolean
  consentementSanteDate: string | null
  contactsUrgence: ContactUrgence[]
  liensParents: ParentLie[]
  documents: DocumentScout[]
  cotisations: CotisationScout[]
  utilisateur?: UtilisateurLie | null
}

export interface ListeScoutsResponse {
  scouts: Scout[]
  total: number
  page: number
  limite: number
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
  photo?: string | null
  allergies?: string | null
  traitementsMedicaux?: string | null
  equipeId?: string | null
  contactsUrgence: DonneesContact[]
}

export interface DonneesModifierScout {
  nom?: string
  prenom?: string
  dateNaissance?: string
  sexe?: string
  brancheType?: string
  actif?: boolean
  photo?: string | null
  allergies?: string | null
  traitementsMedicaux?: string | null
  consentementImage?: boolean
  consentementSante?: boolean
  equipeId?: string | null
}

export interface CorrespondanceDoublon {
  id: string
  nom: string
  prenom: string
  brancheType: string
  dateNaissance: string
  actif: boolean
}

// ---- Clés de cache --------------------------------------------------------

export const QUERY_KEYS = {
  scouts: (filtres?: FiltresScouts) => ['scouts', 'liste', filtres] as const,
  scout: (id: string) => ['scouts', 'fiche', id] as const,
}

// ---- Lectures -------------------------------------------------------------

/** Liste paginée des scouts (recherche, branche, statut côté serveur). */
export function useScouts(filtres: FiltresScouts = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.scouts(filtres),
    queryFn: () =>
      api<ListeScoutsResponse>(
        `/api/scouts${requete({
          page: filtres.page,
          limite: filtres.limite,
          branche: filtres.branche,
          recherche: filtres.recherche,
          actif: filtres.actif,
        })}`,
      ),
    placeholderData: keepPreviousData,
  })
}

/** Fiche d'un scout (contacts, documents, parents, cotisations, équipe). */
export function useScout(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.scout(id),
    queryFn: () => api<FicheScout>(`/api/scouts/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
  })
}

/** Fiches proches (même nom/prénom, éventuellement même date de naissance). */
export function rechercherDoublons(criteres: { nom: string; prenom: string; dateNaissance?: string }) {
  return api<{ correspondances: CorrespondanceDoublon[] }>(`/api/scouts/doublons${requete(criteres)}`)
}

// ---- Mutations ------------------------------------------------------------

function useInvalidation() {
  const queryClient = useQueryClient()
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['scouts'] })
    queryClient.invalidateQueries({ queryKey: ['equipes'] })
    queryClient.invalidateQueries({ queryKey: ['branches'] })
    if (id) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scout(id) })
  }
}

export function useCreerScout() {
  const invalider = useInvalidation()
  return useMutation({
    mutationFn: (donnees: DonneesCreerScout) => api<FicheScout>('/api/scouts', { method: 'POST', json: donnees }),
    onSuccess: () => invalider(),
  })
}

export function useModifierScout(id: string) {
  const invalider = useInvalidation()
  return useMutation({
    mutationFn: (donnees: DonneesModifierScout) =>
      api<Scout>(`/api/scouts/${encodeURIComponent(id)}`, { method: 'PUT', json: donnees }),
    onSuccess: () => invalider(id),
  })
}

/** Variante sans id figé (actions de ligne dans une liste). */
export function useBasculerActifScout() {
  const invalider = useInvalidation()
  return useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) =>
      api<Scout>(`/api/scouts/${encodeURIComponent(id)}`, { method: 'PUT', json: { actif } }),
    onSuccess: (_d, { id }) => invalider(id),
  })
}

export function useAttribuerMatricule(id: string) {
  const invalider = useInvalidation()
  return useMutation({
    mutationFn: (matricule: string) =>
      api(`/api/scouts/${encodeURIComponent(id)}/matricule`, { method: 'PUT', json: { matricule } }),
    onSuccess: () => invalider(id),
  })
}

export function useAjouterContact(scoutId: string) {
  const invalider = useInvalidation()
  return useMutation({
    mutationFn: (donnees: DonneesContact) =>
      api<ContactUrgence>(`/api/scouts/${encodeURIComponent(scoutId)}/contacts`, { method: 'POST', json: donnees }),
    onSuccess: () => invalider(scoutId),
  })
}

export function useSupprimerContact(scoutId: string) {
  const invalider = useInvalidation()
  return useMutation({
    mutationFn: (contactId: string) =>
      api(`/api/scouts/${encodeURIComponent(scoutId)}/contacts/${encodeURIComponent(contactId)}`, { method: 'DELETE' }),
    onSuccess: () => invalider(scoutId),
  })
}

export function useAjouterDocument(scoutId: string) {
  const invalider = useInvalidation()
  return useMutation({
    mutationFn: (donnees: { type: string; nomFichier: string; url: string; dateExpiration?: string | null }) =>
      api<DocumentScout>(`/api/scouts/${encodeURIComponent(scoutId)}/documents`, { method: 'POST', json: donnees }),
    onSuccess: () => invalider(scoutId),
  })
}

export function useSupprimerDocument(scoutId: string) {
  const invalider = useInvalidation()
  return useMutation({
    mutationFn: (documentId: string) =>
      api(`/api/scouts/${encodeURIComponent(scoutId)}/documents/${encodeURIComponent(documentId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => invalider(scoutId),
  })
}

/** Création d'un compte SCOUT (espace famille : fermé tant que ESPACES_FAMILLES_ACTIFS vaut false). */
export function useCreerCompteScout(scoutId: string) {
  const invalider = useInvalidation()
  return useMutation({
    mutationFn: (donnees: { password: string; telephone?: string }) =>
      api<UtilisateurLie>(`/api/scouts/${encodeURIComponent(scoutId)}/compte`, { method: 'POST', json: donnees }),
    onSuccess: () => invalider(scoutId),
  })
}

// ---- Import et passage de branche -----------------------------------------

export interface ResultatImport {
  resultats: { ligne: number; succes: boolean; erreur?: string; scoutId?: string; nom?: string; prenom?: string }[]
  nbSucces: number
  nbEchecs: number
}

export function useImporterScouts() {
  const invalider = useInvalidation()
  return useMutation({
    mutationFn: (scouts: Record<string, string>[]) =>
      api<ResultatImport>('/api/scouts/import', { method: 'POST', json: { scouts } }),
    onSuccess: () => invalider(),
  })
}

export interface PropositionPassage {
  scoutId: string
  nom: string
  prenom: string
  matricule: string | null
  age: number
  brancheActuelle: string
  brancheProposee: string | null
}

export function usePassagesBranche(dateReference: string, actif = true) {
  return useQuery({
    queryKey: ['scouts', 'passage-branche', dateReference],
    queryFn: () =>
      api<{ dateReference: string; propositions: PropositionPassage[] }>(
        `/api/scouts/passage-branche${requete({ dateReference })}`,
      ),
    enabled: actif,
  })
}

export function useAppliquerPassages() {
  const invalider = useInvalidation()
  return useMutation({
    mutationFn: (passages: { scoutId: string; nouvelleBranche: string | null }[]) =>
      api<{ appliques: number }>('/api/scouts/passage-branche', { method: 'POST', json: { passages } }),
    onSuccess: () => invalider(),
  })
}
