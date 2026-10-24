import { describe, it, expect } from 'vitest'
import {
  LABELS_ROLES,
  ROLES_ADMIN,
  ROLES_ASSIGNABLES_ADMIN,
  ROLES_ASSIGNABLES_PAROISSE,
  ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT,
  ROLES_BRANCHE,
  ROLES_GESTION,
  ROLES_GROUPE,
  ROLES_GROUPE_ETENDU,
  ROLES_TOUT_STAFF,
  libelleRoleAvecFonction,
  peutGererContenus,
} from './roles'
import { ESPACES_FAMILLES_ACTIFS } from './perimetre'

describe('groupes de rôles', () => {
  it('ne contient aucun rôle district ni plateforme', () => {
    for (const role of Object.keys(LABELS_ROLES)) {
      expect(role).not.toMatch(/DISTRICT|PLATEFORME/)
    }
  })

  it('ROLES_GROUPE ne contient que le Chef de Groupe', () => {
    expect(ROLES_GROUPE).toEqual(['CHEF_GROUPE'])
  })

  it('ROLES_GROUPE_ETENDU ajoute adjoint et assistant de groupe', () => {
    expect(ROLES_GROUPE_ETENDU).toEqual(['CHEF_GROUPE', 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE'])
  })

  it('ROLES_TOUT_STAFF réunit la maîtrise (6 rôles), sans administrateur, parent ni scout', () => {
    expect(ROLES_TOUT_STAFF).toHaveLength(6)
    for (const r of ['ADMINISTRATEUR', 'PARENT', 'SCOUT']) expect(ROLES_TOUT_STAFF).not.toContain(r)
  })

  it('ROLES_GESTION exclut les adjoints/assistants de groupe', () => {
    expect(ROLES_GESTION).toEqual(['CHEF_GROUPE', ...ROLES_BRANCHE])
  })

  it("l'administrateur est distinct du Chef de Groupe", () => {
    expect(ROLES_ADMIN).toEqual(['ADMINISTRATEUR'])
    expect(ROLES_GROUPE_ETENDU).not.toContain('ADMINISTRATEUR')
  })

  it('la gestion de la maîtrise ne peut pas créer d’administrateur', () => {
    expect(ROLES_ASSIGNABLES_PAROISSE).not.toContain('ADMINISTRATEUR')
    expect(ROLES_ASSIGNABLES_ADMIN).toContain('ADMINISTRATEUR')
  })

  it.runIf(!ESPACES_FAMILLES_ACTIFS)('PARENT et SCOUT ne sont pas attribuables tant que les espaces familles sont fermés', () => {
    expect(ROLES_ASSIGNABLES_PAROISSE).not.toContain('PARENT')
    expect(ROLES_ASSIGNABLES_PAROISSE).not.toContain('SCOUT')
    expect(ROLES_ASSIGNABLES_PAROISSE_HORS_PARENT).toEqual(ROLES_TOUT_STAFF)
  })
})

describe('libelleRoleAvecFonction', () => {
  it('ajoute la branche quand elle est renseignée', () => {
    expect(libelleRoleAvecFonction('RESPONSABLE_BRANCHE', null, 'ECLAIREURS')).toBe('Responsable de Branche — Éclaireurs')
  })
  it('ajoute la fonction libre sinon, et ignore une fonction vide', () => {
    expect(libelleRoleAvecFonction('ASSISTANT_GROUPE', 'Trésorier')).toBe('Assistant de Groupe — Trésorier')
    expect(libelleRoleAvecFonction('ASSISTANT_GROUPE', '  ')).toBe('Assistant de Groupe')
  })
})

describe('peutGererContenus', () => {
  it('autorise l’administrateur et les éditeurs explicitement désignés seulement', () => {
    expect(peutGererContenus({ role: 'ADMINISTRATEUR' })).toBe(true)
    expect(peutGererContenus({ role: 'CHEF_GROUPE', editeurContenu: true })).toBe(true)
    expect(peutGererContenus({ role: 'CHEF_GROUPE', editeurContenu: false })).toBe(false)
    expect(peutGererContenus({ role: 'RESPONSABLE_BRANCHE' })).toBe(false)
  })
})
