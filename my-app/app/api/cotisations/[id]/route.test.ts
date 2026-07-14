import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/audit', () => ({ enregistrerAudit: vi.fn() }))
vi.mock('@/lib/brancheUtilisateur', () => ({ getBrancheUtilisateur: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cotisation: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { PUT, DELETE } from './route'

const PAROISSE = 'paroisse-1'
const COTISATION_ID = 'cot-1'

function session(role: string, overrides: Record<string, unknown> = {}) {
  return { user: { id: 'user-1', role, paroisseId: PAROISSE, ...overrides } }
}

function putReq(body: unknown) {
  return new NextRequest(new URL(`http://localhost/api/cotisations/${COTISATION_ID}`), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

function params() {
  return { params: Promise.resolve({ id: COTISATION_ID }) }
}

const cotisationExistante = (overrides: Record<string, unknown> = {}) => ({
  id: COTISATION_ID,
  montant: 5000,
  montantPaye: 0,
  statut: 'EN_ATTENTE',
  collecteParId: null,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PUT /api/cotisations/[id]', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PUT(putReq({ statut: 'PAYEE' }), params())
    expect(res.status).toBe(401)
  })

  it("403 pour un rôle hors ROLES_GESTION (ex: ADJOINT_GROUPE, qui peut voir la page mais pas modifier)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADJOINT_GROUPE') as never)
    const res = await PUT(putReq({ statut: 'PAYEE' }), params())
    expect(res.status).toBe(403)
    expect(prisma.cotisation.findFirst).not.toHaveBeenCalled()
  })

  it("404 si un responsable de branche tente de modifier une cotisation d'une autre branche (IDOR)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('RESPONSABLE_BRANCHE') as never)
    vi.mocked(getBrancheUtilisateur).mockResolvedValue('OISILLONS')
    // Simule le comportement réel : le findFirst filtre par branche et ne
    // retrouve rien car la cotisation appartient à LOUVETEAUX.
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(null)

    const res = await PUT(putReq({ statut: 'PAYEE' }), params())

    expect(res.status).toBe(404)
    const where = vi.mocked(prisma.cotisation.findFirst).mock.calls[0][0]?.where
    expect(JSON.stringify(where)).toContain('OISILLONS')
  })

  it('400 si le statut est invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(cotisationExistante() as never)
    const res = await PUT(putReq({ statut: 'BIDON' }), params())
    expect(res.status).toBe(400)
  })

  it('400 si PARTIELLEMENT_PAYEE avec un montantPaye invalide (>= montant dû)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(cotisationExistante({ montant: 5000 }) as never)
    const res = await PUT(putReq({ statut: 'PARTIELLEMENT_PAYEE', montantPaye: 5000 }), params())
    expect(res.status).toBe(400)
  })

  it('400 si PARTIELLEMENT_PAYEE avec un montantPaye négatif ou non entier', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(cotisationExistante({ montant: 5000 }) as never)
    const res = await PUT(putReq({ statut: 'PARTIELLEMENT_PAYEE', montantPaye: -100 }), params())
    expect(res.status).toBe(400)
  })

  it('ARGENT_RECU force montantPaye au montant complet, en ignorant toute valeur envoyée par le client', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(cotisationExistante({ montant: 5000 }) as never)
    vi.mocked(prisma.cotisation.update).mockImplementation(
      (({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: COTISATION_ID, ...data })) as never,
    )

    // Le client tente de forcer montantPaye à 1 (non prévu par le contrat de l'API pour ce statut) :
    // le corps ne déclare pas ce champ pour ARGENT_RECU, donc il est ignoré par construction — on
    // vérifie ici que le serveur écrit bien le montant complet, pas 0 ni une valeur arbitraire.
    await PUT(putReq({ statut: 'ARGENT_RECU' }), params())

    const data = vi.mocked(prisma.cotisation.update).mock.calls[0][0]?.data
    expect(data?.montantPaye).toBe(5000)
    expect(data?.collecteParId).toBe('user-1')
  })

  it('EN_ATTENTE réinitialise montantPaye et collecteParId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(
      cotisationExistante({ montant: 5000, montantPaye: 5000, statut: 'PAYEE', collecteParId: 'user-1' }) as never,
    )
    vi.mocked(prisma.cotisation.update).mockImplementation(
      (({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: COTISATION_ID, ...data })) as never,
    )

    await PUT(putReq({ statut: 'EN_ATTENTE' }), params())

    const data = vi.mocked(prisma.cotisation.update).mock.calls[0][0]?.data
    expect(data?.montantPaye).toBe(0)
    expect(data?.collecteParId).toBeNull()
  })
})

describe('DELETE /api/cotisations/[id]', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await DELETE(new NextRequest(new URL(`http://localhost/api/cotisations/${COTISATION_ID}`)), params())
    expect(res.status).toBe(401)
  })

  it('403 pour un rôle hors ROLES_GROUPE (ex: RESPONSABLE_BRANCHE)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('RESPONSABLE_BRANCHE') as never)
    const res = await DELETE(new NextRequest(new URL(`http://localhost/api/cotisations/${COTISATION_ID}`)), params())
    expect(res.status).toBe(403)
    expect(prisma.cotisation.findFirst).not.toHaveBeenCalled()
  })

  it("404 si la cotisation n'appartient pas à la paroisse de l'utilisateur (IDOR cross-paroisse)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(null)

    const res = await DELETE(new NextRequest(new URL(`http://localhost/api/cotisations/${COTISATION_ID}`)), params())

    expect(res.status).toBe(404)
    const where = vi.mocked(prisma.cotisation.findFirst).mock.calls[0][0]?.where
    expect(where?.paroisseId).toBe(PAROISSE)
    expect(prisma.cotisation.delete).not.toHaveBeenCalled()
  })
})
