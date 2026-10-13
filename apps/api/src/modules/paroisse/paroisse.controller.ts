import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_GROUPE, ROLES_TOUT_STAFF } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { IndicateursService } from './indicateurs.service'
import { ParoisseService } from './paroisse.service'

// Tableau de bord d'une paroisse : staff paroissial, parents et scouts.
// ADMIN_PLATEFORME (transverse, sans paroisse) a sa propre zone /admin.
const ROLES_KPIS: string[] = [...ROLES_TOUT_STAFF, 'PARENT', 'SCOUT']

@ApiTags('Paroisse')
@Controller('paroisse')
export class ParoisseController {
  constructor(private readonly paroisse: ParoisseService) {}

  // Sans @Roles : tout compte authentifié rattaché à une paroisse peut lire sa fiche.
  @Get()
  fiche(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.paroisse.fiche(utilisateur)
  }

  @Patch()
  @Roles(...ROLES_GROUPE)
  modifier(@UtilisateurCourant() utilisateur: UtilisateurSession, @Body() corps: unknown) {
    return this.paroisse.modifier(utilisateur, corps)
  }
}

@ApiTags('Paroisse')
@Controller('dashboard')
export class TableauDeBordController {
  constructor(private readonly indicateurs: IndicateursService) {}

  @Get('kpis')
  @Roles(...ROLES_KPIS)
  kpis(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.indicateurs.kpis(utilisateur)
  }
}

@ApiTags('Paroisse')
@Controller('rapports')
export class RapportsController {
  constructor(private readonly indicateurs: IndicateursService) {}

  @Get()
  @Roles(...ROLES_GROUPE)
  rapport(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.indicateurs.rapport(utilisateur)
  }
}
