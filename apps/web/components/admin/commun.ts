// Outils communs aux pages d'administration (messages d'erreur, miettes,
// tons des statuts, calcul des champs modifiés). Aucun appel réseau ici.
import { ErreurApi } from '@/lib/api'
import type { Miette, Ton } from '@/components/ui'

/** Message lisible d'une erreur d'API ou réseau (jamais de détail technique). */
export function messageErreur(erreur: unknown, defaut = 'Une erreur est survenue. Réessayez dans quelques instants.'): string {
  if (erreur instanceof ErreurApi) {
    if (erreur.statut === 403) return "Vous n'avez pas les droits nécessaires pour cette action. L'opération a été refusée par le serveur."
    return erreur.message || defaut
  }
  if (erreur instanceof Error && erreur.message) return erreur.message
  return defaut
}

/** Statut HTTP d'une erreur d'API (0 si réseau ou inconnue). */
export function statutErreur(erreur: unknown): number {
  return erreur instanceof ErreurApi ? erreur.statut : 0
}

/** Fil d'Ariane de l'administration (le tableau de bord tient lieu d'accueil). */
export function miettesAdmin(...suite: Miette[]): Miette[] {
  return [{ libelle: 'Administration', href: '/dashboard' }, ...suite]
}

export const TONS_STATUT_PUBLICATION: Record<string, Ton> = {
  BROUILLON: 'neutre',
  PUBLIEE: 'succes',
  ARCHIVEE: 'attention',
}

export const TONS_STATUT_DEMANDE: Record<string, Ton> = {
  NOUVELLE: 'info',
  EN_COURS: 'attention',
  ACCEPTEE: 'succes',
  REFUSEE: 'danger',
  ARCHIVEE: 'neutre',
}

export const TONS_VALIDATION_HISTORIQUE: Record<string, Ton> = {
  A_VERIFIER: 'attention',
  VALIDE: 'succes',
}

function egal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}

/** Champs de `courant` dont la valeur diffère de `initial` (comparaison superficielle, objets par contenu). */
export function champsModifies<T extends object>(initial: T, courant: T, cles?: (keyof T)[]): Partial<T> {
  const resultat: Partial<T> = {}
  for (const cle of cles ?? (Object.keys(courant) as (keyof T)[])) {
    if (!egal(initial[cle], courant[cle])) resultat[cle] = courant[cle]
  }
  return resultat
}

/** Texte saisi → valeur envoyée à l'API (chaîne vide → null). */
export function texteOuNull(valeur: string): string | null {
  const nettoye = valeur.trim()
  return nettoye ? nettoye : null
}

/** Entier saisi (champ numérique) → nombre ou null si vide / invalide. */
export function entierOuNull(valeur: string): number | null {
  if (!valeur.trim()) return null
  const n = Number(valeur)
  return Number.isInteger(n) ? n : null
}
