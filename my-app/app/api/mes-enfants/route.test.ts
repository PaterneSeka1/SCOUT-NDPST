import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    utilisateur: { findUnique: vi.fn(), findMany: vi.fn() },
    lienParentScout: { findMany: vi.fn() },
    activite: { findMany: vi.fn() },
    jourReunion: { findMany: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

function session() {
  return { user: { id: 'parent-1', role: 'PARENT', paroisseId: 'paroisse-1' } }
}

function lienDeBase(overrides: Record<string, unknown> = {}) {
  return {
    scout: {
      id: 'scout-1',
      nom: 'Amoin',
      prenom: 'Colette',
      brancheType: 'COMPAGNONS',
      presences: [],
      presencesReunion: [],
      _count: { presences: 0, presencesReunion: 0 },
      cotisations: [],
      parcoursCompagnon: null,
      ...overrides,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.utilisateur.findUnique).mockResolvedValue({ id: 'parent-1' } as never)
  vi.mocked(prisma.activite.findMany).mockResolvedValue([])
  vi.mocked(prisma.jourReunion.findMany).mockResolvedValue([])
  vi.mocked(prisma.utilisateur.findMany).mockResolvedValue([])
})

describe('GET /api/mes-enfants', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("parcoursCompagnon: null pour un enfant Compagnons sans parcours", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.lienParentScout.findMany).mockResolvedValue([lienDeBase()] as never)

    const res = await GET()
    const body = await res.json()

    expect(body.enfants).toHaveLength(1)
    expect(body.enfants[0].parcoursCompagnon).toBeNull()
  })

  it("formate le parcours et l'avancement pour un enfant qui en a un", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.lienParentScout.findMany).mockResolvedValue([
      lienDeBase({
        parcoursCompagnon: {
          id: 'parcours-1',
          dateEntreeParcours: new Date('2026-01-01'),
          ageEntree: 18,
          trancheAge: 'DIX_HUIT_ANS',
          dateFinPrevue: new Date('2028-03-01'),
          dateFinReelle: null,
          statut: 'ACTIF',
          progressions: [
            {
              id: 'p1',
              etapeActiviteId: 'e1',
              etapeActivite: { id: 'e1', code: 'ROUTE_ASPIRANT', nom: 'Aspirant routier', etape: 'NOVICIAT', ordre: 2, type: 'DUREE', nomAttribut: 'Flots gris', obligatoire: true },
              dateDebutTheorique: new Date('2026-01-01'),
              dateLimiteTheorique: new Date('2026-02-01'),
              dateRealisationDeclaree: null,
              statut: 'SOUMISE',
              commentaireDeclaration: null,
              motifRejet: null,
              preuveUrl: null,
              numeroSoumission: 1,
              soumisLe: new Date('2026-01-15'),
              valideLe: null,
              rejeteLe: null,
            },
          ],
          attributsObtenus: [],
        },
      }),
    ] as never)

    const res = await GET()
    const body = await res.json()

    expect(body.enfants[0].parcoursCompagnon.parcours.trancheAge).toBe('DIX_HUIT_ANS')
    expect(body.enfants[0].parcoursCompagnon.progressions[0].statut).toBe('SOUMISE')
    expect(body.enfants[0].parcoursCompagnon.avancement.activitesSoumises).toBe(1)
  })
})
