import { UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chargerEnv } from '../config/env'
import { AuthService } from './auth.service'
import type { PrismaService } from '../prisma/prisma.service'

const empreinte = (jeton: string) => createHash('sha256').update(jeton).digest('hex')

const UTILISATEUR = {
  id: 'u1',
  matricule: 'M1',
  email: null,
  nom: 'Nom',
  prenom: 'Prénom',
  role: 'CHEF_GROUPE',
  roleDistrict: null,
  paroisseId: 'p1',
  actif: true,
  paroisse: { actif: true },
}

function prismaSimule(session: Record<string, unknown> | null) {
  return {
    sessionUtilisateur: {
      findFirst: vi.fn().mockResolvedValue(session),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  }
}

describe('AuthService.rafraichir', () => {
  beforeEach(() => {
    chargerEnv({
      DATABASE_URL: 'postgresql://test',
      JWT_ACCESS_SECRET: 'x'.repeat(40),
    } as NodeJS.ProcessEnv)
  })

  const futur = () => new Date(Date.now() + 60_000)

  it('fait tourner le jeton de session et conserve l’ancien en fenêtre de grâce', async () => {
    const prisma = prismaSimule({
      id: 's1',
      empreinteJeton: empreinte('jeton-courant'),
      ancienneEmpreinte: null,
      ancienneValideJusqua: null,
      expireLe: futur(),
      revoqueeLe: null,
      utilisateur: UTILISATEUR,
    })
    const service = new AuthService(prisma as unknown as PrismaService, new JwtService())

    const resultat = await service.rafraichir('jeton-courant')

    expect(resultat.jetonSession).toBeDefined()
    expect(resultat.utilisateur.role).toBe('CHEF_GROUPE')
    const donnees = prisma.sessionUtilisateur.updateMany.mock.calls[0][0].data
    expect(donnees.ancienneEmpreinte).toBe(empreinte('jeton-courant'))
    expect(donnees.empreinteJeton).toBe(empreinte(resultat.jetonSession!))
  })

  it('une rotation concurrente perdante ne remplace pas le cookie gagnant', async () => {
    const prisma = prismaSimule({
      id: 's1',
      empreinteJeton: empreinte('courant'),
      expireLe: futur(),
      revoqueeLe: null,
      utilisateur: UTILISATEUR,
    })
    prisma.sessionUtilisateur.updateMany.mockResolvedValue({ count: 0 })
    prisma.sessionUtilisateur.findFirst
      .mockResolvedValueOnce({
        id: 's1',
        empreinteJeton: empreinte('courant'),
        expireLe: futur(),
        revoqueeLe: null,
        utilisateur: UTILISATEUR,
      })
      .mockResolvedValueOnce({
        id: 's1',
        empreinteJeton: empreinte('gagnant'),
        ancienneEmpreinte: empreinte('courant'),
        ancienneValideJusqua: futur(),
        expireLe: futur(),
        revoqueeLe: null,
      })
    const service = new AuthService(prisma as unknown as PrismaService, new JwtService())
    const resultat = await service.rafraichir('courant')
    expect(resultat.jetonSession).toBeUndefined()
    expect(prisma.sessionUtilisateur.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1', empreinteJeton: empreinte('courant'), revoqueeLe: null, expireLe: { gt: expect.any(Date) } },
      }),
    )
  })

  it('une révocation pendant la rotation ne peut rouvrir une session', async () => {
    const prisma = prismaSimule({
      id: 's1',
      empreinteJeton: empreinte('courant'),
      expireLe: futur(),
      revoqueeLe: null,
      utilisateur: UTILISATEUR,
    })
    prisma.sessionUtilisateur.updateMany.mockResolvedValue({ count: 0 })
    prisma.sessionUtilisateur.findFirst
      .mockResolvedValueOnce({
        id: 's1',
        empreinteJeton: empreinte('courant'),
        expireLe: futur(),
        revoqueeLe: null,
        utilisateur: UTILISATEUR,
      })
      .mockResolvedValueOnce(null)
    const service = new AuthService(prisma as unknown as PrismaService, new JwtService())
    await expect(service.rafraichir('courant')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('accepte l’ancien jeton pendant la fenêtre de grâce sans nouvelle rotation', async () => {
    const prisma = prismaSimule({
      id: 's1',
      empreinteJeton: empreinte('nouveau'),
      ancienneEmpreinte: empreinte('ancien'),
      ancienneValideJusqua: futur(),
      expireLe: futur(),
      revoqueeLe: null,
      utilisateur: UTILISATEUR,
    })
    const service = new AuthService(prisma as unknown as PrismaService, new JwtService())

    const resultat = await service.rafraichir('ancien')

    expect(resultat.jetonSession).toBeUndefined()
    expect(prisma.sessionUtilisateur.update).not.toHaveBeenCalled()
  })

  it('révoque la session quand un ancien jeton est rejoué après la fenêtre de grâce', async () => {
    const prisma = prismaSimule({
      id: 's1',
      empreinteJeton: empreinte('nouveau'),
      ancienneEmpreinte: empreinte('ancien'),
      ancienneValideJusqua: new Date(Date.now() - 1000),
      expireLe: futur(),
      revoqueeLe: null,
      utilisateur: UTILISATEUR,
    })
    const service = new AuthService(prisma as unknown as PrismaService, new JwtService())

    await expect(service.rafraichir('ancien')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(prisma.sessionUtilisateur.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { revoqueeLe: expect.any(Date) },
    })
  })

  it('refuse et révoque la session d’un compte désactivé depuis la connexion', async () => {
    const prisma = prismaSimule({
      id: 's1',
      empreinteJeton: empreinte('jeton'),
      ancienneEmpreinte: null,
      ancienneValideJusqua: null,
      expireLe: futur(),
      revoqueeLe: null,
      utilisateur: { ...UTILISATEUR, actif: false },
    })
    const service = new AuthService(prisma as unknown as PrismaService, new JwtService())

    await expect(service.rafraichir('jeton')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(prisma.sessionUtilisateur.update).toHaveBeenCalled()
  })

  it('refuse une session révoquée ou expirée', async () => {
    const revoquee = new AuthService(
      prismaSimule({
        id: 's1',
        empreinteJeton: empreinte('j'),
        expireLe: futur(),
        revoqueeLe: new Date(),
        utilisateur: UTILISATEUR,
      }) as unknown as PrismaService,
      new JwtService(),
    )
    await expect(revoquee.rafraichir('j')).rejects.toBeInstanceOf(UnauthorizedException)

    const expiree = new AuthService(
      prismaSimule({
        id: 's1',
        empreinteJeton: empreinte('j'),
        expireLe: new Date(Date.now() - 1),
        revoqueeLe: null,
        utilisateur: UTILISATEUR,
      }) as unknown as PrismaService,
      new JwtService(),
    )
    await expect(expiree.rafraichir('j')).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
