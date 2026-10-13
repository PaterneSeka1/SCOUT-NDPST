import { NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import type { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import type { PrismaService } from '../../prisma/prisma.service'
import { CotisationsService } from './cotisations.service'

const responsableBranche: UtilisateurSession = {
  id: 'u-branche',
  matricule: null,
  email: '',
  nom: 'N',
  prenom: 'P',
  role: 'RESPONSABLE_BRANCHE',
  roleDistrict: null,
  paroisseId: 'p1',
}

function construire(branche: string | null) {
  const prisma = {
    cotisation: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
  }
  const perimetre = { brancheUtilisateur: vi.fn().mockResolvedValue(branche) }
  const audit = { enregistrer: vi.fn() }
  const service = new CotisationsService(
    prisma as unknown as PrismaService,
    perimetre as unknown as PerimetreService,
    audit as unknown as AuditService,
  )
  return { service, prisma }
}

describe('CotisationsService — périmètre de branche', () => {
  it("un responsable de branche ne peut pas enregistrer le paiement d'un scout d'une autre branche", async () => {
    const { service, prisma } = construire('LOUVETEAUX')

    await expect(service.modifier(responsableBranche, 'c1', { statut: 'PAYEE' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    // La recherche est restreinte à la paroisse ET à la branche de l'utilisateur.
    expect(prisma.cotisation.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'c1',
        paroisseId: 'p1',
        scout: { brancheType: 'LOUVETEAUX' },
      },
    })
    expect(prisma.cotisation.update).not.toHaveBeenCalled()
  })

  it('un responsable de branche sans branche assignée ne voit aucune cotisation', async () => {
    const { service, prisma } = construire(null)
    await expect(service.modifier(responsableBranche, 'c1', { statut: 'PAYEE' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    await expect(service.lister(responsableBranche, { branche: 'ECLAIREURS' })).resolves.toEqual({ cotisations: [] })
    expect(prisma.cotisation.findMany).not.toHaveBeenCalled()
  })

  it('la branche demandée par le client est ignorée pour un responsable de branche', async () => {
    const { service, prisma } = construire('LOUVETEAUX')
    await service.lister(responsableBranche, {
      branche: 'ECLAIREURS',
      anneeScolaire: '2025-2026',
    })
    expect(prisma.cotisation.findMany.mock.calls[0][0].where).toEqual({
      paroisseId: 'p1',
      anneeScolaire: '2025-2026',
      scout: { brancheType: 'LOUVETEAUX' },
    })
  })
})
