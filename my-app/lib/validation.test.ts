import { describe, it, expect } from 'vitest'
import {
  estCheminLocalValide,
  BrancheTypeSchema,
  TypeActiviteSchema,
  StatutReunionSchema,
} from './validation'

describe('estCheminLocalValide', () => {
  it('accepte les chemins locaux', () => {
    expect(estCheminLocalValide('/uploads/x.png')).toBe(true)
    expect(estCheminLocalValide('/api/fichiers/paroisse-1/x.pdf')).toBe(true)
  })

  it('refuse les URL absolues', () => {
    expect(estCheminLocalValide('https://evil.example.com/x')).toBe(false)
    expect(estCheminLocalValide('http://evil.example.com')).toBe(false)
  })

  it('refuse les URL protocol-relative ("//hote/...")', () => {
    expect(estCheminLocalValide('//evil.example.com/x')).toBe(false)
  })

  it('refuse le contournement par backslash (résolu comme externe par les navigateurs)', () => {
    expect(estCheminLocalValide('/\\evil.example.com/x')).toBe(false)
  })

  it('refuse les chemins relatifs sans slash de tête et les valeurs non-string', () => {
    expect(estCheminLocalValide('relative/path')).toBe(false)
    expect(estCheminLocalValide('')).toBe(false)
    expect(estCheminLocalValide(undefined)).toBe(false)
    expect(estCheminLocalValide(null)).toBe(false)
    expect(estCheminLocalValide(42)).toBe(false)
  })
})

describe('schémas enum (doivent rester synchronisés avec prisma/schema.prisma)', () => {
  it('BrancheTypeSchema accepte les 5 branches et rejette le reste', () => {
    for (const v of ['OISILLONS', 'LOUVETEAUX', 'ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS']) {
      expect(BrancheTypeSchema.safeParse(v).success).toBe(true)
    }
    expect(BrancheTypeSchema.safeParse('AUTRE_CHOSE').success).toBe(false)
  })

  it("TypeActiviteSchema rejette une valeur inventée", () => {
    expect(TypeActiviteSchema.safeParse('HACK_INJECTION').success).toBe(false)
    expect(TypeActiviteSchema.safeParse('CAMP').success).toBe(true)
  })

  it('StatutReunionSchema rejette une valeur inventée', () => {
    expect(StatutReunionSchema.safeParse('EN_COURS').success).toBe(false)
    expect(StatutReunionSchema.safeParse('TERMINEE').success).toBe(true)
  })
})
