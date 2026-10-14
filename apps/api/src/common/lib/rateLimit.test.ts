import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { limiteAtteinte, limiterTaux } from './rateLimit'

// Magasin mémoire (REDIS_URL absent dans les tests). Chaque test utilise une
// clé unique pour éviter toute interférence via l'état partagé du module.
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

  it('autorise les tentatives sous la limite', async () => {
    const cle = cleUnique()
    expect((await limiterTaux(cle, 3, 1000)).autorise).toBe(true)
    expect((await limiterTaux(cle, 3, 1000)).autorise).toBe(true)
    expect((await limiterTaux(cle, 3, 1000)).autorise).toBe(true)
  })

  it('bloque au-delà de la limite', async () => {
    const cle = cleUnique()
    await limiterTaux(cle, 3, 1000)
    await limiterTaux(cle, 3, 1000)
    await limiterTaux(cle, 3, 1000)
    const resultat = await limiterTaux(cle, 3, 1000)
    expect(resultat.autorise).toBe(false)
    expect(resultat.resteTentatives).toBe(0)
  })

  it('décompte les tentatives restantes', async () => {
    const cle = cleUnique()
    expect((await limiterTaux(cle, 3, 1000)).resteTentatives).toBe(2)
    expect((await limiterTaux(cle, 3, 1000)).resteTentatives).toBe(1)
    expect((await limiterTaux(cle, 3, 1000)).resteTentatives).toBe(0)
  })

  it('réinitialise le compteur après la fenêtre', async () => {
    const cle = cleUnique()
    await limiterTaux(cle, 2, 1000)
    await limiterTaux(cle, 2, 1000)
    expect((await limiterTaux(cle, 2, 1000)).autorise).toBe(false)

    vi.advanceTimersByTime(1001)

    expect((await limiterTaux(cle, 2, 1000)).autorise).toBe(true)
  })

  it('isole les compteurs par clé', async () => {
    const cleA = cleUnique()
    const cleB = cleUnique()
    await limiterTaux(cleA, 1, 1000)
    expect((await limiterTaux(cleA, 1, 1000)).autorise).toBe(false)
    expect((await limiterTaux(cleB, 1, 1000)).autorise).toBe(true)
  })
})

describe('limiteAtteinte', () => {
  it('consulte le compteur sans compter de tentative', async () => {
    const cle = cleUnique()
    expect(await limiteAtteinte(cle, 2)).toBe(false)
    expect(await limiteAtteinte(cle, 2)).toBe(false)
    await limiterTaux(cle, 2, 60_000)
    expect(await limiteAtteinte(cle, 2)).toBe(false)
    await limiterTaux(cle, 2, 60_000)
    expect(await limiteAtteinte(cle, 2)).toBe(true)
  })
})
