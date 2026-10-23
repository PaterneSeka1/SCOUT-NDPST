import { UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { hash } from 'bcryptjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import { chargerEnv } from '../config/env'
import { logger } from '../common/lib/logger'
import { AuthService } from './auth.service'

vi.mock('../common/lib/rateLimit', () => ({
  limiteAtteinte: vi.fn().mockResolvedValue(false),
  limiterTaux: vi.fn().mockResolvedValue({ autorise: true }),
}))
vi.mock('../common/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const SECRET = 'AncienTemporaire123!'
const SIGNATURE = 's'.repeat(40)
const compte = {
  id: 'compte-test',
  matricule: 'M-TEST',
  email: null,
  nom: 'Test',
  prenom: 'Compte',
  role: 'ASSISTANT_GROUPE',
  roleDistrict: null,
  paroisseId: 'paroisse-test',
  actif: true,
  doitChangerMotDePasse: true,
  paroisse: { actif: true },
}

async function contexte(changement: Record<string, unknown> = {}) {
  const ancienHash = await hash(SECRET, 4)
  const observe = { ...compte, password: ancienHash }
  const courant = { ...observe, ...changement }
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: compte.id }]),
    utilisateur: { findUnique: vi.fn().mockResolvedValue(courant) },
    sessionUtilisateur: { create: vi.fn().mockResolvedValue({ id: 'session-creee' }) },
  }
  const prisma = {
    utilisateur: { findFirst: vi.fn().mockResolvedValue(observe) },
    $transaction: vi.fn().mockImplementation((operation: (transaction: typeof tx) => unknown) => operation(tx)),
  }
  return {
    tx,
    prisma,
    ancienHash,
    service: new AuthService(prisma as unknown as PrismaService, new JwtService()),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  chargerEnv({ DATABASE_URL: 'postgresql://test', JWT_ACCESS_SECRET: SIGNATURE, INSTALLATION_ID: 'test-local' })
})

describe('connexion concurrente avec changement de mot de passe ou désactivation', () => {
  it('refuse le secret validé si son hash a changé avant la création de session', async () => {
    const ctx = await contexte({ password: await hash('PersonnelRemplace123!', 4), doitChangerMotDePasse: false })
    await expect(ctx.service.connecter('M-TEST', SECRET, '127.0.0.1')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(ctx.tx.sessionUtilisateur.create).not.toHaveBeenCalled()
    expect(ctx.prisma.$transaction).toHaveBeenCalledOnce()
    expect(ctx.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.tx.utilisateur.findUnique.mock.invocationCallOrder[0],
    )
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(ctx.ancienHash)
  })

  it.each([
    ['compte désactivé', { actif: false }],
    ['paroisse désactivée', { paroisse: { actif: false } }],
  ])('refuse une %s pendant bcrypt sans créer de session', async (_cas, changement) => {
    const ctx = await contexte(changement)
    await expect(ctx.service.connecter('M-TEST', SECRET, '127.0.0.1')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(ctx.tx.sessionUtilisateur.create).not.toHaveBeenCalled()
  })

  it('refuse également un compte supprimé avant la relecture verrouillée', async () => {
    const ctx = await contexte()
    ctx.tx.utilisateur.findUnique.mockResolvedValueOnce(null as never)
    await expect(ctx.service.connecter('M-TEST', SECRET, '127.0.0.1')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(ctx.tx.sessionUtilisateur.create).not.toHaveBeenCalled()
  })

  it('émet l’identité relue et un sid sans exposer le hash ni conserver le secret en base', async () => {
    const ctx = await contexte({ prenom: 'IdentiteActualisee' })
    const resultat = await ctx.service.connecter('M-TEST', SECRET, '127.0.0.1')
    expect(resultat.utilisateur.prenom).toBe('IdentiteActualisee')
    const charge = await new JwtService().verifyAsync(resultat.jetonAcces, {
      secret: SIGNATURE, issuer: 'test-local', algorithms: ['HS256'],
    })
    expect(charge).toMatchObject({ sub: compte.id, sid: 'session-creee', prenom: 'IdentiteActualisee' })
    expect(charge.password).toBeUndefined()
    expect(JSON.stringify(resultat)).not.toContain(ctx.ancienHash)
    expect(JSON.stringify(resultat)).not.toContain(SECRET)
    expect(ctx.tx.sessionUtilisateur.create.mock.calls[0][0].data.empreinteJeton).not.toBe(resultat.jetonSession)
    const logs = JSON.stringify(vi.mocked(logger.info).mock.calls)
    expect(logs).not.toContain(ctx.ancienHash)
    expect(logs).not.toContain(SECRET)
    expect(logs).not.toContain(resultat.jetonSession)
  })
})
