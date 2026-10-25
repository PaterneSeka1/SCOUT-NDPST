import { UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const configuration = vi.hoisted(() => ({
  CRON_SECRET: 'secret-cron-de-test-0123456789',
  RETENTION_AUDIT_JOURS: undefined as number | undefined,
  ANONYMISATION_SCOUTS_INACTIFS_JOURS: undefined as number | undefined,
}))
vi.mock('../../config/env', () => ({ env: () => configuration }))

import type { AccesFichiersService } from '../../common/acces-fichiers.service'
import type { AuditService } from '../../common/audit.service'
import type { PrismaService } from '../../prisma/prisma.service'
import { MaintenanceController } from './maintenance.controller'
import { MaintenanceService } from './maintenance.service'

const MAINTENANCE = new Date('2026-10-14T12:00:00Z')
const jours = (n: number) => new Date(MAINTENANCE.getTime() - n * 24 * 60 * 60 * 1000)

function construire() {
  const operation = () => vi.fn().mockReturnValue('operation')
  const prisma = {
    sessionUtilisateur: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
    tokenReinitialisation: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    journalAudit: { deleteMany: vi.fn().mockResolvedValue({ count: 10 }) },
    scout: {
      findMany: vi.fn().mockResolvedValue([{ id: 's1' }]),
      findUnique: vi.fn().mockResolvedValue({
        dateNaissance: new Date('2012-06-15T00:00:00Z'),
        photo: '/api/fichiers/groupe/photo.png',
        documents: [{ url: '/api/fichiers/groupe/fiche.pdf' }],
        autorisationsCamp: [{ documentUrl: '/api/fichiers/groupe/autorisation.pdf' }],
      }),
      update: operation(),
    },
    document: { deleteMany: operation() },
    contactUrgence: { deleteMany: operation() },
    lienParentScout: { deleteMany: operation() },
    autorisationCamp: { updateMany: operation() },
    presence: { updateMany: operation() },
    progressionScout: { updateMany: operation() },
    cotisation: { updateMany: operation() },
    $transaction: vi.fn().mockResolvedValue([]),
  }
  const fichiers = { supprimerSiOrphelin: vi.fn() }
  const audit = { enregistrer: vi.fn() }
  const service = new MaintenanceService(
    prisma as unknown as PrismaService,
    fichiers as unknown as AccesFichiersService,
    audit as unknown as AuditService,
  )
  return { prisma, fichiers, audit, service }
}

describe('cron/purge', () => {
  beforeEach(() => {
    configuration.RETENTION_AUDIT_JOURS = undefined
    configuration.ANONYMISATION_SCOUTS_INACTIFS_JOURS = undefined
  })

  it('refuse sans le secret et ne supprime rien', () => {
    const { prisma, service } = construire()
    expect(() => new MaintenanceController(service).purger('mauvais')).toThrow(UnauthorizedException)
    expect(prisma.sessionUtilisateur.deleteMany).not.toHaveBeenCalled()
  })

  it('supprime uniquement les sessions et jetons expirés depuis plus de 7 jours', async () => {
    const { prisma, service } = construire()
    await expect(service.purger(MAINTENANCE)).resolves.toEqual({
      sessions: 3,
      jetonsReinitialisation: 2,
      journalAudit: null,
      scoutsAnonymises: null,
    })
    expect(prisma.sessionUtilisateur.deleteMany).toHaveBeenCalledWith({ where: { expireLe: { lt: jours(7) } } })
    expect(prisma.tokenReinitialisation.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: jours(7) } } })
  })

  it('ne touche à aucune donnée métier sans durées de conservation configurées', async () => {
    const { prisma, service } = construire()
    await service.purger(MAINTENANCE)
    expect(prisma.journalAudit.deleteMany).not.toHaveBeenCalled()
    expect(prisma.scout.findMany).not.toHaveBeenCalled()
  })

  it('purge le journal d’audit au-delà de RETENTION_AUDIT_JOURS', async () => {
    configuration.RETENTION_AUDIT_JOURS = 1095
    const { prisma, service } = construire()
    const resultat = await service.purger(MAINTENANCE)
    expect(resultat.journalAudit).toBe(10)
    expect(prisma.journalAudit.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: jours(1095) }, entite: { not: 'AdhesionNationale' } },
    })
  })

  it('anonymise les scouts inactifs depuis plus de ANONYMISATION_SCOUTS_INACTIFS_JOURS', async () => {
    configuration.ANONYMISATION_SCOUTS_INACTIFS_JOURS = 1095
    const { prisma, fichiers, audit, service } = construire()
    const resultat = await service.purger(MAINTENANCE)

    expect(resultat.scoutsAnonymises).toBe(1)
    expect(prisma.scout.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actif: false, anonymiseLe: null, desactiveLe: { lt: jours(1095) } } }),
    )
    const donnees = prisma.scout.update.mock.calls[0][0].data
    expect(donnees).toMatchObject({
      nom: 'Anonyme',
      prenom: 'Anonyme',
      matricule: null,
      photo: null,
      allergies: null,
      traitementsMedicaux: null,
      utilisateurId: null,
      anonymiseLe: MAINTENANCE,
    })
    // Seule l'année de naissance est conservée (statistiques par âge).
    expect(donnees.dateNaissance).toEqual(new Date('2012-01-01T00:00:00Z'))
    expect(prisma.document.deleteMany).toHaveBeenCalledWith({ where: { scoutId: 's1' } })
    expect(prisma.lienParentScout.deleteMany).toHaveBeenCalledWith({ where: { scoutId: 's1' } })
    expect(prisma.$transaction).toHaveBeenCalledOnce()
    expect(fichiers.supprimerSiOrphelin.mock.calls.map((c) => c[0])).toEqual([
      '/api/fichiers/groupe/photo.png',
      '/api/fichiers/groupe/fiche.pdf',
      '/api/fichiers/groupe/autorisation.pdf',
    ])
    expect(audit.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCOUT_ANONYMISE', entiteId: 's1' }),
    )
  })
})
