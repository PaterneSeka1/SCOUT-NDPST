import { ForbiddenException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import { chargerEnv } from '../../config/env'
import type { PrismaService } from '../../prisma/prisma.service'
import type { ConfigurationService } from '../configuration/configuration.service'
import { SchemaDemandePublique } from './adhesions.schemas'
import { AdhesionsService } from './adhesions.service'

const base = {
  type: 'INSCRIPTION_JEUNE',
  nomContact: 'Kouamé',
  prenomContact: 'Aya',
  telephone: '07 00 00 00 00',
  nomJeune: 'Kouamé',
  prenomJeune: 'Yao',
  dateNaissanceJeune: '2016-03-04',
  consentement: true,
}

function construire(inscriptionsOuvertes = true) {
  const prisma = { demandeAdhesion: { create: vi.fn(async ({ data }: { data: unknown }) => ({ id: 'd1', ...(data as object) })) } }
  const configuration = { lire: vi.fn().mockResolvedValue({ inscriptionsOuvertes, email: null }) }
  return {
    prisma,
    service: new AdhesionsService(
      prisma as unknown as PrismaService,
      { enregistrer: vi.fn() } as unknown as AuditService,
      configuration as unknown as ConfigurationService,
    ),
  }
}

let ip = 0
beforeEach(() => {
  chargerEnv({ DATABASE_URL: 'postgresql://test', JWT_ACCESS_SECRET: 's'.repeat(40) } as NodeJS.ProcessEnv)
  ip += 1
})

describe('SchemaDemandePublique', () => {
  it('exige le consentement au traitement des données', () => {
    expect(SchemaDemandePublique.safeParse({ ...base, consentement: false }).success).toBe(false)
  })
  it("exige l'identité du jeune pour une inscription, pas pour une information", () => {
    expect(SchemaDemandePublique.safeParse({ ...base, prenomJeune: undefined }).success).toBe(false)
    const { nomJeune: _n, prenomJeune: _p, dateNaissanceJeune: _d, ...contact } = base
    expect(SchemaDemandePublique.safeParse({ ...contact, type: 'INFORMATION' }).success).toBe(true)
  })
  it('refuse un téléphone invalide', () => {
    expect(SchemaDemandePublique.safeParse({ ...base, telephone: 'abc' }).success).toBe(false)
  })
})

describe('AdhesionsService.recevoir', () => {
  it('enregistre la demande sans créer de compte', async () => {
    const { prisma, service } = construire()
    await expect(service.recevoir(SchemaDemandePublique.parse(base), `ip-${ip}`)).resolves.toEqual({ recue: true })
    expect(prisma.demandeAdhesion.create).toHaveBeenCalledTimes(1)
    expect(Object.keys(prisma).join()).not.toContain('utilisateur')
  })

  it('ignore silencieusement un robot (champ piège ou envoi trop rapide)', async () => {
    const { prisma, service } = construire()
    await service.recevoir(SchemaDemandePublique.parse({ ...base, siteWeb: 'http://spam' }), `ip-${ip}`)
    await service.recevoir(SchemaDemandePublique.parse({ ...base, ouvertLe: Date.now() }), `ip-${ip}`)
    expect(prisma.demandeAdhesion.create).not.toHaveBeenCalled()
  })

  it('limite le nombre de demandes par adresse IP', async () => {
    const { service } = construire()
    const corps = SchemaDemandePublique.parse(base)
    for (let i = 0; i < 5; i += 1) await service.recevoir(corps, `ip-${ip}`)
    await expect(service.recevoir(corps, `ip-${ip}`)).rejects.toMatchObject({ status: 429 })
  })

  it('refuse une inscription quand les inscriptions sont fermées', async () => {
    const { service } = construire(false)
    await expect(service.recevoir(SchemaDemandePublique.parse(base), `ip-${ip}`)).rejects.toBeInstanceOf(ForbiddenException)
  })
})
