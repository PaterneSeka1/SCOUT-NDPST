import { ConflictException, ForbiddenException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// PrismaService simulé : aucun accès base.
vi.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }))

import { Prisma } from '../../generated/prisma/client'
import type { UtilisateurSession } from '../../common/types'
import { EquipesService } from './equipes.service'
import { SchemaCreationEquipe, SchemaModificationEquipe } from './scouts.schemas'

function utilisateur(role: string): UtilisateurSession {
  return { id: 'u1', matricule: null, email: '', nom: 'Yao', prenom: 'Koffi', role, editeurContenu: false }
}

function construire(brancheUtilisateur: string | null = 'LOUVETEAUX') {
  const prisma = {
    equipe: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn((args: { data: Record<string, unknown> }) => ({ id: 'e-new', ...args.data })),
      update: vi.fn((args: { data: Record<string, unknown> }) => ({ id: 'e1', ...args.data })),
    },
  }
  const audit = { enregistrer: vi.fn() }
  const acces = {
    estRoleBranche: (u: UtilisateurSession) => u.role.endsWith('_BRANCHE'),
    brancheImposee: vi.fn(async (u: UtilisateurSession) =>
      u.role.endsWith('_BRANCHE') ? brancheUtilisateur : undefined,
    ),
  }
  const service = new EquipesService(prisma as never, audit as never, acces as never)
  return { prisma, audit, acces, service }
}

describe('EquipesService', () => {
  let ctx: ReturnType<typeof construire>
  beforeEach(() => {
    ctx = construire()
  })

  it("limite la lecture de l'encadrement de branche à sa branche", async () => {
    await ctx.service.lister(utilisateur('ASSISTANT_BRANCHE'), { brancheType: 'ECLAIREURS', actif: null })
    expect(ctx.prisma.equipe.findMany.mock.calls[0][0].where).toEqual({ brancheType: 'LOUVETEAUX' })
  })

  it('laisse le groupe filtrer par branche et activité', async () => {
    await ctx.service.lister(utilisateur('ADJOINT_GROUPE'), { brancheType: 'ECLAIREURS', actif: 'true' })
    expect(ctx.prisma.equipe.findMany.mock.calls[0][0].where).toEqual({ brancheType: 'ECLAIREURS', actif: true })
    await expect(
      ctx.service.lister(utilisateur('CHEF_GROUPE'), { brancheType: 'MOUSSES', actif: null }),
    ).rejects.toThrow('Branche invalide')
  })

  it('le chef de groupe crée une équipe dans toute branche (journalisé)', async () => {
    const corps = SchemaCreationEquipe.parse({ nom: ' Panthères ', brancheType: 'ECLAIREURS' })
    await expect(ctx.service.creer(utilisateur('CHEF_GROUPE'), corps)).resolves.toMatchObject({ nom: 'Panthères' })
    expect(ctx.audit.enregistrer).toHaveBeenCalledWith(expect.objectContaining({ action: 'EQUIPE_CREEE' }))
  })

  it("refuse au responsable d'une autre branche, et à l'assistant de branche", async () => {
    const corps = SchemaCreationEquipe.parse({ nom: 'Aigles', brancheType: 'ECLAIREURS' })
    await expect(ctx.service.creer(utilisateur('RESPONSABLE_BRANCHE'), corps)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    await expect(
      ctx.service.creer(utilisateur('ASSISTANT_BRANCHE'), { ...corps, brancheType: 'LOUVETEAUX' }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(ctx.prisma.equipe.create).not.toHaveBeenCalled()
  })

  it("autorise le responsable ou l'adjoint de LA branche", async () => {
    const corps = SchemaCreationEquipe.parse({ nom: 'Loups gris', brancheType: 'LOUVETEAUX' })
    await ctx.service.creer(utilisateur('ADJOINT_BRANCHE'), corps)
    expect(ctx.prisma.equipe.create).toHaveBeenCalled()
  })

  it('409 sur un nom déjà pris dans la branche (pré-contrôle et contrainte unique)', async () => {
    const corps = SchemaCreationEquipe.parse({ nom: 'Aigles', brancheType: 'ECLAIREURS' })
    ctx.prisma.equipe.findFirst.mockResolvedValueOnce({ id: 'e0' })
    await expect(ctx.service.creer(utilisateur('CHEF_GROUPE'), corps)).rejects.toBeInstanceOf(ConflictException)

    ctx.prisma.equipe.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }),
    )
    await expect(ctx.service.creer(utilisateur('CHEF_GROUPE'), corps)).rejects.toBeInstanceOf(ConflictException)
  })

  it("modification : branche de l'équipe existante vérifiée, 404 si inconnue", async () => {
    await expect(
      ctx.service.modifier(utilisateur('CHEF_GROUPE'), 'e-x', SchemaModificationEquipe.parse({ actif: false })),
    ).rejects.toThrow('Équipe introuvable')

    ctx.prisma.equipe.findUnique.mockResolvedValue({ id: 'e1', brancheType: 'ECLAIREURS', nom: 'Aigles' })
    await expect(
      ctx.service.modifier(
        utilisateur('RESPONSABLE_BRANCHE'),
        'e1',
        SchemaModificationEquipe.parse({ nom: 'Faucons' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(ctx.prisma.equipe.update).not.toHaveBeenCalled()

    await ctx.service.modifier(utilisateur('CHEF_GROUPE'), 'e1', SchemaModificationEquipe.parse({ nom: 'Faucons' }))
    expect(ctx.prisma.equipe.findFirst.mock.calls[0][0].where).toMatchObject({
      brancheType: 'ECLAIREURS',
      id: { not: 'e1' },
    })
    expect(ctx.prisma.equipe.update.mock.calls[0][0].data).toEqual({ nom: 'Faucons' })
  })

  it('schémas : nom requis, branche valide, description effaçable', () => {
    expect(SchemaCreationEquipe.safeParse({ nom: ' ', brancheType: 'ECLAIREURS' }).success).toBe(false)
    expect(SchemaCreationEquipe.safeParse({ nom: 'A', brancheType: 'X' }).success).toBe(false)
    expect(SchemaModificationEquipe.parse({ description: '' })).toEqual({ description: null })
  })
})
