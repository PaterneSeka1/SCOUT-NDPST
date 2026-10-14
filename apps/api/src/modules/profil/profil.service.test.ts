import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { hash } from 'bcryptjs'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../../prisma/prisma.service'
import type { AuditService } from '../../common/audit.service'
import type { AuthService } from '../../auth/auth.service'
import type { UtilisateurSession } from '../../common/types'
import { SchemaChangementMotDePasse, SchemaConsentement, SchemaModificationProfil } from './profil.schemas'
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
    // Un id transmis dans le corps est retiré par le schéma : seul session.id compte.
    await ctx.service.changerMotDePasse(
      MOI,
      SchemaChangementMotDePasse.parse({
        id: 'autre-compte',
        motDePasseActuel: 'Ancien123',
        nouveauMotDePasse: 'Nouveau123',
      }),
    )
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

  it('consentementSante : refuse un scout non rattaché au compte', async () => {
    const ctx = creerContexte()
    ctx.prisma.lienParentScout.findFirst.mockResolvedValueOnce(null)
    await expect(ctx.service.consentementSante(MOI, 'scout-x', { consentement: true })).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(ctx.prisma.lienParentScout.findFirst).toHaveBeenCalledWith({
      where: { parentId: 'moi', scoutId: 'scout-x', scout: { paroisseId: 'paroisse-1' } },
    })
    expect(ctx.prisma.scout.update).not.toHaveBeenCalled()
    expect(ctx.audit.enregistrer).not.toHaveBeenCalled()
  })

  it('consentementSante : enregistre l’accord du parent et le journalise', async () => {
    const ctx = creerContexte()
    ctx.prisma.lienParentScout.findFirst.mockResolvedValueOnce({ id: 'lien' })
    ctx.prisma.scout.update.mockResolvedValueOnce({ id: 'scout-1', consentementSante: true })
    await ctx.service.consentementSante(MOI, 'scout-1', { consentement: true })
    const appel = ctx.prisma.scout.update.mock.calls[0][0]
    expect(appel.where).toEqual({ id: 'scout-1' })
    expect(appel.data).toMatchObject({ consentementSante: true, consentementSanteParId: 'moi' })
    expect(appel.data.consentementSanteDate).toBeInstanceOf(Date)
    expect(ctx.audit.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SCOUT_CONSENTEMENT_SANTE_MODIFIE',
        entiteId: 'scout-1',
        details: { consentementSante: true },
      }),
    )
  })

  it('consentementSante : un retrait efface la date et l’auteur', async () => {
    const ctx = creerContexte()
    ctx.prisma.lienParentScout.findFirst.mockResolvedValueOnce({ id: 'lien' })
    ctx.prisma.scout.update.mockResolvedValueOnce({ id: 'scout-1', consentementSante: false })
    await ctx.service.consentementSante(MOI, 'scout-1', { consentement: false })
    expect(ctx.prisma.scout.update.mock.calls[0][0].data).toEqual({
      consentementSante: false,
      consentementSanteDate: null,
      consentementSanteParId: null,
    })
  })
})

describe('Schémas du profil', () => {
  function premierMessage(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, valeur: unknown) {
    const resultat = schema.safeParse(valeur)
    return resultat.success ? undefined : resultat.error?.issues[0]?.message
  }

  it('modification : ne conserve que les champs auto-modifiables', () => {
    expect(
      SchemaModificationProfil.parse({ nom: 'Yao', email: null, role: 'CHEF_GROUPE', paroisseId: 'p2', actif: false }),
    ).toEqual({ nom: 'Yao', email: null })
  })

  it.each([
    [{ nom: null }, 'Le nom est invalide'],
    [{ prenom: 3 }, 'Le prénom est invalide'],
    [{ email: 3 }, 'L’adresse e-mail est invalide'],
    [{ telephone: {} }, 'Le numéro de téléphone est invalide'],
    ['texte', 'Données invalides'],
  ])('modification : rejette %j avec « %s »', (corps, message) => {
    expect(premierMessage(SchemaModificationProfil, corps)).toBe(message)
  })

  it.each([{}, { motDePasseActuel: 'Ancien123' }, { motDePasseActuel: '', nouveauMotDePasse: 'Nouveau123' }])(
    'mot de passe : exige les deux valeurs (%j)',
    (corps) => {
      expect(premierMessage(SchemaChangementMotDePasse, corps)).toBe(
        'Le mot de passe actuel et le nouveau mot de passe sont requis',
      )
    },
  )

  it('consentement : exige un booléen', () => {
    expect(SchemaConsentement.parse({ consentement: false })).toEqual({ consentement: false })
    expect(premierMessage(SchemaConsentement, { consentement: 'oui' })).toBe(
      'Le champ consentement (booléen) est requis',
    )
    expect(premierMessage(SchemaConsentement, {})).toBe('Le champ consentement (booléen) est requis')
  })
})
