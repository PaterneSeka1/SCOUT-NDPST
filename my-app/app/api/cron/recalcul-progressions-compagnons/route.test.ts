import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/parcoursCompagnonService', () => ({
  recalculerStatutsProgressionsCompagnon: vi.fn(),
}))

import { recalculerStatutsProgressionsCompagnon } from '@/lib/parcoursCompagnonService'
import { GET } from './route'

function req(secret?: string) {
  const headers = new Headers()
  if (secret !== undefined) headers.set('x-cron-secret', secret)
  return new NextRequest(new URL('http://localhost/api/cron/recalcul-progressions-compagnons'), { headers })
}

const ANCIEN_SECRET = process.env.CRON_SECRET

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'le-bon-secret'
})

afterEach(() => {
  process.env.CRON_SECRET = ANCIEN_SECRET
})

describe('GET /api/cron/recalcul-progressions-compagnons', () => {
  it('500 si CRON_SECRET n\'est pas configuré côté serveur', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req('peu importe'))
    expect(res.status).toBe(500)
    expect(recalculerStatutsProgressionsCompagnon).not.toHaveBeenCalled()
  })

  it('401 si aucun secret fourni', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('401 si le secret fourni est incorrect', async () => {
    const res = await GET(req('mauvais-secret'))
    expect(res.status).toBe(401)
  })

  it('200 et délègue au service de recalcul si le secret est correct', async () => {
    vi.mocked(recalculerStatutsProgressionsCompagnon).mockResolvedValue({
      progressionsAnalysees: 10, progressionsMisesAJour: 2, nouvellesAlertesRetard: 1,
    })

    const res = await GET(req('le-bon-secret'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ progressionsAnalysees: 10, progressionsMisesAJour: 2, nouvellesAlertesRetard: 1 })
  })
})
