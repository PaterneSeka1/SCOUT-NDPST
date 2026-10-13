import { Injectable, NotFoundException } from '@nestjs/common'
import { ROLES_BRANCHE } from '@scout/shared'
import type { BrancheType } from '../../generated/prisma/client'
import { PerimetreService } from '../../common/perimetre.service'
import { paroisseIdRequise } from '../../common/paroisse'
import type { UtilisateurSession } from '../../common/types'
import { PrismaService } from '../../prisma/prisma.service'

// Cloisonnement par branche commun à toutes les routes du domaine scouts :
// un responsable de branche (RESPONSABLE/ADJOINT/ASSISTANT_BRANCHE) ne voit
// et ne gère QUE les scouts de sa propre branche. Fiche, contacts d'urgence et
// documents (fiche médicale, autorisation parentale…) sont des données
// sensibles de mineurs : même cloisonnement partout.
@Injectable()
export class AccesScoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly perimetre: PerimetreService,
  ) {}

  estRoleBranche(utilisateur: UtilisateurSession): boolean {
    return ROLES_BRANCHE.includes(utilisateur.role)
  }

  // Branche imposée à l'utilisateur :
  // - undefined : rôle de groupe, toute la paroisse ;
  // - null : rôle de branche sans brancheType assigné (compte mal configuré) ;
  // - sinon la branche gérée.
  async brancheImposee(utilisateur: UtilisateurSession): Promise<BrancheType | null | undefined> {
    if (!this.estRoleBranche(utilisateur)) return undefined
    return (await this.perimetre.brancheUtilisateur(utilisateur.id)) as BrancheType | null
  }

  // Vérifie que le scout appartient à la paroisse de l'utilisateur (et à sa
  // branche pour un rôle de branche). Répond 404 "Scout introuvable" dans tous
  // les cas de refus, pour ne pas révéler l'existence d'un scout hors périmètre.
  async verifierScoutGere(utilisateur: UtilisateurSession, scoutId: string): Promise<string> {
    const paroisseId = paroisseIdRequise(utilisateur)
    const branche = await this.brancheImposee(utilisateur)
    if (branche === null) throw new NotFoundException('Scout introuvable')

    const scout = await this.prisma.scout.findFirst({
      where: { id: scoutId, paroisseId, ...(branche ? { brancheType: branche } : {}) },
      select: { id: true },
    })
    if (!scout) throw new NotFoundException('Scout introuvable')
    return paroisseId
  }
}
