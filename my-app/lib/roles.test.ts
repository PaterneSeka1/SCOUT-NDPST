import { describe, it, expect } from 'vitest'
import {
  ROLES_GROUPE,
  ROLES_GROUPE_ETENDU,
  ROLES_BRANCHE,
  ROLES_TOUT_STAFF,
  ROLES_GESTION,
  LABELS_ROLES,
} from './roles'

// Ces constantes pilotent le contrôle d'accès d'une vingtaine de routes API
// (voir la centralisation RBAC). Un test de non-régression ici évite qu'une
// modification future n'élargisse ou ne restreigne silencieusement un groupe.
describe('groupes de rôles RBAC', () => {
  it('ROLES_GROUPE contient exactement la direction du groupe', () => {
    expect([...ROLES_GROUPE].sort()).toEqual(['ADMIN_PAROISSE', 'CHEF_GROUPE'])
  })

  it('ROLES_GROUPE_ETENDU ajoute les adjoints/assistants de groupe', () => {
    expect([...ROLES_GROUPE_ETENDU].sort()).toEqual(
      ['ADJOINT_GROUPE', 'ADMIN_PAROISSE', 'ASSISTANT_GROUPE', 'CHEF_GROUPE'],
    )
  })

  it("ROLES_BRANCHE contient l'encadrement de branche", () => {
    expect([...ROLES_BRANCHE].sort()).toEqual(
      ['ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE', 'RESPONSABLE_BRANCHE'],
    )
  })

  it('ROLES_TOUT_STAFF réunit tout le staff (7 rôles, ni PARENT ni SCOUT)', () => {
    expect(ROLES_TOUT_STAFF).toHaveLength(7)
    expect(ROLES_TOUT_STAFF).not.toContain('PARENT')
    expect(ROLES_TOUT_STAFF).not.toContain('SCOUT')
  })

  it('ROLES_GESTION exclut les adjoints/assistants de groupe', () => {
    expect(ROLES_GESTION).not.toContain('ADJOINT_GROUPE')
    expect(ROLES_GESTION).not.toContain('ASSISTANT_GROUPE')
    expect([...ROLES_GESTION].sort()).toEqual(
      ['ADJOINT_BRANCHE', 'ADMIN_PAROISSE', 'ASSISTANT_BRANCHE', 'CHEF_GROUPE', 'RESPONSABLE_BRANCHE'],
    )
  })

  it('chaque rôle utilisé dans les groupes a un libellé défini', () => {
    for (const role of ROLES_TOUT_STAFF) {
      expect(LABELS_ROLES[role]).toBeTruthy()
    }
  })
})
