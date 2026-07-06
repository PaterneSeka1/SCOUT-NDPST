import { describe, it, expect } from 'vitest'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from './password'

describe('motDePasseValide', () => {
  it('accepte un mot de passe conforme (8+ caractères, lettre + chiffre)', () => {
    expect(motDePasseValide('Admin1234!')).toBe(true)
    expect(motDePasseValide('abcdefg1')).toBe(true)
  })

  it('refuse un mot de passe trop court', () => {
    expect(motDePasseValide('Ab1')).toBe(false)
    expect(motDePasseValide('Ab12345')).toBe(false) // 7 caractères
  })

  it('refuse un mot de passe sans chiffre', () => {
    expect(motDePasseValide('AbcdefghIJ')).toBe(false)
  })

  it('refuse un mot de passe sans lettre', () => {
    expect(motDePasseValide('12345678')).toBe(false)
  })

  it('refuse une chaîne vide', () => {
    expect(motDePasseValide('')).toBe(false)
  })

  it('expose un message de règle non vide', () => {
    expect(REGLE_MOT_DE_PASSE.length).toBeGreaterThan(0)
  })
})
