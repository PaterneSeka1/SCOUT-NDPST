import { Controller, Get, Query, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { ROLES_SUPERVISION } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { envoyerCsv } from './admin.utils'
import { RapportsService } from './rapports.service'

// Synthèse et exports CSV de l'installation : administrateur et Chef de Groupe.
@ApiTags('Administration')
@Roles(...ROLES_SUPERVISION)
@Controller('admin/rapports')
export class AdminRapportsController {
  constructor(private readonly rapports: RapportsService) {}

  @Get()
  synthese() {
    return this.rapports.synthese()
  }

  // ?type=scouts|utilisateurs|activites|cotisations
  @Get('export')
  async exporter(
    @Query('type') type: unknown,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Res() reponse: Response,
  ) {
    envoyerCsv(reponse, await this.rapports.exporter(type, utilisateur.id))
  }
}
