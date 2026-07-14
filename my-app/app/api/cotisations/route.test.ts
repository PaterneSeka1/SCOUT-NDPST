import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Ces routes portent l'essentiel du contrôle d'accès du workflow de
// cotisation/adhésion (isolation paroisse + branche, rôles autorisés) — voir
// lib/roles.test.ts pour les groupes de rôles eux-mêmes. On mocke Prisma et
// la session NextAuth pour tester la logique d'autorisation en isolation,
// sans dépendre d'une base de données.
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/audit', () => ({ enregistrerAudit: vi.fn() }))
vi.mock('@/lib/brancheUtilisateur', () => ({ getBrancheUtilisateur: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cotisation: { findMany: vi.fn(), create: vi.fn() },
    scout: { findMany: vi.fn() },
    utilisateur: { findMany: vi.fn() },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { GET, POST } from './route'

const PAROISSE = 'paroisse-1'

function session(role: string, overrides: Record<string, unknown> = {}) {
  return { user: { id: 'user-1', role, paroisseId: PAROISSE, ...overrides } }
}

function getReq(query = '') {
  return new NextRequest(new URL(`http://localhost/api/cotisations${query}`))
}

function postReq(body: unknown) {
  return new NextRequest(new URL('http://localhost/api/cotisations'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/cotisations', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(getReq())
    expect(res.status).toBe(401)
  })

  it('403 pour un rôle non-staff (PARENT)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('PARENT') as never)
    const res = await GET(getReq())
    expect(res.status).toBe(403)
  })

  it('400 si le statut est invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    const res = await GET(getReq('?statut=BIDON'))
    expect(res.status).toBe(400)
  })

  it('400 si la branche est invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    const res = await GET(getReq('?branche=BIDON'))
    expect(res.status).toBe(400)
  })

  it('liste vide pour un responsable de branche sans brancheType assigné (compte mal configuré), sans requêter Prisma', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('RESPONSABLE_BRANCHE') as never)
    vi.mocked(getBrancheUtilisateur).mockResolvedValue(null)
    const res = await GET(getReq())
    const body = await res.json()
    expect(body).toEqual({ cotisations: [] })
    expect(prisma.cotisation.findMany).not.toHaveBeenCalled()
  })

  it("un responsable de branche ne peut pas voir une autre branche que la sienne, même en le demandant explicitement (IDOR)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('RESPONSABLE_BRANCHE') as never)
    vi.mocked(getBrancheUtilisateur).mockResolvedValue('OISILLONS')
    vi.mocked(prisma.cotisation.findMany).mockResolvedValue([])

    await GET(getReq('?branche=LOUVETEAUX'))

    const where = vi.mocked(prisma.cotisation.findMany).mock.calls[0][0]?.where
    const whereJson = JSON.stringify(where)
    expect(whereJson).toContain('OISILLONS')
    expect(whereJson).not.toContain('LOUVETEAUX')
    expect(where?.paroisseId).toBe(PAROISSE)
  })
})

describe('POST /api/cotisations', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(postReq({}))
    expect(res.status).toBe(401)
  })

  it('403 pour un rôle hors ROLES_GROUPE (ex: RESPONSABLE_BRANCHE ne peut pas définir les droits dus)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('RESPONSABLE_BRANCHE') as never)
    const res = await POST(postReq({ type: 'ADHESION_ANNUELLE', montant: 1000 }))
    expect(res.status).toBe(403)
  })

  it('403 pour ADJOINT_GROUPE (staff, mais pas direction du groupe)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADJOINT_GROUPE') as never)
    const res = await POST(postReq({ type: 'ADHESION_ANNUELLE', montant: 1000 }))
    expect(res.status).toBe(403)
  })

  it('400 si le type est invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    const res = await POST(postReq({ type: 'BIDON', montant: 1000 }))
    expect(res.status).toBe(400)
  })

  it('400 si le montant est négatif ou non entier', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    const res1 = await POST(postReq({ type: 'ADHESION_ANNUELLE', montant: -100 }))
    expect(res1.status).toBe(400)
    const res2 = await POST(postReq({ type: 'ADHESION_ANNUELLE', montant: 12.5 }))
    expect(res2.status).toBe(400)
  })

  it('400 si la branche est invalide pour une cible SCOUTS_BRANCHE', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    const res = await POST(postReq({ type: 'ADHESION_ANNUELLE', montant: 1000, cible: 'SCOUTS_BRANCHE', branche: 'BIDON' }))
    expect(res.status).toBe(400)
  })

  it("crée une cotisation par scout ET par utilisateur pour une cible manuelle mixte, chacune avec le bon champ rempli", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    vi.mocked(prisma.scout.findMany).mockResolvedValue([{ id: 'scout-1' }] as never)
    vi.mocked(prisma.utilisateur.findMany).mockResolvedValue([{ id: 'staff-1' }] as never)
    vi.mocked(prisma.cotisation.create).mockImplementation(
      (({ data }: { data: { scoutId?: string; utilisateurId?: string } }) =>
        Promise.resolve({ id: `cot-${data.scoutId ?? data.utilisateurId}`, ...data })) as never,
    )

    const res = await POST(
      postReq({ type: 'ADHESION_ANNUELLE', montant: 1000, scoutIds: ['scout-1'], utilisateurIds: ['staff-1'] }),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.cotisations).toHaveLength(2)
    expect(body.cotisations.find((c: { scoutId?: string }) => c.scoutId === 'scout-1')).toBeTruthy()
    expect(body.cotisations.find((c: { utilisateurId?: string }) => c.utilisateurId === 'staff-1')).toBeTruthy()
  })

  it('404 si un utilisateurId fourni ne correspond à aucun compte staff actif de la paroisse (ex: id de PARENT)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    vi.mocked(prisma.utilisateur.findMany).mockResolvedValue([]) // filtré par role: in ROLES_TOUT_STAFF côté requête

    const res = await POST(postReq({ type: 'ADHESION_ANNUELLE', montant: 1000, utilisateurIds: ['parent-1'] }))
    expect(res.status).toBe(404)
  })
})
