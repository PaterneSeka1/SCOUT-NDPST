import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_FINANCES, ROLES_GESTION, ROLES_GROUPE, ROLES_TOUT_STAFF } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import {
  SchemaCreationBareme,
  SchemaCreationCotisation,
  SchemaModificationBareme,
  SchemaModificationCotisation,
  SchemaStatutCotisant,
  type CorpsCreationBareme,
  type CorpsCreationCotisation,
  type CorpsModificationBareme,
  type CorpsModificationCotisation,
  type CorpsStatutCotisant,
} from './cotisations.schemas'
import { CotisationsService } from './cotisations.service'

// Paramètre de requête : seule une valeur unique est retenue (un paramètre
// répété arrive sous forme de tableau et n'est jamais transmis à Prisma).
function texteRequete(valeur: unknown): string | undefined {
  return typeof valeur === 'string' ? valeur : undefined
}

// Les routes /cotisations/statuts et /cotisations/baremes sont déclarées avant /cotisations/:id :
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

  // Barème : lecture et écriture réservées aux responsables des finances.
  @Get('baremes')
  @Roles(...ROLES_FINANCES)
  listerBaremes(@Query('anneeScolaire') anneeScolaire?: unknown) {
    return this.cotisations.listerBaremes(texteRequete(anneeScolaire))
  }

  @Post('baremes')
  @HttpCode(201)
  @Roles(...ROLES_FINANCES)
  creerBareme(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Body(new ZodPipe(SchemaCreationBareme)) corps: CorpsCreationBareme,
  ) {
    return this.cotisations.creerBareme(utilisateur, corps)
  }

  @Patch('baremes/:id')
  @Roles(...ROLES_FINANCES)
  modifierBareme(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationBareme)) corps: CorpsModificationBareme,
  ) {
    return this.cotisations.modifierBareme(utilisateur, id, corps)
  }

  @Delete('baremes/:id')
  @Roles(...ROLES_FINANCES)
  supprimerBareme(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.cotisations.supprimerBareme(utilisateur, id)
  }

  @Get()
  @Roles(...ROLES_TOUT_STAFF)
  lister(@UtilisateurCourant() utilisateur: UtilisateurSession, @Query() query: Record<string, unknown>) {
    return this.cotisations.lister(utilisateur, {
      anneeScolaire: texteRequete(query.anneeScolaire),
      statut: texteRequete(query.statut),
      branche: texteRequete(query.branche),
      recherche: texteRequete(query.recherche),
      page: texteRequete(query.page),
      limite: texteRequete(query.limite),
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
