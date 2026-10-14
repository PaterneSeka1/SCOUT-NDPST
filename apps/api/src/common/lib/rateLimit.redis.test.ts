import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Faux client Redis : compteurs en mémoire, ou panne simulée.
const redis = vi.hoisted(() => ({
  valeurs: new Map<string, number>(),
  enPanne: false,
  expirations: new Map<string, string>(),
}))
vi.mock('ioredis', () => ({
  default: class {
    on() {}
    disconnect() {}
    async quit() {}
    async eval(_script: string, _nb: number, cle: string, fenetre: string) {
      if (redis.enPanne) throw new Error('Connection is closed.')
      const compte = (redis.valeurs.get(cle) ?? 0) + 1
      redis.valeurs.set(cle, compte)
      if (compte === 1) redis.expirations.set(cle, fenetre)
      return compte
    }
    async get(cle: string) {
      if (redis.enPanne) throw new Error('Connection is closed.')
      const v = redis.valeurs.get(cle)
      return v === undefined ? null : String(v)
    }
  },
}))

import { fermerLimiteur, limiteAtteinte, limiterTaux } from './rateLimit'

describe('limiterTaux avec REDIS_URL', () => {
  beforeEach(() => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379'
    process.env.INSTALLATION_ID = 'paroisse-test'
    redis.valeurs.clear()
    redis.expirations.clear()
    redis.enPanne = false
  })

  afterEach(async () => {
    delete process.env.REDIS_URL
    await fermerLimiteur()
  })

  it("compte dans Redis, avec une clé préfixée par l'installation et une durée de vie", async () => {
    await limiterTaux('login:ip:1.2.3.4', 2, 60_000)
    expect(redis.valeurs.get('scout:paroisse-test:limite:login:ip:1.2.3.4')).toBe(1)
    expect(redis.expirations.get('scout:paroisse-test:limite:login:ip:1.2.3.4')).toBe('60000')
    await limiterTaux('login:ip:1.2.3.4', 2, 60_000)
    expect(await limiteAtteinte('login:ip:1.2.3.4', 2)).toBe(true)
  })

  it('bascule sur la mémoire si Redis est injoignable, sans laisser passer sans limite', async () => {
    redis.enPanne = true
    expect((await limiterTaux('cle-panne', 1, 60_000)).autorise).toBe(true)
    expect((await limiterTaux('cle-panne', 1, 60_000)).autorise).toBe(false)
  })
})
