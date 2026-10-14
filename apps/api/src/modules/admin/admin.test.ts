import { ConflictException, ForbiddenException, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RolesGuard } from '../../common/guards/roles.guard'
import type { AuditService } from '../../common/audit.service'
import type { AuthService } from '../../auth/auth.service'
import type { PrismaService } from '../../prisma/prisma.service'
import { AdminDistrictsController } from './districts.controller'
import { AdminParoissesController } from './paroisses.controller'
import { SchemaCreationChefGroupe, SchemaModificationParoisse } from './paroisses.schemas'
import { ParoissesService } from './paroisses.service'
import { AdminAuditController, AdminSiteConfigController } from './plateforme.controller'
import { AdminRapportsController } from './rapports.controller'
import { AdminUtilisateursController } from './utilisateurs.controller'
import { SchemaCreationUtilisateur, SchemaMotDePasseAdmin, SchemaNomination } from './utilisateurs.schemas'
import { UtilisateursService } from './utilisateurs.service'

const CONTROLEURS = [
  AdminAuditController,
  AdminSiteConfigController,
  AdminDistrictsController,
  AdminParoissesController,
  AdminRapportsController,
  AdminUtilisateursController,
]

function contexte(classe: object, handler: () => unknown, role: string): ExecutionContext {
  return {
    getClass: () => classe,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ utilisateur: { id: 'u1', role, roleDistrict: null } }) }),
  } as unknown as ExecutionContext
}

describe('AdminModule — contrôle de rôle', () => {
  const garde = new RolesGuard(new Reflector())
  const routes = CONTROLEURS.flatMap((classe) =>
    Object.getOwnPropertyNames(classe.prototype)
      .filter((nom) => nom !== 'constructor')
      .map((nom) => ({
        classe,
        nom,
        handler: (classe.prototype as unknown as Record<string, () => unknown>)[nom],
      })),
  )

  it('couvre bien toutes les routes du module', () => {
    expect(routes.length).toBeGreaterThanOrEqual(25)
  })

  it.each(['CHEF_GROUPE', 'RESPONSABLE_BRANCHE', 'PARENT', 'SCOUT', 'COMMISSAIRE_DISTRICT'])(
    'refuse le rôle %s sur chaque route',
    (role) => {
      for (const { classe, nom, handler } of routes) {
        expect(() => garde.canActivate(contexte(classe, handler, role)), `${classe.name}.${nom}`).toThrow(
          ForbiddenException,
        )
      }
    },
  )

  it('autorise ADMIN_PLATEFORME sur chaque route', () => {
    for (const { classe, handler } of routes) {
      expect(garde.canActivate(contexte(classe, handler, 'ADMIN_PLATEFORME'))).toBe(true)
    }
  })
})

function simulations() {
  const prisma = {
    paroisse: { findUnique: vi.fn(), update: vi.fn() },
    utilisateur: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  }
  const audit = { enregistrer: vi.fn().mockResolvedValue(undefined) }
  const auth = { revoquerToutes: vi.fn().mockResolvedValue(undefined) }
  return {
    prisma,
    audit,
    auth,
    paroisses: new ParoissesService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      auth as unknown as AuthService,
    ),
    utilisateurs: new UtilisateursService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      auth as unknown as AuthService,
    ),
  }
}

describe('AdminModule — unicité du Chef de Groupe actif', () => {
  let s: ReturnType<typeof simulations>

  beforeEach(() => {
    s = simulations()
    s.prisma.paroisse.findUnique.mockResolvedValue({ id: 'p1' })
    // Un Chef de Groupe actif existe déjà dans la paroisse.
    s.prisma.utilisateur.findFirst.mockResolvedValue({ id: 'chef-actuel' })
  })

  it('refuse de créer un second Chef de Groupe via /paroisses/:id/chef-groupe (409)', async () => {
    await expect(
      s.paroisses.creerChefGroupe(
        'p1',
        SchemaCreationChefGroupe.parse({ nom: 'Kouassi', prenom: 'Jean', matricule: 'M1', password: 'abcdef12' }),
      ),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(s.prisma.utilisateur.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { paroisseId: 'p1', role: 'CHEF_GROUPE', actif: true } }),
    )
    expect(s.prisma.utilisateur.create).not.toHaveBeenCalled()
  })

  it('refuse de créer un compte CHEF_GROUPE via /utilisateurs (409)', async () => {
    await expect(
      s.utilisateurs.creer(
        SchemaCreationUtilisateur.parse({
          paroisseId: 'p1',
          nom: 'Kouassi',
          prenom: 'Jean',
          matricule: 'M1',
          role: 'CHEF_GROUPE',
          password: 'abcdef12',
        }),
        'admin',
      ),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(s.prisma.utilisateur.create).not.toHaveBeenCalled()
  })

  it('refuse de promouvoir un autre membre actif Chef de Groupe via /nominations (409)', async () => {
    s.prisma.utilisateur.findFirst
      .mockResolvedValueOnce({
        id: 'u2',
        role: 'ADJOINT_GROUPE',
        fonction: null,
        brancheType: null,
        roleDistrict: null,
        fonctionDistrict: null,
        brancheTypeDistrict: null,
        actif: true,
        matricule: 'M2',
        telephone: null,
        paroisseId: 'p1',
        paroisse: { districtId: 'd1' },
      })
      .mockResolvedValueOnce({ id: 'chef-actuel' })
    await expect(
      s.utilisateurs.nommer('u2', SchemaNomination.parse({ role: 'CHEF_GROUPE' }), 'admin'),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(s.prisma.utilisateur.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { paroisseId: 'p1', role: 'CHEF_GROUPE', actif: true, NOT: { id: 'u2' } },
      }),
    )
  })
})

describe('AdminModule — fermeture des sessions', () => {
  it('révoque les sessions après un changement de mot de passe', async () => {
    const s = simulations()
    s.prisma.utilisateur.findFirst.mockResolvedValue({ id: 'u1', paroisseId: 'p1' })
    s.prisma.utilisateur.update.mockResolvedValue({})
    await s.utilisateurs.changerMotDePasse(
      'u1',
      SchemaMotDePasseAdmin.parse({ nouveauMotDePasse: 'nouveau123' }),
      'admin',
    )
    expect(s.auth.revoquerToutes).toHaveBeenCalledWith('u1')
  })

  it('révoque les sessions après une désactivation de compte', async () => {
    const s = simulations()
    s.prisma.utilisateur.findFirst.mockResolvedValue({ id: 'u1', role: 'CHEF_GROUPE', actif: true, paroisseId: 'p1' })
    s.prisma.utilisateur.update.mockResolvedValue({ id: 'u1', paroisseId: 'p1' })
    await s.utilisateurs.desactiver('u1', 'admin')
    expect(s.auth.revoquerToutes).toHaveBeenCalledWith('u1')
  })

  it('révoque les sessions de tout le personnel quand une paroisse est désactivée', async () => {
    const s = simulations()
    s.prisma.paroisse.findUnique.mockResolvedValue({ id: 'p1', actif: true })
    s.prisma.paroisse.update.mockResolvedValue({ id: 'p1', actif: false })
    s.prisma.utilisateur.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }])
    await s.paroisses.modifier('p1', SchemaModificationParoisse.parse({ actif: false }), 'admin')
    expect(s.auth.revoquerToutes).toHaveBeenCalledWith('u1')
    expect(s.auth.revoquerToutes).toHaveBeenCalledWith('u2')
    expect(s.audit.enregistrer).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAROISSE_DESACTIVEE' }))
  })
})
