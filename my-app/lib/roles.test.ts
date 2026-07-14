import { describe, it, expect } from 'vitest'
import {
  ROLES_GROUPE,
  ROLES_GROUPE_ETENDU,
  ROLES_BRANCHE,
  ROLES_TOUT_STAFF,
  ROLES_GESTION,
  ROLES_PLATEFORME,
  ROLES_DISTRICT,
  ROLES_DISTRICT_ETENDU,
  ROLES_ASSIGNABLES_DISTRICT,
  ROLES_ASSIGNABLES_PAROISSE,
  ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT,
  LABELS_ROLES,
  libelleRoleAvecFonction,
} from './roles'

// Ces constantes pilotent le contrôle d'accès d'une vingtaine de routes API
// (voir la centralisation RBAC). Un test de non-régression ici évite qu'une
// modification future n'élargisse ou ne restreigne silencieusement un groupe.
describe('groupes de rôles RBAC', () => {
  it('ROLES_GROUPE contient exactement la direction de la paroisse (Chef de Groupe)', () => {
    expect([...ROLES_GROUPE].sort()).toEqual(['CHEF_GROUPE'])
  })

  it('ROLES_GROUPE_ETENDU ajoute les adjoints/assistants de groupe', () => {
    expect([...ROLES_GROUPE_ETENDU].sort()).toEqual(
      ['ADJOINT_GROUPE', 'ASSISTANT_GROUPE', 'CHEF_GROUPE'],
    )
  })

  it("ROLES_BRANCHE contient l'encadrement de branche", () => {
    expect([...ROLES_BRANCHE].sort()).toEqual(
      ['ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE', 'RESPONSABLE_BRANCHE'],
    )
  })

  it('ROLES_TOUT_STAFF réunit tout le staff (6 rôles, ni PARENT ni SCOUT, ni ADMIN_PLATEFORME)', () => {
    expect(ROLES_TOUT_STAFF).toHaveLength(6)
    expect(ROLES_TOUT_STAFF).not.toContain('PARENT')
    expect(ROLES_TOUT_STAFF).not.toContain('SCOUT')
    expect(ROLES_TOUT_STAFF).not.toContain('ADMIN_PLATEFORME')
  })

  it('ROLES_GESTION exclut les adjoints/assistants de groupe', () => {
    expect(ROLES_GESTION).not.toContain('ADJOINT_GROUPE')
    expect(ROLES_GESTION).not.toContain('ASSISTANT_GROUPE')
    expect([...ROLES_GESTION].sort()).toEqual(
      ['ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE', 'CHEF_GROUPE', 'RESPONSABLE_BRANCHE'],
    )
  })

  it('ROLES_PLATEFORME ne contient que le rôle global, jamais mélangé aux rôles de paroisse', () => {
    expect(ROLES_PLATEFORME).toEqual(['ADMIN_PLATEFORME'])
    for (const roles of [ROLES_GROUPE, ROLES_GROUPE_ETENDU, ROLES_BRANCHE, ROLES_TOUT_STAFF, ROLES_GESTION]) {
      expect(roles).not.toContain('ADMIN_PLATEFORME')
    }
  })

  it('ROLES_ASSIGNABLES_PAROISSE exclut ADMIN_PLATEFORME et les rôles de district', () => {
    expect(ROLES_ASSIGNABLES_PAROISSE).not.toContain('ADMIN_PLATEFORME')
    for (const roleDistrict of ROLES_DISTRICT_ETENDU) {
      expect(ROLES_ASSIGNABLES_PAROISSE).not.toContain(roleDistrict)
    }
    expect(ROLES_ASSIGNABLES_PAROISSE.length).toBe(Object.keys(LABELS_ROLES).length - 1 - ROLES_DISTRICT_ETENDU.length)
  })

  it('chaque rôle utilisé dans les groupes a un libellé défini', () => {
    for (const role of ROLES_TOUT_STAFF) {
      expect(LABELS_ROLES[role]).toBeTruthy()
    }
  })

  it('ROLES_DISTRICT contient exactement la direction du district (Commissaire de District)', () => {
    expect([...ROLES_DISTRICT].sort()).toEqual(['COMMISSAIRE_DISTRICT'])
  })

  it('ROLES_DISTRICT_ETENDU ajoute l\'adjoint et les assistants de district', () => {
    expect([...ROLES_DISTRICT_ETENDU].sort()).toEqual(
      ['ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT', 'COMMISSAIRE_DISTRICT'],
    )
  })

  it('ROLES_ASSIGNABLES_DISTRICT ne contient jamais COMMISSAIRE_DISTRICT (créé uniquement par ADMIN_PLATEFORME)', () => {
    expect([...ROLES_ASSIGNABLES_DISTRICT].sort()).toEqual(['ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT'])
  })

  it('ROLES_DISTRICT_ETENDU (rôles transverses à plusieurs paroisses) n\'est jamais mélangé aux rôles paroissiaux', () => {
    for (const roles of [ROLES_GROUPE, ROLES_GROUPE_ETENDU, ROLES_BRANCHE, ROLES_TOUT_STAFF, ROLES_GESTION]) {
      for (const roleDistrict of ROLES_DISTRICT_ETENDU) {
        expect(roles).not.toContain(roleDistrict)
      }
    }
  })

  it('ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT exclut PARENT et tous les rôles de district', () => {
    expect(ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT).not.toContain('PARENT')
    for (const roleDistrict of ROLES_DISTRICT_ETENDU) {
      expect(ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT).not.toContain(roleDistrict)
    }
  })

  it('chaque rôle de district a un libellé défini', () => {
    for (const role of ROLES_DISTRICT_ETENDU) {
      expect(LABELS_ROLES[role]).toBeTruthy()
    }
  })

  it('libelleRoleAvecFonction ajoute la fonction seulement si renseignée', () => {
    expect(libelleRoleAvecFonction('ASSISTANT_DISTRICT', 'Spiritualité')).toBe('Assistant au Commissaire de District — Spiritualité')
    expect(libelleRoleAvecFonction('ASSISTANT_DISTRICT', null)).toBe('Assistant au Commissaire de District')
    expect(libelleRoleAvecFonction('ASSISTANT_DISTRICT', '  ')).toBe('Assistant au Commissaire de District')
    expect(libelleRoleAvecFonction('COMMISSAIRE_DISTRICT')).toBe('Commissaire de District')
  })

  it('libelleRoleAvecFonction privilégie brancheType sur fonction quand les deux sont fournis', () => {
    expect(libelleRoleAvecFonction('ASSISTANT_DISTRICT', null, 'ECLAIREURS')).toBe('Assistant au Commissaire de District — Branche Éclaireurs')
    expect(libelleRoleAvecFonction('ASSISTANT_DISTRICT', 'Spiritualité', 'COMPAGNONS')).toBe('Assistant au Commissaire de District — Branche Compagnons (Routiers)')
  })
})
