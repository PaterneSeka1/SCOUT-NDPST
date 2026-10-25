import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { AuditService } from '../../common/audit.service'
import type { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import type { PrismaService } from '../../prisma/prisma.service'
import { CotisationsService } from './cotisations.service'

const responsableBranche: UtilisateurSession = {
  id: 'u-branche',
  matricule: null,
  email: '',
  nom: 'N',
  prenom: 'P',
  role: 'RESPONSABLE_BRANCHE',
  editeurContenu: false,
}

const chefGroupe: UtilisateurSession = { ...responsableBranche, id: 'u-chef', role: 'CHEF_GROUPE' }

function construire(branche: string | null) {
  const prisma = {
    cotisation: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn((args: { data: Record<string, unknown> }) => ({ id: 'c-new', ...args.data })),
      update: vi.fn(),
    },
    scout: { findMany: vi.fn().mockResolvedValue([]) },
    activite: { findUnique: vi.fn().mockResolvedValue(null) },
    baremeCotisation: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn((args: { data: Record<string, unknown> }) => ({ id: 'b-new', ...args.data })),
      update: vi.fn((args: { data: Record<string, unknown> }) => ({ id: 'b1', montant: 10000, ...args.data })),
      delete: vi.fn(),
    },
    $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
  }
  const perimetre = { brancheUtilisateur: vi.fn().mockResolvedValue(branche) }
  const audit = { enregistrer: vi.fn() }
  const service = new CotisationsService(
    prisma as unknown as PrismaService,
    perimetre as unknown as PerimetreService,
    audit as unknown as AuditService,
  )
  return { service, prisma, audit }
}

describe('CotisationsService — périmètre de branche', () => {
  it("un responsable de branche ne peut pas enregistrer le paiement d'un scout d'une autre branche", async () => {
    const { service, prisma } = construire('LOUVETEAUX')

    await expect(service.modifier(responsableBranche, 'c1', { statut: 'PAYEE' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    // La recherche est restreinte à la branche de l'utilisateur.
    expect(prisma.cotisation.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'c1',
        scout: { brancheType: 'LOUVETEAUX' },
      },
    })
    expect(prisma.cotisation.update).not.toHaveBeenCalled()
  })

  it('un responsable de branche sans branche assignée ne voit aucune cotisation', async () => {
    const { service, prisma } = construire(null)
    await expect(service.modifier(responsableBranche, 'c1', { statut: 'PAYEE' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    await expect(service.lister(responsableBranche, { branche: 'ECLAIREURS' })).resolves.toEqual({
      cotisations: [],
      pagination: { page: 1, limite: 50, total: 0, totalPages: 0 },
    })
    expect(prisma.cotisation.findMany).not.toHaveBeenCalled()
  })

  it('la branche demandée par le client est ignorée pour un responsable de branche', async () => {
    const { service, prisma } = construire('LOUVETEAUX')
    await service.lister(responsableBranche, {
      branche: 'ECLAIREURS',
      anneeScolaire: '2025-2026',
    })
    expect(prisma.cotisation.findMany.mock.calls[0][0].where).toEqual({
      anneeScolaire: '2025-2026',
      scout: { brancheType: 'LOUVETEAUX' },
    })
  })

  it('pagine (limite bornée) et recherche sans perdre le cloisonnement de branche', async () => {
    const { service, prisma } = construire('LOUVETEAUX')
    prisma.cotisation.count.mockResolvedValue(250)
    const resultat = await service.lister(responsableBranche, {
      anneeScolaire: '2025-2026',
      recherche: 'kou',
      page: '3',
      limite: '500',
    })
    expect(resultat.pagination).toEqual({ page: 3, limite: 100, total: 250, totalPages: 3 })
    const appel = prisma.cotisation.findMany.mock.calls[0][0]
    expect(appel).toMatchObject({ skip: 200, take: 100 })
    expect(appel.where.scout.brancheType).toBe('LOUVETEAUX')
    expect(appel.where.scout.OR).toHaveLength(3)
  })
})

describe('CotisationsService — création', () => {
  it("rattache une activité existante et n'écrit aucun paroisseId", async () => {
    const { service, prisma, audit } = construire(null)
    prisma.scout.findMany.mockResolvedValue([{ id: 's1' }])
    prisma.activite.findUnique.mockResolvedValue({ id: 'a1' })
    await service.creer(chefGroupe, { cibles: ['s1'], type: 'CAMP', montant: 15000, activiteId: 'a1' })
    const data = prisma.cotisation.create.mock.calls[0][0].data
    expect(data).toMatchObject({ scoutId: 's1', activiteId: 'a1', montant: 15000 })
    expect(data).not.toHaveProperty('paroisseId')
    expect(audit.enregistrer).toHaveBeenCalledWith(expect.objectContaining({ action: 'COTISATION_CREEE' }))
  })

  it('refuse une activité inexistante', async () => {
    const { service, prisma } = construire(null)
    prisma.scout.findMany.mockResolvedValue([{ id: 's1' }])
    await expect(
      service.creer(chefGroupe, { cibles: ['s1'], type: 'CAMP', montant: 1, activiteId: 'a-x' }),
    ).rejects.toThrow('Activité introuvable')
    expect(prisma.cotisation.create).not.toHaveBeenCalled()
  })
})

describe('CotisationsService — barème', () => {
  const corps = {
    anneeScolaire: '2026-2027',
    type: 'ADHESION_ANNUELLE' as const,
    brancheType: null,
    libelle: null,
    montant: 5000,
  }

  it('crée un barème et journalise BAREME_MODIFIE', async () => {
    const { service, prisma, audit } = construire(null)
    await expect(service.creerBareme(chefGroupe, corps)).resolves.toMatchObject({ id: 'b-new', montant: 5000 })
    expect(prisma.baremeCotisation.create).toHaveBeenCalledWith({ data: corps })
    expect(audit.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'BAREME_MODIFIE',
        entite: 'BaremeCotisation',
        details: expect.objectContaining({ operation: 'CREATION' }),
      }),
    )
  })

  it('refuse un doublon (409)', async () => {
    const { service, prisma, audit } = construire(null)
    prisma.baremeCotisation.findFirst.mockResolvedValue({ id: 'b0' })
    await expect(service.creerBareme(chefGroupe, corps)).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.baremeCotisation.create).not.toHaveBeenCalled()
    expect(audit.enregistrer).not.toHaveBeenCalled()
  })

  it('modifie le montant et journalise avant/après', async () => {
    const { service, prisma, audit } = construire(null)
    prisma.baremeCotisation.findUnique.mockResolvedValue({ id: 'b1', ...corps })
    await service.modifierBareme(chefGroupe, 'b1', { montant: 7000 })
    expect(prisma.baremeCotisation.findFirst.mock.calls[0][0].where).toMatchObject({ id: { not: 'b1' } })
    expect(prisma.baremeCotisation.update.mock.calls[0][0].data).toMatchObject({ montant: 7000 })
    expect(audit.enregistrer.mock.calls[0][0].details).toMatchObject({
      operation: 'MODIFICATION',
      avant: { montant: 5000 },
      apres: { montant: 7000 },
    })
  })

  it('404 sur modification ou suppression inconnue', async () => {
    const { service, prisma } = construire(null)
    await expect(service.modifierBareme(chefGroupe, 'x', { montant: 1 })).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.supprimerBareme(chefGroupe, 'x')).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.baremeCotisation.delete).not.toHaveBeenCalled()
  })

  it('supprime et journalise', async () => {
    const { service, prisma, audit } = construire(null)
    prisma.baremeCotisation.findUnique.mockResolvedValue({ id: 'b1', ...corps })
    await expect(service.supprimerBareme(chefGroupe, 'b1')).resolves.toEqual({ ok: true })
    expect(prisma.baremeCotisation.delete).toHaveBeenCalledWith({ where: { id: 'b1' } })
    expect(audit.enregistrer.mock.calls[0][0].details).toMatchObject({ operation: 'SUPPRESSION', montant: 5000 })
  })

  it('liste par année (courante par défaut) et rejette une année invalide', async () => {
    const { service, prisma } = construire(null)
    await service.listerBaremes('2026-2027')
    expect(prisma.baremeCotisation.findMany.mock.calls[0][0].where).toEqual({ anneeScolaire: '2026-2027' })
    await expect(service.listerBaremes('2026')).rejects.toThrow('Année scolaire invalide')
  })
})

describe('Cotisations historiques — frontière avec le nouveau circuit', () => {
  it('refuse une nouvelle adhésion annuelle 2026–2027 dans le module historique', async () => {
    const { service, prisma } = construire(null)
    await expect(
      service.creer(chefGroupe, {
        cibles: ['s1'],
        type: 'ADHESION_ANNUELLE',
        montant: 5000,
        activiteId: undefined,
        anneeScolaire: '2026-2027',
      }),
    ).rejects.toThrow('adhésions nationales')
    expect(prisma.cotisation.create).not.toHaveBeenCalled()
  })
  it('interdit la bascule arbitraire du statut pour les nouvelles années', async () => {
    const { service, prisma } = construire(null)
    await expect(
      service.definirStatut(chefGroupe, { scoutId: 's1', cotisant: true, anneeScolaire: '2026-2027' }),
    ).rejects.toThrow('remplace cette bascule')
    expect(prisma.cotisation.update).not.toHaveBeenCalled()
  })
  it('préserve les annuelles historiques contre la suppression physique', async () => {
    const { service, prisma } = construire(null)
    prisma.cotisation.findFirst.mockResolvedValue({ id: 'c1', type: 'ADHESION_ANNUELLE', montantPaye: 5000 })
    await expect(service.supprimer(chefGroupe, 'c1')).rejects.toThrow('conservée pour audit')
  })
})
