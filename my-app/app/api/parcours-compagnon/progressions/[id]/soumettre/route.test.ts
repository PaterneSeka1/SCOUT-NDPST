import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/audit', () => ({ enregistrerAudit: vi.fn() }))
vi.mock('@/lib/parcoursCompagnonPermissions', () => ({
  autoriseDeclarationParcoursCompagnon: vi.fn(),
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
import { autoriseDeclarationParcoursCompagnon } from '@/lib/parcoursCompagnonPermissions'
import { chargerProgressionAvecScout } from '@/lib/parcoursCompagnonService'
import { POST } from './route'

function session(role = 'RESPONSABLE_BRANCHE') {
  return { user: { id: 'user-1', role, roleDistrict: null, paroisseId: 'paroisse-1' } }
}

function progressionMock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'progression-1',
    statut: 'A_VENIR',
    etapeActiviteId: 'etape-1',
    parcoursId: 'parcours-1',
    parcours: { scout: { id: 'scout-1', paroisseId: 'paroisse-1', brancheType: 'COMPAGNONS' } },
    ...overrides,
  }
}

function req(body: unknown) {
  return new NextRequest(new URL('http://localhost/api/parcours-compagnon/progressions/progression-1/soumettre'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: 'progression-1' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/parcours-compagnon/progressions/[id]/soumettre', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(req({}), { params })
    expect(res.status).toBe(401)
  })

  it("404 si l'activité n'existe pas ou si l'utilisateur n'est pas autorisé (même réponse dans les deux cas)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(null as never)
    const res = await POST(req({ dateRealisationDeclaree: '2026-01-01' }), { params })
    expect(res.status).toBe(404)
  })

  it("404 si l'activité existe mais que l'utilisateur n'est pas autorisé sur ce scout", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock() as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(false)
    const res = await POST(req({ dateRealisationDeclaree: '2026-01-01' }), { params })
    expect(res.status).toBe(404)
  })

  it('409 si l\'activité est déjà VALIDEE', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock({ statut: 'VALIDEE' }) as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    const res = await POST(req({ dateRealisationDeclaree: '2026-01-01' }), { params })
    expect(res.status).toBe(409)
  })

  it('409 si l\'activité est déjà SOUMISE (pas de double soumission)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock({ statut: 'SOUMISE' }) as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    const res = await POST(req({ dateRealisationDeclaree: '2026-01-01' }), { params })
    expect(res.status).toBe(409)
  })

  it('400 si dateRealisationDeclaree est manquante ou invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock() as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    const res = await POST(req({ dateRealisationDeclaree: 'pas-une-date' }), { params })
    expect(res.status).toBe(400)
  })

  it('400 si la date de réalisation est dans le futur', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock() as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    const dansLeFutur = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const res = await POST(req({ dateRealisationDeclaree: dansLeFutur }), { params })
    expect(res.status).toBe(400)
  })

  it('soumet une première fois : action SOUMISE, numeroSoumission incrémenté', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock({ statut: 'A_VENIR' }) as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    vi.mocked(prisma.progressionCompagnon.update).mockResolvedValue({ id: 'progression-1', numeroSoumission: 1 } as never)

    const res = await POST(req({ dateRealisationDeclaree: '2026-01-01', commentaire: 'Fait au camp' }), { params })

    expect(res.status).toBe(200)
    expect(enregistrerAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROGRESSION_COMPAGNON_SOUMISE' }),
    )
  })

  it('une resoumission après rejet efface les champs actifs du rejet précédent et journalise RESOUMISE', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(
      progressionMock({ statut: 'REJETEE', motifRejet: 'Preuve manquante' }) as never,
    )
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    vi.mocked(prisma.progressionCompagnon.update).mockResolvedValue({ id: 'progression-1', numeroSoumission: 2 } as never)

    const res = await POST(req({ dateRealisationDeclaree: '2026-01-01' }), { params })

    expect(res.status).toBe(200)
    expect(prisma.progressionCompagnon.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ motifRejet: null, rejeteLe: null, rejeteParId: null }) }),
    )
    expect(enregistrerAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROGRESSION_COMPAGNON_RESOUMISE' }),
    )
  })
})
