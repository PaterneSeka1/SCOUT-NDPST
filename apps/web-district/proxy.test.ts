import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const ORIGINE = 'https://district.exemple.ci'
const API_LOCALE = 'http://api-district.interne:4000'
const INSTALLATIONS = [{ id: 'paroisse-wiradjuri', nom: 'Paroisse Wiradjuri', api: 'http://api-paroisse.interne:4100' }]

async function chargerProxy() {
  vi.resetModules()
  return (await import('./proxy')).default
}

function requete(chemin: string, cookies: Record<string, string> = {}) {
  const cookie = Object.entries(cookies)
    .map(([nom, valeur]) => `${nom}=${valeur}`)
    .join('; ')
  return new NextRequest(new URL(chemin, ORIGINE), { headers: cookie ? { cookie } : {} })
}

const reecriture = (r: Response) => r.headers.get('x-middleware-rewrite')
const estSuite = (r: Response) => r.headers.get('x-middleware-next') === '1'

describe('proxy (console district)', () => {
  let fetchSimule: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubEnv('API_URL_INTERNE', API_LOCALE)
    vi.stubEnv('INSTALLATIONS_GEREES', JSON.stringify(INSTALLATIONS))
    fetchSimule = vi.fn()
    vi.stubGlobal('fetch', fetchSimule)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  describe('pages', () => {
    it('protège la page de changement obligatoire sans session', async () => {
      const proxy = await chargerProxy()
      const reponse = await proxy(requete('/changer-mot-de-passe'))
      expect(new URL(reponse.headers.get('location')!).pathname).toBe('/login')
    })

    it('rafraîchit la session avant le formulaire de changement obligatoire', async () => {
      fetchSimule.mockResolvedValue(new Response('{}', {
        headers: [['set-cookie', 'scout_acces=nouveau; Path=/; HttpOnly']],
      }))
      const proxy = await chargerProxy()
      const reponse = await proxy(requete('/changer-mot-de-passe', { scout_session: 'session-active' }))
      expect(estSuite(reponse)).toBe(true)
      expect(fetchSimule).toHaveBeenCalledWith(`${API_LOCALE}/api/auth/rafraichir`, expect.anything())
    })

    it('redirige /admin vers /login sans session, en conservant la destination', async () => {
      const proxy = await chargerProxy()
      const reponse = await proxy(requete('/admin/paroisses'))
      expect(reponse.status).toBe(307)
      const location = new URL(reponse.headers.get('location')!)
      expect(location.pathname).toBe('/login')
      expect(location.searchParams.get('callbackUrl')).toBe('/admin/paroisses')
      expect(fetchSimule).not.toHaveBeenCalled()
    })

    it.each(['/login', '/mot-de-passe-oublie', '/reinitialiser-motdepasse?token=abc'])(
      'laisse passer %s sans session',
      async (chemin) => {
        const proxy = await chargerProxy()
        const reponse = await proxy(requete(chemin))
        expect(estSuite(reponse)).toBe(true)
        expect(reponse.headers.get('location')).toBeNull()
      },
    )

    it('laisse passer /admin avec un jeton d’accès', async () => {
      const proxy = await chargerProxy()
      const reponse = await proxy(requete('/admin', { scout_acces: 'jeton' }))
      expect(estSuite(reponse)).toBe(true)
    })

    it('rafraîchit le jeton d’accès depuis la session puis laisse passer /admin', async () => {
      fetchSimule.mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: [
            ['set-cookie', 'scout_acces=nouveau-jeton; Path=/; HttpOnly'],
            ['set-cookie', 'scout_session=session-2; Path=/; HttpOnly'],
          ],
        }),
      )
      const proxy = await chargerProxy()
      const reponse = await proxy(requete('/admin', { scout_session: 'session-1' }))
      expect(fetchSimule).toHaveBeenCalledWith(`${API_LOCALE}/api/auth/rafraichir`, expect.anything())
      expect(estSuite(reponse)).toBe(true)
      expect(reponse.headers.getSetCookie().join('\n')).toContain('scout_acces=nouveau-jeton')
    })

    it('redirige vers /login et efface la session si le rafraîchissement échoue', async () => {
      fetchSimule.mockResolvedValue(new Response('{}', { status: 401 }))
      const proxy = await chargerProxy()
      const reponse = await proxy(requete('/admin', { scout_session: 'expiree' }))
      expect(new URL(reponse.headers.get('location')!).pathname).toBe('/login')
      expect(reponse.headers.getSetCookie().join('\n')).toMatch(/scout_session=;/)
    })

    it('ne tente pas de rafraîchissement sur les routes /api/auth/', async () => {
      const proxy = await chargerProxy()
      await proxy(requete('/api/auth/mot-de-passe-oublie', { scout_session: 's' }))
      expect(fetchSimule).not.toHaveBeenCalled()
    })
  })

  describe('relais vers une installation gérée', () => {
    it('relaie une route administrable vers l’API de l’installation choisie, avec le seul jeton d’accès', async () => {
      const proxy = await chargerProxy()
      const reponse = await proxy(
        requete('/api/admin/paroisses?page=2', {
          scout_acces: 'jeton',
          scout_session: 'session-district',
          scout_installation: 'paroisse-wiradjuri',
        }),
      )
      expect(reecriture(reponse)).toBe('http://api-paroisse.interne:4100/api/admin/paroisses?page=2')
      // Le cookie relayé ne contient que le jeton d'accès (jamais la session district).
      const cookieRelaye = reponse.headers.get('x-middleware-request-cookie')
      expect(cookieRelaye).toBe('scout_acces=jeton')
    })

    it('relaie /api/upload vers l’installation choisie', async () => {
      const proxy = await chargerProxy()
      const reponse = await proxy(
        requete('/api/upload', { scout_acces: 'jeton', scout_installation: 'paroisse-wiradjuri' }),
      )
      expect(reecriture(reponse)).toBe('http://api-paroisse.interne:4100/api/upload')
    })

    it('refuse (401) le relais sans jeton d’accès', async () => {
      const proxy = await chargerProxy()
      const reponse = await proxy(requete('/api/admin/paroisses', { scout_installation: 'paroisse-wiradjuri' }))
      expect(reponse.status).toBe(401)
      expect(reecriture(reponse)).toBeNull()
    })

    it.each(['/api/auth/connexion', '/api/auth/mot-de-passe-oublie', '/api/moi'])(
      'ne relaie pas la route non administrable %s',
      async (chemin) => {
        const proxy = await chargerProxy()
        const reponse = await proxy(requete(chemin, { scout_acces: 'jeton', scout_installation: 'paroisse-wiradjuri' }))
        expect(reecriture(reponse)).toBeNull()
        expect(estSuite(reponse)).toBe(true)
      },
    )

    it.each(['inconnue', 'locale', 'http://169.254.169.254', encodeURIComponent('evil.exemple.com')])(
      'ne relaie pas vers une installation hors liste blanche (%s)',
      async (id) => {
        const proxy = await chargerProxy()
        const reponse = await proxy(requete('/api/admin/paroisses', { scout_acces: 'jeton', scout_installation: id }))
        expect(reecriture(reponse)).toBeNull()
        expect(estSuite(reponse)).toBe(true)
      },
    )

    it('ne relaie rien sans cookie d’installation', async () => {
      const proxy = await chargerProxy()
      const reponse = await proxy(requete('/api/admin/paroisses', { scout_acces: 'jeton' }))
      expect(reecriture(reponse)).toBeNull()
    })
  })

  describe('périmètre V1', () => {
    it('renvoie 404 pour une API hors périmètre', async () => {
      const proxy = await chargerProxy()
      const reponse = await proxy(requete('/api/rapports', { scout_acces: 'jeton' }))
      expect(reponse.status).toBe(404)
    })

    it('redirige une page hors périmètre vers /admin', async () => {
      const proxy = await chargerProxy()
      const reponse = await proxy(requete('/admin/rapports', { scout_acces: 'jeton' }))
      expect(new URL(reponse.headers.get('location')!).pathname).toBe('/admin')
    })
  })
})
