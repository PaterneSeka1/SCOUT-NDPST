import { describe, it, expect } from 'vitest'
import { normaliserDoyenne } from './district'

describe('normaliserDoyenne', () => {
  it('trime les espaces superflus', () => {
    expect(normaliserDoyenne('  Doyenné de Cocody  ')).toBe('Doyenné de Cocody')
  })

  it('retourne null pour une valeur vide, nulle, indéfinie ou uniquement des espaces', () => {
    expect(normaliserDoyenne('')).toBeNull()
    expect(normaliserDoyenne('   ')).toBeNull()
    expect(normaliserDoyenne(null)).toBeNull()
    expect(normaliserDoyenne(undefined)).toBeNull()
  })

  it('conserve une valeur déjà propre telle quelle', () => {
    expect(normaliserDoyenne('Doyenné de Cocody')).toBe('Doyenné de Cocody')
  })
})
