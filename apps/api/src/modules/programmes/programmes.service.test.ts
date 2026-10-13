import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import type { PrismaService } from '../../prisma/prisma.service'
import { ProgrammesService } from './programmes.service'

function utilisateur(role: string, roleDistrict: string | null = null): UtilisateurSession {
  return {
    id: 'u1',
    matricule: null,
    email: '',
    nom: 'N',
    prenom: 'P',
    role,
    roleDistrict,
    paroisseId: 'p1',
  }
}

function construire() {
  const prisma = {
    programme: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'prog', ...data })),
      findFirst: vi.fn().mockResolvedValue({ id: 'prog', paroisseId: 'p1', brancheType: null }),
      delete: vi.fn(),
    },
  }
  const perimetre = {
    brancheUtilisateur: vi.fn().mockResolvedValue('LOUVETEAUX'),
    brancheDistrictUtilisateur: vi.fn().mockResolvedValue('ECLAIREURS'),
    paroissesDuDistrict: vi.fn().mockResolvedValue({
      districtId: 'd1',
      nomDistrict: 'District',
      paroisses: [
        { id: 'p1', nom: 'A', ville: 'V', actif: true },
        { id: 'p2', nom: 'B', ville: 'V', actif: true },
      ],
    }),
  }
  const service = new ProgrammesService(prisma as unknown as PrismaService, perimetre as unknown as PerimetreService)
  return { service, prisma }
}

const corpsValide = {
  titre: 'T',
  periodeDebut: '2026-01-01',
  periodeFin: '2026-06-30',
  brancheType: 'COMPAGNONS',
}

describe('ProgrammesService — création et périmètre', () => {
  it('refuse un compte sans rôle de gestion ni affectation district', async () => {
    const { service, prisma } = construire()
    await expect(service.creer(utilisateur('PARENT'), corpsValide)).rejects.toBeInstanceOf(ForbiddenException)
    await expect(service.creer(utilisateur('PARENT', 'ASSISTANT_DISTRICT'), corpsValide)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(prisma.programme.create).not.toHaveBeenCalled()
  })

  it('refuse à un assistant de district une paroisse hors de son district', async () => {
    const { service, prisma } = construire()
    await expect(
      service.creer(utilisateur('PARENT', 'ASSISTANT_DISTRICT'), {
        ...corpsValide,
        paroisseId: 'p-autre',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.programme.create).not.toHaveBeenCalled()
  })

  it("force la branche de district de l'assistant, quelle que soit la branche envoyée", async () => {
    const { service, prisma } = construire()
    await service.creer(utilisateur('PARENT', 'ASSISTANT_DISTRICT'), {
      ...corpsValide,
      paroisseId: 'p2',
    })
    expect(prisma.programme.create.mock.calls[0][0].data).toMatchObject({
      paroisseId: 'p2',
      brancheType: 'ECLAIREURS',
    })
  })

  it('force la branche du responsable de branche', async () => {
    const { service, prisma } = construire()
    await service.creer(utilisateur('RESPONSABLE_BRANCHE'), corpsValide)
    expect(prisma.programme.create.mock.calls[0][0].data).toMatchObject({
      paroisseId: 'p1',
      brancheType: 'LOUVETEAUX',
    })
  })

  it('un responsable de branche ne peut pas supprimer un programme du groupe', async () => {
    const { service, prisma } = construire()
    await expect(service.supprimer(utilisateur('RESPONSABLE_BRANCHE'), 'prog')).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(prisma.programme.delete).not.toHaveBeenCalled()
  })
})
