import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { ExecutionContext } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../../prisma/prisma.service'
import type { AuditService } from '../../common/audit.service'
import type { AuthService } from '../../auth/auth.service'
import type { UtilisateurSession } from '../../common/types'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Prisma } from '../../generated/prisma/client'
import { UtilisateursController } from './utilisateurs.controller'
import { SchemaCreationUtilisateur, SchemaProfilPublic } from './utilisateurs.schemas'
import { UtilisateursService } from './utilisateurs.service'

const CHEF: UtilisateurSession = {
  id: 'chef-1',
  matricule: 'M001',
  email: 'chef@exemple.ci',
  nom: 'Kouassi',
  prenom: 'Jean',
  role: 'CHEF_GROUPE',
  editeurContenu: false,
}

const ADMIN: UtilisateurSession = { ...CHEF, id: 'admin-1', role: 'ADMINISTRATEUR' }

const MOT_DE_PASSE_VALIDE = 'Secret123'

function cible(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'cible',
    role: 'ADJOINT_GROUPE',
    actif: true,
    brancheType: null,
    profilPublic: false,
    fonctionPublique: null,
    photoPublique: null,
    biographie: null,
    ordrePublic: 0,
    ...surcharge,
  }
}

function creerContexte() {
  const prisma = {
    utilisateur: {
      findFirst: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'cible' }),
    },
    scout: { count: vi.fn() },
    lienParentScout: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    mandat: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma))
  const audit = { enregistrer: vi.fn().mockResolvedValue(undefined) }
  const auth = { revoquerToutes: vi.fn().mockResolvedValue(undefined) }
  const service = new UtilisateursService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    auth as unknown as AuthService,
  )
  return { prisma, audit, auth, service }
}

type Contexte = ReturnType<typeof creerContexte>

// Lecture hors transaction (findFirst) puis relecture sous verrou (findUniqueOrThrow).
function avecCible(ctx: Contexte, compte: Record<string, unknown>) {
  ctx.prisma.utilisateur.findFirst.mockResolvedValue(compte)
  ctx.prisma.utilisateur.findUniqueOrThrow.mockResolvedValue(compte)
}

describe('UtilisateursController — contrôle de rôle', () => {
  const garde = new RolesGuard(new Reflector())
  function autorise(nom: keyof UtilisateursController, role: string): boolean {
    const contexte = {
      getClass: () => UtilisateursController,
      getHandler: () => UtilisateursController.prototype[nom],
      switchToHttp: () => ({ getRequest: () => ({ utilisateur: { id: 'u', role, editeurContenu: true } }) }),
    } as unknown as ExecutionContext
    try {
      return garde.canActivate(contexte)
    } catch {
      return false
    }
  }

  it('réserve la gestion de la maîtrise au Chef de Groupe', () => {
    for (const nom of [
      'lister',
      'creer',
      'detail',
      'mandats',
      'modifier',
      'desactiver',
      'reinitialiserMotDePasse',
    ] as const) {
      expect(autorise(nom, 'CHEF_GROUPE'), nom).toBe(true)
      expect(autorise(nom, 'ADJOINT_GROUPE'), nom).toBe(false)
      expect(autorise(nom, 'ADMINISTRATEUR'), nom).toBe(false)
    }
  })

  it('ouvre l’organigramme à toute la maîtrise, pas aux familles ni à l’administrateur', () => {
    expect(autorise('maitrise', 'ASSISTANT_BRANCHE')).toBe(true)
    expect(autorise('maitrise', 'ADJOINT_GROUPE')).toBe(true)
    expect(autorise('maitrise', 'PARENT')).toBe(false)
    expect(autorise('maitrise', 'ADMINISTRATEUR')).toBe(false)
  })

  it('profil public : Chef de Groupe ou administrateur', () => {
    expect(autorise('modifierProfilPublic', 'CHEF_GROUPE')).toBe(true)
    expect(autorise('modifierProfilPublic', 'ADMINISTRATEUR')).toBe(true)
    expect(autorise('modifierProfilPublic', 'RESPONSABLE_BRANCHE')).toBe(false)
  })
})

describe('UtilisateursService — gestion de la maîtrise', () => {
  let ctx: Contexte

  beforeEach(() => {
    ctx = creerContexte()
  })

  describe('creer', () => {
    it('crée le compte avec un secret temporaire et ouvre un mandat dans la même transaction', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValue(null)
      ctx.prisma.utilisateur.create.mockResolvedValue({
        id: 'nouveau',
        role: 'RESPONSABLE_BRANCHE',
        brancheType: 'LOUVETEAUX',
        email: null,
      })
      const resultat = await ctx.service.creer(
        CHEF,
        SchemaCreationUtilisateur.parse({
          nom: 'N',
          prenom: 'P',
          role: 'RESPONSABLE_BRANCHE',
          brancheType: 'LOUVETEAUX',
          matricule: 'M2',
        }),
      )
      expect(resultat.motDePasseTemporaire).toEqual(expect.any(String))
      const data = ctx.prisma.utilisateur.create.mock.calls[0]![0].data
      expect(data).toMatchObject({ doitChangerMotDePasse: true, role: 'RESPONSABLE_BRANCHE' })
      expect(data).not.toHaveProperty('paroisseId')
      expect(ctx.prisma.mandat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          utilisateurId: 'nouveau',
          role: 'RESPONSABLE_BRANCHE',
          brancheType: 'LOUVETEAUX',
          auteurId: CHEF.id,
          motif: 'Création du compte',
        }),
      })
      expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(JSON.stringify(ctx.audit.enregistrer.mock.calls)).not.toContain(resultat.motDePasseTemporaire)
    })

    it('refuse ADMINISTRATEUR (géré par l’administration)', async () => {
      await expect(
        ctx.service.creer(
          CHEF,
          SchemaCreationUtilisateur.parse({ nom: 'N', prenom: 'P', role: 'ADMINISTRATEUR', matricule: 'M3' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(ctx.prisma.utilisateur.create).not.toHaveBeenCalled()
    })

    it('refuse un second Responsable de Branche actif dans la même branche (409)', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValue({ id: 'deja' })
      await expect(
        ctx.service.creer(
          CHEF,
          SchemaCreationUtilisateur.parse({
            nom: 'N',
            prenom: 'P',
            role: 'RESPONSABLE_BRANCHE',
            brancheType: 'LOUVETEAUX',
            matricule: 'M4',
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException)
      expect(ctx.prisma.utilisateur.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'RESPONSABLE_BRANCHE', brancheType: 'LOUVETEAUX', actif: true } }),
      )
    })

    it('traduit une violation d’index unique concurrente (P2002) en 409', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValue(null)
      ctx.prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }),
      )
      await expect(
        ctx.service.creer(
          CHEF,
          SchemaCreationUtilisateur.parse({ nom: 'N', prenom: 'P', role: 'CHEF_GROUPE', matricule: 'M5' }),
        ),
      ).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('modifier (rôle / statut)', () => {
    it("refuse qu'un compte change son propre rôle", async () => {
      avecCible(ctx, cible({ id: CHEF.id, role: 'CHEF_GROUPE' }))
      await expect(ctx.service.modifier(CHEF, CHEF.id, { role: 'ADJOINT_GROUPE' })).rejects.toBeInstanceOf(
        ForbiddenException,
      )
      expect(ctx.prisma.utilisateur.update).not.toHaveBeenCalled()
    })

    it("refuse qu'un compte se désactive lui-même", async () => {
      avecCible(ctx, cible({ id: CHEF.id, role: 'CHEF_GROUPE' }))
      await expect(ctx.service.modifier(CHEF, CHEF.id, { actif: false })).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('refuse toute promotion en ADMINISTRATEUR', async () => {
      avecCible(ctx, cible())
      await expect(ctx.service.modifier(CHEF, 'cible', { role: 'ADMINISTRATEUR' })).rejects.toBeInstanceOf(
        BadRequestException,
      )
      expect(ctx.prisma.utilisateur.update).not.toHaveBeenCalled()
    })

    it('ne trouve pas un compte administrateur (hors de la maîtrise)', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValueOnce(null)
      await expect(ctx.service.modifier(CHEF, 'admin', { nom: 'X' })).rejects.toBeInstanceOf(NotFoundException)
      expect(ctx.prisma.utilisateur.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'admin', role: { not: 'ADMINISTRATEUR' } } }),
      )
    })

    it('changement de rôle : clôt le mandat, en ouvre un nouveau et révoque les sessions dans la transaction', async () => {
      avecCible(ctx, cible())
      await ctx.service.modifier(CHEF, 'cible', { role: 'ASSISTANT_GROUPE' })
      expect(ctx.prisma.$queryRaw).toHaveBeenCalled()
      expect(ctx.prisma.mandat.updateMany).toHaveBeenCalledWith({
        where: { utilisateurId: 'cible', finLe: null, role: 'ADJOINT_GROUPE', brancheType: null },
        data: { finLe: expect.any(Date) },
      })
      expect(ctx.prisma.mandat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: 'ASSISTANT_GROUPE', brancheType: null, motif: 'Changement de rôle' }),
      })
      expect(ctx.auth.revoquerToutes).toHaveBeenCalledWith('cible', ctx.prisma)
      expect(ctx.audit.enregistrer).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UTILISATEUR_ROLE_MODIFIE' }),
      )
    })

    it('désactivation : clôt le mandat sans en ouvrir et révoque les sessions', async () => {
      avecCible(ctx, cible())
      await ctx.service.modifier(CHEF, 'cible', { actif: false })
      expect(ctx.prisma.mandat.updateMany).toHaveBeenCalled()
      expect(ctx.prisma.mandat.create).not.toHaveBeenCalled()
      expect(ctx.auth.revoquerToutes).toHaveBeenCalledWith('cible', ctx.prisma)
    })

    it('modification du nom seul : historique inchangé', async () => {
      avecCible(ctx, cible())
      await ctx.service.modifier(CHEF, 'cible', { nom: 'Nouveau' })
      expect(ctx.prisma.mandat.updateMany).not.toHaveBeenCalled()
      expect(ctx.prisma.mandat.create).not.toHaveBeenCalled()
      expect(ctx.auth.revoquerToutes).not.toHaveBeenCalled()
    })

    it('refuse une modification si le compte a changé entre-temps (409)', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValue(cible())
      ctx.prisma.utilisateur.findUniqueOrThrow.mockResolvedValue(cible({ role: 'ASSISTANT_GROUPE' }))
      await expect(
        ctx.service.modifier(CHEF, 'cible', { role: 'ADJOINT_BRANCHE', brancheType: 'OISILLONS' }),
      ).rejects.toBeInstanceOf(ConflictException)
      expect(ctx.prisma.utilisateur.update).not.toHaveBeenCalled()
    })
  })

  describe('reinitialiserMotDePasse', () => {
    it("ne touche pas au mot de passe d'un administrateur", async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValueOnce(null)
      await expect(
        ctx.service.reinitialiserMotDePasse(CHEF, 'admin', { nouveauMotDePasse: MOT_DE_PASSE_VALIDE }),
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(ctx.prisma.utilisateur.update).not.toHaveBeenCalled()
      expect(ctx.auth.revoquerToutes).not.toHaveBeenCalled()
    })

    it('met à jour le mot de passe, impose son changement puis révoque toutes les sessions', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValueOnce({ id: 'cible' })
      const resultat = await ctx.service.reinitialiserMotDePasse(CHEF, 'cible', {
        nouveauMotDePasse: MOT_DE_PASSE_VALIDE,
      })
      expect(resultat).toEqual({ message: 'Mot de passe mis à jour' })
      expect(ctx.prisma.utilisateur.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cible' },
          data: expect.objectContaining({ doitChangerMotDePasse: true }),
        }),
      )
      expect(ctx.auth.revoquerToutes).toHaveBeenCalledWith('cible')
    })
  })

  describe('desactiver', () => {
    it('refuse la désactivation de soi-même', async () => {
      await expect(ctx.service.desactiver(CHEF, CHEF.id)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('désactive, clôt le mandat et révoque les sessions (jamais de suppression)', async () => {
      avecCible(ctx, cible())
      await ctx.service.desactiver(CHEF, 'cible')
      expect(ctx.prisma.utilisateur.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cible' }, data: { actif: false } }),
      )
      expect(ctx.prisma.mandat.updateMany).toHaveBeenCalled()
      expect(ctx.auth.revoquerToutes).toHaveBeenCalledWith('cible', ctx.prisma)
    })
  })

  describe('mandats et organigramme', () => {
    it('liste les mandats d’un compte de la maîtrise', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValue({ id: 'cible' })
      await ctx.service.mandats('cible')
      expect(ctx.prisma.mandat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { utilisateurId: 'cible' }, orderBy: { debutLe: 'desc' } }),
      )
    })

    it('groupe la maîtrise active : direction puis branches', async () => {
      ctx.prisma.utilisateur.findMany.mockResolvedValue([
        {
          id: 'a',
          role: 'ASSISTANT_GROUPE',
          brancheType: null,
          mandats: [{ role: 'ASSISTANT_GROUPE', brancheType: null }],
        },
        {
          id: 'r',
          role: 'RESPONSABLE_BRANCHE',
          brancheType: 'LOUVETEAUX',
          mandats: [{ role: 'RESPONSABLE_BRANCHE', brancheType: 'LOUVETEAUX' }],
        },
        { id: 'c', role: 'CHEF_GROUPE', brancheType: null, mandats: [{ role: 'CHEF_GROUPE', brancheType: null }] },
        {
          id: 'x',
          role: 'ASSISTANT_BRANCHE',
          brancheType: 'LOUVETEAUX',
          mandats: [{ role: 'ASSISTANT_BRANCHE', brancheType: 'LOUVETEAUX' }],
        },
      ])
      const organigramme = await ctx.service.maitrise()
      expect(ctx.prisma.utilisateur.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ actif: true }) }),
      )
      expect(organigramme.direction.map((m) => m.id)).toEqual(['c', 'a'])
      const louveteaux = organigramme.branches.find((b) => b.brancheType === 'LOUVETEAUX')
      expect(louveteaux?.membres.map((m) => m.id)).toEqual(['r', 'x'])
      expect(organigramme.branches.find((b) => b.brancheType === 'OISILLONS')?.membres).toEqual([])
    })
  })

  describe('modifierProfilPublic', () => {
    it('publie le profil et journalise PROFIL_PUBLIC_MODIFIE', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValue(cible())
      await ctx.service.modifierProfilPublic(
        CHEF,
        'cible',
        SchemaProfilPublic.parse({ profilPublic: true, biographie: ' Engagé depuis 2010 ', ordrePublic: 3 }),
      )
      expect(ctx.prisma.utilisateur.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cible' },
          data: { profilPublic: true, biographie: 'Engagé depuis 2010', ordrePublic: 3 },
        }),
      )
      expect(ctx.audit.enregistrer).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PROFIL_PUBLIC_MODIFIE',
          details: { champs: ['profilPublic', 'biographie', 'ordrePublic'], profilPublic: true },
        }),
      )
    })

    it('le Chef de Groupe ne voit pas les comptes administrateurs ; l’administrateur si', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValue(cible())
      await ctx.service.modifierProfilPublic(CHEF, 'cible', SchemaProfilPublic.parse({ ordrePublic: 1 }))
      expect(ctx.prisma.utilisateur.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { id: 'cible', role: { not: 'ADMINISTRATEUR' } } }),
      )
      await ctx.service.modifierProfilPublic(ADMIN, 'cible', SchemaProfilPublic.parse({ ordrePublic: 1 }))
      expect(ctx.prisma.utilisateur.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { id: 'cible' } }),
      )
    })

    it('refuse de rendre public un parent ou un scout', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValue(cible({ role: 'PARENT' }))
      await expect(
        ctx.service.modifierProfilPublic(ADMIN, 'cible', SchemaProfilPublic.parse({ profilPublic: true })),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(ctx.prisma.utilisateur.update).not.toHaveBeenCalled()
    })

    it('ne journalise rien si rien ne change', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValue(cible({ profilPublic: true }))
      await ctx.service.modifierProfilPublic(CHEF, 'cible', SchemaProfilPublic.parse({ profilPublic: true }))
      expect(ctx.audit.enregistrer).not.toHaveBeenCalled()
    })
  })
})
