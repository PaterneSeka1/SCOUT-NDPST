import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/audit', () => ({ enregistrerAudit: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { cotisation: { findMany: vi.fn() } },
}))
vi.mock('@/lib/district', () => {
  class DistrictInvalideError extends Error {}
  return { getParoissesDuDistrict: vi.fn(), DistrictInvalideError }
})

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { getParoissesDuDistrict } from '@/lib/district'
import { GET } from './route'

const PAROISSE_ANCRAGE = 'paroisse-ancrage'
const PAROISSES_DISTRICT = [
  { id: 'paroisse-1', nom: 'Sainte-Thérèse', ville: 'Yopougon', actif: true },
  { id: 'paroisse-2', nom: 'Saint-Paul', ville: 'Cocody', actif: true },
]

function session(roleDistrict: string | null, overrides: Record<string, unknown> = {}) {
  return { user: { id: 'user-1', role: 'CHEF_GROUPE', roleDistrict, paroisseId: PAROISSE_ANCRAGE, ...overrides } }
}

function req(query = '') {
  return new NextRequest(new URL(`http://localhost/api/district/rapports/export${query}`))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getParoissesDuDistrict).mockResolvedValue({
    districtId: 'district-1',
    nomDistrict: 'District Abidjan',
    paroisses: PAROISSES_DISTRICT,
  })
})

describe('GET /api/district/rapports/export', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it("403 pour un roleDistrict absent (staff paroissial sans affectation district)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session(null) as never)
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it('403 pour ADJOINT_DISTRICT (réservé au Commissaire lui-même)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADJOINT_DISTRICT') as never)
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it("400 si paroisseId ne fait pas partie du district du commissaire (IDOR cross-district)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('COMMISSAIRE_DISTRICT') as never)
    const res = await GET(req('?paroisseId=paroisse-hors-district'))
    expect(res.status).toBe(400)
    expect(prisma.cotisation.findMany).not.toHaveBeenCalled()
  })

  it('400 si la branche est invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('COMMISSAIRE_DISTRICT') as never)
    const res = await GET(req('?branche=BIDON'))
    expect(res.status).toBe(400)
  })

  it('400 si un statut est invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('COMMISSAIRE_DISTRICT') as never)
    const res = await GET(req('?statut=BIDON'))
    expect(res.status).toBe(400)
  })

  it('sans filtre, interroge toutes les paroisses du district (pas une seule)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('COMMISSAIRE_DISTRICT') as never)
    vi.mocked(prisma.cotisation.findMany).mockResolvedValue([])

    await GET(req())

    const where = vi.mocked(prisma.cotisation.findMany).mock.calls[0][0]?.where
    expect(where?.paroisseId).toEqual({ in: ['paroisse-1', 'paroisse-2'] })
  })

  it('avec un paroisseId valide du district, restreint la requête à cette seule paroisse', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('COMMISSAIRE_DISTRICT') as never)
    vi.mocked(prisma.cotisation.findMany).mockResolvedValue([])

    await GET(req('?paroisseId=paroisse-2'))

    const where = vi.mocked(prisma.cotisation.findMany).mock.calls[0][0]?.where
    expect(where?.paroisseId).toBe('paroisse-2')
  })

  it("le CSV n'a pas de colonne District (implicite au périmètre) mais garde Paroisse/Ville", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('COMMISSAIRE_DISTRICT') as never)
    vi.mocked(prisma.cotisation.findMany).mockResolvedValue([])

    const res = await GET(req())
    const texte = await res.text()

    expect(texte).toContain('"Paroisse";"Ville";"Participant"')
  })
})
