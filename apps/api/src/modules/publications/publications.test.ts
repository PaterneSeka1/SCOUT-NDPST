import { BadRequestException, ConflictException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import type { PrismaService } from '../../prisma/prisma.service'
import { SchemaCreationPublication } from './publications.schemas'
import { PublicationsService } from './publications.service'

function construire(existante: Record<string, unknown> | null = null, slugsPris: string[] = []) {
  const prisma = {
    publication: {
      count: vi.fn(async ({ where }: { where: { slug: string } }) => (slugsPris.includes(where.slug) ? 1 : 0)),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'p1', ...data })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'p1', titre: 'T', ...data })),
      delete: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(existante),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    categoriePublication: { count: vi.fn().mockResolvedValue(1) },
  }
  const audit = { enregistrer: vi.fn() }
  return {
    prisma,
    audit,
    service: new PublicationsService(prisma as unknown as PrismaService, audit as unknown as AuditService),
  }
}

describe('PublicationsService', () => {
  it('crée un brouillon avec un slug unique dérivé du titre et journalise', async () => {
    const { prisma, audit, service } = construire(null, ['camp-d-ete'])
    const corps = SchemaCreationPublication.parse({ titre: "Camp d'été", contenu: 'Texte' })
    await service.creer(corps, 'u1')
    const data = prisma.publication.create.mock.calls[0][0].data
    expect(data.slug).toBe('camp-d-ete-2')
    expect(data.auteurId).toBe('u1')
    expect(data).not.toHaveProperty('statut')
    expect(audit.enregistrer).toHaveBeenCalledWith(expect.objectContaining({ action: 'PUBLICATION_CREEE' }))
  })

  it('refuse un slug invalide', async () => {
    const { service } = construire()
    const corps = SchemaCreationPublication.parse({ titre: 'Titre', contenu: 'x', slug: 'Pas Valide!' })
    await expect(service.creer(corps, 'u1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it("refuse de supprimer une publication en ligne", async () => {
    const { service } = construire({ id: 'p1', statut: 'PUBLIEE', titre: 'T', contenu: 'x' })
    await expect(service.supprimer('p1', 'u1')).rejects.toBeInstanceOf(ConflictException)
  })

  it('refuse de publier un contenu vide', async () => {
    const { service } = construire({ id: 'p1', statut: 'BROUILLON', titre: 'T', contenu: '   ' })
    await expect(service.publier('p1', undefined, 'u1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it("n'expose au public que les publications publiées dont la date est atteinte", async () => {
    const { prisma, service } = construire()
    await service.listerPubliques({})
    const where = prisma.publication.findMany.mock.calls[0][0].where
    expect(where.statut).toBe('PUBLIEE')
    expect(where.datePublication.lte).toBeInstanceOf(Date)
    await service.detailPublic('x').catch(() => undefined)
    expect(prisma.publication.findFirst.mock.calls[0][0].where.statut).toBe('PUBLIEE')
  })
})
