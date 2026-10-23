import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { compare, hash } from 'bcryptjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { motDePasseValide } from '@scout/shared'
import { chargerEnv } from '../config/env'
import type { PrismaService } from '../prisma/prisma.service'
import type { AuthService } from './auth.service'
import { MotDePasseService } from './mot-de-passe.service'
import { genererMotDePasseTemporaire } from './secret-temporaire'
import { UtilisateursService } from '../modules/admin/utilisateurs.service'
import { SchemaCreationUtilisateur } from '../modules/admin/utilisateurs.schemas'
import type { AuditService } from '../common/audit.service'

function contexte() {
  const prisma = {
    utilisateur: { findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    tokenReinitialisation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    sessionUtilisateur: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma))
  return { prisma, service: new MotDePasseService(prisma as unknown as PrismaService, {} as AuthService) }
}

beforeEach(() => chargerEnv({ DATABASE_URL: 'postgresql://test', JWT_ACCESS_SECRET: 's'.repeat(40) }))

describe('activation et secret temporaire', () => {
  it('génère des secrets distincts conformes à la politique', () => {
    const secrets = Array.from({ length: 100 }, genererMotDePasseTemporaire)
    expect(new Set(secrets).size).toBe(100)
    expect(secrets.every(motDePasseValide)).toBe(true)
  })

  it('crée un compte avec un secret généré haché et impose le changement', async () => {
    const prisma = {
      paroisse: { findUnique: vi.fn().mockResolvedValue({ id: 'p1' }) },
      utilisateur: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'u1', role: 'ASSISTANT_GROUPE', email: null }),
      },
    }
    const audit = { enregistrer: vi.fn() }
    const service = new UtilisateursService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      {} as AuthService,
    )
    const resultat = await service.creer(
      SchemaCreationUtilisateur.parse({
        paroisseId: 'p1',
        nom: 'Nom',
        prenom: 'Prénom',
        matricule: 'M1',
        role: 'ASSISTANT_GROUPE',
        password: 'ChoisiParAdmin123',
      }),
      'admin',
    )
    const data = prisma.utilisateur.create.mock.calls[0][0].data
    expect(data.doitChangerMotDePasse).toBe(true)
    expect(data.password).not.toBe(resultat.motDePasseTemporaire)
    expect(await compare(resultat.motDePasseTemporaire, data.password)).toBe(true)
    expect(await compare('ChoisiParAdmin123', data.password)).toBe(false)
    expect(JSON.stringify(audit.enregistrer.mock.calls)).not.toContain(resultat.motDePasseTemporaire)
  })

  it('refuse un secret actuel incorrect sans modifier ni révoquer', async () => {
    const { prisma, service } = contexte()
    prisma.utilisateur.findUnique.mockResolvedValue({ password: await hash('Temporaire123', 4), actif: true })
    await expect(service.changerPersonnel('u-incorrect', 'incorrect', 'Personnel123!')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('refuse de conserver le secret temporaire', async () => {
    const { prisma, service } = contexte()
    prisma.utilisateur.findUnique.mockResolvedValue({ password: await hash('Temporaire123', 4), actif: true })
    await expect(service.changerPersonnel('u-identique', 'Temporaire123', 'Temporaire123')).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('remplace le secret, clôture les sessions et les liens en une transaction', async () => {
    const { prisma, service } = contexte()
    const ancienHash = await hash('Temporaire123', 4)
    prisma.utilisateur.findUnique.mockResolvedValue({ password: ancienHash, actif: true })
    await service.changerPersonnel('u-succes', 'Temporaire123', 'Personnel123!')
    const { where, data } = prisma.utilisateur.updateMany.mock.calls[0][0]
    expect(where).toEqual({ id: 'u-succes', password: ancienHash, actif: true })
    expect(data.doitChangerMotDePasse).toBe(false)
    expect(await compare('Personnel123!', data.password)).toBe(true)
    expect(await compare('Temporaire123', data.password)).toBe(false)
    expect(prisma.sessionUtilisateur.updateMany).toHaveBeenCalledWith({
      where: { utilisateurId: 'u-succes', revoqueeLe: null },
      data: { revoqueeLe: expect.any(Date) },
    })
    expect(prisma.tokenReinitialisation.updateMany).toHaveBeenCalledWith({
      where: { utilisateurId: 'u-succes', utilise: false },
      data: { utilise: true },
    })
    expect(prisma.$transaction).toHaveBeenCalledOnce()
  })

  it('une course avec une réinitialisation ne peut écraser son nouveau secret', async () => {
    const { prisma, service } = contexte()
    prisma.utilisateur.findUnique.mockResolvedValue({ password: await hash('Temporaire123', 4), actif: true })
    prisma.utilisateur.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.changerPersonnel('u-course', 'Temporaire123', 'Personnel123!')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
    expect(prisma.sessionUtilisateur.updateMany).not.toHaveBeenCalled()
  })
})
