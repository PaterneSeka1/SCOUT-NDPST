import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_TOUT_STAFF } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import {
  SchemaConfirmationAutorisation,
  SchemaCreationActivite,
  SchemaModificationActivite,
  SchemaPresencesActivite,
  SchemaRetraitAutorisation,
  type CorpsConfirmationAutorisation,
  type CorpsCreationActivite,
  type CorpsModificationActivite,
  type CorpsPresencesActivite,
  type CorpsRetraitAutorisation,
} from './activites.schemas'
import { ActivitesService } from './activites.service'

// Paramètre de query unique (une valeur répétée ?a=1&a=2 arrive en tableau).
function texteQuery(valeur: unknown): string | null {
  return typeof valeur === 'string' ? valeur : null
}

@ApiTags('Activités')
@Controller('activites')
export class ActivitesController {
  constructor(private readonly activites: ActivitesService) {}

  @Get()
  @Roles(...ROLES_TOUT_STAFF)
  lister(@UtilisateurCourant() utilisateur: UtilisateurSession, @Query() query: Record<string, unknown>) {
    return this.activites.lister(utilisateur, {
      page: texteQuery(query.page),
      limite: texteQuery(query.limite),
      recherche: texteQuery(query.recherche),
      type: texteQuery(query.type),
      brancheType: texteQuery(query.brancheType),
      aVenir: texteQuery(query.aVenir),
    })
  }

  // Pas de @Roles : le staff paroissial OU un ASSISTANT_DISTRICT peut créer
  // (règle « l'un ou l'autre » vérifiée dans le service).
  @Post()
  @HttpCode(201)
  creer(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Body(new ZodPipe(SchemaCreationActivite)) corps: CorpsCreationActivite,
  ) {
    return this.activites.creer(utilisateur, corps)
  }

  @Get(':id')
  @Roles(...ROLES_TOUT_STAFF)
  detail(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.activites.detail(utilisateur, id)
  }

  @Put(':id')
  @Roles(...ROLES_TOUT_STAFF)
  modifier(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationActivite)) corps: CorpsModificationActivite,
  ) {
    return this.activites.modifier(utilisateur, id, corps)
  }

  @Delete(':id')
  @Roles(...ROLES_TOUT_STAFF)
  supprimer(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.activites.supprimer(utilisateur, id)
  }

  // Pas de @Roles : un parent (lien LienParentScout) confirme aussi les
  // autorisations de camp de son enfant ; le contrôle est fait par scout.
  @Post(':id/autorisations')
  @HttpCode(201)
  confirmerAutorisation(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaConfirmationAutorisation)) corps: CorpsConfirmationAutorisation,
  ) {
    return this.activites.confirmerAutorisation(utilisateur, id, corps)
  }

  @Delete(':id/autorisations')
  retirerAutorisation(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaRetraitAutorisation)) corps: CorpsRetraitAutorisation,
  ) {
    return this.activites.retirerAutorisation(utilisateur, id, corps)
  }

  @Get(':id/presences')
  @Roles(...ROLES_TOUT_STAFF)
  listerPresences(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.activites.listerPresences(utilisateur, id)
  }

  @Post(':id/presences')
  @HttpCode(200)
  @Roles(...ROLES_TOUT_STAFF)
  enregistrerPresences(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaPresencesActivite)) corps: CorpsPresencesActivite,
  ) {
    return this.activites.enregistrerPresences(utilisateur, id, corps)
  }
}
