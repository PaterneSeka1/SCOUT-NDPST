import { describe, it, expect } from 'vitest'
import { normaliserDistrict } from './district'

describe('normaliserDistrict', () => {
  it('trime les espaces superflus', () => {
    expect(normaliserDistrict('  District Nord  ')).toBe('District Nord')
  })

  it('retourne null pour une valeur vide, nulle, indéfinie ou uniquement des espaces', () => {
    expect(normaliserDistrict('')).toBeNull()
    expect(normaliserDistrict('   ')).toBeNull()
    expect(normaliserDistrict(null)).toBeNull()
    expect(normaliserDistrict(undefined)).toBeNull()
  })

  it('conserve une valeur déjà propre telle quelle', () => {
    expect(normaliserDistrict('District Nord')).toBe('District Nord')
  })
})
