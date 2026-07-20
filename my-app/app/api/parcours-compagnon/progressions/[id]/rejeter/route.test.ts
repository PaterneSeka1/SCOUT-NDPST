import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/audit', () => ({ enregistrerAudit: vi.fn() }))
vi.mock('@/lib/parcoursCompagnonPermissions', () => ({
  autoriseValidationParcoursCompagnon: vi.fn(),
}))
vi.mock('@/lib/parcoursCompagnonService', () => ({
  chargerProgressionAvecScout: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { progressionCompagnon: { update: vi.fn() } },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { enregistrerAudit } from '@/lib/audit'
import { autoriseValidationParcoursCompagnon } from '@/lib/parcoursCompagnonPermissions'
import { chargerProgressionAvecScout } from '@/lib/parcoursCompagnonService'
import { POST } from './route'

function session() {
  return { user: { id: 'validateur-1', role: 'AUTRE', roleDistrict: 'COMMISSAIRE_DISTRICT', paroisseId: 'paroisse-1' } }
}

function progressionMock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'progression-1',
    statut: 'SOUMISE',
    etapeActiviteId: 'etape-1',
    parcours: { scout: { id: 'scout-1', paroisseId: 'paroisse-1', brancheType: 'COMPAGNONS' } },
    ...overrides,
  }
}

function req(body: unknown) {
  return new NextRequest(new URL('http://localhost/api/parcours-compagnon/progressions/progression-1/rejeter'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: 'progression-1' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/parcours-compagnon/progressions/[id]/rejeter', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(req({ motifRejet: 'x' }), { params })
    expect(res.status).toBe(401)
  })

  it("404 si l'activité n'existe pas ou n'est pas dans le périmètre du validateur", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(null as never)
    const res = await POST(req({ motifRejet: 'x' }), { params })
    expect(res.status).toBe(404)
  })

  it('409 si l\'activité n\'est pas au statut SOUMISE', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock({ statut: 'VALIDEE' }) as never)
    vi.mocked(autoriseValidationParcoursCompagnon).mockResolvedValue(true)
    const res = await POST(req({ motifRejet: 'x' }), { params })
    expect(res.status).toBe(409)
  })

  it('400 si le motif de rejet est manquant', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock() as never)
    vi.mocked(autoriseValidationParcoursCompagnon).mockResolvedValue(true)
    const res = await POST(req({}), { params })
    expect(res.status).toBe(400)
  })

  it('400 si le motif de rejet est une chaîne vide (espaces uniquement)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock() as never)
    vi.mocked(autoriseValidationParcoursCompagnon).mockResolvedValue(true)
    const res = await POST(req({ motifRejet: '   ' }), { params })
    expect(res.status).toBe(400)
  })

  it('rejette avec motif et journalise PROGRESSION_COMPAGNON_REJETEE', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock() as never)
    vi.mocked(autoriseValidationParcoursCompagnon).mockResolvedValue(true)
    vi.mocked(prisma.progressionCompagnon.update).mockResolvedValue({ id: 'progression-1', statut: 'REJETEE' } as never)

    const res = await POST(req({ motifRejet: 'Preuve manquante' }), { params })

    expect(res.status).toBe(200)
    expect(prisma.progressionCompagnon.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statut: 'REJETEE', motifRejet: 'Preuve manquante' }) }),
    )
    expect(enregistrerAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROGRESSION_COMPAGNON_REJETEE', details: expect.objectContaining({ motifRejet: 'Preuve manquante' }) }),
    )
  })
})
