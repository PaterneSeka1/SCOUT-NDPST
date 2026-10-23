import 'reflect-metadata'
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { compare, hash } from 'bcryptjs'
import { randomUUID, createHash } from 'crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { AuthService } from '../src/auth/auth.service'
import { MotDePasseService } from '../src/auth/mot-de-passe.service'
import { AuthGuard } from '../src/common/guards/auth.guard'
import { CLE_MOT_DE_PASSE_TEMPORAIRE } from '../src/common/decorators/mot-de-passe-temporaire.decorator'
import { chargerEnv } from '../src/config/env'
import { PrismaService } from '../src/prisma/prisma.service'

// Validation AVANT constructeur/client/connexion. Aucun dotenv n'est chargé.
const rawUrl = process.env.SCOUT_TEST_DATABASE_URL
if (!rawUrl) throw new Error('SCOUT_TEST_DATABASE_URL explicite requis pour les tests PostgreSQL')
const target = new URL(rawUrl)
const database = decodeURIComponent(target.pathname.slice(1))
if (
  !['postgres:', 'postgresql:'].includes(target.protocol) ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
  !/^(ci_integration|scout_test_integration_[a-z0-9_]+)$/.test(database) ||
  !target.username || target.search || target.hash
) throw new Error('Base PostgreSQL temporaire dédiée sur loopback requise; options URL interdites')
for (const key of ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS']) delete process.env[key]
chargerEnv({ NODE_ENV: 'test', DATABASE_URL: rawUrl, JWT_ACCESS_SECRET: 'integration-test-signature-'.repeat(3), INSTALLATION_ID: 'integration-test' })

const prisma = new PrismaService()
const jwt = new JwtService()
const auth = new AuthService(prisma, jwt)
const passwords = new MotDePasseService(prisma, auth)
const guard = new AuthGuard(new Reflector(), jwt, prisma)
const createdUsers: string[] = []
const createdParishes: string[] = []
const createdDistricts: string[] = []
const INITIAL = 'InitialSecret123!'
const PERSONAL = 'PersonnelSecret456!'

function context(token: string, activationAllowed = false): ExecutionContext {
  const handler = () => undefined
  if (activationAllowed) Reflect.defineMetadata(CLE_MOT_DE_PASSE_TEMPORAIRE, true, handler)
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${token}` }, cookies: {} }) }),
  } as unknown as ExecutionContext
}

async function account(temporary = false) {
  const suffix = randomUUID()
  const district = await prisma.district.create({ data: { nom: `Integration ${suffix}` } })
  createdDistricts.push(district.id)
  const parish = await prisma.paroisse.create({ data: { nom: 'Synthétique', ville: 'Test', diocese: 'Test', districtId: district.id } })
  createdParishes.push(parish.id)
  const user = await prisma.utilisateur.create({ data: {
    nom: 'Synthétique', prenom: 'Test', matricule: `IT-${suffix}`, role: 'CHEF_GROUPE',
    paroisseId: parish.id, password: await hash(INITIAL, 4), doitChangerMotDePasse: temporary,
  } })
  createdUsers.push(user.id)
  return user
}

beforeAll(async () => {
  await prisma.$connect()
  // Ne pas exécuter de nettoyage global dans une base ayant des données.
  if (await prisma.utilisateur.count() !== 0 || await prisma.paroisse.count() !== 0 || await prisma.district.count() !== 0) {
    throw new Error('La base dédiée doit être vide de données applicatives avant cette suite')
  }
})

afterEach(async () => {
  vi.restoreAllMocks()
  for (const id of createdUsers.splice(0)) {
    await prisma.sessionUtilisateur.deleteMany({ where: { utilisateurId: id } })
    await prisma.tokenReinitialisation.deleteMany({ where: { utilisateurId: id } })
    await prisma.utilisateur.delete({ where: { id } })
  }
  for (const id of createdParishes.splice(0)) await prisma.paroisse.delete({ where: { id } })
  for (const id of createdDistricts.splice(0)) await prisma.district.delete({ where: { id } })
})
afterAll(() => prisma.$disconnect())

describe('PostgreSQL réel — sessions, activation et concurrence', () => {
  it('refuse le même JWT immédiatement après retrait de rôle puis après révocation', async () => {
    const user = await account()
    const first = await auth.connecter(user.matricule!, INITIAL, '127.0.0.1')
    await expect(guard.canActivate(context(first.jetonAcces))).resolves.toBe(true)
    await prisma.utilisateur.update({ where: { id: user.id }, data: { role: 'ASSISTANT_GROUPE' } })
    await expect(guard.canActivate(context(first.jetonAcces))).rejects.toBeInstanceOf(UnauthorizedException)
    const second = await auth.connecter(user.matricule!, INITIAL, '127.0.0.1')
    await auth.revoquerToutes(user.id)
    await expect(guard.canActivate(context(second.jetonAcces))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('bloque le métier pendant activation, puis ferme les anciennes sessions au changement', async () => {
    const user = await account(true)
    const login = await auth.connecter(user.matricule!, INITIAL, '127.0.0.1')
    await expect(guard.canActivate(context(login.jetonAcces))).rejects.toBeInstanceOf(ForbiddenException)
    await expect(guard.canActivate(context(login.jetonAcces, true))).resolves.toBe(true)
    await passwords.changerPersonnel(user.id, INITIAL, PERSONAL)
    await expect(guard.canActivate(context(login.jetonAcces, true))).rejects.toBeInstanceOf(UnauthorizedException)
    const fresh = await auth.connecter(user.matricule!, PERSONAL, '127.0.0.1')
    expect(fresh.utilisateur.doitChangerMotDePasse).toBe(false)
    await expect(guard.canActivate(context(fresh.jetonAcces))).resolves.toBe(true)
  })

  it('une connexion ayant lu l’ancien secret ne crée pas de session après son remplacement', async () => {
    const user = await account(true)
    let release!: () => void
    let observed!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const read = new Promise<void>((resolve) => { observed = resolve })
    const original = prisma.utilisateur.findFirst.bind(prisma.utilisateur)
    const spy = vi.spyOn(prisma.utilisateur, 'findFirst').mockImplementationOnce((...args) => {
      const query = original(...args)
      // Proxy conserve le client Prisma fluide tout en retardant uniquement
      // la remise du résultat réel à AuthService, sans simuler sa valeur.
      return new Proxy(query, {
        get(target, property, receiver) {
          if (property === 'then') {
            return (...callbacks: Parameters<typeof query.then>) => query.then(async (value) => {
              observed()
              await gate
              return value
            }).then(...callbacks)
          }
          return Reflect.get(target, property, receiver)
        },
      })
    })
    const pending = auth.connecter(user.matricule!, INITIAL, '127.0.0.1').then(
      (value) => ({ value, error: undefined }),
      (error: unknown) => ({ value: undefined, error }),
    )
    await read
    try { await passwords.changerPersonnel(user.id, INITIAL, PERSONAL) } finally { release() }
    const outcome = await pending
    spy.mockRestore()
    expect(outcome.error).toBeInstanceOf(UnauthorizedException)
    expect(await prisma.sessionUtilisateur.count({ where: { utilisateurId: user.id } })).toBe(0)
  })

  it('deux rafraîchissements concurrents ne produisent qu’un nouveau secret opaque utilisable', async () => {
    const user = await account()
    const login = await auth.connecter(user.matricule!, INITIAL, '127.0.0.1')
    const results = await Promise.all([auth.rafraichir(login.jetonSession!), auth.rafraichir(login.jetonSession!)])
    const issued = results.flatMap((result) => result.jetonSession ? [result.jetonSession] : [])
    expect(issued).toHaveLength(1)
    const saved = await prisma.sessionUtilisateur.findFirstOrThrow({ where: { utilisateurId: user.id } })
    expect(saved.empreinteJeton).toBe(createHash('sha256').update(issued[0]).digest('hex'))
    for (const result of results) await expect(guard.canActivate(context(result.jetonAcces))).resolves.toBe(true)
  })

  it('une erreur PostgreSQL pendant la révocation annule aussi le nouveau hash', async () => {
    const user = await account(true)
    await auth.connecter(user.matricule!, INITIAL, '127.0.0.1')
    // Noms réservés à cette base dédiée; aucune fonction de production modifiée.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION scout_test_reject_revoke() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic revoke failure'; END $$`)
    await prisma.$executeRawUnsafe(`CREATE TRIGGER scout_test_reject_revoke BEFORE UPDATE ON "SessionUtilisateur" FOR EACH ROW EXECUTE FUNCTION scout_test_reject_revoke()`)
    try {
      await expect(passwords.changerPersonnel(user.id, INITIAL, PERSONAL)).rejects.toThrow()
      const current = await prisma.utilisateur.findUniqueOrThrow({ where: { id: user.id } })
      expect(await compare(INITIAL, current.password)).toBe(true)
      expect(current.doitChangerMotDePasse).toBe(true)
      expect(await prisma.sessionUtilisateur.count({ where: { utilisateurId: user.id, revoqueeLe: null } })).toBe(1)
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS scout_test_reject_revoke ON "SessionUtilisateur"')
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS scout_test_reject_revoke()')
    }
  })
})
