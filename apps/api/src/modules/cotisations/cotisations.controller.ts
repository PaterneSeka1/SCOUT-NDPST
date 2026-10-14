import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_GESTION, ROLES_GROUPE, ROLES_TOUT_STAFF } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import {
  SchemaCreationCotisation,
  SchemaModificationCotisation,
  SchemaStatutCotisant,
  type CorpsCreationCotisation,
  type CorpsModificationCotisation,
  type CorpsStatutCotisant,
} from './cotisations.schemas'
import { CotisationsService } from './cotisations.service'

// Paramètre de requête : seule une valeur unique est retenue (un paramètre
// répété arrive sous forme de tableau et n'est jamais transmis à Prisma).
function texteRequete(valeur: unknown): string | undefined {
  return typeof valeur === 'string' ? valeur : undefined
}

// Les routes /cotisations/statuts sont déclarées avant /cotisations/:id :
// Express les enregistre dans l'ordre, sinon PUT /statuts serait capté par :id.
@ApiTags('Cotisations')
@Controller('cotisations')
export class CotisationsController {
  constructor(private readonly cotisations: CotisationsService) {}

  @Get('statuts')
  @Roles(...ROLES_TOUT_STAFF)
  listerStatuts(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Query('anneeScolaire') anneeScolaire?: unknown,
    @Query('branche') branche?: unknown,
  ) {
    return this.cotisations.listerStatuts(utilisateur, {
      anneeScolaire: texteRequete(anneeScolaire),
      branche: texteRequete(branche),
    })
  }

  @Put('statuts')
  @Roles(...ROLES_GROUPE)
  definirStatut(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Body(new ZodPipe(SchemaStatutCotisant)) corps: CorpsStatutCotisant,
  ) {
    return this.cotisations.definirStatut(utilisateur, corps)
  }

  @Get()
  @Roles(...ROLES_TOUT_STAFF)
  lister(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Query('anneeScolaire') anneeScolaire?: unknown,
    @Query('statut') statut?: unknown,
    @Query('branche') branche?: unknown,
  ) {
    return this.cotisations.lister(utilisateur, {
      anneeScolaire: texteRequete(anneeScolaire),
      statut: texteRequete(statut),
      branche: texteRequete(branche),
    })
  }

  @Post()
  @HttpCode(201)
  @Roles(...ROLES_GROUPE)
  creer(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Body(new ZodPipe(SchemaCreationCotisation)) corps: CorpsCreationCotisation,
  ) {
    return this.cotisations.creer(utilisateur, corps)
  }

  @Put(':id')
  @Roles(...ROLES_GESTION)
  modifier(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationCotisation)) corps: CorpsModificationCotisation,
  ) {
    return this.cotisations.modifier(utilisateur, id, corps)
  }

  @Delete(':id')
  @Roles(...ROLES_GROUPE)
  supprimer(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.cotisations.supprimer(utilisateur, id)
  }
}
