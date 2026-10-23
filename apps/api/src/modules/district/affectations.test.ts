import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '../../generated/prisma/client'
import { historiserAffectation, motifAffectation } from './affectations'

function transaction() {
  return {
    $queryRaw: vi.fn(),
    utilisateur: { findUniqueOrThrow: vi.fn().mockResolvedValue({ roleDistrict: 'ADJOINT_DISTRICT', fonctionDistrict: null, brancheTypeDistrict: null, paroisse: { districtId: 'district-a' } }) },
    affectationDistrict: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn() },
    sessionUtilisateur: { updateMany: vi.fn() },
  }
}

describe('Historique des affectations district', () => {
  it('ferme le mandat et révoque les sessions dans la transaction appelante', async () => {
    const tx = transaction()
    await historiserAffectation(tx as unknown as Prisma.TransactionClient, 'membre', {
      roleDistrict: null, fonctionDistrict: null, brancheTypeDistrict: null,
    }, 'acteur', 'Fin de mandat')
    expect(tx.affectationDistrict.updateMany).toHaveBeenCalledWith({
      where: { utilisateurId: 'membre', finLe: null },
      data: { finLe: expect.any(Date), revoqueParId: 'acteur', motifRevocation: 'Fin de mandat' },
    })
    expect(tx.sessionUtilisateur.updateMany).toHaveBeenCalledWith({ where: { utilisateurId: 'membre', revoqueeLe: null }, data: { revoqueeLe: expect.any(Date) } })
    expect(tx.affectationDistrict.create).not.toHaveBeenCalled()
    expect(tx.$queryRaw).toHaveBeenCalledWith(expect.any(Array), 'membre')
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.utilisateur.findUniqueOrThrow.mock.invocationCallOrder[0]!)
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.sessionUtilisateur.updateMany.mock.invocationCallOrder[0]!)
  })

  it('reprend un mandat manquant avant remplacement sans inventer son auteur', async () => {
    const tx = transaction()
    tx.affectationDistrict.updateMany.mockResolvedValue({ count: 0 })
    await historiserAffectation(tx as unknown as Prisma.TransactionClient, 'membre', {
      roleDistrict: 'ASSISTANT_DISTRICT', fonctionDistrict: 'Formation', brancheTypeDistrict: null,
    }, 'acteur')
    expect(tx.affectationDistrict.create).toHaveBeenCalledTimes(2)
    expect(tx.affectationDistrict.create.mock.calls[0]?.[0]).toEqual({ data: expect.objectContaining({ reprise: true, finLe: expect.any(Date), role: 'ADJOINT_DISTRICT' }) })
    expect(tx.affectationDistrict.create.mock.calls[1]?.[0]).toEqual({ data: expect.objectContaining({ auteurId: 'acteur', role: 'ASSISTANT_DISTRICT', fonction: 'Formation' }) })
  })

  it('ne révoque pas les sessions pour une affectation inchangée', async () => {
    const tx = transaction()
    await historiserAffectation(tx as unknown as Prisma.TransactionClient, 'membre', {
      roleDistrict: 'ADJOINT_DISTRICT', fonctionDistrict: null, brancheTypeDistrict: null,
    }, 'acteur')
    expect(tx.affectationDistrict.updateMany).not.toHaveBeenCalled()
    expect(tx.sessionUtilisateur.updateMany).not.toHaveBeenCalled()
    expect(tx.$queryRaw).toHaveBeenCalledOnce()
  })

  it('propage les erreurs de persistance pour provoquer le rollback appelant', async () => {
    const tx = transaction()
    tx.affectationDistrict.updateMany.mockRejectedValue(new Error('écriture refusée'))
    await expect(historiserAffectation(tx as unknown as Prisma.TransactionClient, 'membre', {
      roleDistrict: null, fonctionDistrict: null, brancheTypeDistrict: null,
    }, 'acteur')).rejects.toThrow('écriture refusée')
    expect(tx.sessionUtilisateur.updateMany).not.toHaveBeenCalled()
  })

  it('valide les motifs libres', () => {
    expect(motifAffectation('  Fin de mandat  ')).toBe('Fin de mandat')
    expect(() => motifAffectation('x'.repeat(501))).toThrow()
    expect(() => motifAffectation({})).toThrow()
  })
})
