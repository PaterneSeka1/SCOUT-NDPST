import { ConflictException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import type { AuthService } from '../../auth/auth.service'
import type { PrismaService } from '../../prisma/prisma.service'
import { SchemaModificationParoisse } from './paroisses.schemas'
import { ParoissesService } from './paroisses.service'

function simulation() {
  const tx = {
    $queryRaw: vi.fn(),
    paroisse: {
      findUnique: vi.fn().mockResolvedValue({ districtId: 'district-a' }),
      update: vi.fn().mockResolvedValue({ id: 'paroisse-test', districtId: 'district-b', actif: true }),
    },
    utilisateur: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(), updateMany: vi.fn() },
    sessionUtilisateur: { updateMany: vi.fn() },
    affectationDistrict: { create: vi.fn(), updateMany: vi.fn() },
  }
  const prisma = {
    paroisse: { findUnique: vi.fn().mockResolvedValue({ id: 'paroisse-test', actif: true, districtId: 'district-a' }), update: vi.fn() },
    district: { findUnique: vi.fn().mockResolvedValue({ id: 'district-b' }) },
    $transaction: vi.fn().mockImplementation(async (executer: (client: typeof tx) => unknown) => executer(tx)),
  }
  const audit = { enregistrer: vi.fn() }
  const auth = { revoquerToutes: vi.fn() }
  return { tx, prisma, audit, auth, service: new ParoissesService(prisma as unknown as PrismaService, audit as unknown as AuditService, auth as unknown as AuthService) }
}

describe('Transfert de paroisse — aucun transfert implicite de mandat', () => {
  it('refuse sans écriture une paroisse portant encore une affectation district', async () => {
    const { service, tx, audit } = simulation()
    tx.utilisateur.findFirst.mockResolvedValue({ id: 'commissaire' })
    await expect(service.modifier('paroisse-test', SchemaModificationParoisse.parse({ districtId: 'district-b' }), 'admin')).rejects.toBeInstanceOf(ConflictException)
    expect(tx.utilisateur.findFirst).toHaveBeenCalledWith({
      where: { paroisseId: 'paroisse-test', roleDistrict: { not: null } }, select: { id: true },
    })
    expect(tx.paroisse.update).not.toHaveBeenCalled()
    expect(tx.sessionUtilisateur.updateMany).not.toHaveBeenCalled()
    expect(tx.affectationDistrict.create).not.toHaveBeenCalled()
    expect(tx.affectationDistrict.updateMany).not.toHaveBeenCalled()
    expect(tx.utilisateur.updateMany).not.toHaveBeenCalled()
    expect(audit.enregistrer).not.toHaveBeenCalled()
  })

  it('déplace sans nouvelle nomination et révoque les sessions de cette seule paroisse dans la transaction', async () => {
    const { service, tx, prisma, audit } = simulation()
    await service.modifier('paroisse-test', SchemaModificationParoisse.parse({ districtId: 'district-b' }), 'admin')
    expect(prisma.$transaction).toHaveBeenCalledOnce()
    expect(prisma.paroisse.update).not.toHaveBeenCalled()
    expect(tx.$queryRaw.mock.calls.map((appel) => appel[1])).toEqual(['district-a', 'district-b', 'paroisse-test', 'paroisse-test'])
    expect(tx.$queryRaw.mock.invocationCallOrder[3]).toBeLessThan(tx.sessionUtilisateur.updateMany.mock.invocationCallOrder[0]!)
    expect(tx.sessionUtilisateur.updateMany).toHaveBeenCalledWith({
      where: { utilisateur: { paroisseId: 'paroisse-test' }, revoqueeLe: null }, data: { revoqueeLe: expect.any(Date) },
    })
    expect(tx.utilisateur.update).not.toHaveBeenCalled()
    expect(tx.affectationDistrict.create).not.toHaveBeenCalled()
    expect(tx.affectationDistrict.updateMany).not.toHaveBeenCalled()
    expect(audit.enregistrer).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PAROISSE_DISTRICT_MODIFIE', details: { ancienDistrictId: 'district-a', nouveauDistrictId: 'district-b' },
    }))
  })

  it('refuse un déplacement concurrent détecté après acquisition du verrou', async () => {
    const { service, tx } = simulation()
    tx.paroisse.findUnique.mockResolvedValue({ districtId: 'district-c' })
    await expect(service.modifier('paroisse-test', SchemaModificationParoisse.parse({ districtId: 'district-b' }), 'admin')).rejects.toBeInstanceOf(ConflictException)
    expect(tx.paroisse.update).not.toHaveBeenCalled()
    expect(tx.sessionUtilisateur.updateMany).not.toHaveBeenCalled()
  })

  it('propage un échec de révocation pour annuler le déplacement transactionnel', async () => {
    const { service, tx, audit } = simulation()
    tx.sessionUtilisateur.updateMany.mockRejectedValue(new Error('session indisponible'))
    await expect(service.modifier('paroisse-test', SchemaModificationParoisse.parse({ districtId: 'district-b' }), 'admin')).rejects.toThrow('session indisponible')
    expect(audit.enregistrer).not.toHaveBeenCalled()
  })

  it('ne révoque pas les sessions lorsque le district transmis reste identique', async () => {
    const { service, prisma, tx } = simulation()
    await service.modifier('paroisse-test', SchemaModificationParoisse.parse({ districtId: 'district-a', nom: 'Nom corrigé' }), 'admin')
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.paroisse.update).toHaveBeenCalledOnce()
    expect(tx.sessionUtilisateur.updateMany).not.toHaveBeenCalled()
  })
})
