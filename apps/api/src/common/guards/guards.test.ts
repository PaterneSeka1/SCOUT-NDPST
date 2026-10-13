import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { beforeEach, describe, expect, it } from 'vitest'
import { chargerEnv } from '../../config/env'
import { CLE_PUBLIC } from '../decorators/public.decorator'
import { CLE_ROLES, CLE_ROLES_DISTRICT } from '../decorators/roles.decorator'
import type { UtilisateurSession } from '../types'
import { AuthGuard } from './auth.guard'
import { RolesGuard } from './roles.guard'

const SECRET = 's'.repeat(40)
const EMETTEUR_LOCAL = 'scout-ascci-api'

function contexte(requete: Record<string, unknown>, metadonnees: Record<string, unknown> = {}): ExecutionContext {
  const handler = () => undefined
  for (const [cle, valeur] of Object.entries(metadonnees)) Reflect.defineMetadata(cle, valeur, handler)
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => requete }),
  } as unknown as ExecutionContext
}

const UTILISATEUR: UtilisateurSession = {
  id: 'u1',
  matricule: 'M1',
  email: '',
  nom: 'N',
  prenom: 'P',
  role: 'RESPONSABLE_BRANCHE',
  roleDistrict: null,
  paroisseId: 'p1',
}

describe('AuthGuard', () => {
  const jwt = new JwtService()
  const garde = new AuthGuard(new Reflector(), jwt)

  beforeEach(() => {
    chargerEnv({ DATABASE_URL: 'postgresql://test', JWT_ACCESS_SECRET: SECRET } as NodeJS.ProcessEnv)
  })

  const signer = (secret = SECRET, emetteur = EMETTEUR_LOCAL) => {
    const { id, ...charge } = UTILISATEUR
    return jwt.sign(charge, { subject: id, secret, issuer: emetteur, expiresIn: 60 })
  }

  it('refuse une route protégée sans jeton (401)', async () => {
    await expect(garde.canActivate(contexte({ headers: {}, cookies: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('accepte un jeton valide en cookie et expose l’utilisateur', async () => {
    const requete: Record<string, unknown> = { headers: {}, cookies: { scout_acces: signer() } }
    await expect(garde.canActivate(contexte(requete))).resolves.toBe(true)
    expect(requete.utilisateur).toEqual(UTILISATEUR)
  })

  it('accepte un jeton en en-tête Authorization: Bearer', async () => {
    const requete = { headers: { authorization: `Bearer ${signer()}` }, cookies: {} }
    await expect(garde.canActivate(contexte(requete))).resolves.toBe(true)
  })

  it('refuse un jeton signé avec un autre secret ou un autre émetteur', async () => {
    for (const jeton of [signer('autre-secret'.repeat(4)), signer(SECRET, 'autre-emetteur')]) {
      await expect(
        garde.canActivate(contexte({ headers: {}, cookies: { scout_acces: jeton } })),
      ).rejects.toBeInstanceOf(UnauthorizedException)
    }
  })

  it('laisse passer une route @Public() même avec un jeton invalide', async () => {
    const requete = { headers: {}, cookies: { scout_acces: 'invalide' } }
    await expect(garde.canActivate(contexte(requete, { [CLE_PUBLIC]: true }))).resolves.toBe(true)
  })
})

describe('RolesGuard', () => {
  const garde = new RolesGuard(new Reflector())

  it('refuse un rôle paroissial absent de @Roles (403)', () => {
    expect(() =>
      garde.canActivate(contexte({ utilisateur: UTILISATEUR }, { [CLE_ROLES]: ['CHEF_GROUPE'] })),
    ).toThrow(ForbiddenException)
  })

  it('accepte un rôle paroissial présent dans @Roles', () => {
    expect(
      garde.canActivate(contexte({ utilisateur: UTILISATEUR }, { [CLE_ROLES]: ['RESPONSABLE_BRANCHE'] })),
    ).toBe(true)
  })

  it('n’accorde jamais @RolesDistrict sur la seule base du rôle paroissial', () => {
    const chef = { ...UTILISATEUR, role: 'COMMISSAIRE_DISTRICT', roleDistrict: null }
    expect(() =>
      garde.canActivate(contexte({ utilisateur: chef }, { [CLE_ROLES_DISTRICT]: ['COMMISSAIRE_DISTRICT'] })),
    ).toThrow(ForbiddenException)
    const commissaire = { ...UTILISATEUR, roleDistrict: 'COMMISSAIRE_DISTRICT' }
    expect(
      garde.canActivate(contexte({ utilisateur: commissaire }, { [CLE_ROLES_DISTRICT]: ['COMMISSAIRE_DISTRICT'] })),
    ).toBe(true)
  })
})
