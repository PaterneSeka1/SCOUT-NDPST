import { describe, expect, it, vi } from 'vitest'
import { AuditService } from './audit.service'
import type { PrismaService } from '../prisma/prisma.service'

function prismaSimule(acteurExisteIci: boolean) {
  return {
    utilisateur: { count: vi.fn().mockResolvedValue(acteurExisteIci ? 1 : 0) },
    journalAudit: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('AuditService', () => {
  it('rattache l’action à l’acteur quand il existe dans cette base', async () => {
    const prisma = prismaSimule(true)
    await new AuditService(prisma as unknown as PrismaService).enregistrer({
      paroisseId: 'p1',
      acteurId: 'u1',
      action: 'PAROISSE_MODIFIEE',
      entite: 'Paroisse',
      details: { champ: 'nom' },
    })
    expect(prisma.journalAudit.create.mock.calls[0][0].data).toMatchObject({ acteurId: 'u1', details: { champ: 'nom' } })
  })

  it('conserve l’identifiant d’un administrateur externe dans les détails, sans clé étrangère', async () => {
    const prisma = prismaSimule(false)
    await new AuditService(prisma as unknown as PrismaService).enregistrer({
      paroisseId: null,
      acteurId: 'admin-district',
      action: 'CONFIG_PLATEFORME_MODIFIEE',
      entite: 'ConfigurationPlateforme',
    })
    expect(prisma.journalAudit.create.mock.calls[0][0].data).toMatchObject({
      acteurId: null,
      details: { acteurExterneId: 'admin-district' },
    })
  })
})
