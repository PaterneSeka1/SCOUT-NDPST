import { describe, it, expect, vi, afterEach } from 'vitest'
import { logger } from './logger'

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('émet une ligne JSON structurée sur console.log pour info', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.info('test.evenement', { cle: 'valeur' })
    expect(spy).toHaveBeenCalledOnce()
    const ligne = JSON.parse(spy.mock.calls[0][0] as string)
    expect(ligne).toMatchObject({ niveau: 'info', evenement: 'test.evenement', cle: 'valeur' })
    expect(typeof ligne.horodatage).toBe('string')
  })

  it('émet sur console.warn pour warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('test.warn')
    expect(spy).toHaveBeenCalledOnce()
  })

  it('sérialise le message et la pile pour une Error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('test.erreur', new Error('boom'))
    const ligne = JSON.parse(spy.mock.calls[0][0] as string)
    expect(ligne.niveau).toBe('error')
    expect(ligne.erreur.message).toBe('boom')
    expect(typeof ligne.erreur.stack).toBe('string')
  })

  it('gère une valeur non-Error passée à error()', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('test.erreur', 'chaine brute')
    const ligne = JSON.parse(spy.mock.calls[0][0] as string)
    expect(ligne.erreur.message).toBe('chaine brute')
  })
})
