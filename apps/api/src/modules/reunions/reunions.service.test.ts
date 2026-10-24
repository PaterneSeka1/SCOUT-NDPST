import { ForbiddenException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// PrismaService simulé : aucun accès base.
vi.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }))

import { ReunionsService } from './reunions.service'
import type { UtilisateurSession } from '../../common/types'

function utilisateur(role: string): UtilisateurSession {
  return { id: 'u1', matricule: null, email: '', nom: 'Yao', prenom: 'Koffi', role, editeurContenu: false }
}

function construire() {
  const prisma = {
    jourReunion: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), update: vi.fn(), delete: vi.fn() },
    scout: { findMany: vi.fn().mockResolvedValue([]) },
    presenceReunion: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
    $transaction: vi.fn(),
  }
  const perimetre = { brancheUtilisateur: vi.fn().mockResolvedValue('LOUVETEAUX') }
  const audit = { enregistrer: vi.fn() }
  const service = new ReunionsService(prisma as never, perimetre as never, audit as never)
  return { prisma, perimetre, audit, service }
}

// Règle la plus sensible du domaine : un rôle de branche n'agit que sur les
// réunions de SA branche — ni une autre branche, ni une réunion inter-branches
// (brancheType null, qui relève du groupe).
describe('ReunionsService — accès par branche', () => {
  let ctx: ReturnType<typeof construire>
  beforeEach(() => {
    ctx = construire()
  })

  it("refuse la suppression d'une réunion d'une autre branche, sans supprimer ni journaliser", async () => {
    ctx.prisma.jourReunion.findFirst.mockResolvedValue({ id: 'r1', brancheType: 'ECLAIREURS', _count: { presences: 3 } })
    await expect(ctx.service.supprimer(utilisateur('RESPONSABLE_BRANCHE'), 'r1')).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(ctx.prisma.jourReunion.delete).not.toHaveBeenCalled()
    expect(ctx.audit.enregistrer).not.toHaveBeenCalled()
  })

  it("refuse à un rôle de branche la feuille de présences d'une réunion inter-branches", async () => {
    ctx.prisma.jourReunion.findFirst.mockResolvedValue({ id: 'r2', brancheType: null, statut: 'PLANIFIEE' })
    await expect(ctx.service.feuillePresences(utilisateur('ADJOINT_BRANCHE'), 'r2')).rejects.toThrow(
      'Accès refusé à cette réunion',
    )
  })

  it('refuse à un rôle de branche sans branche assignée', async () => {
    ctx.perimetre.brancheUtilisateur.mockResolvedValue(null)
    ctx.prisma.jourReunion.findFirst.mockResolvedValue({ id: 'r3', brancheType: 'LOUVETEAUX', statut: 'PLANIFIEE' })
    await expect(
      ctx.service.enregistrerPresences(utilisateur('RESPONSABLE_BRANCHE'), 'r3', { presences: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('interdit à un rôle de branche de déplacer sa réunion vers une autre branche', async () => {
    ctx.prisma.jourReunion.findFirst.mockResolvedValue({ id: 'r4', brancheType: 'LOUVETEAUX' })
    await expect(
      ctx.service.modifier(utilisateur('RESPONSABLE_BRANCHE'), 'r4', { brancheType: 'ECLAIREURS' }),
    ).rejects.toThrow('Le changement de branche est réservé au groupe')
    expect(ctx.prisma.jourReunion.update).not.toHaveBeenCalled()
  })

  it('le chef de groupe supprime toute réunion et la suppression est journalisée', async () => {
    ctx.prisma.jourReunion.findFirst.mockResolvedValue({
      id: 'r5',
      brancheType: null,
      titre: null,
      dateHeure: new Date('2026-10-10T09:00:00Z'),
      _count: { presences: 2 },
    })
    await expect(ctx.service.supprimer(utilisateur('CHEF_GROUPE'), 'r5')).resolves.toEqual({ ok: true })
    expect(ctx.prisma.jourReunion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r5' } }),
    )
    expect(ctx.audit.enregistrer).toHaveBeenCalledWith(expect.objectContaining({ action: 'REUNION_SUPPRIMEE' }))
  })

  it('liste : tableau historique sans pagination, objet paginé borné sinon', async () => {
    ctx.prisma.jourReunion.findMany.mockResolvedValue([{ id: 'r1' }])
    ctx.prisma.jourReunion.count.mockResolvedValue(1)
    await expect(ctx.service.lister(utilisateur('CHEF_GROUPE'), { branche: null, statut: null })).resolves.toEqual([
      { id: 'r1' },
    ])
    const pagine = await ctx.service.lister(utilisateur('CHEF_GROUPE'), {
      branche: null,
      statut: null,
      recherche: 'camp',
      page: '2',
      limite: '1000',
    })
    expect(pagine).toEqual({ reunions: [{ id: 'r1' }], pagination: { page: 2, limite: 100, total: 1, totalPages: 1 } })
    const appel = ctx.prisma.jourReunion.findMany.mock.calls[1][0]
    expect(appel).toMatchObject({ skip: 100, take: 100 })
    expect(appel.where.OR).toHaveLength(3)
  })

  it('liste : un rôle de branche reste limité à sa branche malgré ?branche=', async () => {
    await ctx.service.lister(utilisateur('RESPONSABLE_BRANCHE'), { branche: 'ECLAIREURS', statut: null })
    expect(ctx.prisma.jourReunion.findMany.mock.calls[0][0].where).toEqual({ brancheType: 'LOUVETEAUX' })
  })
})
