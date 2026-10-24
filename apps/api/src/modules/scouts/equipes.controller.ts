import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_GROUPE, ROLES_TOUT_STAFF } from '@scout/shared'
import { z } from 'zod'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import { premiereValeur } from './corps'
import { EquipesService, ROLES_BRANCHE_GESTION_EQUIPES } from './equipes.service'
import { SchemaCreationEquipe, SchemaModificationEquipe } from './scouts.schemas'

@ApiTags('Scouts')
@Controller('equipes')
export class EquipesController {
  constructor(private readonly equipes: EquipesService) {}

  @Get()
  @Roles(...ROLES_TOUT_STAFF)
  lister(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Query('brancheType') brancheType?: unknown,
    @Query('actif') actif?: unknown,
  ) {
    return this.equipes.lister(utilisateur, {
      brancheType: premiereValeur(brancheType),
      actif: premiereValeur(actif),
    })
  }

  // Groupe, ou responsable/adjoint de la branche de l'équipe (vérifié par le service).
  @Post()
  @HttpCode(201)
  @Roles(...ROLES_GROUPE, ...ROLES_BRANCHE_GESTION_EQUIPES)
  creer(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Body(new ZodPipe(SchemaCreationEquipe)) corps: z.infer<typeof SchemaCreationEquipe>,
  ) {
    return this.equipes.creer(utilisateur, corps)
  }

  @Patch(':id')
  @Roles(...ROLES_GROUPE, ...ROLES_BRANCHE_GESTION_EQUIPES)
  modifier(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationEquipe)) corps: z.infer<typeof SchemaModificationEquipe>,
  ) {
    return this.equipes.modifier(utilisateur, id, corps)
  }
}
