import { ORDRE_BRANCHES } from '@scout/shared'
import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import type { PrismaService } from '../../prisma/prisma.service'
import type { ConfigurationService } from '../configuration/configuration.service'
import type { GalerieService } from '../galerie/galerie.service'
import type { PublicationsService } from '../publications/publications.service'
import { SchemaBranche } from './site-public.schemas'
import { SitePublicService } from './site-public.service'

function construire() {
  const prisma = {
    utilisateur: { findMany: vi.fn().mockResolvedValue([]) },
    activite: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    branche: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  }
  const service = new SitePublicService(
    prisma as unknown as PrismaService,
    {} as AuditService,
    {} as ConfigurationService,
    {} as PublicationsService,
    {} as GalerieService,
  )
  return { prisma, service }
}

describe('SitePublicService — données publiées uniquement', () => {
  it('limite les présentations publiques et administrables aux cinq branches', async () => {
    const { prisma, service } = construire()
    await service.branches()
    await service.listerBranchesAdmin()
    for (const [appel] of prisma.branche.findMany.mock.calls) {
      expect(appel.where.type.in).toEqual(ORDRE_BRANCHES)
      expect(appel.where.type.in).not.toContain('RESSOURCES_ADULTES')
    }
  })

  it('refuse de modifier les ressources adultes comme une sixième branche', async () => {
    const { service } = construire()
    await expect(service.modifierBranche('RESSOURCES_ADULTES', SchemaBranche.parse({}), 'admin')).rejects.toMatchObject({ status: 404 })
  })

  it("n'affiche que les membres actifs ayant accepté un profil public, sans données de contact", async () => {
    const { prisma, service } = construire()
    await service.equipe()
    const appel = prisma.utilisateur.findMany.mock.calls[0][0]
    expect(appel.where).toMatchObject({ actif: true, profilPublic: true })
    expect(appel.select).not.toHaveProperty('telephone')
    expect(appel.select).not.toHaveProperty('email')
    expect(appel.where.role.in).not.toContain('PARENT')
    expect(appel.where.role.in).not.toContain('SCOUT')
  })

  it('expose le code de branche (null pour la direction) et trie la direction en premier', async () => {
    const { prisma, service } = construire()
    const base = { fonctionPublique: null, photoPublique: null, biographie: null, ordrePublic: 0 }
    prisma.utilisateur.findMany.mockResolvedValueOnce([
      { ...base, id: 'b', prenom: 'Awa', nom: 'Koné', role: 'RESPONSABLE_BRANCHE', brancheType: 'LOUVETEAUX' },
      { ...base, id: 'g', prenom: 'Yao', nom: 'Kouassi', role: 'CHEF_GROUPE', brancheType: null },
    ])
    const equipe = await service.equipe()
    expect(equipe.map((m) => [m.id, m.brancheType, m.branche])).toEqual([
      ['g', null, null],
      ['b', 'LOUVETEAUX', 'Louveteaux'],
    ])
  })

  it("n'expose que les activités publiques, jamais leur description interne", async () => {
    const { prisma, service } = construire()
    await service.activites({})
    const appel = prisma.activite.findMany.mock.calls[0][0]
    expect(appel.where.publique).toBe(true)
    expect(appel.select).not.toHaveProperty('description')
    expect(appel.select).toHaveProperty('descriptionPublique')
  })

  it('renvoie 404 pour une branche non publiée', async () => {
    const { prisma, service } = construire()
    await expect(service.branche('oisillons')).rejects.toMatchObject({ status: 404 })
    expect(prisma.branche.findFirst.mock.calls[0][0].where).toMatchObject({ active: true, publiee: true, type: { in: ORDRE_BRANCHES } })
  })
})
