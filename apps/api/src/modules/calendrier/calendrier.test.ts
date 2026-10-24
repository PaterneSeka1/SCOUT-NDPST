import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { CalendrierService } from './calendrier.service'
import type { PerimetreService } from '../../common/perimetre.service'
import type { PrismaService } from '../../prisma/prisma.service'

describe('CalendrierService.fluxIcs', () => {
  const findUnique = vi.fn()
  const prisma = { utilisateur: { findUnique } } as unknown as PrismaService
  const service = new CalendrierService(prisma, {} as PerimetreService)

  it('refuse une requête sans jeton', async () => {
    await expect(service.fluxIcs(undefined, '10.0.0.1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('refuse un jeton inconnu ou un compte désactivé', async () => {
    findUnique.mockResolvedValueOnce(null)
    await expect(service.fluxIcs('jeton-inconnu', '10.0.0.2')).rejects.toBeInstanceOf(NotFoundException)
    findUnique.mockResolvedValueOnce({ id: 'u1', prenom: 'A', nom: 'B', role: 'CHEF_GROUPE', actif: false })
    await expect(service.fluxIcs('jeton-inactif', '10.0.0.2')).rejects.toBeInstanceOf(NotFoundException)
  })

  it("refuse le jeton d'un compte qui n'appartient plus à la maîtrise", async () => {
    findUnique.mockResolvedValueOnce({ id: 'u2', prenom: 'A', nom: 'B', role: 'PARENT', actif: true })
    await expect(service.fluxIcs('jeton-parent', '10.0.0.4')).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('limite le débit par IP (30 requêtes par 15 minutes)', async () => {
    findUnique.mockResolvedValue(null)
    for (let i = 0; i < 30; i++) {
      await expect(service.fluxIcs('x', '10.0.0.3')).rejects.toBeInstanceOf(NotFoundException)
    }
    await expect(service.fluxIcs('x', '10.0.0.3')).rejects.toMatchObject({ status: 429 })
  })
})
