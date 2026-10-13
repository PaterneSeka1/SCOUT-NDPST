import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../../prisma/prisma.service'
import type { AuditService } from '../../common/audit.service'
import type { AuthService } from '../../auth/auth.service'
import type { UtilisateurSession } from '../../common/types'
import { UtilisateursService } from './utilisateurs.service'

const CHEF: UtilisateurSession = {
  id: 'chef-1',
  matricule: 'M001',
  email: 'chef@exemple.ci',
  nom: 'Kouassi',
  prenom: 'Jean',
  role: 'CHEF_GROUPE',
  roleDistrict: null,
  paroisseId: 'paroisse-1',
}

const MOT_DE_PASSE_VALIDE = 'Secret123'

function creerContexte() {
  const prisma = {
    utilisateur: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'cible' }),
    },
    lienParentScout: { findMany: vi.fn().mockResolvedValue([]) },
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

describe('UtilisateursService — hiérarchie des modifications', () => {
  let ctx: ReturnType<typeof creerContexte>

  beforeEach(() => {
    ctx = creerContexte()
  })

  describe('modifier (rôle / statut)', () => {
    it("refuse qu'un compte change son propre rôle", async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValueOnce({
        id: CHEF.id,
        role: 'CHEF_GROUPE',
        actif: true,
        brancheType: null,
        roleDistrict: null,
      })
      await expect(ctx.service.modifier(CHEF, CHEF.id, { role: 'ADJOINT_GROUPE' })).rejects.toBeInstanceOf(
        ForbiddenException,
      )
      expect(ctx.prisma.utilisateur.update).not.toHaveBeenCalled()
    })

    it("refuse qu'un compte se désactive lui-même", async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValueOnce({
        id: CHEF.id,
        role: 'CHEF_GROUPE',
        actif: true,
        brancheType: null,
        roleDistrict: null,
      })
      await expect(ctx.service.modifier(CHEF, CHEF.id, { actif: false })).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('refuse toute promotion en ADMIN_PLATEFORME ou rôle de district', async () => {
      const cible = { id: 'cible', role: 'ADJOINT_GROUPE', actif: true, brancheType: null, roleDistrict: null }
      ctx.prisma.utilisateur.findFirst.mockResolvedValue(cible)
      await expect(ctx.service.modifier(CHEF, 'cible', { role: 'ADMIN_PLATEFORME' })).rejects.toBeInstanceOf(
        BadRequestException,
      )
      await expect(ctx.service.modifier(CHEF, 'cible', { role: 'COMMISSAIRE_DISTRICT' })).rejects.toBeInstanceOf(
        BadRequestException,
      )
      expect(ctx.prisma.utilisateur.update).not.toHaveBeenCalled()
    })

    it("protège le rôle et le statut d'un membre de l'équipe de district", async () => {
      const cible = {
        id: 'cible',
        role: 'ADJOINT_GROUPE',
        actif: true,
        brancheType: null,
        roleDistrict: 'ASSISTANT_DISTRICT',
      }
      ctx.prisma.utilisateur.findFirst.mockResolvedValue(cible)
      await expect(ctx.service.modifier(CHEF, 'cible', { role: 'ASSISTANT_GROUPE' })).rejects.toBeInstanceOf(
        ForbiddenException,
      )
      await expect(ctx.service.modifier(CHEF, 'cible', { actif: false })).rejects.toBeInstanceOf(ForbiddenException)
    })

    it("ne trouve pas un compte d'une autre paroisse", async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValueOnce(null)
      await expect(ctx.service.modifier(CHEF, 'autre', { nom: 'X' })).rejects.toBeInstanceOf(NotFoundException)
      expect(ctx.prisma.utilisateur.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'autre', paroisseId: 'paroisse-1' } }),
      )
    })

    it('révoque les sessions du compte désactivé', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValueOnce({
        id: 'cible',
        role: 'ADJOINT_GROUPE',
        actif: true,
        brancheType: null,
        roleDistrict: null,
      })
      await ctx.service.modifier(CHEF, 'cible', { actif: false })
      expect(ctx.auth.revoquerToutes).toHaveBeenCalledWith('cible')
    })
  })

  describe('reinitialiserMotDePasse', () => {
    it("refuse de réinitialiser le mot de passe d'un membre de l'équipe de district", async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValueOnce({ id: 'cible', roleDistrict: 'ADJOINT_DISTRICT' })
      await expect(
        ctx.service.reinitialiserMotDePasse(CHEF, 'cible', { nouveauMotDePasse: MOT_DE_PASSE_VALIDE }),
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(ctx.prisma.utilisateur.update).not.toHaveBeenCalled()
      expect(ctx.auth.revoquerToutes).not.toHaveBeenCalled()
    })

    it('rejette un mot de passe trop faible', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValueOnce({ id: 'cible', roleDistrict: null })
      await expect(
        ctx.service.reinitialiserMotDePasse(CHEF, 'cible', { nouveauMotDePasse: 'court' }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('met à jour le mot de passe puis révoque toutes les sessions du compte', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValueOnce({ id: 'cible', roleDistrict: null })
      const resultat = await ctx.service.reinitialiserMotDePasse(CHEF, 'cible', {
        nouveauMotDePasse: MOT_DE_PASSE_VALIDE,
      })
      expect(resultat).toEqual({ message: 'Mot de passe mis à jour' })
      expect(ctx.prisma.utilisateur.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cible' } }),
      )
      expect(ctx.auth.revoquerToutes).toHaveBeenCalledWith('cible')
    })
  })

  describe('desactiver', () => {
    it('refuse la désactivation de soi-même', async () => {
      await expect(ctx.service.desactiver(CHEF, CHEF.id)).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('désactive et révoque les sessions', async () => {
      ctx.prisma.utilisateur.findFirst.mockResolvedValueOnce({ id: 'cible', roleDistrict: null })
      await ctx.service.desactiver(CHEF, 'cible')
      expect(ctx.prisma.utilisateur.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cible' }, data: { actif: false } }),
      )
      expect(ctx.auth.revoquerToutes).toHaveBeenCalledWith('cible')
    })
  })
})
