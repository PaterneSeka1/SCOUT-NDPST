import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/audit', () => ({ enregistrerAudit: vi.fn() }))
vi.mock('@/lib/brancheUtilisateur', () => ({ getBrancheUtilisateur: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { cotisation: { findMany: vi.fn() } },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { GET } from './route'

const PAROISSE = 'paroisse-1'

function session(role: string, overrides: Record<string, unknown> = {}) {
  return { user: { id: 'user-1', role, paroisseId: PAROISSE, ...overrides } }
}

function req(query = '') {
  return new NextRequest(new URL(`http://localhost/api/cotisations/export${query}`))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/cotisations/export', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('403 pour un rôle non-staff (PARENT)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('PARENT') as never)
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it('400 si le statut est invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    const res = await GET(req('?statut=BIDON'))
    expect(res.status).toBe(400)
  })

  it('400 si la branche est invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    const res = await GET(req('?branche=BIDON'))
    expect(res.status).toBe(400)
  })

  it('CSV vide (en-tête seul) pour un responsable de branche sans brancheType assigné, sans requêter Prisma', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('RESPONSABLE_BRANCHE') as never)
    vi.mocked(getBrancheUtilisateur).mockResolvedValue(null)
    const res = await GET(req())
    const texte = await res.text()
    expect(texte).toContain('Participant')
    expect(prisma.cotisation.findMany).not.toHaveBeenCalled()
  })

  it("un responsable de branche exporte toujours sa propre branche, jamais celle demandée par le client (IDOR)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('RESPONSABLE_BRANCHE') as never)
    vi.mocked(getBrancheUtilisateur).mockResolvedValue('OISILLONS')
    vi.mocked(prisma.cotisation.findMany).mockResolvedValue([])

    await GET(req('?branche=LOUVETEAUX'))

    const where = vi.mocked(prisma.cotisation.findMany).mock.calls[0][0]?.where
    const whereJson = JSON.stringify(where)
    expect(whereJson).toContain('OISILLONS')
    expect(whereJson).not.toContain('LOUVETEAUX')
    expect(where?.paroisseId).toBe(PAROISSE)
  })

  it('génère un CSV avec la ligne attendue pour une cotisation scout', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    vi.mocked(prisma.cotisation.findMany).mockResolvedValue([
      {
        type: 'ADHESION_ANNUELLE',
        libelle: null,
        montant: 5000,
        montantPaye: 5000,
        anneeScolaire: '2025-2026',
        statut: 'A_JOUR',
        datePaiement: new Date('2026-01-15'),
        modePaiement: 'Espèces',
        scout: { nom: 'Konan', prenom: 'Gervais', matricule: 'M001', brancheType: 'OISILLONS' },
        utilisateur: null,
        collectePar: null,
        enregistrePar: { nom: 'Bamba', prenom: 'Adama', role: 'RESPONSABLE_BRANCHE' },
      },
    ] as never)

    const res = await GET(req())
    const texte = await res.text()

    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(texte).toContain('Gervais Konan')
    expect(texte).toContain('5000')
    expect(texte).toContain('À jour')
  })
})
