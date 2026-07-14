import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/audit', () => ({ enregistrerAudit: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    utilisateur: { findFirst: vi.fn() },
    cotisation: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { PUT } from './route'

const UTILISATEUR_ID = 'user-staff-1'

function session(role: string) {
  return { user: { id: 'admin-1', role } }
}

function req(body: unknown) {
  return new NextRequest(new URL(`http://localhost/api/admin/utilisateurs/${UTILISATEUR_ID}/adhesion`), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

function params() {
  return { params: Promise.resolve({ id: UTILISATEUR_ID }) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PUT /api/admin/utilisateurs/[id]/adhesion', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PUT(req({ aJour: true }), params())
    expect(res.status).toBe(401)
  })

  it('403 pour un rôle non-plateforme (ex: CHEF_GROUPE)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    const res = await PUT(req({ aJour: true }), params())
    expect(res.status).toBe(403)
    expect(prisma.utilisateur.findFirst).not.toHaveBeenCalled()
  })

  it('404 si l’utilisateur est introuvable (ou est lui-même ADMIN_PLATEFORME, exclu de la recherche)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue(null)
    const res = await PUT(req({ aJour: true }), params())
    expect(res.status).toBe(404)
  })

  it("400 si le rôle de la personne n'est pas assujetti à l'adhésion (ex: PARENT)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'PARENT', paroisseId: 'paroisse-1' } as never)
    const res = await PUT(req({ aJour: true }), params())
    expect(res.status).toBe(400)
  })

  it('400 si aJour n’est pas un booléen', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'CHEF_GROUPE', paroisseId: 'paroisse-1' } as never)
    const res = await PUT(req({ aJour: 'oui' }), params())
    expect(res.status).toBe(400)
  })

  it('aucune cotisation existante + aJour=false : ne crée rien, renvoie statutAdhesion null (déjà "pas à jour" par défaut)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'CHEF_GROUPE', paroisseId: 'paroisse-1' } as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(null)

    const res = await PUT(req({ aJour: false }), params())
    const body = await res.json()

    expect(body).toEqual({ statutAdhesion: null })
    expect(prisma.cotisation.create).not.toHaveBeenCalled()
    expect(prisma.cotisation.update).not.toHaveBeenCalled()
  })

  it('aucune cotisation existante + aJour=true : crée un enregistrement PAYEE avec montant à 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'CHEF_GROUPE', paroisseId: 'paroisse-1' } as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.cotisation.create).mockResolvedValue({ id: 'cot-1', statut: 'PAYEE' } as never)

    const res = await PUT(req({ aJour: true }), params())
    const body = await res.json()

    expect(body).toEqual({ statutAdhesion: 'PAYEE' })
    const data = vi.mocked(prisma.cotisation.create).mock.calls[0][0]?.data
    expect(data?.montant).toBe(0)
    expect(data?.statut).toBe('PAYEE')
    expect(data?.utilisateurId).toBe(UTILISATEUR_ID)
    expect(data?.paroisseId).toBe('paroisse-1')
  })

  it('cotisation existante + aJour=true : passe à PAYEE avec montantPaye = montant dû', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'CHEF_GROUPE', paroisseId: 'paroisse-1' } as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue({ id: 'cot-1', montant: 5000, statut: 'EN_ATTENTE' } as never)
    vi.mocked(prisma.cotisation.update).mockResolvedValue({ id: 'cot-1', statut: 'PAYEE' } as never)

    const res = await PUT(req({ aJour: true }), params())
    const body = await res.json()

    expect(body).toEqual({ statutAdhesion: 'PAYEE' })
    const data = vi.mocked(prisma.cotisation.update).mock.calls[0][0]?.data
    expect(data?.montantPaye).toBe(5000)
    expect(data?.statut).toBe('PAYEE')
  })

  it('cotisation existante + aJour=false : repasse à EN_ATTENTE avec montantPaye à 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'CHEF_GROUPE', paroisseId: 'paroisse-1' } as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue({ id: 'cot-1', montant: 5000, statut: 'PAYEE' } as never)
    vi.mocked(prisma.cotisation.update).mockResolvedValue({ id: 'cot-1', statut: 'EN_ATTENTE' } as never)

    const res = await PUT(req({ aJour: false }), params())
    const body = await res.json()

    expect(body).toEqual({ statutAdhesion: 'EN_ATTENTE' })
    const data = vi.mocked(prisma.cotisation.update).mock.calls[0][0]?.data
    expect(data?.montantPaye).toBe(0)
    expect(data?.statut).toBe('EN_ATTENTE')
  })
})
