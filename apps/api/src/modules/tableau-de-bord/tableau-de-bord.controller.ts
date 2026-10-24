import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_ADMIN, ROLES_GROUPE, ROLES_TOUT_STAFF } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { IndicateursService } from './indicateurs.service'

// Tableau de bord adapté au rôle : administrateur, maîtrise, et (si leurs
// espaces sont ouverts) parents et scouts.
const ROLES_TABLEAU: string[] = [...ROLES_ADMIN, ...ROLES_TOUT_STAFF, 'PARENT', 'SCOUT']

@ApiTags('Tableau de bord')
@Controller()
export class TableauDeBordController {
  constructor(private readonly indicateurs: IndicateursService) {}

  @Get('tableau-de-bord')
  @Roles(...ROLES_TABLEAU)
  tableauDeBord(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.indicateurs.tableauDeBord(utilisateur)
  }

  // Rapport d'activité du groupe : direction du groupe et administrateur.
  @Get('rapports')
  @Roles(...ROLES_GROUPE, ...ROLES_ADMIN)
  rapport() {
    return this.indicateurs.rapport()
  }
}
