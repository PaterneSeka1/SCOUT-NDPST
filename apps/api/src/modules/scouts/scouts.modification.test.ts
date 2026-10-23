import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { UtilisateurSession } from '../../common/types'
import { SchemaModificationScout } from './scouts.schemas'
import { ScoutsService } from './scouts.service'

const utilisateur: UtilisateurSession = {
  id: 'u1',
  matricule: null,
  email: '',
  nom: 'N',
  prenom: 'P',
  role: 'CHEF_GROUPE',
  roleDistrict: null,
  paroisseId: 'p1',
}

function construire(actif = true) {
  const prisma = {
    scout: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 's1', brancheType: 'LOUVETEAUX', photo: '/api/fichiers/p1/ancienne.png', actif }),
      update: vi.fn().mockResolvedValue({ id: 's1', photo: null }),
    },
  }
  const audit = { enregistrer: vi.fn() }
  const acces = { brancheImposee: vi.fn().mockResolvedValue(undefined) }
  const fichiers = { verifierRattachable: vi.fn(), supprimerSiOrphelin: vi.fn() }
  return {
    prisma,
    audit,
    acces,
    fichiers,
    service: new ScoutsService(prisma as never, audit as never, acces as never, fichiers as never),
  }
}

describe('ScoutsService — mises à jour validées et données sensibles', () => {
  it('ne modifie pas les champs absents et ne journalise pas leur modification', async () => {
    const ctx = construire()
    await ctx.service.modifier(utilisateur, 's1', SchemaModificationScout.parse({ prenom: ' Awa ' }))
    expect(ctx.prisma.scout.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { prenom: 'Awa' },
      include: { contactsUrgence: true },
    })
    expect(ctx.audit.enregistrer).not.toHaveBeenCalled()
    expect(ctx.fichiers.supprimerSiOrphelin).not.toHaveBeenCalled()
  })

  it('retire le consentement, efface les données médicales et trace uniquement les champs', async () => {
    const ctx = construire()
    await ctx.service.modifier(
      utilisateur,
      's1',
      SchemaModificationScout.parse({
        consentementSante: false,
        allergies: null,
        traitementsMedicaux: ' Traitement confidentiel ',
      }),
    )
    expect(ctx.prisma.scout.update.mock.calls[0][0].data).toEqual({
      consentementSante: false,
      consentementSanteDate: null,
      consentementSanteParId: null,
      consentementSanteOrigine: 'RETIRE',
      allergies: null,
      traitementsMedicaux: 'Traitement confidentiel',
    })
    expect(ctx.audit.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SCOUT_DONNEES_MEDICALES_MODIFIEES',
        details: { champs: ['allergies', 'traitementsMedicaux'] },
      }),
    )
    expect(JSON.stringify(ctx.audit.enregistrer.mock.calls)).not.toContain('Traitement confidentiel')
    expect(ctx.audit.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SCOUT_CONSENTEMENT_SANTE_MODIFIE', details: { consentementSante: false, source: 'RETIRE', methode: 'INTERFACE_ADMINISTRATIVE' } }),
    )
  })

  it('enregistre la date et l’auteur du consentement accordé', async () => {
    const ctx = construire()
    await ctx.service.modifier(utilisateur, 's1', SchemaModificationScout.parse({ consentementSante: true }))
    expect(ctx.prisma.scout.update.mock.calls[0][0].data).toEqual({
      consentementSante: true,
      consentementSanteDate: expect.any(Date),
      consentementSanteParId: 'u1',
      consentementSanteOrigine: 'SAISIE_ADMINISTRATIVE',
    })
  })


  it.each([true, false])('distingue aussi la saisie administrative image (%s)', async (accord) => {
    const ctx = construire()
    await ctx.service.modifier(utilisateur, 's1', SchemaModificationScout.parse({
      consentementImage: accord,
      consentementImageOrigine: 'COMPTE_PARENT_LIE', // une saisie admin ne peut usurper cette provenance
    }))
    expect(ctx.prisma.scout.update.mock.calls[0][0].data).toMatchObject({
      consentementImage: accord,
      consentementImageOrigine: accord ? 'SAISIE_ADMINISTRATIVE' : 'RETIRE',
      consentementImageDate: accord ? expect.any(Date) : null,
      consentementImageParId: accord ? 'u1' : null,
    })
    expect(ctx.audit.enregistrer).toHaveBeenCalledWith(expect.objectContaining({
      acteurId: 'u1',
      action: 'SCOUT_CONSENTEMENT_IMAGE_MODIFIE',
      details: {
        consentementImage: accord,
        source: accord ? 'SAISIE_ADMINISTRATIVE' : 'RETIRE',
        methode: 'INTERFACE_ADMINISTRATIVE',
      },
    }))
  })

  it('date la désactivation et retire la date lors de la réactivation', async () => {
    const ctx = construire()
    await ctx.service.modifier(utilisateur, 's1', SchemaModificationScout.parse({ actif: false }))
    expect(ctx.prisma.scout.update.mock.calls[0][0].data).toEqual({ actif: false, desactiveLe: expect.any(Date) })
    const inactif = construire(false)
    await inactif.service.modifier(utilisateur, 's1', SchemaModificationScout.parse({ actif: true }))
    expect(inactif.prisma.scout.update.mock.calls[0][0].data).toEqual({ actif: true, desactiveLe: null })
  })

  it('ne repousse pas la date de conservation si le scout est déjà inactif', async () => {
    const ctx = construire(false)
    await ctx.service.modifier(utilisateur, 's1', SchemaModificationScout.parse({ actif: false }))
    expect(ctx.prisma.scout.update.mock.calls[0][0].data).toEqual({ actif: false })
  })

  it('refuse un scout hors branche et un changement de branche interdit', async () => {
    const ctx = construire()
    ctx.acces.brancheImposee.mockResolvedValue('LOUVETEAUX')
    await expect(
      ctx.service.modifier(utilisateur, 's1', SchemaModificationScout.parse({ brancheType: 'ECLAIREURS' })),
    ).rejects.toBeInstanceOf(ForbiddenException)
    ctx.prisma.scout.findFirst.mockResolvedValue(null)
    await expect(
      ctx.service.modifier(utilisateur, 's1', SchemaModificationScout.parse({ consentementSante: true })),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(ctx.prisma.scout.update).not.toHaveBeenCalled()
    expect(ctx.audit.enregistrer).not.toHaveBeenCalled()
  })

  it('vérifie le rattachement avant modification et supprime l’ancienne photo orpheline', async () => {
    const ctx = construire()
    await ctx.service.modifier(
      utilisateur,
      's1',
      SchemaModificationScout.parse({ photo: '/api/fichiers/p1/nouvelle.png' }),
    )
    expect(ctx.fichiers.verifierRattachable).toHaveBeenCalledWith(utilisateur, '/api/fichiers/p1/nouvelle.png', 's1')
    expect(ctx.fichiers.verifierRattachable.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.prisma.scout.update.mock.invocationCallOrder[0],
    )
    expect(ctx.fichiers.supprimerSiOrphelin).toHaveBeenCalledWith('/api/fichiers/p1/ancienne.png')
  })
})
