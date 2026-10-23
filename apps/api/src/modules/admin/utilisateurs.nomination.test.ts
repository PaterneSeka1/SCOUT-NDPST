import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import type { AuthService } from '../../auth/auth.service'
import type { PrismaService } from '../../prisma/prisma.service'
import { SchemaNomination } from './utilisateurs.schemas'
import { UtilisateursService } from './utilisateurs.service'

describe('Nomination administrative — ordre des verrous', () => {
  it('verrouille district puis utilisateur avant révocation, même sans changement de mandat district', async () => {
    const compte = {
      id: 'membre', role: 'ADJOINT_GROUPE', brancheType: null, fonction: null,
      roleDistrict: null, fonctionDistrict: null, brancheTypeDistrict: null,
      actif: true, matricule: 'TEST-M1', telephone: null,
      paroisseId: 'paroisse', paroisse: { districtId: 'district' },
    }
    const tx = {
      $queryRaw: vi.fn(),
      utilisateur: { findUniqueOrThrow: vi.fn().mockResolvedValue(compte), update: vi.fn().mockResolvedValue({ ...compte, role: 'ASSISTANT_GROUPE' }) },
      sessionUtilisateur: { updateMany: vi.fn() },
      affectationDistrict: { create: vi.fn(), updateMany: vi.fn() },
    }
    const prisma = {
      utilisateur: { findFirst: vi.fn().mockResolvedValue(compte) },
      $transaction: vi.fn().mockImplementation(async (action: (client: typeof tx) => unknown) => action(tx)),
    }
    const service = new UtilisateursService(
      prisma as unknown as PrismaService,
      { enregistrer: vi.fn() } as unknown as AuditService,
      {} as AuthService,
    )
    await service.nommer('membre', SchemaNomination.parse({ role: 'ASSISTANT_GROUPE' }), 'admin')
    expect(tx.$queryRaw.mock.calls.map((appel) => appel[1])).toEqual(['district', 'membre', 'membre'])
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(tx.utilisateur.findUniqueOrThrow.mock.invocationCallOrder[0]!)
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(tx.sessionUtilisateur.updateMany.mock.invocationCallOrder[0]!)
    expect(tx.sessionUtilisateur.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.utilisateur.update.mock.invocationCallOrder[0]!)
    expect(tx.affectationDistrict.create).not.toHaveBeenCalled()
    expect(tx.affectationDistrict.updateMany).not.toHaveBeenCalled()
  })
})
