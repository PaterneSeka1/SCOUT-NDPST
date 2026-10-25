import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import type { UtilisateurSession } from '../../common/types'
import type { PrismaService } from '../../prisma/prisma.service'
import { PassageBrancheService } from './passage-branche.service'

function construire() {
  const prisma = {
    scout: { findMany: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockResolvedValue([]),
  }
  const audit = { enregistrer: vi.fn().mockResolvedValue(undefined) }
  const service = new PassageBrancheService(prisma as unknown as PrismaService, audit as unknown as AuditService)
  return { prisma, audit, service }
}

const acteur = { id: 'responsable-groupe' } as UtilisateurSession

describe('Passage de branche — ressources adultes', () => {
  it('propose la catégorie adulte à 21 ans sans désactiver le scout', async () => {
    const { prisma, service } = construire()
    prisma.scout.findMany.mockResolvedValue([
      { id: 's1', nom: 'Scout', prenom: 'Adulte', matricule: null, dateNaissance: new Date(2005, 9, 25), brancheType: 'COMPAGNONS' },
    ])
    const resultat = await service.previsualiser('2026-10-25')
    expect(resultat.propositions).toMatchObject([{ scoutId: 's1', age: 21, brancheProposee: 'RESSOURCES_ADULTES' }])
    expect(prisma.scout.findMany.mock.calls[0][0].where.OR).toEqual([
      { utilisateur: null }, { utilisateur: { role: { not: 'RESPONSABLE_BRANCHE' } } },
    ])
    expect(prisma.scout.update).not.toHaveBeenCalled()
  })

  it('refuse le classement adulte si le scout est devenu chef d’unité', async () => {
    const { prisma, audit, service } = construire()
    prisma.scout.findMany.mockResolvedValue([{ id: 's1', brancheType: 'COMPAGNONS', utilisateur: { role: 'RESPONSABLE_BRANCHE' } }])
    await expect(service.appliquer(acteur, { passages: [{ scoutId: 's1', nouvelleBranche: 'RESSOURCES_ADULTES' }] }))
      .rejects.toMatchObject({ status: 400 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(audit.enregistrer).not.toHaveBeenCalled()
  })

  it('conserve le dossier actif lors du passage aux ressources adultes', async () => {
    const { prisma, service } = construire()
    prisma.scout.findMany.mockResolvedValue([{ id: 's1', brancheType: 'COMPAGNONS', utilisateur: { role: 'SCOUT' } }])
    await expect(service.appliquer(acteur, { passages: [{ scoutId: 's1', nouvelleBranche: 'RESSOURCES_ADULTES' }] }))
      .resolves.toEqual({ appliques: 1 })
    expect(prisma.scout.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { brancheType: 'RESSOURCES_ADULTES', equipeId: null } })
  })
})
