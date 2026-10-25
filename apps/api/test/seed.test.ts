import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrancheType, RoleUtilisateur } from '../src/generated/prisma/enums'

const db = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
}))
vi.mock('pg', () => ({
  Client: class {
    connect = db.connect
    query = db.query
    end = db.end
  },
}))
vi.mock('bcryptjs', () => ({ hash: vi.fn(async () => 'empreinte-test') }))

type Ligne = Record<string, unknown>
const insertions = new Map<string, Ligne[]>()
const schema = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8')

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.stubEnv('DATABASE_URL', 'postgresql://simulation/seed_test')
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('SEED_DEMO', 'true')
  vi.stubEnv('ADMIN_MATRICULE', 'ADMIN001A')
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'table').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  insertions.clear()
  db.query.mockImplementation(async (sql: string, valeurs: unknown[] = []) => {
    const insertion = sql.match(/INSERT INTO "(\w+)" \(([^)]+)\)\s+VALUES/)
    if (!insertion) return { rows: [] }
    const [, table, colonnesSql] = insertion
    const modele = schema.match(new RegExp(`model ${table} \\{([\\s\\S]*?)\\n\\}`))
    if (!modele) throw new Error(`Table absente du schéma : ${table}`)
    const colonnes = [...colonnesSql.matchAll(/"(\w+)"/g)].map((m) => m[1])
    for (const colonne of colonnes) {
      if (!new RegExp(`^\\s+${colonne}\\s+`, 'm').test(modele[1])) {
        throw new Error(`Colonne absente du schéma : ${table}.${colonne}`)
      }
    }
    const ligne = Object.fromEntries(colonnes.slice(0, valeurs.length).map((c, i) => [c, valeurs[i]]))
    insertions.set(table, [...(insertions.get(table) ?? []), ligne])
    return { rows: [ligne] }
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

async function executerSeed() {
  await import('../prisma/seed.js')
  await vi.waitFor(() => expect(db.end).toHaveBeenCalledOnce())
}

describe('Seed de développement', () => {
  it('couvre tous les rôles et les périmètres de branche avec des relations cohérentes', async () => {
    await executerSeed()
    expect(process.exit).not.toHaveBeenCalled()
    expect(db.query).toHaveBeenCalledWith('COMMIT')
    const comptes = insertions.get('Utilisateur')!
    expect([...new Set(comptes.map((c) => c.role))].sort()).toEqual(Object.values(RoleUtilisateur).sort())
    const identifiants = comptes.map((c) => c.matricule ?? c.telephone)
    expect(new Set(identifiants).size).toBe(comptes.length)
    expect(comptes.find((c) => c.matricule === 'DEMOIN')?.actif).toBe(false)
    expect(comptes.find((c) => c.matricule === 'DEMOEDIT')).toMatchObject({
      role: 'ASSISTANT_GROUPE',
      editeurContenu: true,
    })
    expect(comptes.find((c) => c.matricule === 'DEMOSG')?.editeurContenu).toBe(false)
    for (const branche of Object.values(BrancheType)) {
      for (const role of ['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE']) {
        expect(comptes.filter((c) => c.role === role && c.brancheType === branche && c.actif)).toHaveLength(1)
      }
      const responsable = comptes.find((c) => c.role === 'RESPONSABLE_BRANCHE' && c.brancheType === branche)!
      const activite = insertions
        .get('Activite')!
        .find((a) => a.brancheType === branche && a.creePar === responsable.id)!
      const scout = insertions.get('Scout')!.find((s) => s.brancheType === branche)!
      expect(activite).toBeDefined()
      expect(insertions.get('Presence')).toContainEqual(
        expect.objectContaining({ activiteId: activite.id, scoutId: scout.id }),
      )
      const reunion = insertions.get('JourReunion')!.find((r) => r.brancheType === branche)!
      expect(insertions.get('PresenceReunion')).toContainEqual(
        expect.objectContaining({ jourReunionId: reunion.id, scoutId: scout.id }),
      )
      const programme = insertions.get('Programme')!.find((p) => p.brancheType === branche)!
      expect(insertions.get('LigneProgramme')).toContainEqual(
        expect.objectContaining({ programmeId: programme.id, activiteId: activite.id }),
      )
    }
    const parent = comptes.find((c) => c.role === 'PARENT')!
    expect(insertions.get('LienParentScout')!.filter((l) => l.parentId === parent.id)).toHaveLength(2)
    const scout = comptes.find((c) => c.role === 'SCOUT')!
    expect(insertions.get('Scout')).toContainEqual(expect.objectContaining({ utilisateurId: scout.id }))
  })

  it('permet de créer uniquement l’administrateur avec SEED_DEMO=false', async () => {
    vi.stubEnv('SEED_DEMO', 'false')
    await executerSeed()
    expect(process.exit).not.toHaveBeenCalled()
    expect([...insertions.keys()]).toEqual(['Utilisateur'])
    expect(insertions.get('Utilisateur')).toHaveLength(1)
    expect(insertions.get('Utilisateur')![0].role).toBe('ADMINISTRATEUR')
    expect(db.query).toHaveBeenCalledWith('COMMIT')
  })

  it('annule la transaction si une insertion échoue', async () => {
    db.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO')) throw new Error('Échec simulé')
      return { rows: [] }
    })
    await executerSeed()
    expect(db.query).toHaveBeenCalledWith('ROLLBACK')
    expect(db.query).not.toHaveBeenCalledWith('COMMIT')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('refuse de se connecter à la base en production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await executerSeed()
    expect(db.connect).not.toHaveBeenCalled()
    expect(db.query).not.toHaveBeenCalledWith('BEGIN')
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
