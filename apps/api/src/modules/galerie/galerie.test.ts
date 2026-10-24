import { BadRequestException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { nomFichierPriveGenere, type AccesFichiersService } from '../../common/acces-fichiers.service'
import type { AuditService } from '../../common/audit.service'
import type { PrismaService } from '../../prisma/prisma.service'
import { SchemaAjoutMedia, SchemaModificationMedia } from './galerie.schemas'
import { GalerieService } from './galerie.service'

function construire(media: Record<string, unknown> | null = null) {
  const prisma = {
    album: { findUnique: vi.fn().mockResolvedValue({ id: 'a1', medias: [] }) },
    media: {
      findUnique: vi.fn().mockResolvedValue(media),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...media, ...data })),
    },
  }
  const service = new GalerieService(
    prisma as unknown as PrismaService,
    { enregistrer: vi.fn() } as unknown as AuditService,
    { supprimerSiOrphelin: vi.fn() } as unknown as AccesFichiersService,
  )
  return { prisma, service }
}

const photo = { id: 'm1', albumId: 'a1', publie: false, contientMineurs: true, consentementVerifie: false }

describe('GalerieService — consentements à l’image', () => {
  it('refuse de publier une photo de mineurs sans consentement vérifié', async () => {
    const { prisma, service } = construire(photo)
    await expect(service.modifierMedia('m1', SchemaModificationMedia.parse({ publie: true }), 'u1')).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.media.update).not.toHaveBeenCalled()
  })

  it('publie une photo de mineurs une fois le consentement vérifié', async () => {
    const { service } = construire(photo)
    await expect(service.modifierMedia('m1', SchemaModificationMedia.parse({ publie: true, consentementVerifie: true }), 'u1')).resolves.toMatchObject({
      publie: true,
    })
  })

  it("ajoute toujours une photo non publiée, et seulement depuis les téléversements galerie de l'utilisateur", async () => {
    const { prisma, service } = construire()
    const url = `/api/fichiers/galerie/${nomFichierPriveGenere('u1', 'jpg')}`
    await service.ajouterMedia('a1', SchemaAjoutMedia.parse({ url, contientMineurs: true, consentementVerifie: true }), 'u1')
    expect(prisma.media.create.mock.calls[0][0].data.publie).toBe(false)

    await expect(
      service.ajouterMedia('a1', SchemaAjoutMedia.parse({ url: `/api/fichiers/groupe/${nomFichierPriveGenere('u1', 'jpg')}` }), 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.ajouterMedia('a1', SchemaAjoutMedia.parse({ url, contientMineurs: true, consentementVerifie: false }), 'u2')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('ne sert au public que les photos visibles (filtre relu en base)', async () => {
    const { prisma, service } = construire()
    await expect(service.fichierPublic('m1')).rejects.toBeInstanceOf(NotFoundException)
    const where = prisma.media.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ id: 'm1', publie: true, album: { publie: true } })
    expect(where.OR).toEqual([{ contientMineurs: false }, { consentementVerifie: true }])
  })
})
