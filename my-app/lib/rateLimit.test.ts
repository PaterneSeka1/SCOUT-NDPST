import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { limiterTaux } from './rateLimit'

// Chaque test utilise une clé unique pour éviter toute interférence via l'état
// partagé (Map en mémoire au niveau du module).
let compteurCle = 0
function cleUnique() {
  compteurCle += 1
  return `test-${compteurCle}`
}

describe('limiterTaux', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('autorise les tentatives sous la limite', () => {
    const cle = cleUnique()
    expect(limiterTaux(cle, 3, 1000).autorise).toBe(true)
    expect(limiterTaux(cle, 3, 1000).autorise).toBe(true)
    expect(limiterTaux(cle, 3, 1000).autorise).toBe(true)
  })

  it('bloque après avoir atteint le nombre maximal de tentatives', () => {
    const cle = cleUnique()
    limiterTaux(cle, 3, 1000)
    limiterTaux(cle, 3, 1000)
    limiterTaux(cle, 3, 1000)
    const resultat = limiterTaux(cle, 3, 1000)
    expect(resultat.autorise).toBe(false)
    expect(resultat.resteTentatives).toBe(0)
  })

  it('décrémente correctement le nombre de tentatives restantes', () => {
    const cle = cleUnique()
    expect(limiterTaux(cle, 3, 1000).resteTentatives).toBe(2)
    expect(limiterTaux(cle, 3, 1000).resteTentatives).toBe(1)
    expect(limiterTaux(cle, 3, 1000).resteTentatives).toBe(0)
  })

  it("réinitialise le compteur une fois la fenêtre expirée", () => {
    const cle = cleUnique()
    limiterTaux(cle, 2, 1000)
    limiterTaux(cle, 2, 1000)
    expect(limiterTaux(cle, 2, 1000).autorise).toBe(false)

    vi.advanceTimersByTime(1001)

    expect(limiterTaux(cle, 2, 1000).autorise).toBe(true)
  })

  it('isole les compteurs par clé', () => {
    const cleA = cleUnique()
    const cleB = cleUnique()
    limiterTaux(cleA, 1, 1000)
    expect(limiterTaux(cleA, 1, 1000).autorise).toBe(false)
    expect(limiterTaux(cleB, 1, 1000).autorise).toBe(true)
  })
})
