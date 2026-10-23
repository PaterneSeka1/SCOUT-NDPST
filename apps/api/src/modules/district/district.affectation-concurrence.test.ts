import { ConflictException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import type { AuthService } from '../../auth/auth.service'
import type { PerimetreService } from '../../common/perimetre.service'
import type { PrismaService } from '../../prisma/prisma.service'
import { DistrictService } from './district.service'

describe('Affectation district — transfert concurrent de la paroisse cible', () => {
  it.each(['district-a', 'district-b'])('refuse un rattachement modifié avant ou après lecture du district %s', async (districtLu) => {
    const tx = {
      $queryRaw: vi.fn(),
      paroisse: { findUniqueOrThrow: vi.fn()
        .mockResolvedValueOnce({ districtId: districtLu })
        .mockResolvedValueOnce({ districtId: 'district-b' })
        .mockResolvedValueOnce({ districtId: 'district-a' }) },
      utilisateur: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
      affectationDistrict: { create: vi.fn() },
      sessionUtilisateur: { updateMany: vi.fn() },
    }
    const prisma = {
      utilisateur: { findUnique: vi.fn().mockResolvedValue({
        id: 'candidat', role: 'CHEF_GROUPE', roleDistrict: null, actif: true, paroisseId: 'paroisse-cible',
      }) },
      $transaction: vi.fn().mockImplementation(async (executer: (client: typeof tx) => unknown) => executer(tx)),
    }
    const perimetre = { paroissesDuDistrict: vi.fn().mockResolvedValue({
      nomDistrict: 'District A', paroisses: [{ id: 'paroisse-cible', nom: 'Paroisse cible', actif: true }],
    }) }
    const service = new DistrictService(
      prisma as unknown as PrismaService, perimetre as unknown as PerimetreService,
      { enregistrer: vi.fn() } as unknown as AuditService, {} as AuthService,
    )
    await expect(service.affecter({
      id: 'commissaire', matricule: 'TEST-C1', email: '', nom: 'Test', prenom: 'Test',
      role: 'CHEF_GROUPE', roleDistrict: 'COMMISSAIRE_DISTRICT', paroisseId: 'paroisse-ancrage',
    }, { utilisateurId: 'candidat', role: 'ADJOINT_DISTRICT' })).rejects.toBeInstanceOf(ConflictException)
    expect(tx.utilisateur.update).not.toHaveBeenCalled()
    expect(tx.affectationDistrict.create).not.toHaveBeenCalled()
    expect(tx.sessionUtilisateur.updateMany).not.toHaveBeenCalled()
  })
})
