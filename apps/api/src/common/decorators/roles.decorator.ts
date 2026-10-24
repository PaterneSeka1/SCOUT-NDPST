import { SetMetadata } from '@nestjs/common'

export const CLE_ROLES = 'rolesAutorises'
export const CLE_EDITEUR_CONTENU = 'editeurContenu'

// Restreint une route (ou un contrôleur) aux rôles listés (Utilisateur.role) —
// utiliser les groupes de @scout/shared (ROLES_TOUT_STAFF…).
export const Roles = (...roles: string[]) => SetMetadata(CLE_ROLES, roles)

// Restreint une route aux gestionnaires de contenus publics : l'administrateur
// et les comptes explicitement désignés (Utilisateur.editeurContenu).
export const EditeurContenu = () => SetMetadata(CLE_EDITEUR_CONTENU, true)
