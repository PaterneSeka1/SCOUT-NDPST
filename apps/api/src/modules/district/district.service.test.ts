import 'reflect-metadata'
import { BadRequestException, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RolesGuard } from '../../common/guards/roles.guard'
import { PerimetreService } from '../../common/perimetre.service'
import type { AuditService } from '../../common/audit.service'
import type { AuthService } from '../../auth/auth.service'
import type { PrismaService } from '../../prisma/prisma.service'
import type { UtilisateurSession } from '../../common/types'
import { DistrictController } from './district.controller'
import { DistrictService } from './district.service'

const COMMISSAIRE: UtilisateurSession = {
  id: 'commissaire-1',
  matricule: 'C1',
  email: 'c@exemple.ci',
  nom: 'Kouassi',
  prenom: 'Aya',
  role: 'CHEF_GROUPE',
  roleDistrict: 'COMMISSAIRE_DISTRICT',
  paroisseId: 'paroisse-a',
}

// Le district du Commissaire compte deux paroisses (a, b) ; la paroisse z
// appartient à un autre district.
function prismaSimule() {
  return {
    paroisse: {
      findUnique: vi.fn().mockResolvedValue({ districtId: 'district-1', district: { nom: 'Abidjan Nord' } }),
      findMany: vi.fn().mockResolvedValue([
        { id: 'paroisse-a', nom: 'A', ville: 'Abidjan', actif: true },
        { id: 'paroisse-b', nom: 'B', ville: 'Abidjan', actif: true },
      ]),
    },
    utilisateur: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  }
}

describe('DistrictService — périmètre du Commissaire de District', () => {
  let prisma: ReturnType<typeof prismaSimule>
  let audit: { enregistrer: ReturnType<typeof vi.fn> }
  let auth: { revoquerToutes: ReturnType<typeof vi.fn> }
  let service: DistrictService

  beforeEach(() => {
    prisma = prismaSimule()
    audit = { enregistrer: vi.fn() }
    auth = { revoquerToutes: vi.fn() }
    const p = prisma as unknown as PrismaService
    service = new DistrictService(
      p,
      new PerimetreService(p),
      audit as unknown as AuditService,
      auth as unknown as AuthService,
    )
  })

  it("refuse de changer le mot de passe d'un compte hors des paroisses du district (404, aucune écriture)", async () => {
    prisma.utilisateur.findFirst.mockResolvedValue(null)

    await expect(service.modifierMotDePasse(COMMISSAIRE, 'compte-z', 'Motdepasse1')).rejects.toBeInstanceOf(
      NotFoundException,
    )

    // La recherche est scopée aux paroisses du district ET aux affectations assignables.
    expect(prisma.utilisateur.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'compte-z',
        paroisseId: { in: ['paroisse-a', 'paroisse-b'] },
        roleDistrict: { in: ['ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT'] },
      },
      select: { id: true, paroisseId: true },
    })
    expect(prisma.utilisateur.update).not.toHaveBeenCalled()
    expect(auth.revoquerToutes).not.toHaveBeenCalled()
    expect(audit.enregistrer).not.toHaveBeenCalled()
  })

  it('change le mot de passe d’un membre du district, révoque ses sessions et journalise', async () => {
    prisma.utilisateur.findFirst.mockResolvedValue({ id: 'adjoint-1', paroisseId: 'paroisse-b' })

    await expect(service.modifierMotDePasse(COMMISSAIRE, 'adjoint-1', 'Motdepasse1')).resolves.toEqual({
      message: 'Mot de passe mis à jour',
    })
    expect(prisma.utilisateur.update).toHaveBeenCalledTimes(1)
    expect(auth.revoquerToutes).toHaveBeenCalledWith('adjoint-1')
    expect(audit.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE', entiteId: 'adjoint-1' }),
    )
  })

  it("refuse d'affecter au district un membre d'une paroisse d'un autre district", async () => {
    prisma.utilisateur.findUnique.mockResolvedValue({
      id: 'chef-z',
      role: 'CHEF_GROUPE',
      roleDistrict: null,
      actif: true,
      paroisseId: 'paroisse-z',
    })

    await expect(
      service.affecter(COMMISSAIRE, { utilisateurId: 'chef-z', role: 'ADJOINT_DISTRICT' }),
    ).rejects.toThrow("Cette personne n'appartient pas à une paroisse de ce district")
    expect(prisma.utilisateur.update).not.toHaveBeenCalled()
  })

  it('refuse un rôle hors ROLES_ASSIGNABLES_DISTRICT (ex. COMMISSAIRE_DISTRICT)', async () => {
    await expect(
      service.affecter(COMMISSAIRE, { utilisateurId: 'chef-a', role: 'COMMISSAIRE_DISTRICT' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    prisma.utilisateur.findFirst.mockResolvedValue({
      id: 'adjoint-1',
      roleDistrict: 'ADJOINT_DISTRICT',
      actif: true,
      fonctionDistrict: null,
      paroisseId: 'paroisse-a',
    })
    await expect(service.modifierMembre(COMMISSAIRE, 'adjoint-1', { role: 'ADMIN_PLATEFORME' })).rejects.toThrow(
      'Rôle invalide',
    )
    expect(prisma.utilisateur.update).not.toHaveBeenCalled()
  })
})

describe('DistrictController — accès gouverné par roleDistrict', () => {
  const garde = new RolesGuard(new Reflector())

  function contexte(methode: keyof DistrictController, utilisateur: Partial<UtilisateurSession>): ExecutionContext {
    return {
      getHandler: () => DistrictController.prototype[methode],
      getClass: () => DistrictController,
      switchToHttp: () => ({ getRequest: () => ({ utilisateur }) }),
    } as unknown as ExecutionContext
  }

  it('refuse un compte sans roleDistrict, quel que soit son rôle paroissial', () => {
    const chefGroupe = { ...COMMISSAIRE, role: 'CHEF_GROUPE', roleDistrict: null }
    for (const methode of ['apercu', 'rapports', 'listerEquipe', 'modifierMotDePasse'] as const) {
      expect(() => garde.canActivate(contexte(methode, chefGroupe))).toThrow(ForbiddenException)
    }
  })

  it('réserve la gestion de l’équipe au Commissaire (ADJOINT_DISTRICT refusé)', () => {
    const adjoint = { ...COMMISSAIRE, roleDistrict: 'ADJOINT_DISTRICT' }
    expect(() => garde.canActivate(contexte('affecter', adjoint))).toThrow(ForbiddenException)
    expect(garde.canActivate(contexte('apercu', adjoint))).toBe(true)
    expect(garde.canActivate(contexte('affecter', COMMISSAIRE))).toBe(true)
  })
})
