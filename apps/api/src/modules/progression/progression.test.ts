import { ConflictException, ForbiddenException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import type { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import type { PrismaService } from '../../prisma/prisma.service'
import { SchemaEtape } from './progression.schemas'
import { ProgressionService } from './progression.service'

const u = (role: string): UtilisateurSession => ({ id: 'u1', matricule: null, email: '', nom: 'N', prenom: 'P', role, editeurContenu: false })

function construire(branche: string | null, etape: Record<string, unknown> | null = null) {
  const prisma = {
    badge: {
      create: vi.fn(async ({ data }: { data: unknown }) => ({ id: 'b1', ...(data as object) })),
      findUnique: vi.fn().mockResolvedValue(etape),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    },
  }
  const service = new ProgressionService(
    prisma as unknown as PrismaService,
    { enregistrer: vi.fn() } as unknown as AuditService,
    { brancheUtilisateur: vi.fn().mockResolvedValue(branche) } as unknown as PerimetreService,
  )
  return { prisma, service }
}

describe('Référentiel pédagogique', () => {
  it('le Chef de Groupe et le responsable de LA branche peuvent saisir une étape', async () => {
    await expect(construire(null).service.creer(u('CHEF_GROUPE'), SchemaEtape.parse({ brancheType: 'LOUVETEAUX', nom: 'Étape 1' }))).resolves.toBeTruthy()
    await expect(construire('LOUVETEAUX').service.creer(u('RESPONSABLE_BRANCHE'), SchemaEtape.parse({ brancheType: 'LOUVETEAUX', nom: 'Étape 1' }))).resolves.toBeTruthy()
  })

  it("refuse l'encadrement d'une autre branche et les assistants", async () => {
    await expect(construire('ECLAIREURS').service.creer(u('RESPONSABLE_BRANCHE'), SchemaEtape.parse({ brancheType: 'LOUVETEAUX', nom: 'x' }))).rejects.toBeInstanceOf(ForbiddenException)
    await expect(construire('LOUVETEAUX').service.creer(u('ASSISTANT_BRANCHE'), SchemaEtape.parse({ brancheType: 'LOUVETEAUX', nom: 'x' }))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('conserve une étape déjà validée pour des scouts', async () => {
    const { service, prisma } = construire(null, { id: 'b1', brancheType: 'LOUVETEAUX', _count: { progressions: 2 } })
    await expect(service.supprimer(u('CHEF_GROUPE'), 'b1')).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.badge.delete).not.toHaveBeenCalled()
  })

  it("limite la lecture à la branche de l'encadrement de branche", async () => {
    const { service, prisma } = construire('CHEMINOTS')
    await service.referentiel(u('ASSISTANT_BRANCHE'))
    expect(prisma.badge.findMany.mock.calls[0][0].where).toEqual({ brancheType: { in: ['CHEMINOTS'] } })
  })
})
