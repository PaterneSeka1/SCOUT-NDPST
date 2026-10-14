import { afterEach, describe, expect, it, vi } from 'vitest'
import { urlApiInterne } from './api-interne'

describe('urlApiInterne', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('échoue en production sans API_URL_INTERNE', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('API_URL_INTERNE', undefined)
    expect(() => urlApiInterne()).toThrow(/API_URL_INTERNE manquante/)
  })

  it('échoue en production avec une valeur vide', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('API_URL_INTERNE', '   ')
    expect(() => urlApiInterne()).toThrow(/API_URL_INTERNE manquante/)
  })

  it('se replie sur l’API locale en développement', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('API_URL_INTERNE', undefined)
    expect(urlApiInterne()).toBe('http://127.0.0.1:4000')
  })

  it('utilise la valeur configurée en retirant espaces et barre oblique finale', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('API_URL_INTERNE', '  http://api.interne:4000/  ')
    expect(urlApiInterne()).toBe('http://api.interne:4000')
  })
})
