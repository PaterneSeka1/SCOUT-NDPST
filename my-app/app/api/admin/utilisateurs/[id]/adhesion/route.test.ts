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
    const res = await PUT(req({ statut: 'A_JOUR' }), params())
    expect(res.status).toBe(401)
  })

  it('403 pour un rôle non-plateforme (ex: CHEF_GROUPE)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('CHEF_GROUPE') as never)
    const res = await PUT(req({ statut: 'A_JOUR' }), params())
    expect(res.status).toBe(403)
    expect(prisma.utilisateur.findFirst).not.toHaveBeenCalled()
  })

  it('404 si l’utilisateur est introuvable (ou est lui-même ADMIN_PLATEFORME, exclu de la recherche)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue(null)
    const res = await PUT(req({ statut: 'A_JOUR' }), params())
    expect(res.status).toBe(404)
  })

  it("400 si le rôle de la personne n'est pas assujetti à l'adhésion (ex: PARENT)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'PARENT', paroisseId: 'paroisse-1' } as never)
    const res = await PUT(req({ statut: 'A_JOUR' }), params())
    expect(res.status).toBe(400)
  })

  it('400 si le statut est inconnu', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'CHEF_GROUPE', paroisseId: 'paroisse-1' } as never)
    const res = await PUT(req({ statut: 'BIDON' }), params())
    expect(res.status).toBe(400)
  })

  it('aucune cotisation existante + statut=NON_A_JOUR : crée un enregistrement à montant 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'CHEF_GROUPE', paroisseId: 'paroisse-1' } as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.cotisation.create).mockResolvedValue({ id: 'cot-1', statut: 'NON_A_JOUR' } as never)

    const res = await PUT(req({ statut: 'NON_A_JOUR' }), params())
    const body = await res.json()

    expect(body).toEqual({ statutAdhesion: 'NON_A_JOUR' })
    const data = vi.mocked(prisma.cotisation.create).mock.calls[0][0]?.data
    expect(data?.montant).toBe(0)
    expect(data?.statut).toBe('NON_A_JOUR')
    expect(data?.utilisateurId).toBe(UTILISATEUR_ID)
    expect(data?.paroisseId).toBe('paroisse-1')
  })

  it('aucune cotisation existante + statut=A_JOUR : crée un enregistrement A_JOUR avec montant à 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'CHEF_GROUPE', paroisseId: 'paroisse-1' } as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.cotisation.create).mockResolvedValue({ id: 'cot-1', statut: 'A_JOUR' } as never)

    const res = await PUT(req({ statut: 'A_JOUR' }), params())
    const body = await res.json()

    expect(body).toEqual({ statutAdhesion: 'A_JOUR' })
    const data = vi.mocked(prisma.cotisation.create).mock.calls[0][0]?.data
    expect(data?.montant).toBe(0)
    expect(data?.statut).toBe('A_JOUR')
  })

  it('cotisation existante (montant réel) + statut=A_JOUR : montantPaye = montant dû', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'CHEF_GROUPE', paroisseId: 'paroisse-1' } as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue({ id: 'cot-1', montant: 5000, statut: 'NON_A_JOUR', collecteParId: null } as never)
    vi.mocked(prisma.cotisation.update).mockResolvedValue({ id: 'cot-1', statut: 'A_JOUR' } as never)

    const res = await PUT(req({ statut: 'A_JOUR' }), params())
    const body = await res.json()

    expect(body).toEqual({ statutAdhesion: 'A_JOUR' })
    const data = vi.mocked(prisma.cotisation.update).mock.calls[0][0]?.data
    expect(data?.montantPaye).toBe(5000)
    expect(data?.statut).toBe('A_JOUR')
  })

  it('statut=ARGENT_RECU : montantPaye = montant dû, collecteParId = admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'CHEF_GROUPE', paroisseId: 'paroisse-1' } as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue({ id: 'cot-1', montant: 5000, statut: 'NON_A_JOUR', collecteParId: null } as never)
    vi.mocked(prisma.cotisation.update).mockResolvedValue({ id: 'cot-1', statut: 'ARGENT_RECU' } as never)

    const res = await PUT(req({ statut: 'ARGENT_RECU' }), params())
    const body = await res.json()

    expect(body).toEqual({ statutAdhesion: 'ARGENT_RECU' })
    const data = vi.mocked(prisma.cotisation.update).mock.calls[0][0]?.data
    expect(data).toMatchObject({ statut: 'ARGENT_RECU', montantPaye: 5000, collecteParId: 'admin-1' })
  })

  it('cotisation existante (montant réel) + statut=NON_A_JOUR : ne supprime jamais, repasse à NON_A_JOUR avec montantPaye 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({ id: UTILISATEUR_ID, role: 'CHEF_GROUPE', paroisseId: 'paroisse-1' } as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue({ id: 'cot-1', montant: 5000, statut: 'A_JOUR', collecteParId: 'admin-1' } as never)
    vi.mocked(prisma.cotisation.update).mockResolvedValue({ id: 'cot-1', statut: 'NON_A_JOUR' } as never)

    const res = await PUT(req({ statut: 'NON_A_JOUR' }), params())
    const body = await res.json()

    expect(body).toEqual({ statutAdhesion: 'NON_A_JOUR' })
    const data = vi.mocked(prisma.cotisation.update).mock.calls[0][0]?.data
    expect(data).toMatchObject({ statut: 'NON_A_JOUR', montantPaye: 0 })
  })

  it("400 si le compte SCOUT n'est lié à aucune fiche scout", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({
      id: UTILISATEUR_ID,
      role: 'SCOUT',
      paroisseId: 'paroisse-1',
      ficheScout: null,
    } as never)

    const res = await PUT(req({ statut: 'A_JOUR' }), params())
    expect(res.status).toBe(400)
    expect(prisma.cotisation.findFirst).not.toHaveBeenCalled()
  })

  it('un compte SCOUT cible la cotisation de sa fiche Scout liée (scoutId), jamais utilisateurId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(prisma.utilisateur.findFirst).mockResolvedValue({
      id: UTILISATEUR_ID,
      role: 'SCOUT',
      paroisseId: 'paroisse-1',
      ficheScout: { id: 'scout-42' },
    } as never)
    vi.mocked(prisma.cotisation.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.cotisation.create).mockResolvedValue({ id: 'cot-2', statut: 'A_JOUR' } as never)

    const res = await PUT(req({ statut: 'A_JOUR' }), params())
    const body = await res.json()

    expect(body).toEqual({ statutAdhesion: 'A_JOUR' })
    const whereFind = vi.mocked(prisma.cotisation.findFirst).mock.calls[0][0]?.where
    expect(whereFind).toMatchObject({ scoutId: 'scout-42', utilisateurId: undefined })
    const dataCreate = vi.mocked(prisma.cotisation.create).mock.calls[0][0]?.data
    expect(dataCreate?.scoutId).toBe('scout-42')
    expect(dataCreate?.utilisateurId).toBeUndefined()
  })
})
