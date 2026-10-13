import { BadRequestException, Injectable } from '@nestjs/common'
import { ROLES_BRANCHE } from '@scout/shared'
import type { RoleUtilisateur } from '../../generated/prisma/client'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  // Encadrement de chaque branche de la paroisse et effectif actif par branche.
  async synthese(utilisateur: UtilisateurSession) {
    const paroisseId = utilisateur.paroisseId
    if (!paroisseId) throw new BadRequestException('Aucune paroisse')

    const [utilisateursBranche, scoutsParBranche] = await Promise.all([
      this.prisma.utilisateur.findMany({
        where: { paroisseId, role: { in: ROLES_BRANCHE as RoleUtilisateur[] }, brancheType: { not: null } },
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          telephone: true,
          role: true,
          fonction: true,
          brancheType: true,
        },
        orderBy: [{ brancheType: 'asc' }, { role: 'asc' }],
      }),
      this.prisma.scout.groupBy({
        by: ['brancheType'],
        where: { paroisseId, actif: true },
        _count: { id: true },
      }),
    ])

    const postes = utilisateursBranche.map((u) => ({
      id: u.id,
      brancheType: u.brancheType,
      role: u.role.replace('_BRANCHE', ''),
      fonction: u.fonction,
      utilisateur: { id: u.id, nom: u.nom, prenom: u.prenom, email: u.email, telephone: u.telephone },
    }))

    const comptesParBranche: Record<string, number> = {}
    for (const g of scoutsParBranche) comptesParBranche[g.brancheType] = g._count.id

    return { postes, comptesParBranche }
  }
}
