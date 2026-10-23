import { UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { generateKeyPairSync } from 'crypto'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chargerEnv } from '../config/env'
import { AuthGuard } from '../common/guards/auth.guard'
import { reinitialiserClesAdmin } from './cles-admin'
import { AuthService } from './auth.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { RequeteAuthentifiee } from '../common/types'

// Administrateur plateforme partagé : l'installation « district-essai »
// signe ses jetons, l'installation « paroisse-essai » les vérifie avec la
// seule clé publique.

const dossier = mkdtempSync(path.join(tmpdir(), 'cles-admin-'))
const paire = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const district = paire()
const intrus = paire()
const fichier = (nom: string, contenu: string) => {
  const chemin = path.join(dossier, nom)
  writeFileSync(chemin, contenu)
  return chemin
}
const PRIVEE_DISTRICT = fichier('district-prive.pem', district.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString())
const PUBLIQUE_DISTRICT = fichier('district-public.pem', district.publicKey.export({ type: 'spki', format: 'pem' }).toString())
const PEM_INTRUS = intrus.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

const BASE = { DATABASE_URL: 'postgresql://test', JWT_ACCESS_SECRET: 'x'.repeat(40) }
const jwt = new JwtService()

const ADMIN = {
  matricule: 'ADM1',
  email: '',
  nom: 'Admin',
  prenom: 'Plateforme',
  role: 'ADMIN_PLATEFORME',
  roleDistrict: null,
  paroisseId: null,
  doitChangerMotDePasse: false,
}

function installation(valeurs: Record<string, string>) {
  chargerEnv({ ...BASE, ...valeurs } as NodeJS.ProcessEnv)
  reinitialiserClesAdmin()
}

const enDistrict = () => installation({ INSTALLATION_ID: 'district-essai', ADMIN_CLE_PRIVEE_FICHIER: PRIVEE_DISTRICT })
const URL_VERIFICATION = 'https://district.exemple.ci/api/auth/session'
const enParoisse = (url: string | undefined = URL_VERIFICATION) =>
  installation({
    INSTALLATION_ID: 'paroisse-essai',
    ADMIN_EMETTEUR_CONFIANCE: 'district-essai',
    ADMIN_CLE_PUBLIQUE_FICHIER: PUBLIQUE_DISTRICT,
    ...(url ? { ADMIN_URL_VERIFICATION_SESSION: url } : {}),
  })

const prisma = { sessionUtilisateur: { findUnique: vi.fn() } }
const fetchSimule = vi.fn()

async function verifier(jeton: string) {
  const requete: RequeteAuthentifiee = { headers: {}, cookies: { scout_acces: jeton } } as unknown as RequeteAuthentifiee
  const contexte = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => requete }),
  } as unknown as ExecutionContext
  await new AuthGuard(new Reflector(), jwt, prisma as unknown as PrismaService).canActivate(contexte)
  return requete.utilisateur
}

const signerES256 = (charge: object, cle: string, emetteur = 'district-essai') =>
  jwt.sign({ ...charge, sid: 'session-admin' }, { subject: 'u-admin', privateKey: cle, algorithm: 'ES256', issuer: emetteur, expiresIn: 60 })

async function jetonAdminEmisParLeDistrict(): Promise<string> {
  enDistrict()
  const service = new AuthService({} as PrismaService, jwt)
  const signer = (service as unknown as { signerAcces: (s: object, sessionId: string) => Promise<string> }).signerAcces.bind(service)
  return signer({ id: 'u-admin', ...ADMIN }, 'session-admin')
}

describe('administrateur plateforme partagé entre installations', () => {
  beforeEach(() => {
    reinitialiserClesAdmin()
    prisma.sessionUtilisateur.findUnique.mockReset().mockResolvedValue({
      utilisateurId: 'u-admin', revoqueeLe: null, expireLe: new Date(Date.now() + 60_000),
      utilisateur: { id: 'u-admin', ...ADMIN, actif: true, paroisse: null },
    })
    fetchSimule.mockReset().mockResolvedValue({ ok: true, json: async () => ({ utilisateur: { id: 'u-admin', ...ADMIN } }) })
    vi.stubGlobal('fetch', fetchSimule)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('le district signe les jetons admin en ES256 et les accepte lui-même', async () => {
    const jeton = await jetonAdminEmisParLeDistrict()
    expect(jwt.decode(jeton, { complete: true })?.header.alg).toBe('ES256')
    const utilisateur = await verifier(jeton)
    expect(utilisateur?.role).toBe('ADMIN_PLATEFORME')
    expect(utilisateur?.externe).toBeUndefined()
    expect(prisma.sessionUtilisateur.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'session-admin' } }))
    expect(fetchSimule).not.toHaveBeenCalled()
  })

  it('le district garde HS256 pour les comptes ordinaires', async () => {
    enDistrict()
    const service = new AuthService({} as PrismaService, jwt)
    const signer = (service as unknown as { signerAcces: (s: object, sessionId: string) => Promise<string> }).signerAcces.bind(service)
    const jeton = await signer({ id: 'u1', ...ADMIN, role: 'CHEF_GROUPE', paroisseId: 'p1' }, 'session-ordinaire')
    expect(jwt.decode(jeton, { complete: true })?.header.alg).toBe('HS256')
  })

  it('la paroisse accepte le jeton admin du district, comme compte externe', async () => {
    const jeton = await jetonAdminEmisParLeDistrict()
    enParoisse()
    const utilisateur = await verifier(jeton)
    expect(utilisateur).toMatchObject({ id: 'u-admin', role: 'ADMIN_PLATEFORME', paroisseId: null, externe: 'district-essai' })
    expect(fetchSimule).toHaveBeenCalledWith(URL_VERIFICATION, {
      headers: { Authorization: `Bearer ${jeton}` }, signal: expect.any(AbortSignal), redirect: 'error',
    })
    expect(prisma.sessionUtilisateur.findUnique).not.toHaveBeenCalled()
  })

  it('refuse une session administrateur révoquée auprès de l’émetteur', async () => {
    const jeton = await jetonAdminEmisParLeDistrict()
    enParoisse()
    fetchSimule.mockResolvedValue({ ok: false, status: 401 })
    await expect(verifier(jeton)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(fetchSimule).toHaveBeenCalledTimes(1)
  })

  it('refuse un accès externe si la vérification dépasse son délai', async () => {
    const jeton = await jetonAdminEmisParLeDistrict()
    enParoisse()
    fetchSimule.mockRejectedValue(new DOMException('Délai dépassé', 'TimeoutError'))
    await expect(verifier(jeton)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('refuse un accès externe sans URL de vérification configurée', async () => {
    const jeton = await jetonAdminEmisParLeDistrict()
    enParoisse('')
    await expect(verifier(jeton)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(fetchSimule).not.toHaveBeenCalled()
  })

  it.each([
    ['identité différente', { id: 'autre-admin', ...ADMIN }],
    ['rôle retiré', { id: 'u-admin', ...ADMIN, role: 'CHEF_GROUPE' }],
    ['mot de passe personnel requis', { id: 'u-admin', ...ADMIN, doitChangerMotDePasse: true }],
    ['identité déjà externe', { id: 'u-admin', ...ADMIN, externe: 'tiers' }],
  ])('refuse une réponse de vérification avec %s', async (_nom, utilisateur) => {
    const jeton = await jetonAdminEmisParLeDistrict()
    enParoisse()
    fetchSimule.mockResolvedValue({ ok: true, json: async () => ({ utilisateur }) })
    await expect(verifier(jeton)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('vérifie à nouveau auprès de l’émetteur à chaque requête, sans cache positif', async () => {
    const jeton = await jetonAdminEmisParLeDistrict()
    enParoisse()
    await expect(verifier(jeton)).resolves.toMatchObject({ id: 'u-admin' })
    fetchSimule.mockResolvedValue({ ok: false, status: 401 })
    await expect(verifier(jeton)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(fetchSimule).toHaveBeenCalledTimes(2)
  })

  it('la paroisse refuse un jeton ES256 du district pour un autre rôle que ADMIN_PLATEFORME', async () => {
    enParoisse()
    const jeton = signerES256({ ...ADMIN, role: 'CHEF_GROUPE', paroisseId: 'p-paroisse' }, district.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString())
    await expect(verifier(jeton)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('la paroisse refuse un jeton signé par une autre clé, même avec le bon émetteur', async () => {
    enParoisse()
    await expect(verifier(signerES256(ADMIN, PEM_INTRUS))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('la paroisse refuse un émetteur non déclaré', async () => {
    enParoisse()
    const jeton = signerES256(ADMIN, district.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), 'autre-installation')
    await expect(verifier(jeton)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('la paroisse refuse un jeton HS256 signé avec la clé publique (confusion d’algorithme)', async () => {
    enParoisse()
    const jeton = jwt.sign(ADMIN, {
      subject: 'u-admin',
      secret: district.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      algorithm: 'HS256',
      issuer: 'district-essai',
    })
    await expect(verifier(jeton)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('refuse un jeton non signé (alg: none)', async () => {
    enParoisse()
    const segment = (objet: object) => Buffer.from(JSON.stringify(objet)).toString('base64url')
    const jeton = `${segment({ alg: 'none', typ: 'JWT' })}.${segment({ ...ADMIN, sub: 'u', iss: 'district-essai' })}.`
    await expect(verifier(jeton)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('une paroisse sans configuration de confiance refuse tout jeton ES256', async () => {
    const jeton = await jetonAdminEmisParLeDistrict()
    installation({ INSTALLATION_ID: 'paroisse-isolee' })
    await expect(verifier(jeton)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
