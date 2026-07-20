import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/parcoursCompagnonPermissions', () => ({
  autoriseConsultationParcoursCompagnon: vi.fn(),
  autoriseDeclarationParcoursCompagnon: vi.fn(),
}))
vi.mock('@/lib/parcoursCompagnonService', () => ({
  genererParcoursCompagnon: vi.fn(),
  ParcoursDejaExistantError: class ParcoursDejaExistantError extends Error {},
  ReferentielVideError: class ReferentielVideError extends Error {},
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    scout: { findUnique: vi.fn() },
    parcoursCompagnon: { findUnique: vi.fn() },
    utilisateur: { findUnique: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import {
  autoriseConsultationParcoursCompagnon,
  autoriseDeclarationParcoursCompagnon,
} from '@/lib/parcoursCompagnonPermissions'
import { genererParcoursCompagnon, ParcoursDejaExistantError } from '@/lib/parcoursCompagnonService'
import { AgeEntreeInvalideError } from '@/lib/parcoursCompagnon'
import { GET, POST } from './route'

function session() {
  return { user: { id: 'user-1', role: 'RESPONSABLE_BRANCHE', roleDistrict: null, paroisseId: 'paroisse-1' } }
}

const SCOUT_COMPAGNON = {
  id: 'scout-1',
  nom: 'Konan',
  prenom: 'Yao',
  paroisseId: 'paroisse-1',
  brancheType: 'COMPAGNONS',
  dateNaissance: new Date('2008-01-01'),
}

function getReq() {
  return new NextRequest(new URL('http://localhost/api/scouts/scout-1/parcours-compagnon'))
}

function postReq(body: unknown) {
  return new NextRequest(new URL('http://localhost/api/scouts/scout-1/parcours-compagnon'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const params = Promise.resolve({ id: 'scout-1' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/scouts/[id]/parcours-compagnon', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(getReq(), { params })
    expect(res.status).toBe(401)
  })

  it('404 si le scout est introuvable ou hors périmètre', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findUnique).mockResolvedValue(null)
    const res = await GET(getReq(), { params })
    expect(res.status).toBe(404)
  })

  it('renvoie parcours: null (200, pas 404) quand le scout Compagnon n\'a pas encore de parcours', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findUnique).mockResolvedValue(SCOUT_COMPAGNON as never)
    vi.mocked(autoriseConsultationParcoursCompagnon).mockResolvedValue(true)
    vi.mocked(prisma.parcoursCompagnon.findUnique).mockResolvedValue(null)

    const res = await GET(getReq(), { params })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.parcours).toBeNull()
    expect(body.avancement).toBeNull()
    expect(body.brancheCompatible).toBe(true)
  })

  it('brancheCompatible=false pour un scout hors branche Compagnons', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findUnique).mockResolvedValue({ ...SCOUT_COMPAGNON, brancheType: 'ECLAIREURS' } as never)
    vi.mocked(autoriseConsultationParcoursCompagnon).mockResolvedValue(true)
    vi.mocked(prisma.parcoursCompagnon.findUnique).mockResolvedValue(null)

    const body = await (await GET(getReq(), { params })).json()
    expect(body.brancheCompatible).toBe(false)
  })
})

describe('POST /api/scouts/[id]/parcours-compagnon', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(postReq({}), { params })
    expect(res.status).toBe(401)
  })

  it('404 si le scout est introuvable ou hors périmètre de déclaration', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findUnique).mockResolvedValue(SCOUT_COMPAGNON as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(false)
    const res = await POST(postReq({ dateEntreeParcours: '2026-01-01' }), { params })
    expect(res.status).toBe(404)
  })

  it("400 si le scout n'est pas de la branche Compagnons", async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findUnique).mockResolvedValue({ ...SCOUT_COMPAGNON, brancheType: 'ECLAIREURS' } as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    const res = await POST(postReq({ dateEntreeParcours: '2026-01-01' }), { params })
    expect(res.status).toBe(400)
  })

  it('400 si dateEntreeParcours est manquante ou invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findUnique).mockResolvedValue(SCOUT_COMPAGNON as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    const res = await POST(postReq({ dateEntreeParcours: 'invalide' }), { params })
    expect(res.status).toBe(400)
  })

  it('400 si le responsableId fourni ne correspond à aucun utilisateur', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findUnique).mockResolvedValue(SCOUT_COMPAGNON as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    vi.mocked(prisma.utilisateur.findUnique).mockResolvedValue(null)

    const res = await POST(postReq({ dateEntreeParcours: '2026-01-01', responsableId: 'inconnu' }), { params })
    expect(res.status).toBe(400)
    expect(genererParcoursCompagnon).not.toHaveBeenCalled()
  })

  it('400 si genererParcoursCompagnon signale un âge d\'entrée invalide', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findUnique).mockResolvedValue(SCOUT_COMPAGNON as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    vi.mocked(genererParcoursCompagnon).mockRejectedValue(new AgeEntreeInvalideError(25))

    const res = await POST(postReq({ dateEntreeParcours: '2026-01-01' }), { params })
    expect(res.status).toBe(400)
  })

  it('409 si un parcours existe déjà pour ce scout', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findUnique).mockResolvedValue(SCOUT_COMPAGNON as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    vi.mocked(genererParcoursCompagnon).mockRejectedValue(new ParcoursDejaExistantError('déjà existant'))

    const res = await POST(postReq({ dateEntreeParcours: '2026-01-01' }), { params })
    expect(res.status).toBe(409)
  })

  it('201 et délègue la génération au service métier', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session() as never)
    vi.mocked(prisma.scout.findUnique).mockResolvedValue(SCOUT_COMPAGNON as never)
    vi.mocked(autoriseDeclarationParcoursCompagnon).mockResolvedValue(true)
    vi.mocked(genererParcoursCompagnon).mockResolvedValue({
      id: 'parcours-1', ageEntree: 18, trancheAge: 'DIX_HUIT_ANS', dateFinPrevue: new Date('2028-03-01'), alerteEntreeVingtAns: false,
    })

    const res = await POST(postReq({ dateEntreeParcours: '2026-01-01' }), { params })
    expect(res.status).toBe(201)
    expect(genererParcoursCompagnon).toHaveBeenCalledWith(
      expect.objectContaining({ scoutId: 'scout-1', paroisseId: 'paroisse-1' }),
    )
  })
})
