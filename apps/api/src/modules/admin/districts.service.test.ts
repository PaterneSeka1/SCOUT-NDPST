import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../../prisma/prisma.service'
import type { AuditService } from '../../common/audit.service'
import { DistrictsService } from './districts.service'

function simulation() {
  const ancien = { roleDistrict: 'COMMISSAIRE_DISTRICT', fonctionDistrict: null, brancheTypeDistrict: null, paroisse: { districtId: 'district-a' } }
  const nouveau = { id: 'nouveau', role: 'CHEF_GROUPE', roleDistrict: null, actif: true, paroisseId: 'paroisse-a', paroisse: { districtId: 'district-a' } }
  const tx = {
    $queryRaw: vi.fn(),
    utilisateur: {
      findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => where.id === 'ancien' ? ancien : { ...nouveau, fonctionDistrict: null, brancheTypeDistrict: null }),
      findMany: vi.fn().mockResolvedValue([{ id: 'ancien' }]),
      updateMany: vi.fn(),
      update: vi.fn().mockResolvedValue({ ...nouveau, roleDistrict: 'COMMISSAIRE_DISTRICT' }),
    },
    affectationDistrict: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn() },
    sessionUtilisateur: { updateMany: vi.fn() },
  }
  const prisma = {
    district: { findUnique: vi.fn().mockResolvedValue({ id: 'district-a' }) },
    utilisateur: { findUnique: vi.fn().mockResolvedValue(nouveau) },
    $transaction: vi.fn().mockImplementation(async (executer: (client: typeof tx) => unknown) => executer(tx)),
  }
  const audit = { enregistrer: vi.fn() }
  return { tx, prisma, audit, service: new DistrictsService(prisma as unknown as PrismaService, audit as unknown as AuditService) }
}

describe('DistrictsService — remplacement transactionnel du commissaire', () => {
  it('historise et révoque les sessions des deux responsables sans changer leur rôle paroissial', async () => {
    const { service, tx, prisma } = simulation()
    await service.designerCommissaire('district-a', { utilisateurId: 'nouveau' }, 'admin-distant')
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3)
    expect(tx.$queryRaw.mock.calls.map((appel) => appel[1])).toEqual(['district-a', 'ancien', 'nouveau'])
    expect(tx.sessionUtilisateur.updateMany.mock.calls.map(([argument]) => argument.where.utilisateurId)).toEqual(['ancien', 'nouveau'])
    expect(tx.affectationDistrict.create).toHaveBeenCalledWith({ data: expect.objectContaining({ utilisateurId: 'nouveau', districtId: 'district-a', auteurId: 'admin-distant', role: 'COMMISSAIRE_DISTRICT' }) })
    expect(tx.utilisateur.update).toHaveBeenCalledWith(expect.objectContaining({ data: { roleDistrict: 'COMMISSAIRE_DISTRICT', fonctionDistrict: null, brancheTypeDistrict: null } }))
  })

  it('interrompt la transaction avant la projection si la révocation échoue', async () => {
    const { service, tx, audit } = simulation()
    tx.sessionUtilisateur.updateMany.mockRejectedValue(new Error('base indisponible'))
    await expect(service.designerCommissaire('district-a', { utilisateurId: 'nouveau' }, 'admin')).rejects.toThrow('base indisponible')
    expect(tx.utilisateur.update).not.toHaveBeenCalled()
    expect(audit.enregistrer).not.toHaveBeenCalled()
  })
})
