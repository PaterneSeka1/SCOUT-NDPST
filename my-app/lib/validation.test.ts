import { describe, it, expect } from 'vitest'
import {
  estCheminLocalValide,
  estUrlFichierValide,
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

describe('estUrlFichierValide', () => {
  it('accepte toujours ce que estCheminLocalValide accepte, sans origine autorisée', () => {
    expect(estUrlFichierValide('/uploads/x.png', null)).toBe(true)
    expect(estUrlFichierValide('/uploads/x.png')).toBe(true)
  })

  it('refuse une URL absolue quand aucune origine externe n\'est autorisée', () => {
    expect(estUrlFichierValide('https://mon-bucket.s3.amazonaws.com/public/x.png', null)).toBe(false)
  })

  it('accepte une URL absolue dont l\'origine correspond exactement à celle autorisée', () => {
    const origine = 'https://mon-bucket.s3.amazonaws.com'
    expect(estUrlFichierValide('https://mon-bucket.s3.amazonaws.com/public/x.png', origine)).toBe(true)
  })

  it('refuse une URL absolue dont l\'origine diffère de celle autorisée', () => {
    const origine = 'https://mon-bucket.s3.amazonaws.com'
    expect(estUrlFichierValide('https://evil.example.com/public/x.png', origine)).toBe(false)
  })

  it('refuse les valeurs non-string même avec une origine autorisée', () => {
    const origine = 'https://mon-bucket.s3.amazonaws.com'
    expect(estUrlFichierValide(undefined, origine)).toBe(false)
    expect(estUrlFichierValide(42, origine)).toBe(false)
  })
})

describe('schémas enum (doivent rester synchronisés avec prisma/schema.prisma)', () => {
  it('BrancheTypeSchema accepte les 6 branches et rejette le reste', () => {
    for (const v of ['OISILLONS', 'LOUVETEAUX', 'ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS', 'RESSOURCES_ADULTES']) {
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
