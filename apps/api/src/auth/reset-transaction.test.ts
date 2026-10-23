import { BadRequestException } from '@nestjs/common'
import { compare } from 'bcryptjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import type { AuthService } from './auth.service'
import { chargerEnv } from '../config/env'
import { MotDePasseService } from './mot-de-passe.service'

vi.mock('../common/lib/rateLimit', () => ({ limiterTaux: vi.fn().mockResolvedValue({ autorise: true }) }))

function contexte() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    utilisateur: { update: vi.fn().mockResolvedValue({}) },
    tokenReinitialisation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }
  const prisma = {
    tokenReinitialisation: { findUnique: vi.fn().mockResolvedValue({
      id: 'lien', utilisateurId: 'compte', utilise: false, expiresAt: new Date(Date.now() + 60000),
    }) },
    $transaction: vi.fn().mockImplementation((operation: (transaction: typeof tx) => unknown) => operation(tx)),
  }
  const auth = { revoquerToutes: vi.fn().mockResolvedValue(undefined) }
  return { tx, prisma, auth, service: new MotDePasseService(prisma as unknown as PrismaService, auth as unknown as AuthService) }
}

beforeEach(() => chargerEnv({ DATABASE_URL: 'postgresql://test', JWT_ACCESS_SECRET: 's'.repeat(40) }))

describe('réinitialisation atomique du secret et des sessions', () => {
  it('verrouille le compte avant de consommer le lien puis révoque dans la même transaction', async () => {
    const ctx = contexte()
    await ctx.service.reinitialiser('jeton-test', 'NouveauSecret123!', '127.0.0.1')
    expect(ctx.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(ctx.tx.tokenReinitialisation.updateMany.mock.invocationCallOrder[0])
    expect(ctx.auth.revoquerToutes).toHaveBeenCalledWith('compte', ctx.tx)
    expect(ctx.tx.utilisateur.update.mock.calls[0][0].data.doitChangerMotDePasse).toBe(false)
    expect(await compare('NouveauSecret123!', ctx.tx.utilisateur.update.mock.calls[0][0].data.password)).toBe(true)
  })

  it('ne change rien si une consommation concurrente a déjà gagné', async () => {
    const ctx = contexte()
    ctx.tx.tokenReinitialisation.updateMany.mockResolvedValueOnce({ count: 0 })
    await expect(ctx.service.reinitialiser('jeton-test', 'NouveauSecret123!', '127.0.0.1')).rejects.toBeInstanceOf(BadRequestException)
    expect(ctx.tx.utilisateur.update).not.toHaveBeenCalled()
    expect(ctx.auth.revoquerToutes).not.toHaveBeenCalled()
  })

  it('propage un échec de révocation pour permettre le rollback PostgreSQL', async () => {
    const ctx = contexte()
    const echec = new Error('Révocation indisponible')
    ctx.auth.revoquerToutes.mockRejectedValueOnce(echec)
    await expect(ctx.service.reinitialiser('jeton-test', 'NouveauSecret123!', '127.0.0.1')).rejects.toBe(echec)
    expect(ctx.auth.revoquerToutes).toHaveBeenCalledWith('compte', ctx.tx)
  })
})
