import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ROLES_GROUPE, estValeurEnum } from '@scout/shared'
import { BrancheType, Prisma } from '../../generated/prisma/client'
import { AuditService } from '../../common/audit.service'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'
import { AccesScoutsService } from './acces-scouts.service'
import type { DonneesCreationEquipe, DonneesModificationEquipe } from './scouts.schemas'

// Rôles de branche autorisés à gérer les équipes de LEUR branche (l'assistant
// de branche consulte seulement).
export const ROLES_BRANCHE_GESTION_EQUIPES = ['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE']

export interface FiltresEquipes {
  brancheType: string | null
  actif: string | null
}

const SELECTION_EQUIPE = {
  id: true,
  nom: true,
  brancheType: true,
  description: true,
  actif: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { scouts: true } },
} as const

const MESSAGE_DOUBLON = 'Une équipe porte déjà ce nom dans cette branche'

@Injectable()
export class EquipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly acces: AccesScoutsService,
  ) {}

  // Lecture : toute la maîtrise ; l'encadrement de branche ne voit que les
  // équipes de sa branche (toute branche demandée par le client est ignorée).
  async lister(utilisateur: UtilisateurSession, filtres: FiltresEquipes) {
    let branche: BrancheType | undefined
    if (this.acces.estRoleBranche(utilisateur)) {
      const bt = await this.acces.brancheImposee(utilisateur)
      if (!bt) return { equipes: [] }
      branche = bt
    } else if (filtres.brancheType) {
      if (!estValeurEnum(BrancheType, filtres.brancheType)) throw new BadRequestException('Branche invalide')
      branche = filtres.brancheType as BrancheType
    }
    if (filtres.actif !== null && filtres.actif !== 'true' && filtres.actif !== 'false') {
      throw new BadRequestException('Filtre actif invalide')
    }

    const equipes = await this.prisma.equipe.findMany({
      where: {
        ...(branche ? { brancheType: branche } : {}),
        ...(filtres.actif !== null ? { actif: filtres.actif === 'true' } : {}),
      },
      select: SELECTION_EQUIPE,
      orderBy: [{ brancheType: 'asc' }, { nom: 'asc' }],
    })
    return { equipes }
  }

  // Écriture : direction du groupe, ou responsable/adjoint de LA branche
  // concernée. Le rôle est déjà filtré par le contrôleur ; la branche est
  // vérifiée ici, côté serveur.
  private async verifierGestionBranche(utilisateur: UtilisateurSession, brancheType: BrancheType) {
    if (ROLES_GROUPE.includes(utilisateur.role)) return
    if (!ROLES_BRANCHE_GESTION_EQUIPES.includes(utilisateur.role)) throw new ForbiddenException('Accès refusé')
    const bt = await this.acces.brancheImposee(utilisateur)
    if (!bt || bt !== brancheType) throw new ForbiddenException('Gestion limitée aux équipes de votre branche')
  }

  private async verifierNomLibre(brancheType: BrancheType, nom: string, exclureId?: string) {
    const doublon = await this.prisma.equipe.findFirst({
      where: {
        brancheType,
        nom: { equals: nom, mode: 'insensitive' },
        ...(exclureId ? { id: { not: exclureId } } : {}),
      },
      select: { id: true },
    })
    if (doublon) throw new ConflictException(MESSAGE_DOUBLON)
  }

  async creer(utilisateur: UtilisateurSession, corps: DonneesCreationEquipe) {
    const { nom, brancheType, description } = corps
    await this.verifierGestionBranche(utilisateur, brancheType)
    await this.verifierNomLibre(brancheType, nom)

    const equipe = await this.avecConflit(() =>
      this.prisma.equipe.create({ data: { nom, brancheType, description }, select: SELECTION_EQUIPE }),
    )
    await this.audit.enregistrer({
      acteurId: utilisateur.id,
      action: 'EQUIPE_CREEE',
      entite: 'Equipe',
      entiteId: equipe.id,
      details: { nom, brancheType },
    })
    return equipe
  }

  async modifier(utilisateur: UtilisateurSession, id: string, corps: DonneesModificationEquipe) {
    const existante = await this.prisma.equipe.findUnique({
      where: { id },
      select: { id: true, brancheType: true, nom: true },
    })
    if (!existante) throw new NotFoundException('Équipe introuvable')
    await this.verifierGestionBranche(utilisateur, existante.brancheType)

    const { nom, description, actif } = corps
    if (nom !== undefined && nom !== existante.nom) await this.verifierNomLibre(existante.brancheType, nom, id)

    const equipe = await this.avecConflit(() =>
      this.prisma.equipe.update({
        where: { id },
        data: {
          ...(nom !== undefined ? { nom } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(actif !== undefined ? { actif } : {}),
        },
        select: SELECTION_EQUIPE,
      }),
    )
    await this.audit.enregistrer({
      acteurId: utilisateur.id,
      action: 'EQUIPE_MODIFIEE',
      entite: 'Equipe',
      entiteId: id,
      details: { champs: Object.keys(corps).filter((cle) => corps[cle as keyof typeof corps] !== undefined) },
    })
    return equipe
  }

  // Création ou renommage concurrent : la contrainte unique (brancheType, nom) tranche.
  private async avecConflit<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException(MESSAGE_DOUBLON)
      }
      throw erreur
    }
  }
}
