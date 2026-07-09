export const LABELS_ROLES: Record<string, string> = {
  ADMIN_PLATEFORME: 'Administrateur plateforme',
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
  ADMIN_PLATEFORME: 'bg-slate-800 text-white',
  CHEF_GROUPE: 'bg-green-100 text-green-800',
  ADJOINT_GROUPE: 'bg-green-50 text-green-700',
  ASSISTANT_GROUPE: 'bg-emerald-50 text-emerald-700',
  RESPONSABLE_BRANCHE: 'bg-blue-100 text-blue-800',
  ADJOINT_BRANCHE: 'bg-blue-50 text-blue-700',
  ASSISTANT_BRANCHE: 'bg-indigo-50 text-indigo-700',
  PARENT: 'bg-purple-100 text-purple-800',
  SCOUT: 'bg-orange-100 text-orange-800',
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

/** Rôles assignables à un utilisateur d'une paroisse (tous sauf ADMIN_PLATEFORME, réservé à la zone /admin). */
export const ROLES_ASSIGNABLES_PAROISSE: string[] = Object.keys(LABELS_ROLES).filter((r) => r !== 'ADMIN_PLATEFORME')

/** Rôles d'équipe (page "Membres") — exclut PARENT, qui a sa propre page dédiée. */
export const ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT: string[] = ROLES_ASSIGNABLES_PAROISSE.filter((r) => r !== 'PARENT')
