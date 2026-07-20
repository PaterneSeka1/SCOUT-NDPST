import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/brancheUtilisateur', () => ({ getBrancheUtilisateur: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { scout: { findMany: vi.fn() } },
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
  return new NextRequest(new URL(`http://localhost/api/parcours-compagnon${query}`))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/parcours-compagnon', () => {
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

  it('400 si la branche est invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    const res = await GET(req('?branche=BIDON'))
    expect(res.status).toBe(400)
  })

  it('liste vide pour un responsable de branche sans brancheType assigné, sans requêter Prisma', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('RESPONSABLE_BRANCHE') as never)
    vi.mocked(getBrancheUtilisateur).mockResolvedValue(null)
    const res = await GET(req())
    const body = await res.json()
    expect(body).toEqual({ scouts: [] })
    expect(prisma.scout.findMany).not.toHaveBeenCalled()
  })

  it("un responsable de branche ne peut pas voir une autre branche que la sienne, même en le demandant explicitement (IDOR)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('RESPONSABLE_BRANCHE') as never)
    vi.mocked(getBrancheUtilisateur).mockResolvedValue('OISILLONS')
    vi.mocked(prisma.scout.findMany).mockResolvedValue([])

    await GET(req('?branche=COMPAGNONS'))

    const where = vi.mocked(prisma.scout.findMany).mock.calls[0][0]?.where
    const whereJson = JSON.stringify(where)
    expect(whereJson).toContain('OISILLONS')
    expect(whereJson).not.toContain('COMPAGNONS')
    expect(where?.paroisseId).toBe(PAROISSE)
  })

  it('inclut la date de naissance et renvoie parcours/avancement null pour un scout sans parcours', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    vi.mocked(prisma.scout.findMany).mockResolvedValue([
      {
        id: 'scout-1',
        nom: 'Kadio',
        prenom: 'Fabrice',
        dateNaissance: new Date('2008-07-15'),
        brancheType: 'COMPAGNONS',
        matricule: null,
        actif: true,
        parcoursCompagnon: null,
      },
    ] as never)

    const res = await GET(req())
    const body = await res.json()

    expect(body.scouts).toHaveLength(1)
    expect(body.scouts[0].scout.dateNaissance).toBeTruthy()
    expect(body.scouts[0].parcours).toBeNull()
    expect(body.scouts[0].avancement).toBeNull()
  })

  it("calcule l'avancement à partir des progressions quand un parcours existe", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    vi.mocked(prisma.scout.findMany).mockResolvedValue([
      {
        id: 'scout-1',
        nom: 'Amoin',
        prenom: 'Colette',
        dateNaissance: new Date('2008-07-15'),
        brancheType: 'COMPAGNONS',
        matricule: 'M1',
        actif: true,
        parcoursCompagnon: {
          id: 'parcours-1',
          trancheAge: 'DIX_HUIT_ANS',
          statut: 'ACTIF',
          dateFinPrevue: new Date('2028-09-20'),
          ageEntree: 18,
          progressions: [
            {
              statut: 'VALIDEE',
              dateDebutTheorique: new Date('2026-01-01'),
              dateLimiteTheorique: new Date('2026-01-01'),
              etapeActivite: { id: 'e1', nom: 'Accueil', etape: 'NOVICIAT', obligatoire: true, ordre: 1 },
            },
            {
              statut: 'A_VENIR',
              dateDebutTheorique: new Date('2026-01-01'),
              dateLimiteTheorique: new Date('2026-02-01'),
              etapeActivite: { id: 'e2', nom: 'Aspirant routier', etape: 'NOVICIAT', obligatoire: true, ordre: 2 },
            },
          ],
        },
      },
    ] as never)

    const res = await GET(req())
    const body = await res.json()

    expect(body.scouts[0].parcours.trancheAge).toBe('DIX_HUIT_ANS')
    expect(body.scouts[0].avancement.totalActivitesObligatoires).toBe(2)
    expect(body.scouts[0].avancement.activitesValidees).toBe(1)
    expect(body.scouts[0].avancement.pourcentageAvancement).toBe(50)
  })
})
