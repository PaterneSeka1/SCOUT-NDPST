import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { BrancheTypeSchema, ROLES_BRANCHE, ROLES_GROUPE } from '@scout/shared'
import type { BrancheType } from '../../generated/prisma/client'
import { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'
import type {
  CorpsCreationLigne,
  CorpsCreationProgramme,
  CorpsModificationLigne,
  CorpsModificationProgramme,
} from './programmes.schemas'

const SELECTION_ACTIVITE = {
  select: { id: true, titre: true, dateDebut: true },
} as const

@Injectable()
export class ProgrammesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
  ) {}

  async lister(utilisateur: UtilisateurSession, branche: string | undefined) {
    // Les responsables de branche ne voient QUE leur branche (+ les programmes
    // du groupe, brancheType null, qu'ils doivent aussi pouvoir consulter) —
    // toute valeur "branche" fournie par le client est ignorée pour ce rôle.
    let filtreBranche = branche
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que tout le groupe par défaut.
      if (!bt) return []
      filtreBranche = bt
    }
    if (filtreBranche && !BrancheTypeSchema.safeParse(filtreBranche).success) {
      throw new BadRequestException('Branche invalide')
    }

    return this.prisma.programme.findMany({
      where: {
        ...(filtreBranche
          ? {
              OR: [{ brancheType: filtreBranche as BrancheType }, { brancheType: null }],
            }
          : {}),
      },
      include: {
        _count: { select: { lignes: true } },
        creeParUtilisateur: { select: { prenom: true, nom: true } },
      },
      orderBy: { periodeDebut: 'desc' },
    })
  }

  async creer(utilisateur: UtilisateurSession, corps: CorpsCreationProgramme) {
    const estGroupe = ROLES_GROUPE.includes(utilisateur.role)
    const estBranche = ROLES_BRANCHE.includes(utilisateur.role)
    if (!estGroupe && !estBranche) throw new ForbiddenException('Accès refusé')

    // Forme, dates et ordre des dates déjà validés par SchemaCreationProgramme.
    const { titre, description, periodeDebut: debut, periodeFin: fin, brancheType } = corps

    let brancheEffective: BrancheType | null = brancheType ?? null
    // Un responsable de branche ne peut créer que le programme de sa propre branche
    if (estBranche) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      if (!bt) throw new ForbiddenException('Aucune branche assignée')
      brancheEffective = bt as BrancheType
    }

    return this.prisma.programme.create({
      data: {
        titre,
        description: description ?? null,
        periodeDebut: debut,
        periodeFin: fin,
        brancheType: brancheEffective,
        creePar: utilisateur.id,
      },
      include: {
        _count: { select: { lignes: true } },
      },
    })
  }

  async detail(utilisateur: UtilisateurSession, id: string) {
    const programme = await this.prisma.programme.findFirst({
      where: { id },
      include: {
        creeParUtilisateur: { select: { prenom: true, nom: true } },
        lignes: {
          orderBy: { ordre: 'asc' },
          include: { activite: SELECTION_ACTIVITE },
        },
      },
    })
    if (!programme) throw new NotFoundException('Programme introuvable')
    return programme
  }

  async modifier(utilisateur: UtilisateurSession, id: string, corps: CorpsModificationProgramme) {
    const { titre, description, periodeDebut, periodeFin } = corps

    const existant = await this.programmeAutorise(utilisateur, id)

    const debut = periodeDebut ?? existant.periodeDebut
    const fin = periodeFin ?? existant.periodeFin
    if (fin <= debut) {
      throw new BadRequestException('La date de fin doit être après la date de début')
    }

    return this.prisma.programme.update({
      where: { id },
      data: {
        ...(titre !== undefined ? { titre } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(periodeDebut !== undefined ? { periodeDebut: debut } : {}),
        ...(periodeFin !== undefined ? { periodeFin: fin } : {}),
      },
    })
  }

  async supprimer(utilisateur: UtilisateurSession, id: string) {
    await this.programmeAutorise(utilisateur, id)
    await this.prisma.programme.delete({ where: { id } })
    return { ok: true }
  }

  async ajouterLigne(utilisateur: UtilisateurSession, programmeId: string, corps: CorpsCreationLigne) {
    await this.programmeAutorise(utilisateur, programmeId)

    const { theme, objectif, datePrevue } = corps

    const dernier = await this.prisma.ligneProgramme.findFirst({
      where: { programmeId },
      orderBy: { ordre: 'desc' },
      select: { ordre: true },
    })

    return this.prisma.ligneProgramme.create({
      data: {
        programmeId,
        theme,
        objectif: objectif ?? null,
        datePrevue: datePrevue ?? null,
        ordre: (dernier?.ordre ?? -1) + 1,
      },
    })
  }

  async modifierLigne(
    utilisateur: UtilisateurSession,
    programmeId: string,
    ligneId: string,
    corps: CorpsModificationLigne,
  ) {
    await this.ligneAutorisee(utilisateur, programmeId, ligneId)

    const { theme, objectif, datePrevue, ordre, activiteId } = corps

    if (activiteId) {
      const activite = await this.prisma.activite.findFirst({
        where: { id: activiteId },
      })
      if (!activite) throw new BadRequestException('Activité introuvable')
    }

    return this.prisma.ligneProgramme.update({
      where: { id: ligneId },
      data: {
        ...(theme !== undefined ? { theme } : {}),
        ...(objectif !== undefined ? { objectif } : {}),
        ...(datePrevue !== undefined ? { datePrevue } : {}),
        ...(ordre !== undefined ? { ordre } : {}),
        ...(activiteId !== undefined ? { activiteId } : {}),
      },
      include: { activite: SELECTION_ACTIVITE },
    })
  }

  async supprimerLigne(utilisateur: UtilisateurSession, programmeId: string, ligneId: string) {
    await this.ligneAutorisee(utilisateur, programmeId, ligneId)
    await this.prisma.ligneProgramme.delete({ where: { id: ligneId } })
    return { ok: true }
  }

  // Programme existant ; un responsable de branche ne peut agir que sur
  // le programme de sa propre branche (ni ceux du groupe, ni ceux d'une autre branche).
  private async programmeAutorise(utilisateur: UtilisateurSession, id: string) {
    const programme = await this.prisma.programme.findFirst({
      where: { id },
    })
    if (!programme) throw new NotFoundException('Programme introuvable')
    await this.verifierBranche(utilisateur, programme.brancheType)
    return programme
  }

  private async ligneAutorisee(utilisateur: UtilisateurSession, programmeId: string, ligneId: string) {
    const ligne = await this.prisma.ligneProgramme.findFirst({
      where: { id: ligneId, programmeId },
      include: { programme: true },
    })
    if (!ligne) throw new NotFoundException('Ligne introuvable')
    await this.verifierBranche(utilisateur, ligne.programme.brancheType)
    return ligne
  }

  private async verifierBranche(utilisateur: UtilisateurSession, brancheProgramme: string | null) {
    if (!ROLES_BRANCHE.includes(utilisateur.role)) return
    const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
    if (!bt || brancheProgramme !== bt) throw new ForbiddenException('Accès refusé à ce programme')
  }
}
