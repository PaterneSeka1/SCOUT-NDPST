import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_TOUT_STAFF } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import { SchemaEtape, SchemaModificationEtape, type CorpsEtape, type CorpsModificationEtape } from './progression.schemas'
import { ProgressionService } from './progression.service'

// Référentiel pédagogique par branche et synthèse de progression. La
// validation des étapes d'un scout reste sur /scouts/:id/progressions.
@ApiTags('Progression pédagogique')
@Roles(...ROLES_TOUT_STAFF)
@Controller('progression')
export class ProgressionController {
  constructor(private readonly progression: ProgressionService) {}

  @Get('referentiel')
  referentiel(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.progression.referentiel(utilisateur)
  }

  @Get('synthese')
  synthese(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.progression.synthese(utilisateur)
  }

  @Post('referentiel')
  @HttpCode(201)
  creer(@UtilisateurCourant() utilisateur: UtilisateurSession, @Body(new ZodPipe(SchemaEtape)) corps: CorpsEtape) {
    return this.progression.creer(utilisateur, corps)
  }

  @Patch('referentiel/:id')
  modifier(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationEtape)) corps: CorpsModificationEtape,
  ) {
    return this.progression.modifier(utilisateur, id, corps)
  }

  @Delete('referentiel/:id')
  supprimer(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.progression.supprimer(utilisateur, id)
  }
}
