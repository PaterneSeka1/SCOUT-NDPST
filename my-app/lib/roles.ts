import { LABELS_BRANCHES } from './branches'

export const LABELS_ROLES: Record<string, string> = {
  ADMIN_PLATEFORME: 'Administrateur plateforme',
  CHEF_GROUPE: 'Chef de Groupe',
  ADJOINT_GROUPE: 'Adjoint de Groupe',
  ASSISTANT_GROUPE: 'Assistant de Groupe',
  RESPONSABLE_BRANCHE: 'Responsable de Branche',
  ADJOINT_BRANCHE: 'Adjoint de Branche',
  ASSISTANT_BRANCHE: 'Assistant de Branche',
  COMMISSAIRE_DISTRICT: 'Commissaire de District',
  ADJOINT_DISTRICT: 'Commissaire de District Adjoint',
  ASSISTANT_DISTRICT: 'Assistant au Commissaire de District',
  PARENT: 'Parent',
  SCOUT: 'Scout',
}

export const COULEURS_ROLES: Record<string, string> = {
  ADMIN_PLATEFORME: 'bg-slate-800 text-white',
  CHEF_GROUPE: 'bg-green-100 text-green-800',
  ADJOINT_GROUPE: 'bg-green-50 text-green-700',
  ASSISTANT_GROUPE: 'bg-emerald-50 text-emerald-700',
  RESPONSABLE_BRANCHE: 'bg-blue-100 text-blue-800',
  ADJOINT_BRANCHE: 'bg-blue-50 text-blue-700',
  ASSISTANT_BRANCHE: 'bg-indigo-50 text-indigo-700',
  COMMISSAIRE_DISTRICT: 'bg-amber-100 text-amber-900',
  ADJOINT_DISTRICT: 'bg-amber-50 text-amber-800',
  ASSISTANT_DISTRICT: 'bg-yellow-50 text-yellow-700',
  PARENT: 'bg-purple-100 text-purple-800',
  SCOUT: 'bg-orange-100 text-orange-800',
}

/**
 * "Assistant au Commissaire de District — Branche Route" si brancheType renseigné,
 * "... — Spiritualité" si fonction renseignée (texte libre), sinon le libellé seul.
 * brancheType et fonction sont mutuellement exclusifs (voir /district/equipe).
 */
export function libelleRoleAvecFonction(role: string, fonction?: string | null, brancheType?: string | null): string {
  const base = LABELS_ROLES[role] ?? role
  if (brancheType) return `${base} — Branche ${LABELS_BRANCHES[brancheType] ?? brancheType}`
  return fonction?.trim() ? `${base} — ${fonction.trim()}` : base
}

// ---------------------------------------------------------------------------
// Groupes de rôles utilisés pour les contrôles d'accès des routes API.
// Centralisés ici pour éviter que chaque route ne redéfinisse sa propre copie
// (risque d'oubli d'un rôle lors d'une future évolution). Les routes existantes
// gardent leur propre variable locale (ex: `ROLES_AUTORISES`) qui pointe vers
// l'une de ces constantes — cela ne change aucun comportement, seulement la
// source de vérité.
//
// ADMIN_PLATEFORME (rôle global, transverse à toutes les paroisses) n'est
// JAMAIS mélangé à ces groupes : ils ne décrivent que la hiérarchie *à
// l'intérieur d'une paroisse*. ADMIN_PLATEFORME a sa propre surface (zone
// /admin) et sa propre constante ROLES_PLATEFORME, plus bas.
// ---------------------------------------------------------------------------

// Types larges (string[], pas de tuple littéral) : `session.user.role` est typé
// `string` côté NextAuth, donc un tableau de littéraux ferait échouer `.includes()`
// à la compilation.

/** Direction d'une paroisse : le Chef de Groupe, administrateur local complet. */
export const ROLES_GROUPE: string[] = ['CHEF_GROUPE']

/** Toute l'équipe de groupe (direction + adjoint/assistants de groupe). */
export const ROLES_GROUPE_ETENDU: string[] = [...ROLES_GROUPE, 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE']

/** Encadrement d'une branche (responsable, adjoint, assistants). */
export const ROLES_BRANCHE: string[] = ['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE']

/** Tout le staff paroissial (tous les rôles sauf PARENT et SCOUT). */
export const ROLES_TOUT_STAFF: string[] = [...ROLES_GROUPE_ETENDU, ...ROLES_BRANCHE]

/** Direction du groupe + encadrement de branche (sans les adjoints/assistants de groupe). */
export const ROLES_GESTION: string[] = [...ROLES_GROUPE, ...ROLES_BRANCHE]

/** Administrateur plateforme : gère les paroisses, le branding commun, les rapports consolidés. Jamais combiné aux groupes ci-dessus. */
export const ROLES_PLATEFORME: string[] = ['ADMIN_PLATEFORME']

/**
 * Direction du district : au-dessus des Chefs de Groupe de plusieurs paroisses
 * partageant le même Paroisse.district. Rattaché à une paroisse d'ancrage précise
 * (voir lib/district.ts pour la résolution du périmètre réel).
 *
 * Ces valeurs ne peuplent JAMAIS `Utilisateur.role` (rôle paroissial, testé par
 * ces constantes ROLES_XXX ci-dessus) — elles peuplent `Utilisateur.roleDistrict`,
 * un champ ADDITIF distinct (voir prisma/schema.prisma) : une personne peut très
 * bien être CHEF_GROUPE (role) ET COMMISSAIRE_DISTRICT (roleDistrict) en même
 * temps, elle continue d'exercer son rôle paroissial normalement. C'est
 * roleDistrict qui gouverne l'accès à la zone applicative /district, jamais role.
 */
export const ROLES_DISTRICT: string[] = ['COMMISSAIRE_DISTRICT']

/** Toute l'équipe de district (direction + adjoint/assistants). */
export const ROLES_DISTRICT_ETENDU: string[] = [...ROLES_DISTRICT, 'ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT']

/** Rôles assignables par un Commissaire de District à sa propre équipe, via /district/equipe. */
export const ROLES_ASSIGNABLES_DISTRICT: string[] = ['ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT']

/**
 * Rôles assignables à `role` (rôle PAROISSIAL) sur un utilisateur : tous sauf
 * ADMIN_PLATEFORME (zone /admin) et les rôles de district. `role` n'est jamais
 * une valeur de district, même pour un compte qui sert aussi le district : une
 * affectation district (roleDistrict) est additive, jamais assignée en posant
 * directement `role` — voir prisma/schema.prisma et /district/utilisateurs.
 */
export const ROLES_ASSIGNABLES_PAROISSE: string[] = Object.keys(LABELS_ROLES).filter(
  (r) => r !== 'ADMIN_PLATEFORME' && !ROLES_DISTRICT_ETENDU.includes(r),
)

/**
 * Rôles d'équipe (page "Membres", pilotée par le Chef de Groupe) — exclut PARENT
 * (page dédiée). Les rôles de district sont déjà exclus de ROLES_ASSIGNABLES_PAROISSE.
 */
export const ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT: string[] = ROLES_ASSIGNABLES_PAROISSE.filter(
  (r) => r !== 'PARENT',
)

/**
 * ROLES_ASSIGNABLES_PAROISSE sans CHEF_GROUPE — pour les formulaires génériques
 * d'édition de rôle (admin plateforme). La nomination d'un Chef de Groupe passe
 * toujours par un flux dédié qui gère l'unicité (un seul chef actif par
 * paroisse, contrainte SQL — voir prisma/schema.prisma) de façon atomique :
 * /api/admin/paroisses/[id]/chef-groupe/designer (désignation) ou
 * /api/admin/paroisses/[id]/chef-groupe (création). Un simple changement de
 * rôle via le formulaire générique provoquerait une erreur de contrainte SQL
 * brute s'il existe déjà un chef actif.
 */
export const ROLES_ASSIGNABLES_PAROISSE_SANS_CHEF: string[] = ROLES_ASSIGNABLES_PAROISSE.filter(
  (r) => r !== 'CHEF_GROUPE',
)

/**
 * ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT sans CHEF_GROUPE — pour les formulaires
 * self-service du Chef de Groupe (/dashboard/utilisateurs). La passation de la
 * direction de groupe passe exclusivement par /api/utilisateurs/chef-groupe/ceder,
 * qui rétrograde l'ancien chef et promeut le nouveau dans la même transaction.
 */
export const ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT_SANS_CHEF: string[] = ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT.filter(
  (r) => r !== 'CHEF_GROUPE',
)
