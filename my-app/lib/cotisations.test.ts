import { describe, it, expect } from 'vitest'
import { anneeScolaireCourante, formatMontantFCFA } from './cotisations'

describe('anneeScolaireCourante', () => {
  it('renvoie l\'année en cours quand on est après septembre', () => {
    expect(anneeScolaireCourante(new Date('2026-10-15'))).toBe('2026-2027')
  })

  it('renvoie l\'année précédente quand on est avant septembre', () => {
    expect(anneeScolaireCourante(new Date('2026-07-06'))).toBe('2025-2026')
  })

  it('bascule pile en septembre', () => {
    expect(anneeScolaireCourante(new Date('2026-09-01'))).toBe('2026-2027')
  })
})

describe('formatMontantFCFA', () => {
  it('formate avec séparateur de milliers et suffixe FCFA', () => {
    expect(formatMontantFCFA(5000)).toMatch(/^5.000 FCFA$/)
  })
})
