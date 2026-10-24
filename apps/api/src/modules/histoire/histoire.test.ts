import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import type { PrismaService } from '../../prisma/prisma.service'
import { SchemaEvenement, SchemaModificationEvenement } from './histoire.schemas'
import { HistoireService } from './histoire.service'

describe('Histoire du groupe', () => {
  it('exige une source pour un fait marqué validé', () => {
    expect(SchemaEvenement.safeParse({ annee: 1956, titre: 'Fondation', statutValidation: 'VALIDE' }).success).toBe(false)
    expect(SchemaEvenement.safeParse({ annee: 1956, titre: 'Fondation', statutValidation: 'VALIDE', source: 'Registre' }).success).toBe(true)
  })

  it('crée un événement non publié et à vérifier par défaut', () => {
    const corps = SchemaEvenement.parse({ annee: 1956, titre: 'Fondation' })
    expect(corps.publie).toBeUndefined()
    expect(corps.statutValidation).toBeUndefined()
  })

  it('refuse de valider un événement existant sans source', async () => {
    const prisma = {
      evenementHistorique: { findUnique: vi.fn().mockResolvedValue({ id: 'e1', source: null, statutValidation: 'A_VERIFIER' }), update: vi.fn() },
    }
    const service = new HistoireService(prisma as unknown as PrismaService, { enregistrer: vi.fn() } as unknown as AuditService)
    await expect(service.modifier('e1', SchemaModificationEvenement.parse({ statutValidation: 'VALIDE' }), 'u1')).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.evenementHistorique.update).not.toHaveBeenCalled()
  })

  it("n'expose au public que les événements publiés", async () => {
    const prisma = { evenementHistorique: { findMany: vi.fn().mockResolvedValue([]) } }
    await new HistoireService(prisma as unknown as PrismaService, {} as AuditService).publics()
    expect(prisma.evenementHistorique.findMany.mock.calls[0][0].where).toEqual({ publie: true })
  })
})
