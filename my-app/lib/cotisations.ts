import { ROLES_TOUT_STAFF } from './roles'

export const LABELS_TYPE_COTISATION: Record<string, string> = {
  ADHESION_ANNUELLE: 'Adhésion annuelle',
  CAMP: 'Camp',
  AUTRE: 'Autre',
}

// 3 statuts seulement (voir prisma/schema.prisma pour le détail du choix) :
// NON_A_JOUR couvre aussi bien "rien payé" que "payé partiellement" — le
// montant déjà reçu reste visible via `montantPaye`, pas besoin d'un statut
// dédié. A_JOUR couvre "payé" et "exonéré" de la même façon (voir le flag
// `exonere` des routes de transition).
export const LABELS_STATUT_COTISATION: Record<string, string> = {
  NON_A_JOUR: 'Non à jour',
  ARGENT_RECU: 'Argent reçu',
  A_JOUR: 'À jour',
}

export const COULEURS_STATUT_COTISATION: Record<string, string> = {
  NON_A_JOUR: 'bg-amber-100 text-amber-800',
  ARGENT_RECU: 'bg-orange-100 text-orange-800',
  A_JOUR: 'bg-green-100 text-green-800',
}

export const STATUTS_COTISATION_A_FINALISER = ['NON_A_JOUR', 'ARGENT_RECU']
export const STATUTS_COTISATION_ARGENT_RECU = ['ARGENT_RECU', 'A_JOUR']

// Rôles dont le droit d'adhésion est suivi : tout le staff (via Cotisation.
// utilisateurId) ET les scouts (via leur fiche Scout liée, Cotisation.scoutId)
// — mais jamais PARENT, qui ne paie pas d'adhésion. Un compte SCOUT n'a pas
// sa propre Cotisation.utilisateurId : son statut vient de Scout.cotisations
// (voir la jointure `ficheScout` dans les routes /api/utilisateurs et
// /api/admin/utilisateurs).
export function estAssujettiAdhesion(role: string): boolean {
  return ROLES_TOUT_STAFF.includes(role) || role === 'SCOUT'
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
