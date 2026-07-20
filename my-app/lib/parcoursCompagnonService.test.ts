import { describe, it, expect, vi, beforeEach } from 'vitest'

// tx exposé pour pouvoir asserter dessus depuis les tests — voir le mock de
// $transaction ci-dessous, qui invoque directement le callback avec cet objet
// (API transaction interactive de Prisma, pas la variante "tableau" utilisée
// par app/api/cotisations/route.ts).
const tx = {
  parcoursCompagnon: { create: vi.fn() },
  progressionCompagnon: { createMany: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    parcoursCompagnon: { findUnique: vi.fn() },
    etapeParcoursCompagnon: { findMany: vi.fn() },
    progressionCompagnon: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx)),
  },
}))
vi.mock('@/lib/audit', () => ({ enregistrerAudit: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { enregistrerAudit } from '@/lib/audit'
import {
  genererParcoursCompagnon,
  recalculerStatutsProgressionsCompagnon,
  ParcoursDejaExistantError,
  ReferentielVideError,
} from './parcoursCompagnonService'
import { AgeEntreeInvalideError } from './parcoursCompagnon'

const REFERENTIEL = [
  { id: 'accueil', ordre: 1, type: 'EVENEMENT', dureeDixHuitAns: 0, dureeDixNeufAns: 0, dureeVingtAns: 0 },
  { id: 'aspirant', ordre: 2, type: 'DUREE', dureeDixHuitAns: 1, dureeDixNeufAns: 1, dureeVingtAns: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
  tx.parcoursCompagnon.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'parcours-1', ...data }),
  )
  tx.progressionCompagnon.createMany.mockResolvedValue({ count: REFERENTIEL.length })
})

describe('genererParcoursCompagnon', () => {
  const paramsBase = {
    scoutId: 'scout-1',
    dateNaissance: new Date('2008-01-01'),
    paroisseId: 'paroisse-1',
    dateEntreeParcours: new Date('2026-01-01'),
    acteurId: 'user-1',
  }

  it('lève ParcoursDejaExistantError si un parcours existe déjà pour ce scout', async () => {
    vi.mocked(prisma.parcoursCompagnon.findUnique).mockResolvedValue({ id: 'existant' } as never)
    await expect(genererParcoursCompagnon(paramsBase)).rejects.toThrow(ParcoursDejaExistantError)
    expect(prisma.etapeParcoursCompagnon.findMany).not.toHaveBeenCalled()
  })

  it("lève AgeEntreeInvalideError sans lire le référentiel si l'âge d'entrée est hors 18-20 ans", async () => {
    vi.mocked(prisma.parcoursCompagnon.findUnique).mockResolvedValue(null)
    await expect(
      genererParcoursCompagnon({ ...paramsBase, dateNaissance: new Date('1990-01-01') }),
    ).rejects.toThrow(AgeEntreeInvalideError)
    expect(prisma.etapeParcoursCompagnon.findMany).not.toHaveBeenCalled()
  })

  it('lève ReferentielVideError si aucune activité active', async () => {
    vi.mocked(prisma.parcoursCompagnon.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.etapeParcoursCompagnon.findMany).mockResolvedValue([])
    await expect(genererParcoursCompagnon(paramsBase)).rejects.toThrow(ReferentielVideError)
  })

  it('génère le parcours et toutes ses lignes de progression, puis journalise l\'audit', async () => {
    vi.mocked(prisma.parcoursCompagnon.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.etapeParcoursCompagnon.findMany).mockResolvedValue(REFERENTIEL as never)

    const resultat = await genererParcoursCompagnon(paramsBase)

    expect(resultat.trancheAge).toBe('DIX_HUIT_ANS')
    expect(resultat.ageEntree).toBe(18)
    expect(resultat.alerteEntreeVingtAns).toBe(false)
    expect(tx.progressionCompagnon.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ etapeActiviteId: 'accueil', statut: 'A_VENIR' })]),
      }),
    )
    expect(enregistrerAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PARCOURS_COMPAGNON_GENERE', entiteId: 'parcours-1' }),
    )
  })

  it('signale alerteEntreeVingtAns=true pour une entrée à 20 ans', async () => {
    vi.mocked(prisma.parcoursCompagnon.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.etapeParcoursCompagnon.findMany).mockResolvedValue(REFERENTIEL as never)

    const resultat = await genererParcoursCompagnon({ ...paramsBase, dateNaissance: new Date('2006-01-01') })
    expect(resultat.trancheAge).toBe('VINGT_ANS')
    expect(resultat.alerteEntreeVingtAns).toBe(true)
  })
})

describe('recalculerStatutsProgressionsCompagnon', () => {
  it('ne touche pas une ligne dont le statut temporel calculé est inchangé', async () => {
    vi.mocked(prisma.progressionCompagnon.findMany).mockResolvedValue([
      {
        id: 'p1',
        statut: 'A_VENIR',
        dateDebutTheorique: new Date('2026-06-01'),
        dateLimiteTheorique: new Date('2026-08-01'),
        derniereAlerteRetardLe: null,
      },
    ] as never)

    const resultat = await recalculerStatutsProgressionsCompagnon(new Date('2026-01-01'))

    expect(resultat).toEqual({ progressionsAnalysees: 1, progressionsMisesAJour: 0, nouvellesAlertesRetard: 0 })
    expect(prisma.progressionCompagnon.update).not.toHaveBeenCalled()
  })

  it('passe une ligne en retard et enregistre la première alerte', async () => {
    vi.mocked(prisma.progressionCompagnon.findMany).mockResolvedValue([
      {
        id: 'p1',
        statut: 'EN_COURS',
        dateDebutTheorique: new Date('2026-01-01'),
        dateLimiteTheorique: new Date('2026-02-01'),
        derniereAlerteRetardLe: null,
      },
    ] as never)
    vi.mocked(prisma.progressionCompagnon.update).mockResolvedValue({} as never)

    const resultat = await recalculerStatutsProgressionsCompagnon(new Date('2026-03-01'))

    expect(resultat.progressionsMisesAJour).toBe(1)
    expect(resultat.nouvellesAlertesRetard).toBe(1)
    expect(prisma.progressionCompagnon.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ statut: 'EN_RETARD', derniereAlerteRetardLe: new Date('2026-03-01') }),
      }),
    )
  })

  it("n'envoie pas de seconde alerte si la dernière remonte à moins de 24h (statut déjà EN_RETARD, inchangé)", async () => {
    vi.mocked(prisma.progressionCompagnon.findMany).mockResolvedValue([
      {
        id: 'p1',
        statut: 'EN_RETARD',
        dateDebutTheorique: new Date('2026-01-01'),
        dateLimiteTheorique: new Date('2026-02-01'),
        derniereAlerteRetardLe: new Date('2026-03-01T08:00:00'),
      },
    ] as never)

    const resultat = await recalculerStatutsProgressionsCompagnon(new Date('2026-03-01T12:00:00'))

    expect(resultat).toEqual({ progressionsAnalysees: 1, progressionsMisesAJour: 0, nouvellesAlertesRetard: 0 })
    expect(prisma.progressionCompagnon.update).not.toHaveBeenCalled()
  })

  it("un statut métier (ex: SOUMISE) n'est jamais retourné par findMany : le filtre where l'exclut en amont", async () => {
    vi.mocked(prisma.progressionCompagnon.findMany).mockResolvedValue([])
    await recalculerStatutsProgressionsCompagnon(new Date('2026-01-01'))
    expect(prisma.progressionCompagnon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { statut: { in: ['A_VENIR', 'EN_COURS', 'EN_RETARD'] } } }),
    )
  })
})
