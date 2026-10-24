import 'reflect-metadata'
import { randomUUID } from 'crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { chargerEnv } from '../src/config/env'
import { PrismaService } from '../src/prisma/prisma.service'
import { SchemaRechercheDoublons } from '../src/modules/scouts/scouts.schemas'
import { ScoutsService } from '../src/modules/scouts/scouts.service'

// Règles métier qui reposent sur PostgreSQL lui-même (SQL brut, index
// partiels, contraintes) : impossibles à prouver avec un Prisma simulé.
// Même garde que postgres-auth.integration.ts : base jetable dédiée uniquement.
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
const scouts = new ScoutsService(prisma, {} as never, {} as never, {} as never)
const creesScouts: string[] = []
const creesUtilisateurs: string[] = []

beforeAll(async () => {
  await prisma.$connect()
  if (await prisma.utilisateur.count() !== 0 || await prisma.scout.count() !== 0) {
    throw new Error('La base dédiée doit être vide de données applicatives avant cette suite')
  }
})

afterEach(async () => {
  for (const id of creesScouts.splice(0)) await prisma.scout.delete({ where: { id } })
  for (const id of creesUtilisateurs.splice(0)) {
    await prisma.mandat.deleteMany({ where: { utilisateurId: id } })
    await prisma.utilisateur.delete({ where: { id } })
  }
})
afterAll(() => prisma.$disconnect())

async function scout(nom: string, prenom: string, dateNaissance = '2015-04-02') {
  const s = await prisma.scout.create({
    data: { nom, prenom, dateNaissance: new Date(`${dateNaissance}T00:00:00Z`), sexe: 'FEMININ', brancheType: 'LOUVETEAUX' },
  })
  creesScouts.push(s.id)
  return s
}

async function compte(role: 'CHEF_GROUPE' | 'RESPONSABLE_BRANCHE', brancheType: 'LOUVETEAUX' | null = null) {
  const u = await prisma.utilisateur.create({
    data: { nom: 'Synthétique', prenom: 'Test', matricule: `IT-${randomUUID()}`, role, brancheType, password: 'x' },
  })
  creesUtilisateurs.push(u.id)
  return u
}

describe('PostgreSQL réel — règles métier mono-paroissiales', () => {
  it('détecte un doublon malgré la casse, les accents, les espaces et l’inversion nom/prénom', async () => {
    const existant = await scout('Kouassi', 'Ébène Marie')
    const recherche = (corps: Record<string, string>) =>
      scouts.doublons(SchemaRechercheDoublons.parse(corps)).then((r) => r.correspondances.map((c) => c.id))

    expect(await recherche({ nom: 'KOUASSI', prenom: 'ebene  marie' })).toEqual([existant.id])
    expect(await recherche({ nom: 'Ébène Marie', prenom: 'kouassi' })).toEqual([existant.id])
    expect(await recherche({ nom: 'Kouassi', prenom: 'Ebene Marie', dateNaissance: '2015-04-02' })).toEqual([existant.id])
    expect(await recherche({ nom: 'Kouassi', prenom: 'Ebene Marie', dateNaissance: '2016-04-02' })).toEqual([])
  })

  it("n'accepte qu'un seul Chef de Groupe actif", async () => {
    await compte('CHEF_GROUPE')
    await expect(compte('CHEF_GROUPE')).rejects.toMatchObject({ code: 'P2002' })
  })

  it("n'accepte qu'un seul Responsable actif par branche", async () => {
    await compte('RESPONSABLE_BRANCHE', 'LOUVETEAUX')
    await expect(compte('RESPONSABLE_BRANCHE', 'LOUVETEAUX')).rejects.toMatchObject({ code: 'P2002' })
  })

  it("la configuration de l'installation est unique et présente après migration", async () => {
    const lignes = await prisma.configurationInstallation.findMany()
    expect(lignes).toHaveLength(1)
    expect(lignes[0].id).toBe('installation')
    expect(lignes[0].anneeHistorique).toBe(1956)
    expect(lignes[0].rangHistoriqueValide).toBe(false)
  })

  it('les branches du référentiel sont initialisées une seule fois', async () => {
    expect(await prisma.branche.count()).toBe(6)
  })
})
