import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_DISTRICT, ROLES_DISTRICT_ETENDU } from '@scout/shared'
import { RolesDistrict } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { DistrictService, type CorpsAffectation, type FiltresEquipe } from './district.service'

// Espace district : l'accès est toujours gouverné par l'affectation district
// (roleDistrict), jamais par le rôle paroissial (role). Le périmètre (paroisses
// du district, branche district) est appliqué par DistrictService.
@ApiTags('District')
@Controller('district')
export class DistrictController {
  constructor(private readonly district: DistrictService) {}

  @Get('apercu')
  @RolesDistrict(...ROLES_DISTRICT_ETENDU)
  apercu(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.district.apercu(utilisateur)
  }

  // Réservé à l'ASSISTANT_DISTRICT chargé d'une branche.
  @Get('ma-branche')
  @RolesDistrict('ASSISTANT_DISTRICT')
  maBranche(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.district.maBranche(utilisateur)
  }

  @Get('paroisses')
  @RolesDistrict(...ROLES_DISTRICT_ETENDU)
  paroisses(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.district.paroisses(utilisateur)
  }

  @Get('rapports')
  @RolesDistrict(...ROLES_DISTRICT)
  rapports(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.district.rapports(utilisateur)
  }

  // Gestion de l'équipe district : réservée au Commissaire de District
  // (ROLES_DISTRICT). Déclarée avant `utilisateurs/:id` pour ne pas être
  // capturée par le paramètre.
  @Get('utilisateurs/eligibles')
  @RolesDistrict(...ROLES_DISTRICT)
  eligibles(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.district.eligibles(utilisateur)
  }

  @Get('utilisateurs')
  @RolesDistrict(...ROLES_DISTRICT)
  listerEquipe(@UtilisateurCourant() utilisateur: UtilisateurSession, @Query() filtres: FiltresEquipe) {
    return this.district.listerEquipe(utilisateur, filtres ?? {})
  }

  @Post('utilisateurs')
  @HttpCode(200)
  @RolesDistrict(...ROLES_DISTRICT)
  affecter(@UtilisateurCourant() utilisateur: UtilisateurSession, @Body() corps: CorpsAffectation) {
    return this.district.affecter(utilisateur, corps ?? {})
  }

  @Get('utilisateurs/:id')
  @RolesDistrict(...ROLES_DISTRICT)
  detailMembre(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.district.detailMembre(utilisateur, id)
  }

  @Put('utilisateurs/:id')
  @RolesDistrict(...ROLES_DISTRICT)
  modifierMembre(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body() corps: CorpsAffectation,
  ) {
    return this.district.modifierMembre(utilisateur, id, corps ?? {})
  }

  @Delete('utilisateurs/:id')
  @RolesDistrict(...ROLES_DISTRICT)
  retirerMembre(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.district.retirerMembre(utilisateur, id)
  }

  @Put('utilisateurs/:id/password')
  @RolesDistrict(...ROLES_DISTRICT)
  modifierMotDePasse(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body() corps: { nouveauMotDePasse?: unknown } | undefined,
  ) {
    return this.district.modifierMotDePasse(utilisateur, id, corps?.nouveauMotDePasse)
  }
}
