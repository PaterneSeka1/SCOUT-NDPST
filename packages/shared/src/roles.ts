import { LABELS_BRANCHES } from './branches'
import { ESPACES_FAMILLES_ACTIFS } from './perimetre'

export const LABELS_ROLES: Record<string, string> = {
  ADMINISTRATEUR: 'Administrateur',
  CHEF_GROUPE: 'Chef de Groupe',
  ADJOINT_GROUPE: 'Adjoint de Groupe',
  ASSISTANT_GROUPE: 'Assistant de Groupe',
  RESPONSABLE_BRANCHE: 'Responsable de Branche',
  ADJOINT_BRANCHE: 'Adjoint de Branche',
  ASSISTANT_BRANCHE: 'Assistant de Branche',
  PARENT: 'Parent',
  SCOUT: 'Scout',
}

export const COULEURS_ROLES: Record<string, string> = {
  ADMINISTRATEUR: 'bg-stone-800 text-white',
  CHEF_GROUPE: 'bg-green-100 text-green-800',
  ADJOINT_GROUPE: 'bg-green-50 text-green-700',
  ASSISTANT_GROUPE: 'bg-emerald-50 text-emerald-700',
  RESPONSABLE_BRANCHE: 'bg-orange-100 text-orange-900',
  ADJOINT_BRANCHE: 'bg-orange-50 text-orange-800',
  ASSISTANT_BRANCHE: 'bg-amber-50 text-amber-800',
  PARENT: 'bg-purple-100 text-purple-800',
  SCOUT: 'bg-sky-100 text-sky-800',
}

/** "Responsable de Branche — Louveteaux" si brancheType renseigné, sinon "… — fonction" ou le libellé seul. */
export function libelleRoleAvecFonction(role: string, fonction?: string | null, brancheType?: string | null): string {
  const base = LABELS_ROLES[role] ?? role
  if (brancheType) return `${base} — ${LABELS_BRANCHES[brancheType] ?? brancheType}`
  return fonction?.trim() ? `${base} — ${fonction.trim()}` : base
}

// ---------------------------------------------------------------------------
// Groupes de rôles utilisés pour les contrôles d'accès (API : @Roles(...),
// frontend : navigation). Source de vérité unique.
//
// ADMINISTRATEUR gère l'installation (comptes, configuration, contenus publics,
// journal d'audit) ; il ne dirige pas le groupe scout et n'est jamais mélangé
// aux groupes de la maîtrise ci-dessous.
// ---------------------------------------------------------------------------

/** Direction scoute du groupe : le Chef de Groupe. */
export const ROLES_GROUPE: string[] = ['CHEF_GROUPE']

/** Toute l'équipe de groupe (direction + adjoint/assistants de groupe). */
export const ROLES_GROUPE_ETENDU: string[] = [...ROLES_GROUPE, 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE']

/** Encadrement d'une branche (responsable, adjoint, assistants). */
export const ROLES_BRANCHE: string[] = ['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE']

/** Toute la maîtrise (tous les rôles sauf ADMINISTRATEUR, PARENT et SCOUT). */
export const ROLES_TOUT_STAFF: string[] = [...ROLES_GROUPE_ETENDU, ...ROLES_BRANCHE]

/** Direction du groupe + encadrement de branche (sans les adjoints/assistants de groupe). */
export const ROLES_GESTION: string[] = [...ROLES_GROUPE, ...ROLES_BRANCHE]

/** Administration technique de l'installation. */
export const ROLES_ADMIN: string[] = ['ADMINISTRATEUR']

/** Gestion financière (cotisations, barèmes) : direction du groupe et administrateur. */
export const ROLES_FINANCES: string[] = [...ROLES_GROUPE_ETENDU]

/** Lecture du journal d'audit et des rapports globaux. */
export const ROLES_SUPERVISION: string[] = [...ROLES_ADMIN, ...ROLES_GROUPE]

/**
 * Rôles attribuables à un compte par la gestion de la maîtrise (Chef de
 * Groupe) : jamais ADMINISTRATEUR (réservé à l'administration), ni PARENT/SCOUT
 * tant que les espaces familles sont fermés (voir perimetre.ts).
 */
export const ROLES_ASSIGNABLES_PAROISSE: string[] = Object.keys(LABELS_ROLES).filter(
  (r) => r !== 'ADMINISTRATEUR' && (ESPACES_FAMILLES_ACTIFS || !['PARENT', 'SCOUT'].includes(r)),
)

/** Rôles d'équipe (page « Maîtrise ») — exclut PARENT (page dédiée). */
export const ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT: string[] = ROLES_ASSIGNABLES_PAROISSE.filter(
  (r) => r !== 'PARENT',
)

/** Rôles attribuables par l'administrateur : tous ceux de la maîtrise, plus ADMINISTRATEUR. */
export const ROLES_ASSIGNABLES_ADMIN: string[] = [...ROLES_ADMIN, ...ROLES_ASSIGNABLES_PAROISSE]

/** Un compte peut-il gérer les contenus publics (actualités, galerie, histoire) ? */
export function peutGererContenus(utilisateur: { role: string; editeurContenu?: boolean | null }): boolean {
  return utilisateur.role === 'ADMINISTRATEUR' || utilisateur.editeurContenu === true
}
