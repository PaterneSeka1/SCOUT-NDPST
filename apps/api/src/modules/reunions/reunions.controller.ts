import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_GESTION, ROLES_GROUPE, ROLES_TOUT_STAFF } from '@scout/shared'
import type { Response } from 'express'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { ReunionsService } from './reunions.service'

// Paramètre de query unique (une valeur répétée ?a=1&a=2 arrive en tableau).
function texteQuery(valeur: unknown): string | null {
  return typeof valeur === 'string' ? valeur : null
}

@ApiTags('Réunions')
@Controller('reunions')
export class ReunionsController {
  constructor(private readonly reunions: ReunionsService) {}

  // Routes « config » déclarées avant « :id » : sinon /reunions/config serait
  // capturée comme une réunion d'identifiant « config ».

  // Réservé au staff paroissial (exclut notamment ADMIN_PLATEFORME, sans paroisse).
  @Get('config')
  @Roles(...ROLES_TOUT_STAFF)
  listerConfigs(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.reunions.listerConfigs(utilisateur)
  }

  @Put('config')
  @Roles(...ROLES_GROUPE)
  enregistrerConfig(@UtilisateurCourant() utilisateur: UtilisateurSession, @Body() corps: unknown) {
    return this.reunions.enregistrerConfig(utilisateur, corps)
  }

  @Get()
  @Roles(...ROLES_TOUT_STAFF)
  lister(@UtilisateurCourant() utilisateur: UtilisateurSession, @Query() query: Record<string, unknown>) {
    return this.reunions.lister(utilisateur, texteQuery(query.branche), texteQuery(query.statut))
  }

  // Groupe ou branche ; un chef de branche ne crée que pour sa propre branche.
  @Post()
  @HttpCode(201)
  @Roles(...ROLES_GESTION)
  creer(@UtilisateurCourant() utilisateur: UtilisateurSession, @Body() corps: unknown) {
    return this.reunions.creer(utilisateur, corps)
  }

  @Get(':id')
  @Roles(...ROLES_TOUT_STAFF)
  detail(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.reunions.detail(utilisateur, id)
  }

  @Patch(':id')
  @Roles(...ROLES_GESTION)
  modifier(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string, @Body() corps: unknown) {
    return this.reunions.modifier(utilisateur, id, corps)
  }

  @Delete(':id')
  @Roles(...ROLES_GESTION)
  supprimer(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.reunions.supprimer(utilisateur, id)
  }

  @Get(':id/presences')
  @Roles(...ROLES_TOUT_STAFF)
  feuillePresences(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.reunions.feuillePresences(utilisateur, id)
  }

  @Post(':id/presences')
  @HttpCode(200)
  @Roles(...ROLES_TOUT_STAFF)
  enregistrerPresences(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body() corps: unknown,
  ) {
    return this.reunions.enregistrerPresences(utilisateur, id, corps)
  }

  @Get(':id/presences/export')
  @Roles(...ROLES_TOUT_STAFF)
  async exporterPresences(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Res() reponse: Response,
  ) {
    const fichier = await this.reunions.exporterPresences(utilisateur, id)
    reponse.setHeader('Content-Type', 'text/csv; charset=utf-8')
    reponse.setHeader('Content-Disposition', fichier.contentDisposition)
    reponse.status(200).send(fichier.contenu)
  }
}
