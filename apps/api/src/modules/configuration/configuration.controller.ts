import { Body, Controller, Get, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_ADMIN } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import { SchemaConfiguration, type DonneesConfiguration } from './configuration.schemas'
import { ConfigurationService } from './configuration.service'

// Administration > Identité et configuration. Une seule ressource : lecture
// et mise à jour, sans création ni suppression.
@ApiTags('Administration')
@Roles(...ROLES_ADMIN)
@Controller('admin/configuration')
export class AdminConfigurationController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get()
  lire() {
    return this.configuration.lire()
  }

  @Put()
  modifier(
    @Body(new ZodPipe(SchemaConfiguration)) corps: DonneesConfiguration,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.configuration.modifier(corps, utilisateur.id)
  }
}

// Identité affichée dans l'espace privé (tout compte connecté).
@ApiTags('Configuration')
@Controller('configuration')
export class ConfigurationController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get()
  identite() {
    return this.configuration.identitePublique()
  }
}
