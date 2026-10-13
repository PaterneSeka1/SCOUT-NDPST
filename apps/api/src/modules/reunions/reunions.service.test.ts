import { ForbiddenException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// PrismaService simulé : aucun accès base.
vi.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }))

import { ReunionsService } from './reunions.service'
import type { UtilisateurSession } from '../../common/types'

function utilisateur(role: string): UtilisateurSession {
  return { id: 'u1', matricule: null, email: '', nom: 'Yao', prenom: 'Koffi', role, roleDistrict: null, paroisseId: 'p1' }
}

function construire() {
  const prisma = {
    jourReunion: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
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

  it('le chef de groupe supprime toute réunion de sa paroisse et la suppression est journalisée', async () => {
    ctx.prisma.jourReunion.findFirst.mockResolvedValue({
      id: 'r5',
      brancheType: null,
      titre: null,
      dateHeure: new Date('2026-10-10T09:00:00Z'),
      _count: { presences: 2 },
    })
    await expect(ctx.service.supprimer(utilisateur('CHEF_GROUPE'), 'r5')).resolves.toEqual({ ok: true })
    expect(ctx.prisma.jourReunion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r5', paroisseId: 'p1' } }),
    )
    expect(ctx.audit.enregistrer).toHaveBeenCalledWith(expect.objectContaining({ action: 'REUNION_SUPPRIMEE' }))
  })
})
