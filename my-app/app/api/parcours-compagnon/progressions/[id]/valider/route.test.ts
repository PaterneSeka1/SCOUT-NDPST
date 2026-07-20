import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const tx = {
  progressionCompagnon: { update: vi.fn(), findMany: vi.fn() },
  attributCompagnon: { upsert: vi.fn() },
  parcoursCompagnon: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
}

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
  prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx)) },
}))

import { getServerSession } from 'next-auth/next'
import { enregistrerAudit } from '@/lib/audit'
import { autoriseValidationParcoursCompagnon } from '@/lib/parcoursCompagnonPermissions'
import { chargerProgressionAvecScout } from '@/lib/parcoursCompagnonService'
import { POST } from './route'

function session(overrides: Record<string, unknown> = {}) {
  return { user: { id: 'validateur-1', role: 'AUTRE', roleDistrict: 'COMMISSAIRE_DISTRICT', paroisseId: 'paroisse-1', ...overrides } }
}

function progressionMock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'progression-1',
    statut: 'SOUMISE',
    soumisParId: 'responsable-1',
    etapeActiviteId: 'etape-1',
    parcoursId: 'parcours-1',
    etapeActivite: { id: 'etape-1', nom: 'Mini-camp', nomAttribut: 'Étoile marron' },
    parcours: { scout: { id: 'scout-1', paroisseId: 'paroisse-1', brancheType: 'COMPAGNONS' } },
    ...overrides,
  }
}

function req() {
  return new NextRequest(new URL('http://localhost/api/parcours-compagnon/progressions/progression-1/valider'), {
    method: 'POST',
  })
}

const params = Promise.resolve({ id: 'progression-1' })

beforeEach(() => {
  vi.clearAllMocks()
  tx.progressionCompagnon.update.mockResolvedValue({ id: 'progression-1', statut: 'VALIDEE' })
  tx.attributCompagnon.upsert.mockResolvedValue({})
  tx.progressionCompagnon.findMany.mockResolvedValue([
    { id: 'progression-1', statut: 'VALIDEE', dateLimiteTheorique: new Date(), etapeActivite: { id: 'etape-1', nom: 'x', etape: 'APPRENTISSAGE', obligatoire: true, ordre: 1 } },
  ])
  tx.parcoursCompagnon.findUniqueOrThrow.mockResolvedValue({ id: 'parcours-1', statut: 'ACTIF' })
})

describe('POST /api/parcours-compagnon/progressions/[id]/valider', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(req(), { params })
    expect(res.status).toBe(401)
  })

  it("404 si l'activité n'existe pas ou n'est pas dans le périmètre du validateur", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(null as never)
    const res = await POST(req(), { params })
    expect(res.status).toBe(404)
  })

  it('409 si l\'activité n\'est pas au statut SOUMISE', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock({ statut: 'A_VENIR' }) as never)
    vi.mocked(autoriseValidationParcoursCompagnon).mockResolvedValue(true)
    const res = await POST(req(), { params })
    expect(res.status).toBe(409)
  })

  it('403 : un validateur ne peut pas valider sa propre soumission', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(
      progressionMock({ soumisParId: 'validateur-1' }) as never,
    )
    vi.mocked(autoriseValidationParcoursCompagnon).mockResolvedValue(true)
    const res = await POST(req(), { params })
    expect(res.status).toBe(403)
  })

  it("crée l'attribut correspondant quand l'étape en a un, et journalise la validation", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock() as never)
    vi.mocked(autoriseValidationParcoursCompagnon).mockResolvedValue(true)

    const res = await POST(req(), { params })

    expect(res.status).toBe(200)
    expect(tx.attributCompagnon.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ nom: 'Étoile marron' }) }),
    )
    expect(enregistrerAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'PROGRESSION_COMPAGNON_VALIDEE' }))
  })

  it("ne crée aucun attribut quand l'étape n'en a pas (nomAttribut null)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(
      progressionMock({ etapeActivite: { id: 'etape-1', nom: 'Raid', nomAttribut: null } }) as never,
    )
    vi.mocked(autoriseValidationParcoursCompagnon).mockResolvedValue(true)

    await POST(req(), { params })

    expect(tx.attributCompagnon.upsert).not.toHaveBeenCalled()
  })

  it('clôt le parcours et journalise PARCOURS_COMPAGNON_TERMINE quand toutes les activités obligatoires sont validées', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock() as never)
    vi.mocked(autoriseValidationParcoursCompagnon).mockResolvedValue(true)
    // Une seule activité obligatoire au total, déjà VALIDEE après la mise à jour → 100%.
    tx.progressionCompagnon.findMany.mockResolvedValue([
      { id: 'progression-1', statut: 'VALIDEE', dateLimiteTheorique: new Date(), etapeActivite: { id: 'etape-1', nom: 'x', etape: 'DEPART_ROUTIER', obligatoire: true, ordre: 1 } },
    ])

    const res = await POST(req(), { params })
    const body = await res.json()

    expect(body.parcoursTermine).toBe(true)
    expect(tx.parcoursCompagnon.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statut: 'TERMINE' }) }),
    )
    expect(enregistrerAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'PARCOURS_COMPAGNON_TERMINE' }))
  })

  it('ne journalise pas PARCOURS_COMPAGNON_TERMINE deux fois si le parcours est déjà TERMINE', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(chargerProgressionAvecScout).mockResolvedValue(progressionMock() as never)
    vi.mocked(autoriseValidationParcoursCompagnon).mockResolvedValue(true)
    tx.progressionCompagnon.findMany.mockResolvedValue([
      { id: 'progression-1', statut: 'VALIDEE', dateLimiteTheorique: new Date(), etapeActivite: { id: 'etape-1', nom: 'x', etape: 'DEPART_ROUTIER', obligatoire: true, ordre: 1 } },
    ])
    tx.parcoursCompagnon.findUniqueOrThrow.mockResolvedValue({ id: 'parcours-1', statut: 'TERMINE' })

    const res = await POST(req(), { params })
    const body = await res.json()

    expect(body.parcoursTermine).toBe(false)
    expect(tx.parcoursCompagnon.update).not.toHaveBeenCalled()
    expect(enregistrerAudit).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'PARCOURS_COMPAGNON_TERMINE' }))
  })
})
