import { ForbiddenException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import type { PrismaService } from '../../prisma/prisma.service'
import type { CorpsCreationProgramme } from './programmes.schemas'
import { ProgrammesService } from './programmes.service'

function utilisateur(role: string): UtilisateurSession {
  return {
    id: 'u1',
    matricule: null,
    email: '',
    nom: 'N',
    prenom: 'P',
    role,
    editeurContenu: false,
  }
}

function construire() {
  const prisma = {
    programme: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'prog', ...data })),
      findFirst: vi.fn().mockResolvedValue({ id: 'prog', brancheType: null }),
      delete: vi.fn(),
    },
  }
  const perimetre = {
    brancheUtilisateur: vi.fn().mockResolvedValue('LOUVETEAUX'),
  }
  const service = new ProgrammesService(prisma as unknown as PrismaService, perimetre as unknown as PerimetreService)
  return { service, prisma }
}

// Corps tel que transmis par le contrôleur après validation (SchemaCreationProgramme).
const corpsValide: CorpsCreationProgramme = {
  titre: 'T',
  periodeDebut: new Date('2026-01-01'),
  periodeFin: new Date('2026-06-30'),
  brancheType: 'COMPAGNONS',
}

describe('ProgrammesService — création et périmètre', () => {
  it('refuse un compte sans rôle de gestion', async () => {
    const { service, prisma } = construire()
    await expect(service.creer(utilisateur('PARENT'), corpsValide)).rejects.toBeInstanceOf(ForbiddenException)
    await expect(service.creer(utilisateur('ADMINISTRATEUR'), corpsValide)).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.programme.create).not.toHaveBeenCalled()
  })

  it('le groupe choisit la branche (ou aucune) et aucun paroisseId n’est écrit', async () => {
    const { service, prisma } = construire()
    await service.creer(utilisateur('CHEF_GROUPE'), corpsValide)
    const data = prisma.programme.create.mock.calls[0][0].data
    expect(data).toMatchObject({ brancheType: 'COMPAGNONS', creePar: 'u1' })
    expect(data).not.toHaveProperty('paroisseId')
  })

  it('force la branche du responsable de branche', async () => {
    const { service, prisma } = construire()
    await service.creer(utilisateur('RESPONSABLE_BRANCHE'), corpsValide)
    expect(prisma.programme.create.mock.calls[0][0].data).toMatchObject({ brancheType: 'LOUVETEAUX' })
  })

  it('un responsable de branche ne peut pas supprimer un programme du groupe', async () => {
    const { service, prisma } = construire()
    await expect(service.supprimer(utilisateur('RESPONSABLE_BRANCHE'), 'prog')).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(prisma.programme.delete).not.toHaveBeenCalled()
  })
})
