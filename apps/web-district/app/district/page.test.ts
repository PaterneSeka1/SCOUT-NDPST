import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EtatApercuDistrict } from '@/lib/apercu-district'
import { ApercuDistrict } from './ApercuDistrict'

const simulations = vi.hoisted(() => ({
  v1: true,
  session: vi.fn(),
  api: vi.fn(),
  notFound: vi.fn(() => { throw new Error('PAGE_404') }),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECTION:${url}`) }),
}))
vi.mock('@scout/shared', async (original) => ({
  ...await original<typeof import('@scout/shared')>(),
  get PERIMETRE_V1() { return simulations.v1 },
}))
vi.mock('@/lib/session-serveur', () => ({ getSession: simulations.session }))
vi.mock('@/lib/api-serveur', () => ({ appelApiServeur: simulations.api }))
vi.mock('next/navigation', () => ({ notFound: simulations.notFound, redirect: simulations.redirect }))

import DistrictPage from './page'

const donnees = {
  nomDistrict: 'Test',
  totaux: { paroisses: 1, paroissesActives: 1, scouts: 12, utilisateurs: 4, activitesMois: 2 },
  paroisses: [{ id: 'p1', nom: 'Saint Test', ville: 'Abidjan', actif: true, scouts: 12, utilisateurs: 4 }],
}

describe('Préparation du rendu serveur district', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    simulations.v1 = true
    simulations.session.mockResolvedValue({ user: { role: 'CHEF_GROUPE', roleDistrict: 'COMMISSAIRE_DISTRICT', doitChangerMotDePasse: false } })
    simulations.api.mockImplementation(async () => Response.json(donnees))
  })

  it('reste inaccessible en V1 avant toute lecture de session ou de données', async () => {
    const reel = await vi.importActual<typeof import('@scout/shared')>('@scout/shared')
    expect(reel.PERIMETRE_V1).toBe(true)
    await expect(DistrictPage()).rejects.toThrow('PAGE_404')
    expect(simulations.session).not.toHaveBeenCalled()
    expect(simulations.api).not.toHaveBeenCalled()
  })

  it('rend les agrégats locaux dans une simulation hors V1 sans appel de consolidation', async () => {
    simulations.v1 = false
    const contenu = renderToStaticMarkup(await DistrictPage())
    expect(contenu).toContain('District Test')
    expect(contenu).toContain('Saint Test')
    expect(contenu).toContain('Données de cette installation uniquement')
    expect(simulations.api).toHaveBeenCalledExactlyOnceWith('/api/district/apercu')
  })

  it.each(['ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT', null])('refuse une affectation hors ROLES_DISTRICT : %s', async (roleDistrict) => {
    simulations.v1 = false
    simulations.session.mockResolvedValue({ user: { role: 'CHEF_GROUPE', roleDistrict } })
    await expect(DistrictPage()).rejects.toThrow('PAGE_404')
    expect(simulations.api).not.toHaveBeenCalled()
  })

  it('renvoie un utilisateur non connecté vers la connexion', async () => {
    simulations.v1 = false
    simulations.session.mockResolvedValue(null)
    await expect(DistrictPage()).rejects.toThrow('REDIRECTION:/login?callbackUrl=%2Fdistrict')
    expect(simulations.api).not.toHaveBeenCalled()
  })

  it('impose le changement du mot de passe avant la consultation', async () => {
    simulations.v1 = false
    simulations.session.mockResolvedValue({ user: { roleDistrict: 'COMMISSAIRE_DISTRICT', doitChangerMotDePasse: true } })
    await expect(DistrictPage()).rejects.toThrow('REDIRECTION:/changer-mot-de-passe')
    expect(simulations.api).not.toHaveBeenCalled()
  })

  it.each([
    ['session-expiree', 'Session expirée'], ['interdit', 'Accès interdit'],
    ['fonctionnalite-indisponible', 'Espace district indisponible'],
    ['indisponible', 'Indicateurs indisponibles'], ['invalide', 'Indicateurs incohérents'],
    ['reseau', 'Connexion au service impossible'],
  ] as const)('rend explicitement l’état %s sans indicateur fictif', (statut, titre) => {
    const etat: EtatApercuDistrict = { statut }
    const contenu = renderToStaticMarkup(createElement(ApercuDistrict, { etat }))
    expect(contenu).toContain(titre)
    expect(contenu).toContain('role="alert"')
    expect(contenu).not.toContain('<dd')
    if (statut === 'session-expiree') expect(contenu).toContain('Se reconnecter')
    if (['indisponible', 'invalide', 'reseau'].includes(statut)) expect(contenu).toContain('Réessayer')
  })

  it('affiche un état vide lorsque l’API confirme l’absence de paroisses', () => {
    const contenu = renderToStaticMarkup(createElement(ApercuDistrict, { etat: {
      statut: 'disponible', donnees: { nomDistrict: 'Test', totaux: { paroisses: 0, paroissesActives: 0, scouts: 0, utilisateurs: 0, activitesMois: 0 }, paroisses: [] },
    } }))
    expect(contenu).toContain('Aucune paroisse rattachée')
  })
})
