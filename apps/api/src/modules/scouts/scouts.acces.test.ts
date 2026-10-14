import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccesFichiersService } from '../../common/acces-fichiers.service'
import { AuditService } from '../../common/audit.service'
import { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import type { PrismaService } from '../../prisma/prisma.service'
import { AccesScoutsService } from './acces-scouts.service'
import { FicheScoutService } from './fiche-scout.service'
import { ScoutsService } from './scouts.service'

// Règle la plus sensible du domaine : un responsable de branche ne voit et ne
// gère QUE les scouts de sa propre branche, quelle que soit la branche demandée
// par le client, et un compte de branche sans branche assignée ne voit rien.

function utilisateur(role: string): UtilisateurSession {
  return {
    id: 'u1',
    matricule: null,
    email: 'u1@exemple.ci',
    nom: 'Kouassi',
    prenom: 'Awa',
    role,
    roleDistrict: null,
    paroisseId: 'p1',
  }
}

function prismaSimule(brancheUtilisateur: string | null) {
  return {
    utilisateur: { findUnique: vi.fn().mockResolvedValue({ brancheType: brancheUtilisateur }) },
    scout: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    contactUrgence: { count: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  }
}

function services(prisma: ReturnType<typeof prismaSimule>) {
  const p = prisma as unknown as PrismaService
  const audit = { enregistrer: vi.fn() } as unknown as AuditService
  const acces = new AccesScoutsService(p, new PerimetreService(p))
  const fichiers = new AccesFichiersService(p, new PerimetreService(p))
  return {
    scouts: new ScoutsService(p, audit, acces, fichiers),
    fiche: new FicheScoutService(p, audit, acces, fichiers),
  }
}

const filtres = { page: null, limite: null, recherche: null, actif: null }

describe('Cloisonnement par branche des scouts', () => {
  let prisma: ReturnType<typeof prismaSimule>

  beforeEach(() => {
    prisma = prismaSimule('LOUVETEAUX')
  })

  it('force la branche du responsable même si le client en demande une autre', async () => {
    const { scouts } = services(prisma)
    await scouts.lister(utilisateur('RESPONSABLE_BRANCHE'), { ...filtres, branche: 'ECLAIREURS' })

    const where = prisma.scout.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ paroisseId: 'p1', brancheType: 'LOUVETEAUX' })
    expect(prisma.scout.count.mock.calls[0][0].where.brancheType).toBe('LOUVETEAUX')
  })

  it('ne renvoie rien à un rôle de branche sans branche assignée (jamais toute la paroisse)', async () => {
    prisma = prismaSimule(null)
    const { scouts } = services(prisma)
    const resultat = await scouts.lister(utilisateur('ADJOINT_BRANCHE'), { ...filtres, branche: null })

    expect(resultat).toEqual({ scouts: [], total: 0, page: 1, totalPages: 0 })
    expect(prisma.scout.findMany).not.toHaveBeenCalled()
  })

  it('laisse un chef de groupe filtrer librement, toujours limité à sa paroisse', async () => {
    const { scouts } = services(prisma)
    await scouts.lister(utilisateur('CHEF_GROUPE'), { ...filtres, branche: 'ECLAIREURS' })

    expect(prisma.scout.findMany.mock.calls[0][0].where).toMatchObject({ paroisseId: 'p1', brancheType: 'ECLAIREURS' })
    expect(prisma.utilisateur.findUnique).not.toHaveBeenCalled()
  })

  it("répond 404 sur la fiche d'un scout d'une autre branche", async () => {
    const { scouts } = services(prisma)
    await expect(scouts.detail(utilisateur('ASSISTANT_BRANCHE'), 's-autre')).rejects.toBeInstanceOf(NotFoundException)

    expect(prisma.scout.findFirst.mock.calls[0][0].where).toEqual({
      id: 's-autre',
      paroisseId: 'p1',
      brancheType: 'LOUVETEAUX',
    })
  })

  it("refuse la suppression d'un contact d'urgence hors branche sans toucher aux contacts", async () => {
    const { fiche } = services(prisma)
    await expect(fiche.supprimerContact(utilisateur('RESPONSABLE_BRANCHE'), 's-autre', 'c1')).rejects.toThrow(
      'Scout introuvable',
    )
    expect(prisma.contactUrgence.delete).not.toHaveBeenCalled()
  })
})
