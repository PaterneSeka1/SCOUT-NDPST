import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_PLATEFORME } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { UtilisateursService } from './utilisateurs.service'

@ApiTags('Administration plateforme')
@Roles(...ROLES_PLATEFORME)
@Controller('admin/utilisateurs')
export class AdminUtilisateursController {
  constructor(private readonly utilisateurs: UtilisateursService) {}

  @Get()
  lister(@Query() requete: Record<string, unknown>) {
    return this.utilisateurs.lister(requete)
  }

  @Post()
  @HttpCode(201)
  creer(@Body() corps: unknown, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.utilisateurs.creer(corps, utilisateur.id)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.utilisateurs.detail(id)
  }

  @Put(':id')
  modifier(@Param('id') id: string, @Body() corps: unknown, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.utilisateurs.modifier(id, corps, utilisateur.id)
  }

  // Désactivation (jamais de suppression physique d'un compte).
  @Delete(':id')
  desactiver(@Param('id') id: string, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.utilisateurs.desactiver(id, utilisateur.id)
  }

  @Put(':id/nominations')
  nommer(@Param('id') id: string, @Body() corps: unknown, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.utilisateurs.nommer(id, corps, utilisateur.id)
  }

  @Put(':id/password')
  changerMotDePasse(
    @Param('id') id: string,
    @Body() corps: unknown,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.utilisateurs.changerMotDePasse(id, corps, utilisateur.id)
  }
}
