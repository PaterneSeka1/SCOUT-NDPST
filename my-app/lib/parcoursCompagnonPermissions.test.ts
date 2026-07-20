import { describe, it, expect, vi, beforeEach } from 'vitest'

// Isole la logique d'autorisation des accès Prisma réels — même approche que
// app/api/scouts/[id]/progressions/route.ts pour autoriseSurScout.
vi.mock('@/lib/brancheUtilisateur', () => ({
  getBrancheUtilisateur: vi.fn(),
  getBrancheDistrictUtilisateur: vi.fn(),
}))
vi.mock('@/lib/district', () => ({ getParoissesDuDistrict: vi.fn() }))

import { getBrancheUtilisateur, getBrancheDistrictUtilisateur } from '@/lib/brancheUtilisateur'
import { getParoissesDuDistrict } from '@/lib/district'
import {
  autoriseConsultationParcoursCompagnon,
  autoriseDeclarationParcoursCompagnon,
  autoriseValidationParcoursCompagnon,
} from './parcoursCompagnonPermissions'

const SCOUT = { paroisseId: 'paroisse-1', brancheType: 'COMPAGNONS' }
const PAROISSES_DU_DISTRICT = (ids: string[]) => ({
  districtId: 'district-1',
  nomDistrict: 'Nord',
  paroisses: ids.map((id) => ({ id, nom: id, ville: 'X', actif: true })),
})

function session(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'user-1', role: 'RESPONSABLE_BRANCHE', roleDistrict: null, paroisseId: 'paroisse-1', ...overrides },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('autoriseConsultationParcoursCompagnon', () => {
  it('ADMIN_PLATEFORME a toujours accès, sans périmètre', async () => {
    const ok = await autoriseConsultationParcoursCompagnon(session({ role: 'ADMIN_PLATEFORME', paroisseId: null }), SCOUT)
    expect(ok).toBe(true)
  })

  it('RESPONSABLE_BRANCHE de la bonne paroisse et de la bonne branche a accès', async () => {
    vi.mocked(getBrancheUtilisateur).mockResolvedValue('COMPAGNONS')
    expect(await autoriseConsultationParcoursCompagnon(session(), SCOUT)).toBe(true)
  })

  it("RESPONSABLE_BRANCHE d'une autre paroisse n'a pas accès (IDOR)", async () => {
    vi.mocked(getBrancheUtilisateur).mockResolvedValue('COMPAGNONS')
    expect(await autoriseConsultationParcoursCompagnon(session({ paroisseId: 'autre-paroisse' }), SCOUT)).toBe(false)
  })

  it("RESPONSABLE_BRANCHE d'une autre branche n'a pas accès", async () => {
    vi.mocked(getBrancheUtilisateur).mockResolvedValue('ECLAIREURS')
    expect(await autoriseConsultationParcoursCompagnon(session(), SCOUT)).toBe(false)
  })

  it('COMMISSAIRE_DISTRICT a accès à toute branche des paroisses de son district', async () => {
    vi.mocked(getParoissesDuDistrict).mockResolvedValue(PAROISSES_DU_DISTRICT(['paroisse-1']))
    const ok = await autoriseConsultationParcoursCompagnon(session({ role: 'AUTRE', roleDistrict: 'COMMISSAIRE_DISTRICT' }), SCOUT)
    expect(ok).toBe(true)
  })

  it("COMMISSAIRE_DISTRICT n'a pas accès à une paroisse hors de son district", async () => {
    vi.mocked(getParoissesDuDistrict).mockResolvedValue(PAROISSES_DU_DISTRICT(['autre-paroisse']))
    const ok = await autoriseConsultationParcoursCompagnon(session({ role: 'AUTRE', roleDistrict: 'COMMISSAIRE_DISTRICT' }), SCOUT)
    expect(ok).toBe(false)
  })

  it('ASSISTANT_DISTRICT de la bonne branche et du bon district a accès', async () => {
    vi.mocked(getBrancheDistrictUtilisateur).mockResolvedValue('COMPAGNONS')
    vi.mocked(getParoissesDuDistrict).mockResolvedValue(PAROISSES_DU_DISTRICT(['paroisse-1']))
    const ok = await autoriseConsultationParcoursCompagnon(session({ role: 'AUTRE', roleDistrict: 'ASSISTANT_DISTRICT' }), SCOUT)
    expect(ok).toBe(true)
  })

  it("ASSISTANT_DISTRICT d'une autre branche n'a pas accès, sans même requêter le périmètre district", async () => {
    vi.mocked(getBrancheDistrictUtilisateur).mockResolvedValue('ECLAIREURS')
    const ok = await autoriseConsultationParcoursCompagnon(session({ role: 'AUTRE', roleDistrict: 'ASSISTANT_DISTRICT' }), SCOUT)
    expect(ok).toBe(false)
    expect(getParoissesDuDistrict).not.toHaveBeenCalled()
  })

  it('un rôle sans rapport (PARENT) est toujours refusé', async () => {
    expect(await autoriseConsultationParcoursCompagnon(session({ role: 'PARENT' }), SCOUT)).toBe(false)
  })
})

describe('autoriseDeclarationParcoursCompagnon (création du parcours, soumission) — rôles de branche uniquement', () => {
  it('RESPONSABLE_BRANCHE autorisé', async () => {
    vi.mocked(getBrancheUtilisateur).mockResolvedValue('COMPAGNONS')
    expect(await autoriseDeclarationParcoursCompagnon(session(), SCOUT)).toBe(true)
  })

  it('ADMIN_PLATEFORME autorisé', async () => {
    expect(await autoriseDeclarationParcoursCompagnon(session({ role: 'ADMIN_PLATEFORME', paroisseId: null }), SCOUT)).toBe(true)
  })

  it('COMMISSAIRE_DISTRICT (rôle de validation) ne peut PAS soumettre pour le compte du responsable de branche', async () => {
    const ok = await autoriseDeclarationParcoursCompagnon(session({ role: 'AUTRE', roleDistrict: 'COMMISSAIRE_DISTRICT' }), SCOUT)
    expect(ok).toBe(false)
    expect(getParoissesDuDistrict).not.toHaveBeenCalled()
  })
})

describe('autoriseValidationParcoursCompagnon (valider/rejeter) — rôles de district uniquement', () => {
  it('RESPONSABLE_BRANCHE (rôle de soumission) ne peut PAS valider', async () => {
    vi.mocked(getBrancheUtilisateur).mockResolvedValue('COMPAGNONS')
    expect(await autoriseValidationParcoursCompagnon(session(), SCOUT)).toBe(false)
  })

  it('COMMISSAIRE_DISTRICT autorisé', async () => {
    vi.mocked(getParoissesDuDistrict).mockResolvedValue(PAROISSES_DU_DISTRICT(['paroisse-1']))
    const ok = await autoriseValidationParcoursCompagnon(session({ role: 'AUTRE', roleDistrict: 'COMMISSAIRE_DISTRICT' }), SCOUT)
    expect(ok).toBe(true)
  })

  it('ADMIN_PLATEFORME autorisé', async () => {
    expect(await autoriseValidationParcoursCompagnon(session({ role: 'ADMIN_PLATEFORME', paroisseId: null }), SCOUT)).toBe(true)
  })
})
