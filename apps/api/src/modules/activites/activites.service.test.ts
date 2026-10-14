import { ForbiddenException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// PrismaService simulé : aucun accès base (évite aussi le chargement de la
// configuration d'environnement par le vrai service).
vi.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }))

import { ActivitesService } from './activites.service'
import type { UtilisateurSession } from '../../common/types'

const responsableLouveteaux: UtilisateurSession = {
  id: 'u-branche',
  matricule: null,
  email: '',
  nom: 'Kouassi',
  prenom: 'Awa',
  role: 'RESPONSABLE_BRANCHE',
  roleDistrict: null,
  paroisseId: 'p1',
}

function construire() {
  const prisma = {
    activite: { findFirst: vi.fn() },
    autorisationCamp: { findMany: vi.fn().mockResolvedValue([]) },
    presence: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
    scout: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(),
  }
  const perimetre = { brancheUtilisateur: vi.fn().mockResolvedValue('LOUVETEAUX') }
  const fichiers = { verifierRattachable: vi.fn() }
  const service = new ActivitesService(prisma as never, perimetre as never, fichiers as never)
  return { prisma, perimetre, service }
}

// Règle la plus sensible du domaine : un responsable de branche ne lit ni
// n'écrit les présences d'une activité d'une AUTRE branche de sa paroisse.
describe('ActivitesService — cloisonnement des présences par branche', () => {
  let ctx: ReturnType<typeof construire>
  beforeEach(() => {
    ctx = construire()
  })

  it("refuse la lecture des présences d'une activité d'une autre branche", async () => {
    ctx.prisma.activite.findFirst.mockResolvedValue({
      id: 'a1',
      paroisseId: 'p1',
      brancheType: 'ECLAIREURS',
      type: 'SORTIE',
    })
    await expect(ctx.service.listerPresences(responsableLouveteaux, 'a1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(ctx.prisma.presence.findMany).not.toHaveBeenCalled()
  })

  it("refuse l'enregistrement des présences d'une activité d'une autre branche", async () => {
    ctx.prisma.activite.findFirst.mockResolvedValue({
      id: 'a1',
      paroisseId: 'p1',
      brancheType: 'ECLAIREURS',
      type: 'SORTIE',
    })
    await expect(
      ctx.service.enregistrerPresences(responsableLouveteaux, 'a1', { presences: [{ scoutId: 's1', present: true }] }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled()
  })

  it("filtre toujours l'activité sur la paroisse de l'utilisateur", async () => {
    ctx.prisma.activite.findFirst.mockResolvedValue(null)
    await expect(ctx.service.listerPresences(responsableLouveteaux, 'a-autre')).rejects.toThrow('Activité introuvable')
    expect(ctx.prisma.activite.findFirst).toHaveBeenCalledWith({ where: { id: 'a-autre', paroisseId: 'p1' } })
  })

  it('autorise une activité inter-branches (brancheType null)', async () => {
    ctx.prisma.activite.findFirst.mockResolvedValue({ id: 'a2', paroisseId: 'p1', brancheType: null, type: 'SORTIE' })
    await expect(ctx.service.listerPresences(responsableLouveteaux, 'a2')).resolves.toEqual([])
  })

  it("rejette le pointage d'un scout hors de la branche de l'activité", async () => {
    ctx.prisma.activite.findFirst.mockResolvedValue({
      id: 'a3',
      paroisseId: 'p1',
      brancheType: 'LOUVETEAUX',
      type: 'SORTIE',
    })
    ctx.prisma.scout.findMany.mockResolvedValue([{ id: 's1' }])
    await expect(
      ctx.service.enregistrerPresences(responsableLouveteaux, 'a3', {
        presences: [
          { scoutId: 's1', present: true },
          { scoutId: 's-intrus', present: true },
        ],
      }),
    ).rejects.toThrow('Certains scouts ne font pas partie de cette activité')
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled()
  })
})
