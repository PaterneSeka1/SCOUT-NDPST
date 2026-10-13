import { Body, Controller, Get, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_PLATEFORME } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { PlateformeService } from './plateforme.service'

@ApiTags('Administration plateforme')
@Roles(...ROLES_PLATEFORME)
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly plateforme: PlateformeService) {}

  @Get()
  journal(@Query() requete: Record<string, unknown>) {
    return this.plateforme.journalAudit(requete)
  }
}

@ApiTags('Administration plateforme')
@Roles(...ROLES_PLATEFORME)
@Controller('admin/site-config')
export class AdminSiteConfigController {
  constructor(private readonly plateforme: PlateformeService) {}

  // Réservé à l'administrateur plateforme comme le reste du module (la route
  // Next laissait la lecture ouverte, mais les pages publiques lisent la
  // configuration directement en base).
  @Get()
  lire() {
    return this.plateforme.lireConfig()
  }

  @Put()
  modifier(@Body() corps: unknown) {
    return this.plateforme.modifierConfig(corps)
  }
}
