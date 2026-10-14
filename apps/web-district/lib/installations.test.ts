import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// installations.ts garde la liste analysée en cache au niveau du module :
// chaque test recharge le module après avoir fixé INSTALLATIONS_GEREES.
async function charger(valeur: string | undefined) {
  if (valeur === undefined) vi.stubEnv('INSTALLATIONS_GEREES', undefined)
  else vi.stubEnv('INSTALLATIONS_GEREES', valeur)
  vi.resetModules()
  return import('./installations')
}

const VALIDE = JSON.stringify([
  { id: 'paroisse-wiradjuri', nom: '  Paroisse Wiradjuri  ', api: 'http://127.0.0.1:4000/' },
  { id: 'paroisse-2', nom: 'Paroisse 2', api: 'https://api.paroisse2.exemple.ci' },
])

describe('installationsGerees', () => {
  beforeEach(() => vi.unstubAllEnvs())
  afterEach(() => vi.unstubAllEnvs())

  it('renvoie une liste vide sans variable ou avec une valeur vide', async () => {
    expect((await charger(undefined)).installationsGerees()).toEqual([])
    expect((await charger('   ')).installationsGerees()).toEqual([])
  })

  it('analyse une liste valide, rogne le nom et retire la barre oblique finale de l’API', async () => {
    const { installationsGerees } = await charger(VALIDE)
    expect(installationsGerees()).toEqual([
      { id: 'paroisse-wiradjuri', nom: 'Paroisse Wiradjuri', api: 'http://127.0.0.1:4000' },
      { id: 'paroisse-2', nom: 'Paroisse 2', api: 'https://api.paroisse2.exemple.ci' },
    ])
  })

  it('rejette un JSON invalide', async () => {
    const { installationsGerees } = await charger('[{id:')
    expect(() => installationsGerees()).toThrow(/JSON invalide/)
  })

  it('rejette une valeur qui n’est pas une liste', async () => {
    const { installationsGerees } = await charger('{"id":"paroisse-1"}')
    expect(() => installationsGerees()).toThrow(/une liste est attendue/)
  })

  it.each([
    ['identifiant manquant', { nom: 'X', api: 'http://a' }],
    ['identifiant trop court', { id: 'ab', nom: 'X', api: 'http://a' }],
    ['identifiant en majuscules', { id: 'Paroisse', nom: 'X', api: 'http://a' }],
    ['identifiant avec caractères spéciaux', { id: 'par/../oisse', nom: 'X', api: 'http://a' }],
    ['identifiant trop long', { id: 'a'.repeat(41), nom: 'X', api: 'http://a' }],
    ['identifiant réservé « locale »', { id: 'locale', nom: 'X', api: 'http://a' }],
  ])('rejette un %s', async (_cas, element) => {
    const { installationsGerees } = await charger(JSON.stringify([element]))
    expect(() => installationsGerees()).toThrow('INSTALLATIONS_GEREES[0].id invalide.')
  })

  it('rejette un élément nul', async () => {
    const { installationsGerees } = await charger('[null]')
    expect(() => installationsGerees()).toThrow('INSTALLATIONS_GEREES[0].id invalide.')
  })

  it('rejette un nom manquant ou vide', async () => {
    const { installationsGerees } = await charger(JSON.stringify([{ id: 'paroisse-1', nom: '  ', api: 'http://a' }]))
    expect(() => installationsGerees()).toThrow('INSTALLATIONS_GEREES[0].nom manquant.')
  })

  it.each(['ftp://a', 'javascript:alert(1)', '//hote', '127.0.0.1:4000', 42])(
    'rejette une API invalide (%s)',
    async (api) => {
      const { installationsGerees } = await charger(
        JSON.stringify([
          { id: 'paroisse-1', nom: 'P1', api: 'http://ok' },
          { id: 'paroisse-2', nom: 'P2', api },
        ]),
      )
      expect(() => installationsGerees()).toThrow('INSTALLATIONS_GEREES[1].api invalide.')
    },
  )
})

describe('installationParId', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('retrouve une installation déclarée', async () => {
    const { installationParId } = await charger(VALIDE)
    expect(installationParId('paroisse-2')?.api).toBe('https://api.paroisse2.exemple.ci')
  })

  it('renvoie null pour l’installation locale, un identifiant absent ou inconnu', async () => {
    const { installationParId, INSTALLATION_LOCALE } = await charger(VALIDE)
    expect(installationParId(undefined)).toBeNull()
    expect(installationParId('')).toBeNull()
    expect(installationParId(INSTALLATION_LOCALE)).toBeNull()
    expect(installationParId('inconnue')).toBeNull()
    expect(installationParId('http://169.254.169.254')).toBeNull()
  })

  it('renvoie null quand aucune installation n’est configurée', async () => {
    const { installationParId } = await charger(undefined)
    expect(installationParId('paroisse-wiradjuri')).toBeNull()
  })
})

describe('routeAdministrable', () => {
  it.each(['/api/admin/paroisses', '/api/admin/utilisateurs/42', '/api/admin/apparence', '/api/upload'])(
    'relaie %s',
    async (chemin) => {
      const { routeAdministrable } = await charger(undefined)
      expect(routeAdministrable(chemin)).toBe(true)
    },
  )

  it.each([
    '/api/auth/connexion',
    '/api/auth/rafraichir',
    '/api/auth/mot-de-passe-oublie',
    '/api/auth/reinitialiser-motdepasse',
    '/api/moi',
    '/api/public/logo',
    '/api/admin',
    '/api/administration/x',
    '/api/upload/autre',
    '/api/uploads',
    '/admin/paroisses',
  ])('ne relaie pas %s', async (chemin) => {
    const { routeAdministrable } = await charger(undefined)
    expect(routeAdministrable(chemin)).toBe(false)
  })
})
