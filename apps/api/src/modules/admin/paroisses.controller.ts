import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { ROLES_PLATEFORME } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { envoyerCsv } from './admin.utils'
import { ParoissesService } from './paroisses.service'

@ApiTags('Administration plateforme')
@Roles(...ROLES_PLATEFORME)
@Controller('admin/paroisses')
export class AdminParoissesController {
  constructor(private readonly paroisses: ParoissesService) {}

  @Get()
  lister() {
    return this.paroisses.lister()
  }

  @Post()
  @HttpCode(201)
  creer(@Body() corps: unknown) {
    return this.paroisses.creer(corps)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.paroisses.detail(id)
  }

  @Patch(':id')
  modifier(@Param('id') id: string, @Body() corps: unknown, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.paroisses.modifier(id, corps, utilisateur.id)
  }

  @Delete(':id')
  supprimer(@Param('id') id: string, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.paroisses.supprimer(id, utilisateur.id)
  }

  @Post(':id/chef-groupe')
  @HttpCode(201)
  creerChefGroupe(@Param('id') id: string, @Body() corps: unknown) {
    return this.paroisses.creerChefGroupe(id, corps)
  }

  @Get(':id/export/scouts')
  async exporterScouts(
    @Param('id') id: string,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Res() reponse: Response,
  ) {
    envoyerCsv(reponse, await this.paroisses.exporterScouts(id, utilisateur.id))
  }

  @Get(':id/export/utilisateurs')
  async exporterUtilisateurs(
    @Param('id') id: string,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Res() reponse: Response,
  ) {
    envoyerCsv(reponse, await this.paroisses.exporterUtilisateurs(id, utilisateur.id))
  }
}
