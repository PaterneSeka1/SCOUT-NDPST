import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { ROLES_BRANCHE } from '@scout/shared'
import { Prisma } from '../../generated/prisma/client'
import { PerimetreService } from '../../common/perimetre.service'
import { paroisseIdRequise } from '../../common/paroisse'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'
import type { DonneesValidationProgression } from './scouts.schemas'

interface ScoutCible {
  id: string
  nom: string
  prenom: string
  paroisseId: string
  brancheType: string
}

@Injectable()
export class ProgressionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
  ) {}

  // Détermine si l'utilisateur peut consulter/valider la progression de ce
  // scout : responsable de branche de SA paroisse et de la même branche, ou
  // assistant district chargé de cette branche pour une paroisse de son district.
  // Ne renvoie qu'un booléen : en cas de refus, l'appelant répond 404
  // "Scout introuvable" (même message qu'un scout absent) pour ne jamais révéler
  // à un tiers non autorisé qu'un scout existe dans une autre paroisse/branche.
  async autoriseSurScout(
    utilisateur: UtilisateurSession,
    scout: { paroisseId: string; brancheType: string },
  ): Promise<boolean> {
    if (ROLES_BRANCHE.includes(utilisateur.role)) {
      const paroisseId = paroisseIdRequise(utilisateur)
      if (scout.paroisseId === paroisseId) {
        const brancheUtilisateur = await this.perimetre.brancheUtilisateur(utilisateur.id)
        if (brancheUtilisateur === scout.brancheType) return true
      }
    }

    if (utilisateur.roleDistrict === 'ASSISTANT_DISTRICT') {
      const brancheDistrict = await this.perimetre.brancheDistrictUtilisateur(utilisateur.id)
      if (brancheDistrict && brancheDistrict === scout.brancheType) {
        const { paroisses } = await this.perimetre.paroissesDuDistrict(paroisseIdRequise(utilisateur))
        if (paroisses.some((p) => p.id === scout.paroisseId)) return true
      }
    }

    return false
  }

  private async scoutAutorise(utilisateur: UtilisateurSession, id: string): Promise<ScoutCible> {
    const scout = await this.prisma.scout.findUnique({
      where: { id },
      select: { id: true, nom: true, prenom: true, paroisseId: true, brancheType: true },
    })
    if (!scout || !(await this.autoriseSurScout(utilisateur, scout))) {
      throw new NotFoundException('Scout introuvable')
    }
    return scout
  }

  async lister(utilisateur: UtilisateurSession, id: string) {
    const scout = await this.scoutAutorise(utilisateur, id)

    const [badges, progressions] = await Promise.all([
      this.prisma.badge.findMany({
        where: { brancheType: scout.brancheType as Prisma.BadgeWhereInput['brancheType'] },
        orderBy: { ordre: 'asc' },
      }),
      this.prisma.progressionScout.findMany({
        where: { scoutId: id },
        include: { validePar: { select: { nom: true, prenom: true } } },
      }),
    ])

    const progressionsParBadge = new Map(progressions.map((p) => [p.badgeId, p]))

    const badgesReponse = badges
      .map((badge) => {
        const progression = progressionsParBadge.get(badge.id)
        return {
          id: badge.id,
          nom: badge.nom,
          description: badge.description,
          ordre: badge.ordre,
          icone: badge.icone,
          valide: Boolean(progression),
          dateValidation: progression ? progression.dateValidation.toISOString() : null,
          valideParNomComplet: progression ? `${progression.validePar.prenom} ${progression.validePar.nom}` : null,
          progressionId: progression ? progression.id : null,
        }
      })
      .sort((a, b) => a.ordre - b.ordre)

    return {
      scout: { id: scout.id, nom: scout.nom, prenom: scout.prenom, brancheType: scout.brancheType },
      badges: badgesReponse,
    }
  }

  async valider(utilisateur: UtilisateurSession, id: string, corps: DonneesValidationProgression) {
    const scout = await this.scoutAutorise(utilisateur, id)
    const { badgeId, commentaire } = corps

    const badge = await this.prisma.badge.findUnique({
      where: { id: badgeId },
      select: { id: true, brancheType: true },
    })
    if (!badge) throw new BadRequestException('Badge introuvable')
    if (badge.brancheType !== scout.brancheType) {
      throw new BadRequestException("Ce badge n'appartient pas à la branche de ce scout")
    }

    try {
      return await this.prisma.progressionScout.create({
        data: {
          scoutId: id,
          badgeId,
          valideParId: utilisateur.id,
          commentaire: commentaire?.trim() || null,
        },
      })
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException('Ce badge est déjà validé pour ce scout')
      }
      throw erreur
    }
  }
}
