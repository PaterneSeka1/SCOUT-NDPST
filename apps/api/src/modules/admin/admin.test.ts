import { BadRequestException, ConflictException, ForbiddenException, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RolesGuard } from '../../common/guards/roles.guard'
import type { AuditService } from '../../common/audit.service'
import type { AuthService } from '../../auth/auth.service'
import type { PrismaService } from '../../prisma/prisma.service'
import { AdminUtilisateursController } from './utilisateurs.controller'
import { SchemaCreationUtilisateur, SchemaModificationUtilisateur, SchemaMotDePasseAdmin } from './utilisateurs.schemas'
import { MESSAGE_DERNIER_ADMINISTRATEUR, UtilisateursService } from './utilisateurs.service'

// Les contrôleurs plateforme.* et rapports.* sont refondus séparément : leur
// contrôle de rôle est à couvrir avec eux.
const CONTROLEURS = [AdminUtilisateursController]

function contexte(classe: object, handler: () => unknown, role: string, editeurContenu = false): ExecutionContext {
  return {
    getClass: () => classe,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ utilisateur: { id: 'u1', role, editeurContenu } }) }),
  } as unknown as ExecutionContext
}

describe('AdminUtilisateursController — contrôle de rôle', () => {
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

  it('couvre bien toutes les routes du contrôleur, sans route de nomination district', () => {
    expect(routes.map((r) => r.nom).sort()).toEqual(
      ['changerMotDePasse', 'creer', 'desactiver', 'detail', 'lister', 'mandats', 'modifier'].sort(),
    )
  })

  it.each(['CHEF_GROUPE', 'ADJOINT_GROUPE', 'RESPONSABLE_BRANCHE', 'PARENT', 'SCOUT'])(
    'refuse le rôle %s sur chaque route (même éditeur de contenus)',
    (role) => {
      for (const { classe, nom, handler } of routes) {
        expect(() => garde.canActivate(contexte(classe, handler, role, true)), `${classe.name}.${nom}`).toThrow(
          ForbiddenException,
        )
      }
    },
  )

  it('autorise ADMINISTRATEUR sur chaque route', () => {
    for (const { classe, handler } of routes) {
      expect(garde.canActivate(contexte(classe, handler, 'ADMINISTRATEUR'))).toBe(true)
    }
  })
})

// Compte existant renvoyé par trouverCible / verrouillerPoste.
function compte(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'u2',
    role: 'ADJOINT_GROUPE',
    actif: true,
    fonction: null,
    brancheType: null,
    editeurContenu: false,
    profilPublic: false,
    fonctionPublique: null,
    photoPublique: null,
    biographie: null,
    ordrePublic: 0,
    ...surcharge,
  }
}

function simulations() {
  const prisma = {
    utilisateur: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'u2' }),
    },
    mandat: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    // Verrou des administrateurs actifs : liste configurable par test.
    administrateursActifs: [] as { id: string }[],
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  }
  prisma.$queryRaw.mockImplementation((morceaux: TemplateStringsArray) =>
    Promise.resolve(morceaux.join('').includes("'ADMINISTRATEUR'") ? prisma.administrateursActifs : []),
  )
  prisma.$transaction.mockImplementation((action: (tx: unknown) => unknown) => action(prisma))
  const audit = { enregistrer: vi.fn().mockResolvedValue(undefined) }
  const auth = { revoquerToutes: vi.fn().mockResolvedValue(undefined) }
  return {
    prisma,
    audit,
    auth,
    utilisateurs: new UtilisateursService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      auth as unknown as AuthService,
    ),
  }
}

// Le compte existant est lu hors transaction (findUnique) puis relu sous
// verrou (findUniqueOrThrow) : les deux renvoient le même état.
function avecCompte(s: ReturnType<typeof simulations>, existant: Record<string, unknown>) {
  s.prisma.utilisateur.findUnique.mockResolvedValue(existant)
  s.prisma.utilisateur.findUniqueOrThrow.mockResolvedValue(existant)
}

describe('AdminUtilisateursService — création', () => {
  it('crée un compte avec secret temporaire, ouvre un mandat et journalise', async () => {
    const s = simulations()
    s.prisma.utilisateur.findUnique.mockResolvedValue(null)
    s.prisma.utilisateur.create.mockResolvedValue({
      id: 'n1',
      role: 'ADJOINT_BRANCHE',
      brancheType: 'LOUVETEAUX',
      email: null,
    })
    const resultat = await s.utilisateurs.creer(
      SchemaCreationUtilisateur.parse({
        nom: 'N',
        prenom: 'P',
        matricule: 'M1',
        role: 'ADJOINT_BRANCHE',
        brancheType: 'LOUVETEAUX',
        editeurContenu: true,
      }),
      'admin',
    )
    expect(resultat.motDePasseTemporaire).toEqual(expect.any(String))
    const data = s.prisma.utilisateur.create.mock.calls[0]![0].data
    expect(data).toMatchObject({ doitChangerMotDePasse: true, editeurContenu: true, brancheType: 'LOUVETEAUX' })
    expect(data).not.toHaveProperty('paroisseId')
    expect(s.prisma.mandat.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        utilisateurId: 'n1',
        role: 'ADJOINT_BRANCHE',
        brancheType: 'LOUVETEAUX',
        auteurId: 'admin',
      }),
    })
    expect(JSON.stringify(s.audit.enregistrer.mock.calls)).not.toContain(resultat.motDePasseTemporaire)
  })

  it("n'ouvre pas de mandat pour un compte administrateur", async () => {
    const s = simulations()
    s.prisma.utilisateur.findUnique.mockResolvedValue(null)
    s.prisma.utilisateur.create.mockResolvedValue({ id: 'n2', role: 'ADMINISTRATEUR', email: null })
    await s.utilisateurs.creer(
      SchemaCreationUtilisateur.parse({ nom: 'N', prenom: 'P', matricule: 'M2', role: 'ADMINISTRATEUR' }),
      'admin',
    )
    expect(s.prisma.mandat.create).not.toHaveBeenCalled()
  })

  it('refuse un second Chef de Groupe actif (409)', async () => {
    const s = simulations()
    s.prisma.utilisateur.findFirst.mockResolvedValue({ id: 'chef-actuel' })
    await expect(
      s.utilisateurs.creer(
        SchemaCreationUtilisateur.parse({ nom: 'K', prenom: 'J', matricule: 'M1', role: 'CHEF_GROUPE' }),
        'admin',
      ),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(s.prisma.utilisateur.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'CHEF_GROUPE', actif: true } }),
    )
    expect(s.prisma.utilisateur.create).not.toHaveBeenCalled()
  })
})

describe('AdminUtilisateursService — protection du dernier administrateur', () => {
  let s: ReturnType<typeof simulations>

  beforeEach(() => {
    s = simulations()
    avecCompte(s, compte({ id: 'adm2', role: 'ADMINISTRATEUR' }))
  })

  it('refuse de rétrograder le dernier administrateur actif (409)', async () => {
    s.prisma.administrateursActifs = [{ id: 'adm2' }]
    await expect(
      s.utilisateurs.modifier('adm2', SchemaModificationUtilisateur.parse({ role: 'ADJOINT_GROUPE' }), 'autre'),
    ).rejects.toThrow(MESSAGE_DERNIER_ADMINISTRATEUR)
    expect(s.prisma.utilisateur.update).not.toHaveBeenCalled()
  })

  it('refuse de désactiver le dernier administrateur actif (409), par PUT comme par DELETE', async () => {
    s.prisma.administrateursActifs = [{ id: 'adm2' }]
    await expect(
      s.utilisateurs.modifier('adm2', SchemaModificationUtilisateur.parse({ actif: false }), 'autre'),
    ).rejects.toBeInstanceOf(ConflictException)
    await expect(s.utilisateurs.desactiver('adm2', 'autre')).rejects.toBeInstanceOf(ConflictException)
    expect(s.prisma.utilisateur.update).not.toHaveBeenCalled()
    expect(s.auth.revoquerToutes).not.toHaveBeenCalled()
  })

  it('verrouille les administrateurs avant la ligne du compte', async () => {
    s.prisma.administrateursActifs = [{ id: 'adm1' }, { id: 'adm2' }]
    await s.utilisateurs.desactiver('adm2', 'adm1')
    const requetes = s.prisma.$queryRaw.mock.calls.map((appel) => (appel[0] as TemplateStringsArray).join(''))
    expect(requetes[0]).toContain("'ADMINISTRATEUR'")
    expect(requetes[0]).toContain('FOR UPDATE')
    expect(requetes[1]).toContain('FOR UPDATE')
    expect(s.prisma.utilisateur.update).toHaveBeenCalledWith(expect.objectContaining({ data: { actif: false } }))
    expect(s.auth.revoquerToutes).toHaveBeenCalledWith('adm2', s.prisma)
  })

  it('autorise la rétrogradation quand un autre administrateur reste actif', async () => {
    s.prisma.administrateursActifs = [{ id: 'adm1' }, { id: 'adm2' }]
    await s.utilisateurs.modifier('adm2', SchemaModificationUtilisateur.parse({ role: 'ADJOINT_GROUPE' }), 'adm1')
    expect(s.prisma.utilisateur.update).toHaveBeenCalled()
    // Devient membre de la maîtrise : un mandat est ouvert.
    expect(s.prisma.mandat.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ utilisateurId: 'adm2', role: 'ADJOINT_GROUPE' }),
    })
  })

  it('un administrateur ne peut ni se retirer le rôle ni se désactiver (403)', async () => {
    s.prisma.administrateursActifs = [{ id: 'adm1' }, { id: 'adm2' }]
    await expect(
      s.utilisateurs.modifier('adm2', SchemaModificationUtilisateur.parse({ role: 'CHEF_GROUPE' }), 'adm2'),
    ).rejects.toBeInstanceOf(ForbiddenException)
    await expect(
      s.utilisateurs.modifier('adm2', SchemaModificationUtilisateur.parse({ actif: false }), 'adm2'),
    ).rejects.toBeInstanceOf(ForbiddenException)
    await expect(s.utilisateurs.desactiver('adm2', 'adm2')).rejects.toBeInstanceOf(ForbiddenException)
    expect(s.prisma.utilisateur.update).not.toHaveBeenCalled()
  })

  it("ne vérifie pas le dernier administrateur pour un compte qui n'en est pas un", async () => {
    avecCompte(s, compte())
    await s.utilisateurs.desactiver('u2', 'adm1')
    const requetes = s.prisma.$queryRaw.mock.calls.map((appel) => (appel[0] as TemplateStringsArray).join(''))
    expect(requetes.some((r) => r.includes("'ADMINISTRATEUR'"))).toBe(false)
  })
})

describe('AdminUtilisateursService — mandats, éditeur de contenus et profil public', () => {
  let s: ReturnType<typeof simulations>

  beforeEach(() => {
    s = simulations()
  })

  it('changement de branche : clôt le mandat ouvert, en ouvre un nouveau et révoque les sessions', async () => {
    avecCompte(s, compte({ role: 'RESPONSABLE_BRANCHE', brancheType: 'LOUVETEAUX' }))
    await s.utilisateurs.modifier('u2', SchemaModificationUtilisateur.parse({ brancheType: 'ECLAIREURS' }), 'admin')
    expect(s.prisma.mandat.updateMany).toHaveBeenCalledWith({
      where: { utilisateurId: 'u2', finLe: null, role: 'RESPONSABLE_BRANCHE', brancheType: 'LOUVETEAUX' },
      data: { finLe: expect.any(Date) },
    })
    expect(s.prisma.mandat.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: 'RESPONSABLE_BRANCHE',
        brancheType: 'ECLAIREURS',
        motif: 'Changement de branche',
      }),
    })
    expect(s.prisma.mandat.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      s.prisma.mandat.create.mock.invocationCallOrder[0]!,
    )
    expect(s.auth.revoquerToutes).toHaveBeenCalledWith('u2', s.prisma)
  })

  it('réactivation : rouvre un mandat sans en clore', async () => {
    avecCompte(s, compte({ actif: false }))
    await s.utilisateurs.modifier('u2', SchemaModificationUtilisateur.parse({ actif: true }), 'admin')
    expect(s.prisma.mandat.updateMany).not.toHaveBeenCalled()
    expect(s.prisma.mandat.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: 'ADJOINT_GROUPE', motif: 'Réactivation du compte' }),
    })
    expect(s.audit.enregistrer).toHaveBeenCalledWith(expect.objectContaining({ action: 'UTILISATEUR_REACTIVE' }))
  })

  it('modification du nom seul : ni mandat ni révocation', async () => {
    avecCompte(s, compte())
    await s.utilisateurs.modifier('u2', SchemaModificationUtilisateur.parse({ nom: 'Nouveau' }), 'admin')
    expect(s.prisma.mandat.updateMany).not.toHaveBeenCalled()
    expect(s.prisma.mandat.create).not.toHaveBeenCalled()
    expect(s.auth.revoquerToutes).not.toHaveBeenCalled()
  })

  it('accorde editeurContenu, sans révoquer les sessions, et le journalise', async () => {
    avecCompte(s, compte())
    await s.utilisateurs.modifier('u2', SchemaModificationUtilisateur.parse({ editeurContenu: true }), 'admin')
    expect(s.prisma.utilisateur.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ editeurContenu: true }) }),
    )
    expect(s.auth.revoquerToutes).not.toHaveBeenCalled()
    expect(s.audit.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UTILISATEUR_EDITEUR_CONTENU_MODIFIE', details: { editeurContenu: true } }),
    )
  })

  it('publie un profil public et journalise PROFIL_PUBLIC_MODIFIE', async () => {
    avecCompte(s, compte())
    await s.utilisateurs.modifier(
      'u2',
      SchemaModificationUtilisateur.parse({ profilPublic: true, fonctionPublique: 'Adjoint' }),
      'admin',
    )
    expect(s.prisma.utilisateur.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ profilPublic: true, fonctionPublique: 'Adjoint' }) }),
    )
    expect(s.audit.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROFIL_PUBLIC_MODIFIE',
        details: { champs: ['profilPublic', 'fonctionPublique'], profilPublic: true },
      }),
    )
  })

  it('refuse de rendre public un compte PARENT ou SCOUT', async () => {
    avecCompte(s, compte({ role: 'SCOUT' }))
    await expect(
      s.utilisateurs.modifier('u2', SchemaModificationUtilisateur.parse({ profilPublic: true }), 'admin'),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('refuse un rôle de district ou inconnu', async () => {
    avecCompte(s, compte())
    expect(SchemaModificationUtilisateur.safeParse({ role: 'COMMISSAIRE_DISTRICT' }).success).toBe(false)
    await expect(
      s.utilisateurs.modifier('u2', SchemaModificationUtilisateur.parse({ role: 'SCOUT' }), 'admin'),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('désactivation : clôt le mandat ouvert sans en ouvrir', async () => {
    avecCompte(s, compte())
    await s.utilisateurs.desactiver('u2', 'admin')
    expect(s.prisma.mandat.updateMany).toHaveBeenCalled()
    expect(s.prisma.mandat.create).not.toHaveBeenCalled()
    expect(s.audit.enregistrer).toHaveBeenCalledWith(expect.objectContaining({ action: 'UTILISATEUR_DESACTIVE' }))
  })

  it('liste les mandats du compte, du plus récent au plus ancien', async () => {
    s.prisma.utilisateur.findUnique.mockResolvedValue({ id: 'u2' })
    await s.utilisateurs.mandats('u2')
    expect(s.prisma.mandat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { utilisateurId: 'u2' }, orderBy: { debutLe: 'desc' } }),
    )
  })
})

describe('AdminUtilisateursService — mot de passe', () => {
  it('impose le changement et révoque les sessions', async () => {
    const s = simulations()
    s.prisma.utilisateur.findUnique.mockResolvedValue({ id: 'u1' })
    await s.utilisateurs.changerMotDePasse(
      'u1',
      SchemaMotDePasseAdmin.parse({ nouveauMotDePasse: 'nouveau123' }),
      'admin',
    )
    expect(s.prisma.utilisateur.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: expect.objectContaining({ doitChangerMotDePasse: true }) }),
    )
    expect(s.auth.revoquerToutes).toHaveBeenCalledWith('u1')
    expect(s.audit.enregistrer).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UTILISATEUR_MOT_DE_PASSE_REINITIALISE' }),
    )
  })
})
