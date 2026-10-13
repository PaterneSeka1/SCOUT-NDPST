import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { BrancheTypeSchema, ROLES_BRANCHE, ROLES_GROUPE } from '@scout/shared'
import type { BrancheType } from '../../generated/prisma/client'
import { paroisseIdRequise } from '../../common/paroisse'
import { PerimetreService } from '../../common/perimetre.service'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'

export interface CorpsCreationProgramme {
  titre?: unknown
  description?: unknown
  periodeDebut?: unknown
  periodeFin?: unknown
  brancheType?: unknown
  paroisseId?: unknown
}

export interface CorpsModificationProgramme {
  titre?: unknown
  description?: unknown
  periodeDebut?: unknown
  periodeFin?: unknown
}

export interface CorpsLigne {
  theme?: unknown
  objectif?: unknown
  datePrevue?: unknown
  ordre?: unknown
  activiteId?: unknown
}

// Correspondance explicite des champs du corps : chaque champ texte doit être
// une chaîne (ou null quand le champ l'autorise), jamais un objet transmis tel
// quel à Prisma.
function texte(valeur: unknown, champ: string): string | undefined {
  if (valeur === undefined) return undefined
  if (typeof valeur !== 'string') throw new BadRequestException(`${champ} doit être une chaîne de caractères`)
  return valeur
}

function texteNullable(valeur: unknown, champ: string): string | null | undefined {
  if (valeur === null) return null
  return texte(valeur, champ)
}

function date(valeur: string): Date {
  const d = new Date(valeur)
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Date invalide')
  return d
}

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
    const paroisseId = paroisseIdRequise(utilisateur)

    // Les responsables de branche ne voient QUE leur branche (+ les programmes
    // du groupe, brancheType null, qu'ils doivent aussi pouvoir consulter) —
    // toute valeur "branche" fournie par le client est ignorée pour ce rôle.
    let filtreBranche = branche
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que la paroisse entière par défaut.
      if (!bt) return []
      filtreBranche = bt
    }
    if (filtreBranche && !BrancheTypeSchema.safeParse(filtreBranche).success) {
      throw new BadRequestException('Branche invalide')
    }

    return this.prisma.programme.findMany({
      where: {
        paroisseId,
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
    const paroisseIdCorps = typeof corps.paroisseId === 'string' ? corps.paroisseId : undefined
    const estAssistantDistrict = utilisateur.roleDistrict === 'ASSISTANT_DISTRICT'
    const creationDistrict = estAssistantDistrict && !!paroisseIdCorps
    if (!estGroupe && !estBranche && !creationDistrict) throw new ForbiddenException('Accès refusé')

    const titre = texte(corps.titre, 'titre')
    const description = texteNullable(corps.description, 'description')
    const periodeDebut = texte(corps.periodeDebut, 'periodeDebut')
    const periodeFin = texte(corps.periodeFin, 'periodeFin')
    const brancheType = corps.brancheType

    if (!titre || !periodeDebut || !periodeFin) {
      throw new BadRequestException('Le titre et la période sont obligatoires')
    }
    const debut = date(periodeDebut)
    const fin = date(periodeFin)
    if (fin <= debut) {
      throw new BadRequestException('La date de fin doit être après la date de début')
    }
    const brancheValidee = brancheType != null ? BrancheTypeSchema.safeParse(brancheType) : null
    if (brancheValidee && !brancheValidee.success) {
      throw new BadRequestException('Branche invalide')
    }

    let paroisseId: string
    let brancheEffective: string | null = brancheValidee?.success ? brancheValidee.data : null

    // La création via le district (choix de la paroisse cible) n'est utilisée
    // que par /district/ma-branche/programmes/nouveau, seule à envoyer
    // paroisseId dans le corps — un ASSISTANT_DISTRICT qui exerce par ailleurs
    // un rôle paroissial de groupe/branche crée normalement via l'autre
    // branche ci-dessous quand ce champ est absent (formulaire du tableau de bord).
    if (creationDistrict && paroisseIdCorps) {
      // Assistant au Commissaire de District chargé d'une branche : choisit la
      // paroisse cible parmi celles de son district, brancheType forcé à sa
      // branche — toute valeur envoyée par le client pour brancheType est ignorée.
      const bt = await this.perimetre.brancheDistrictUtilisateur(utilisateur.id)
      if (!bt) throw new ForbiddenException('Aucune branche assignée')
      const { paroisses } = await this.perimetre.paroissesDuDistrict(paroisseIdRequise(utilisateur))
      if (!paroisses.some((p) => p.id === paroisseIdCorps)) {
        throw new BadRequestException('Paroisse invalide ou manquante')
      }
      paroisseId = paroisseIdCorps
      brancheEffective = bt
    } else {
      paroisseId = paroisseIdRequise(utilisateur)
      // Un responsable de branche ne peut créer que le programme de sa propre branche
      if (estBranche) {
        const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
        if (!bt) throw new ForbiddenException('Aucune branche assignée')
        brancheEffective = bt
      }
    }

    return this.prisma.programme.create({
      data: {
        titre,
        description: description ?? null,
        periodeDebut: debut,
        periodeFin: fin,
        brancheType: (brancheEffective as BrancheType | null) ?? null,
        paroisseId,
        creePar: utilisateur.id,
      },
      include: {
        _count: { select: { lignes: true } },
      },
    })
  }

  async detail(utilisateur: UtilisateurSession, id: string) {
    const paroisseId = paroisseIdRequise(utilisateur)
    const programme = await this.prisma.programme.findFirst({
      where: { id, paroisseId },
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
    const paroisseId = paroisseIdRequise(utilisateur)
    const titre = texte(corps.titre, 'titre')
    const description = texteNullable(corps.description, 'description')
    const periodeDebut = texte(corps.periodeDebut, 'periodeDebut')
    const periodeFin = texte(corps.periodeFin, 'periodeFin')

    const existant = await this.programmeAutorise(utilisateur, paroisseId, id)

    const debut = periodeDebut !== undefined ? date(periodeDebut) : existant.periodeDebut
    const fin = periodeFin !== undefined ? date(periodeFin) : existant.periodeFin
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
    const paroisseId = paroisseIdRequise(utilisateur)
    await this.programmeAutorise(utilisateur, paroisseId, id)
    await this.prisma.programme.delete({ where: { id } })
    return { ok: true }
  }

  async ajouterLigne(utilisateur: UtilisateurSession, programmeId: string, corps: CorpsLigne) {
    const paroisseId = paroisseIdRequise(utilisateur)
    await this.programmeAutorise(utilisateur, paroisseId, programmeId)

    const theme = texte(corps.theme, 'theme')
    const objectif = texteNullable(corps.objectif, 'objectif')
    const datePrevue = texteNullable(corps.datePrevue, 'datePrevue')
    if (!theme) throw new BadRequestException('Le thème est obligatoire')

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
        datePrevue: datePrevue ? date(datePrevue) : null,
        ordre: (dernier?.ordre ?? -1) + 1,
      },
    })
  }

  async modifierLigne(utilisateur: UtilisateurSession, programmeId: string, ligneId: string, corps: CorpsLigne) {
    const paroisseId = paroisseIdRequise(utilisateur)
    await this.ligneAutorisee(utilisateur, paroisseId, programmeId, ligneId)

    const theme = texte(corps.theme, 'theme')
    const objectif = texteNullable(corps.objectif, 'objectif')
    const datePrevue = texteNullable(corps.datePrevue, 'datePrevue')
    const activiteId = texteNullable(corps.activiteId, 'activiteId')
    const { ordre } = corps
    if (ordre !== undefined && (typeof ordre !== 'number' || !Number.isInteger(ordre))) {
      throw new BadRequestException('ordre doit être un entier')
    }

    if (activiteId) {
      const activite = await this.prisma.activite.findFirst({
        where: { id: activiteId, paroisseId },
      })
      if (!activite) throw new BadRequestException('Activité introuvable')
    }

    return this.prisma.ligneProgramme.update({
      where: { id: ligneId },
      data: {
        ...(theme !== undefined ? { theme } : {}),
        ...(objectif !== undefined ? { objectif } : {}),
        ...(datePrevue !== undefined ? { datePrevue: datePrevue ? date(datePrevue) : null } : {}),
        ...(ordre !== undefined ? { ordre } : {}),
        ...(activiteId !== undefined ? { activiteId } : {}),
      },
      include: { activite: SELECTION_ACTIVITE },
    })
  }

  async supprimerLigne(utilisateur: UtilisateurSession, programmeId: string, ligneId: string) {
    const paroisseId = paroisseIdRequise(utilisateur)
    await this.ligneAutorisee(utilisateur, paroisseId, programmeId, ligneId)
    await this.prisma.ligneProgramme.delete({ where: { id: ligneId } })
    return { ok: true }
  }

  // Programme de la paroisse ; un responsable de branche ne peut agir que sur
  // le programme de sa propre branche (ni ceux du groupe, ni ceux d'une autre branche).
  private async programmeAutorise(utilisateur: UtilisateurSession, paroisseId: string, id: string) {
    const programme = await this.prisma.programme.findFirst({
      where: { id, paroisseId },
    })
    if (!programme) throw new NotFoundException('Programme introuvable')
    await this.verifierBranche(utilisateur, programme.brancheType)
    return programme
  }

  private async ligneAutorisee(
    utilisateur: UtilisateurSession,
    paroisseId: string,
    programmeId: string,
    ligneId: string,
  ) {
    const ligne = await this.prisma.ligneProgramme.findFirst({
      where: { id: ligneId, programmeId },
      include: { programme: true },
    })
    if (!ligne || ligne.programme.paroisseId !== paroisseId) throw new NotFoundException('Ligne introuvable')
    await this.verifierBranche(utilisateur, ligne.programme.brancheType)
    return ligne
  }

  private async verifierBranche(utilisateur: UtilisateurSession, brancheProgramme: string | null) {
    if (!ROLES_BRANCHE.includes(utilisateur.role)) return
    const bt = await this.perimetre.brancheUtilisateur(utilisateur.id)
    if (!bt || brancheProgramme !== bt) throw new ForbiddenException('Accès refusé à ce programme')
  }
}
