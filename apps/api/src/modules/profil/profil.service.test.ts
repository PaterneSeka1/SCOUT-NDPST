import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { hash } from 'bcryptjs'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../../prisma/prisma.service'
import type { AuditService } from '../../common/audit.service'
import type { AuthService } from '../../auth/auth.service'
import type { UtilisateurSession } from '../../common/types'
import { ProfilService } from './profil.service'

const MOI: UtilisateurSession = {
  id: 'moi',
  matricule: 'M002',
  email: 'moi@exemple.ci',
  nom: 'Yao',
  prenom: 'Awa',
  role: 'ADJOINT_GROUPE',
  roleDistrict: null,
  paroisseId: 'paroisse-1',
}

function creerContexte() {
  const prisma = {
    utilisateur: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    lienParentScout: { findFirst: vi.fn() },
    scout: { update: vi.fn() },
  }
  const audit = { enregistrer: vi.fn().mockResolvedValue(undefined) }
  const auth = { revoquerToutes: vi.fn().mockResolvedValue(undefined) }
  const service = new ProfilService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    auth as unknown as AuthService,
  )
  return { prisma, audit, auth, service }
}

describe('ProfilService', () => {
  it('changerMotDePasse : refuse un mot de passe actuel incorrect sans rien révoquer', async () => {
    const ctx = creerContexte()
    ctx.prisma.utilisateur.findUnique.mockResolvedValueOnce({ id: 'moi', password: await hash('Ancien123', 4) })
    await expect(
      ctx.service.changerMotDePasse(MOI, { motDePasseActuel: 'Mauvais123', nouveauMotDePasse: 'Nouveau123' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(ctx.prisma.utilisateur.update).not.toHaveBeenCalled()
    expect(ctx.auth.revoquerToutes).not.toHaveBeenCalled()
  })

  it('changerMotDePasse : agit sur le compte de la session et révoque toutes ses sessions', async () => {
    const ctx = creerContexte()
    ctx.prisma.utilisateur.findUnique.mockResolvedValueOnce({ id: 'moi', password: await hash('Ancien123', 4) })
    await ctx.service.changerMotDePasse(MOI, {
      id: 'autre-compte',
      motDePasseActuel: 'Ancien123',
      nouveauMotDePasse: 'Nouveau123',
    })
    expect(ctx.prisma.utilisateur.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'moi' } }))
    expect(ctx.auth.revoquerToutes).toHaveBeenCalledWith('moi')
  })

  it("consentementImage : refuse un scout non rattaché au compte", async () => {
    const ctx = creerContexte()
    ctx.prisma.lienParentScout.findFirst.mockResolvedValueOnce(null)
    await expect(ctx.service.consentementImage(MOI, 'scout-x', { consentement: true })).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(ctx.prisma.scout.update).not.toHaveBeenCalled()
  })
})
