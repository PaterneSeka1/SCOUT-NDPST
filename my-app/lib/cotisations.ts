import type { StatutCotisation } from '@/app/generated/prisma/client'

export const LABELS_TYPE_COTISATION: Record<string, string> = {
  ADHESION_ANNUELLE: 'Adhésion annuelle',
  CAMP: 'Camp',
  AUTRE: 'Autre',
}

export const LABELS_STATUT_COTISATION: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  PARTIELLEMENT_PAYEE: 'Partiellement payée',
  PAYEE: 'Payée',
  EXONEREE: 'Exonérée',
}

export const COULEURS_STATUT_COTISATION: Record<string, string> = {
  EN_ATTENTE: 'bg-amber-100 text-amber-800',
  PARTIELLEMENT_PAYEE: 'bg-blue-100 text-blue-800',
  PAYEE: 'bg-green-100 text-green-800',
  EXONEREE: 'bg-gray-100 text-gray-700',
}

// Année scolaire scoute (septembre → août). Ex, au 6 juillet 2026 : "2025-2026".
export function anneeScolaireCourante(reference: Date = new Date()): string {
  const annee = reference.getFullYear()
  const debut = reference.getMonth() >= 8 ? annee : annee - 1 // mois 8 = septembre (0-indexé)
  return `${debut}-${debut + 1}`
}

// Format "AAAA-AAAA" avec deux années consécutives, ex : "2025-2026".
export function anneeScolaireValide(valeur: string): boolean {
  const correspondance = /^(\d{4})-(\d{4})$/.exec(valeur)
  return !!correspondance && Number(correspondance[2]) === Number(correspondance[1]) + 1
}

// Statuts qui font d'un scout un « cotisant » pour l'année (suivi simplifié V1,
// voir app/api/cotisations/statuts/route.ts).
export const STATUTS_COTISANT: StatutCotisation[] = ['PAYEE', 'EXONEREE']

export function formatMontantFCFA(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} FCFA`
}
