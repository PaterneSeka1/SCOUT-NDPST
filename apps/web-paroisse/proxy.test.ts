import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import proxy from './proxy'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('première connexion paroissiale', () => {
  it('redirige vers la connexion en absence de session', async () => {
    const reponse = await proxy(new NextRequest('https://scout.exemple.ci/changer-mot-de-passe'))
    expect(new URL(reponse.headers.get('location')!).pathname).toBe('/login')
  })
  it('rafraîchit un accès expiré avant le formulaire obligatoire', async () => {
    vi.stubEnv('API_URL_INTERNE', 'http://api.interne:4000')
    const fetchSimule = vi.fn().mockResolvedValue(new Response('{}', {
      headers: [['set-cookie', 'scout_acces=nouveau; Path=/; HttpOnly']],
    }))
    vi.stubGlobal('fetch', fetchSimule)
    const reponse = await proxy(new NextRequest('https://scout.exemple.ci/changer-mot-de-passe', {
      headers: { cookie: 'scout_session=session-active' },
    }))
    expect(reponse.headers.get('x-middleware-next')).toBe('1')
    expect(fetchSimule).toHaveBeenCalledWith('http://api.interne:4000/api/auth/rafraichir', expect.anything())
  })
})
