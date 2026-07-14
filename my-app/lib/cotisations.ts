export const LABELS_TYPE_COTISATION: Record<string, string> = {
  ADHESION_ANNUELLE: 'Adhésion annuelle',
  CAMP: 'Camp',
  AUTRE: 'Autre',
}

export const LABELS_STATUT_COTISATION: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  PARTIELLEMENT_PAYEE: 'Partiellement reçu',
  ARGENT_RECU: 'Argent reçu',
  PAYE_SITE: 'Payé sur le site',
  PAYEE: 'Adhésion validée',
  EXONEREE: 'Exonérée',
}

export const COULEURS_STATUT_COTISATION: Record<string, string> = {
  EN_ATTENTE: 'bg-amber-100 text-amber-800',
  PARTIELLEMENT_PAYEE: 'bg-blue-100 text-blue-800',
  ARGENT_RECU: 'bg-orange-100 text-orange-800',
  PAYE_SITE: 'bg-indigo-100 text-indigo-800',
  PAYEE: 'bg-green-100 text-green-800',
  EXONEREE: 'bg-gray-100 text-gray-700',
}

export const STATUTS_COTISATION_A_FINALISER = ['EN_ATTENTE', 'PARTIELLEMENT_PAYEE', 'ARGENT_RECU', 'PAYE_SITE']
export const STATUTS_COTISATION_ARGENT_RECU = ['PARTIELLEMENT_PAYEE', 'ARGENT_RECU', 'PAYE_SITE', 'PAYEE']

// Vue simplifiée "à jour / pas à jour" du droit d'adhésion, utilisée là où le
// détail du workflow de collecte (partiel, argent reçu, payé site...) n'a pas
// sa place — ex. bascule administrative plateforme. Par défaut (aucune
// cotisation générée, `statut` null/undefined), une personne est "pas à jour".
export function adhesionEstAJour(statut: string | null | undefined): boolean {
  return statut === 'PAYEE' || statut === 'EXONEREE'
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
