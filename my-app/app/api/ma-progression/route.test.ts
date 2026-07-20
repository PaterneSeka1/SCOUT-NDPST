import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    scout: { findFirst: vi.fn() },
    badge: { findMany: vi.fn() },
    activite: { findMany: vi.fn() },
    presenceReunion: { findMany: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GET } from './route'

function session() {
  return { user: { id: 'scout-user-1', role: 'SCOUT' } }
}

function scoutDeBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'scout-1',
    nom: 'Amoin',
    prenom: 'Colette',
    brancheType: 'COMPAGNONS',
    paroisseId: 'paroisse-1',
    progressions: [],
    presences: [],
    _count: { presences: 0 },
    parcoursCompagnon: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.badge.findMany).mockResolvedValue([])
  vi.mocked(prisma.activite.findMany).mockResolvedValue([])
  vi.mocked(prisma.presenceReunion.findMany).mockResolvedValue([])
})

describe('GET /api/ma-progression', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('404 si le compte ne correspond à aucune fiche scout', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findFirst).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(404)
  })

  it("parcoursCompagnon: null quand le scout Compagnons n'a pas encore de parcours", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findFirst).mockResolvedValue(scoutDeBase() as never)

    const res = await GET()
    const body = await res.json()

    expect(body.parcoursCompagnon).toBeNull()
    expect(body.scout.parcoursCompagnon).toBeUndefined() // pas dupliqué dans l'objet scout brut
  })

  it('renvoie le parcours formaté (statut recalculé, dates sérialisées) quand il existe', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findFirst).mockResolvedValue(
      scoutDeBase({
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
              etapeActivite: { id: 'e1', code: 'ROUTE_ACCUEIL', nom: 'Accueil', etape: 'NOVICIAT', ordre: 1, type: 'EVENEMENT', nomAttribut: 'Foulard', obligatoire: true },
              dateDebutTheorique: new Date('2026-01-01'),
              dateLimiteTheorique: new Date('2026-01-01'),
              dateRealisationDeclaree: null,
              statut: 'VALIDEE',
              commentaireDeclaration: null,
              motifRejet: null,
              preuveUrl: null,
              numeroSoumission: 1,
              soumisLe: null,
              valideLe: new Date('2026-01-05'),
              rejeteLe: null,
            },
          ],
          attributsObtenus: [{ id: 'a1', nom: 'Foulard', obtenuLe: new Date('2026-01-05') }],
        },
      }) as never,
    )

    const res = await GET()
    const body = await res.json()

    expect(body.parcoursCompagnon.parcours.trancheAge).toBe('DIX_HUIT_ANS')
    expect(body.parcoursCompagnon.progressions).toHaveLength(1)
    expect(body.parcoursCompagnon.progressions[0].statut).toBe('VALIDEE')
    expect(body.parcoursCompagnon.avancement.pourcentageAvancement).toBe(100)
    expect(body.parcoursCompagnon.attributsObtenus[0].nom).toBe('Foulard')
  })
})
