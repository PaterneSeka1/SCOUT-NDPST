import { createHash } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const envoyerEmail = vi.fn()
vi.mock('../common/lib/email', () => ({ envoyerEmailReinitialisation: (...args: unknown[]) => envoyerEmail(...args) }))

import { chargerEnv } from '../config/env'
import type { PrismaService } from '../prisma/prisma.service'
import type { AuthService } from './auth.service'
import { MotDePasseService } from './mot-de-passe.service'

const empreinte = (jeton: string) => createHash('sha256').update(jeton).digest('hex')

function construire() {
  const prisma = {
    utilisateur: { findFirst: vi.fn().mockResolvedValue({ id: 'u1', prenom: 'Awa', email: 'awa@exemple.ci' }) },
    tokenReinitialisation: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  }
  const service = new MotDePasseService(prisma as unknown as PrismaService, {} as AuthService)
  return { prisma, service }
}

// Une fuite de la table TokenReinitialisation ne doit pas permettre de
// réinitialiser un mot de passe : seule l'empreinte du jeton est stockée.
describe('MotDePasseService — jetons de réinitialisation', () => {
  beforeEach(() => {
    chargerEnv({
      DATABASE_URL: 'postgresql://test',
      JWT_ACCESS_SECRET: 'x'.repeat(40),
      URL_FRONTEND_PAROISSE: 'https://paroisse.exemple.ci',
    } as NodeJS.ProcessEnv)
    envoyerEmail.mockReset()
  })

  it("stocke l'empreinte du jeton envoyé par e-mail, jamais le jeton", async () => {
    const { prisma, service } = construire()
    await service.demanderReinitialisation('awa@exemple.ci', `ip-${Math.random()}`)

    const lien = envoyerEmail.mock.calls[0][2] as string
    const jeton = new URL(lien).searchParams.get('token') as string
    const stocke = prisma.tokenReinitialisation.create.mock.calls[0][0].data
    expect(stocke).not.toHaveProperty('token')
    expect(stocke.empreinte).toBe(empreinte(jeton))
    expect(stocke.empreinte).not.toBe(jeton)
  })

  it('recherche le jeton reçu par son empreinte', async () => {
    const { prisma, service } = construire()
    await service.verifierLien('jeton-recu')
    expect(prisma.tokenReinitialisation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empreinte: empreinte('jeton-recu') } }),
    )
  })
})
