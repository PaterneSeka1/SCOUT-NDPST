import { SetMetadata } from '@nestjs/common'

export const CLE_ROLES = 'rolesAutorises'
export const CLE_ROLES_DISTRICT = 'rolesDistrictAutorises'

// Restreint une route (ou un contrôleur) aux rôles PAROISSIAUX listés
// (Utilisateur.role) — utiliser les groupes de @scout/shared (ROLES_TOUT_STAFF…).
export const Roles = (...roles: string[]) => SetMetadata(CLE_ROLES, roles)

// Restreint une route aux affectations DISTRICT listées (Utilisateur.roleDistrict),
// jamais au rôle paroissial : voir ROLES_DISTRICT_ETENDU dans @scout/shared.
export const RolesDistrict = (...roles: string[]) => SetMetadata(CLE_ROLES_DISTRICT, roles)
