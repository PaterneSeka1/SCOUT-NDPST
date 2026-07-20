import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/parcoursCompagnonService', () => ({
  recalculerStatutsProgressionsCompagnon: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { recalculerStatutsProgressionsCompagnon } from '@/lib/parcoursCompagnonService'
import { POST } from './route'

function session(role: string) {
  return { user: { id: 'user-1', role } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/admin/parcours-compagnons/recalculer', () => {
  it('401 si non authentifié', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('403 pour un rôle autre que ADMIN_PLATEFORME', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('COMMISSAIRE_DISTRICT') as never)
    const res = await POST()
    expect(res.status).toBe(403)
    expect(recalculerStatutsProgressionsCompagnon).not.toHaveBeenCalled()
  })

  it('200 et délègue au service de recalcul pour ADMIN_PLATEFORME', async () => {
    vi.mocked(getServerSession).mockResolvedValue(session('ADMIN_PLATEFORME') as never)
    vi.mocked(recalculerStatutsProgressionsCompagnon).mockResolvedValue({
      progressionsAnalysees: 5, progressionsMisesAJour: 0, nouvellesAlertesRetard: 0,
    })

    const res = await POST()
    expect(res.status).toBe(200)
    expect(recalculerStatutsProgressionsCompagnon).toHaveBeenCalled()
  })
})
