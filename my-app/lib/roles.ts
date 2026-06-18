// Les enfants (scouts) sont gérés via la fiche Scout, pas via un compte Utilisateur
export const LABELS_ROLES: Record<string, string> = {
  ADMIN_PAROISSE: 'Administrateur',
  CHEF_GROUPE: 'Chef de Groupe',
  ADJOINT_GROUPE: 'Adjoint de Groupe',
  ASSISTANT_GROUPE: 'Assistant de Groupe',
  RESPONSABLE_BRANCHE: 'Responsable de Branche',
  ADJOINT_BRANCHE: 'Adjoint de Branche',
  ASSISTANT_BRANCHE: 'Assistant de Branche',
  PARENT: 'Parent',
}

export const COULEURS_ROLES: Record<string, string> = {
  ADMIN_PAROISSE: 'bg-red-100 text-red-800',
  CHEF_GROUPE: 'bg-green-100 text-green-800',
  ADJOINT_GROUPE: 'bg-green-50 text-green-700',
  ASSISTANT_GROUPE: 'bg-emerald-50 text-emerald-700',
  RESPONSABLE_BRANCHE: 'bg-blue-100 text-blue-800',
  ADJOINT_BRANCHE: 'bg-blue-50 text-blue-700',
  ASSISTANT_BRANCHE: 'bg-indigo-50 text-indigo-700',
  PARENT: 'bg-purple-100 text-purple-800',
}
