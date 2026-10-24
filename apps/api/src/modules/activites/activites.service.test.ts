import { BadRequestException, ForbiddenException } from '@nestjs/common'
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
  editeurContenu: false,
}

const chefGroupe: UtilisateurSession = { ...responsableLouveteaux, id: 'u-chef', role: 'CHEF_GROUPE' }

function construire() {
  const prisma = {
    activite: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
    },
    utilisateur: { findFirst: vi.fn() },
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
      brancheType: 'ECLAIREURS',
      type: 'SORTIE',
    })
    await expect(ctx.service.listerPresences(responsableLouveteaux, 'a1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(ctx.prisma.presence.findMany).not.toHaveBeenCalled()
  })

  it("refuse l'enregistrement des présences d'une activité d'une autre branche", async () => {
    ctx.prisma.activite.findFirst.mockResolvedValue({
      id: 'a1',
      brancheType: 'ECLAIREURS',
      type: 'SORTIE',
    })
    await expect(
      ctx.service.enregistrerPresences(responsableLouveteaux, 'a1', { presences: [{ scoutId: 's1', present: true }] }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('renvoie 404 pour une activité inexistante, sans filtre de paroisse', async () => {
    ctx.prisma.activite.findFirst.mockResolvedValue(null)
    await expect(ctx.service.listerPresences(responsableLouveteaux, 'a-autre')).rejects.toThrow('Activité introuvable')
    expect(ctx.prisma.activite.findFirst).toHaveBeenCalledWith({ where: { id: 'a-autre' } })
  })

  it('autorise une activité inter-branches (brancheType null)', async () => {
    ctx.prisma.activite.findFirst.mockResolvedValue({ id: 'a2', brancheType: null, type: 'SORTIE' })
    await expect(ctx.service.listerPresences(responsableLouveteaux, 'a2')).resolves.toEqual([])
  })

  it("rejette le pointage d'un scout hors de la branche de l'activité", async () => {
    ctx.prisma.activite.findFirst.mockResolvedValue({
      id: 'a3',
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

const BASE_CREATION = { titre: 'Sortie', dateDebut: new Date('2026-11-01T09:00:00Z'), dateFin: null }

describe('ActivitesService — suivi, publication et responsable', () => {
  let ctx: ReturnType<typeof construire>
  beforeEach(() => {
    ctx = construire()
  })

  it("crée une activité jamais publique par défaut, statut PREVUE, branche forcée pour l'encadrement", async () => {
    await ctx.service.creer(responsableLouveteaux, { ...BASE_CREATION, brancheType: 'ECLAIREURS' })
    const data = ctx.prisma.activite.create.mock.calls[0][0].data
    expect(data).toMatchObject({ publique: false, statut: 'PREVUE', brancheType: 'LOUVETEAUX', responsableId: null })
    expect(data).not.toHaveProperty('paroisseId')
  })

  it('refuse un responsable qui n’est pas un compte actif de la maîtrise', async () => {
    ctx.prisma.utilisateur.findFirst.mockResolvedValue(null)
    await expect(ctx.service.creer(chefGroupe, { ...BASE_CREATION, responsableId: 'u-parent' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(ctx.prisma.utilisateur.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'u-parent',
          actif: true,
          role: { in: expect.arrayContaining(['CHEF_GROUPE']) },
        }),
      }),
    )
    expect(ctx.prisma.activite.create).not.toHaveBeenCalled()
  })

  it('accepte un responsable valide et les champs de suivi', async () => {
    ctx.prisma.utilisateur.findFirst.mockResolvedValue({ id: 'u-resp' })
    await ctx.service.creer(chefGroupe, {
      ...BASE_CREATION,
      responsableId: 'u-resp',
      statut: 'EN_COURS',
      bilan: 'RAS',
      publique: true,
      descriptionPublique: 'Sortie ouverte',
    })
    expect(ctx.prisma.activite.create.mock.calls[0][0].data).toMatchObject({
      responsableId: 'u-resp',
      statut: 'EN_COURS',
      bilan: 'RAS',
      publique: true,
      descriptionPublique: 'Sortie ouverte',
    })
  })

  it('refuse un rôle hors maîtrise à la création', async () => {
    await expect(ctx.service.creer({ ...chefGroupe, role: 'PARENT' }, BASE_CREATION)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('refuse de publier une activité sans description publique', async () => {
    ctx.prisma.activite.findFirst.mockResolvedValue({
      id: 'a1',
      brancheType: null,
      dateDebut: new Date('2026-11-01'),
      dateFin: null,
      publique: false,
      descriptionPublique: null,
    })
    await expect(ctx.service.modifier(chefGroupe, 'a1', { publique: true })).rejects.toThrow(
      'Une description publique est requise',
    )
    expect(ctx.prisma.activite.update).not.toHaveBeenCalled()
  })

  it('modifie statut et bilan sans toucher à la publication', async () => {
    ctx.prisma.activite.findFirst.mockResolvedValue({
      id: 'a1',
      brancheType: null,
      dateDebut: new Date('2026-11-01'),
      dateFin: null,
      publique: false,
      descriptionPublique: null,
    })
    await ctx.service.modifier(chefGroupe, 'a1', { statut: 'TERMINEE', bilan: 'Bon bilan' })
    const data = ctx.prisma.activite.update.mock.calls[0][0].data
    expect(data).toEqual({ statut: 'TERMINEE', bilan: 'Bon bilan' })
  })

  it('filtre la liste par statut et rejette un statut invalide', async () => {
    await ctx.service.lister(chefGroupe, {
      page: null,
      limite: null,
      recherche: null,
      type: null,
      statut: 'ANNULEE',
      brancheType: null,
      aVenir: null,
    })
    expect(ctx.prisma.activite.findMany.mock.calls[0][0].where).toEqual({ AND: [{ statut: 'ANNULEE' }] })
    await expect(
      ctx.service.lister(chefGroupe, {
        page: null,
        limite: null,
        recherche: null,
        type: null,
        statut: 'FAUX',
        brancheType: null,
        aVenir: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
