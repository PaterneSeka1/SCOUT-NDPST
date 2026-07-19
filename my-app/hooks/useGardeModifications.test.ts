import { describe, it, expect } from 'vitest'
import { sontDifferents } from './useGardeModifications'

describe('sontDifferents', () => {
  it('renvoie false pour des valeurs structurellement identiques', () => {
    expect(sontDifferents({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(false)
  })

  it('renvoie true si une valeur diffère', () => {
    expect(sontDifferents({ a: 1 }, { a: 2 })).toBe(true)
  })

  it('renvoie true si la structure diffère', () => {
    expect(sontDifferents({ a: 1 }, { a: 1, b: 2 })).toBe(true)
  })

  it('gère les valeurs primitives', () => {
    expect(sontDifferents('abc', 'abc')).toBe(false)
    expect(sontDifferents(1, 2)).toBe(true)
  })

  it('gère les tableaux', () => {
    expect(sontDifferents([1, 2, 3], [1, 2, 3])).toBe(false)
    expect(sontDifferents([1, 2, 3], [1, 2])).toBe(true)
  })

  it('gère null/undefined', () => {
    expect(sontDifferents(null, null)).toBe(false)
    expect(sontDifferents(null, undefined)).toBe(true)
  })
})
