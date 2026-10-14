import { HttpException, UnauthorizedException } from '@nestjs/common'
import type { JwtService } from '@nestjs/jwt'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chargerEnv } from '../config/env'
import type { PrismaService } from '../prisma/prisma.service'
import { AuthService } from './auth.service'

// Limitation des tentatives de connexion : seuls les échecs comptent, par
// identifiant + IP. Un tiers qui se trompe 5 fois depuis son poste ne doit
// pas empêcher le titulaire du compte de se connecter depuis le sien.
describe('AuthService.connecter — limitation des échecs', () => {
  let identifiant = 0
  const prisma = { utilisateur: { findFirst: vi.fn().mockResolvedValue(null) } }
  const service = new AuthService(prisma as unknown as PrismaService, {} as JwtService)

  beforeEach(() => {
    chargerEnv({ DATABASE_URL: 'postgresql://test', JWT_ACCESS_SECRET: 'x'.repeat(40) } as NodeJS.ProcessEnv)
    identifiant += 1
  })

  const tenter = (ip: string) => service.connecter(`MATRICULE-${identifiant}`, 'mauvais', ip)

  it('bloque (429) après 5 échecs depuis la même IP pour le même identifiant', async () => {
    for (let i = 0; i < 5; i++) await expect(tenter('10.0.0.1')).rejects.toBeInstanceOf(UnauthorizedException)
    const erreur = await tenter('10.0.0.1').catch((e: unknown) => e)
    expect(erreur).toBeInstanceOf(HttpException)
    expect((erreur as HttpException).getStatus()).toBe(429)
  })

  it("laisse le titulaire du compte tenter sa chance depuis une autre IP", async () => {
    for (let i = 0; i < 5; i++) await tenter('10.0.0.2').catch(() => undefined)
    await expect(tenter('10.0.0.3')).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
