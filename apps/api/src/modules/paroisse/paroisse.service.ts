import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'
import type { CorpsModificationParoisse } from './paroisse.schemas'

@Injectable()
export class ParoisseService {
  constructor(private readonly prisma: PrismaService) {}

  // Fiche de la paroisse de l'utilisateur, ouverte à tout compte authentifié
  // rattaché à une paroisse.
  async fiche(utilisateur: UtilisateurSession) {
    const paroisseId = utilisateur.paroisseId
    if (!paroisseId) throw new BadRequestException('Aucune paroisse associée')

    const paroisse = await this.prisma.paroisse.findUnique({
      where: { id: paroisseId },
      include: {
        district: { select: { id: true, nom: true } },
        _count: {
          select: { scouts: true, utilisateurs: true, activites: true },
        },
      },
    })
    if (!paroisse) throw new NotFoundException('Paroisse introuvable')
    return paroisse
  }

  // Mise à jour de la fiche par la direction du groupe (rôle contrôlé par le
  // contrôleur). Corps déjà validé par SchemaModificationParoisse : seuls les
  // champs modifiables y figurent (ni couleurs ni district — ce dernier
  // détermine le périmètre d'un Commissaire de District et reste réservé à
  // ADMIN_PLATEFORME, via /admin/paroisses/[id]).
  async modifier(utilisateur: UtilisateurSession, corps: CorpsModificationParoisse) {
    const paroisseId = utilisateur.paroisseId
    if (!paroisseId) throw new BadRequestException('Aucune paroisse associée')

    const { nom, ville, diocese, ocean, adresse, telephone, email, logo } = corps

    try {
      return await this.prisma.paroisse.update({
        where: { id: paroisseId },
        data: {
          ...(nom != null ? { nom: nom.trim() } : {}),
          ...(ville != null ? { ville: ville.trim() } : {}),
          ...(diocese != null ? { diocese: diocese.trim() } : {}),
          ...(ocean !== undefined ? { ocean: ocean?.trim() || null } : {}),
          ...(adresse !== undefined ? { adresse: adresse?.trim() || null } : {}),
          ...(telephone !== undefined ? { telephone: telephone?.trim() || null } : {}),
          ...(email !== undefined ? { email: email?.trim() || null } : {}),
          ...(logo !== undefined ? { logo: logo?.trim() || null } : {}),
        },
      })
    } catch (erreur) {
      // Contrainte d'unicité : seul l'e-mail est unique sur Paroisse.
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === 'P2002') {
        throw new ConflictException('Cette adresse e-mail est déjà utilisée par une autre paroisse')
      }
      throw erreur
    }
  }
}
