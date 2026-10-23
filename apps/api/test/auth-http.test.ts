import 'reflect-metadata'
import { Controller, Get, type INestApplication } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthController } from '../src/auth/auth.controller'
import { AuthService } from '../src/auth/auth.service'
import { MotDePasseService } from '../src/auth/mot-de-passe.service'
import { Roles } from '../src/common/decorators/roles.decorator'
import { AuthGuard } from '../src/common/guards/auth.guard'
import { RolesGuard } from '../src/common/guards/roles.guard'
import type { UtilisateurSession } from '../src/common/types'
import { chargerEnv } from '../src/config/env'
import { PrismaService } from '../src/prisma/prisma.service'
import { FiltreErreurs } from '../src/common/filters/erreurs.filter'

@Controller()
class RoutesMetierTemoins {
  @Get('admin/temoin')
  @Roles('ADMIN_PLATEFORME')
  admin() { return { ok: true } }

  @Get('metier/temoin')
  metier() { return { ok: true } }
}

const SECRET = 'http-test-secret-'.repeat(3)
const EMETTEUR = 'installation-http-test'
const administrateur = {
  id: 'admin-http', matricule: 'ADM-HTTP', email: '', nom: 'Admin', prenom: 'Test',
  role: 'ADMIN_PLATEFORME', roleDistrict: null, paroisseId: null, doitChangerMotDePasse: false,
}

describe('HTTP Nest — session persistante et activation obligatoire', () => {
  let app: INestApplication
  const jwt = new JwtService()
  const prisma = { sessionUtilisateur: { findUnique: vi.fn() } }
  const motDePasse = { changerPersonnel: vi.fn() }
  const session = () => ({
    utilisateurId: administrateur.id, revoqueeLe: null, expireLe: new Date(Date.now() + 60_000),
    utilisateur: { ...administrateur, actif: true, paroisse: null },
  })
  const jeton = (charge: UtilisateurSession = administrateur) => {
    const { id, ...identite } = charge
    return jwt.sign({ ...identite, sid: 'session-http' }, {
      subject: id, issuer: EMETTEUR, secret: SECRET, algorithm: 'HS256', expiresIn: 60,
    })
  }

  beforeAll(async () => {
    chargerEnv({ DATABASE_URL: 'postgresql://test', JWT_ACCESS_SECRET: SECRET, INSTALLATION_ID: EMETTEUR } as NodeJS.ProcessEnv)
    const module = await Test.createTestingModule({
      controllers: [AuthController, RoutesMetierTemoins],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: MotDePasseService, useValue: motDePasse },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_FILTER, useClass: FiltreErreurs },
      ],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  })

  beforeEach(() => {
    prisma.sessionUtilisateur.findUnique.mockReset().mockResolvedValue(session())
    motDePasse.changerPersonnel.mockReset().mockResolvedValue({ ok: true })
  })

  afterAll(async () => { await app?.close() })

  it('autorise un administrateur actif puis refuse immédiatement le même JWT après révocation', async () => {
    const authorization = `Bearer ${jeton()}`
    await request(app.getHttpServer()).get('/api/admin/temoin').set('Authorization', authorization).expect(200)
    prisma.sessionUtilisateur.findUnique.mockResolvedValue({ ...session(), revoqueeLe: new Date() })
    await request(app.getHttpServer()).get('/api/admin/temoin').set('Authorization', authorization).expect(401)
  })

  it('applique aussi RolesGuard après l’authentification persistante', async () => {
    const chef = { ...administrateur, role: 'CHEF_GROUPE', paroisseId: 'paroisse-http' }
    prisma.sessionUtilisateur.findUnique.mockResolvedValue({ ...session(), utilisateur: { ...chef, actif: true, paroisse: { actif: true } } })
    await request(app.getHttpServer()).get('/api/admin/temoin').set('Authorization', `Bearer ${jeton(chef)}`).expect(403)
  })

  it('bloque la route métier et garde accessibles la session et le changement personnel', async () => {
    prisma.sessionUtilisateur.findUnique.mockResolvedValue({ ...session(), utilisateur: { ...session().utilisateur, doitChangerMotDePasse: true } })
    const authorization = `Bearer ${jeton()}`
    const metier = await request(app.getHttpServer()).get('/api/metier/temoin').set('Authorization', authorization).expect(403)
    expect(metier.body.code).toBe('CHANGEMENT_MOT_DE_PASSE_REQUIS')
    expect(metier.body.erreur).toBe('Définissez votre mot de passe personnel avant de continuer')
    const lecture = await request(app.getHttpServer()).get('/api/auth/session').set('Authorization', authorization).expect(200)
    expect(lecture.body.utilisateur.doitChangerMotDePasse).toBe(true)
    await request(app.getHttpServer()).post('/api/auth/changer-mot-de-passe').set('Authorization', authorization)
      .send({ motDePasseActuel: 'Temporaire123', nouveauMotDePasse: 'Personnel123' }).expect(200)
    expect(motDePasse.changerPersonnel).toHaveBeenCalledWith('admin-http', 'Temporaire123', 'Personnel123')
  })

  it('refuse aussi les routes d’activation à une session révoquée', async () => {
    prisma.sessionUtilisateur.findUnique.mockResolvedValue({ ...session(), revoqueeLe: new Date() })
    const authorization = `Bearer ${jeton()}`
    await request(app.getHttpServer()).get('/api/auth/session').set('Authorization', authorization).expect(401)
    await request(app.getHttpServer()).post('/api/auth/changer-mot-de-passe').set('Authorization', authorization)
      .send({ motDePasseActuel: 'Temporaire123', nouveauMotDePasse: 'Personnel123' }).expect(401)
    expect(motDePasse.changerPersonnel).not.toHaveBeenCalled()
  })
})
