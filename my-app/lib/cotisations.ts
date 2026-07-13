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

export function formatMontantFCFA(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} FCFA`
}
