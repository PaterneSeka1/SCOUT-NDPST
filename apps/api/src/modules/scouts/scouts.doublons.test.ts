import { describe, expect, it, vi } from 'vitest'

// PrismaService simulé : aucun accès base.
vi.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }))

import { ACCENTS_CIBLE, ACCENTS_SOURCE, ScoutsService, normaliserNom } from './scouts.service'
import { SchemaRechercheDoublons } from './scouts.schemas'

function construire() {
  const prisma = { $queryRaw: vi.fn().mockResolvedValue([]) }
  const service = new ScoutsService(prisma as never, {} as never, {} as never, {} as never)
  return { prisma, service }
}

describe('Détection de doublons', () => {
  it('normalise casse, accents et espaces', () => {
    expect(normaliserNom('  KOUAMÉ   Éloïse ')).toBe('kouame eloise')
  })

  it('table de translittération SQL alignée sur normaliserNom', () => {
    const source = [...ACCENTS_SOURCE]
    const cible = [...ACCENTS_CIBLE]
    expect(source).toHaveLength(cible.length)
    source.forEach((lettre, i) => expect(normaliserNom(lettre)).toBe(cible[i]))
  })

  it('interroge la base avec des valeurs paramétrées et normalisées', async () => {
    const { prisma, service } = construire()
    const criteres = SchemaRechercheDoublons.parse({ nom: ' Kouamé ', prenom: 'ÉLOÏSE', dateNaissance: '2015-03-02' })
    await expect(service.doublons(criteres)).resolves.toEqual({ correspondances: [] })

    const [fragments, ...valeurs] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]]
    const sql = fragments.join('?')
    expect(sql).toContain('FROM "Scout"')
    expect(sql).toContain('LIMIT 20')
    // Aucune saisie utilisateur concaténée dans le SQL : uniquement en paramètres.
    expect(sql).not.toContain('kouame')
    const parametres = valeurs.flatMap((v) =>
      v && typeof v === 'object' && 'values' in v ? (v as { values: unknown[] }).values : [v],
    )
    expect(parametres).toContain('kouame')
    expect(parametres).toContain('eloise')
    expect(parametres).toContainEqual(new Date('2015-03-02T00:00:00.000Z'))
    expect(parametres).toContainEqual(new Date('2015-03-03T00:00:00.000Z'))
  })

  it('schéma : nom et prénom requis, date facultative mais valide', () => {
    expect(SchemaRechercheDoublons.safeParse({ nom: 'A' }).success).toBe(false)
    expect(SchemaRechercheDoublons.safeParse({ nom: 'A', prenom: 'B', dateNaissance: 'nope' }).success).toBe(false)
    expect(SchemaRechercheDoublons.parse({ nom: 'A', prenom: 'B', dateNaissance: '' })).toEqual({
      nom: 'A',
      prenom: 'B',
      dateNaissance: undefined,
    })
  })
})
