import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_GESTION, ROLES_TOUT_STAFF as ROLES_LECTURE } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import {
  SchemaCreationLigne,
  SchemaCreationProgramme,
  SchemaModificationLigne,
  SchemaModificationProgramme,
  type CorpsCreationLigne,
  type CorpsCreationProgramme,
  type CorpsModificationLigne,
  type CorpsModificationProgramme,
} from './programmes.schemas'
import { ProgrammesService } from './programmes.service'

@ApiTags('Programmes')
@Controller('programmes')
export class ProgrammesController {
  constructor(private readonly programmes: ProgrammesService) {}

  @Get()
  @Roles(...ROLES_LECTURE)
  lister(@UtilisateurCourant() utilisateur: UtilisateurSession, @Query('branche') branche?: unknown) {
    return this.programmes.lister(utilisateur, typeof branche === 'string' ? branche : undefined)
  }

  // Pas de @Roles : la création est ouverte à la direction (groupe, branches)
  // ET à un ASSISTANT_DISTRICT qui cible une paroisse de son district — règle
  // combinée rôle paroissial / affectation district, vérifiée par le service.
  @Post()
  @HttpCode(201)
  creer(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Body(new ZodPipe(SchemaCreationProgramme)) corps: CorpsCreationProgramme,
  ) {
    return this.programmes.creer(utilisateur, corps)
  }

  @Get(':id')
  @Roles(...ROLES_LECTURE)
  detail(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.programmes.detail(utilisateur, id)
  }

  @Patch(':id')
  @Roles(...ROLES_GESTION)
  modifier(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationProgramme)) corps: CorpsModificationProgramme,
  ) {
    return this.programmes.modifier(utilisateur, id, corps)
  }

  @Delete(':id')
  @Roles(...ROLES_GESTION)
  supprimer(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.programmes.supprimer(utilisateur, id)
  }

  @Post(':id/lignes')
  @HttpCode(201)
  @Roles(...ROLES_GESTION)
  ajouterLigne(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaCreationLigne)) corps: CorpsCreationLigne,
  ) {
    return this.programmes.ajouterLigne(utilisateur, id, corps)
  }

  @Patch(':id/lignes/:ligneId')
  @Roles(...ROLES_GESTION)
  modifierLigne(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Param('ligneId') ligneId: string,
    @Body(new ZodPipe(SchemaModificationLigne)) corps: CorpsModificationLigne,
  ) {
    return this.programmes.modifierLigne(utilisateur, id, ligneId, corps)
  }

  @Delete(':id/lignes/:ligneId')
  @Roles(...ROLES_GESTION)
  supprimerLigne(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Param('ligneId') ligneId: string,
  ) {
    return this.programmes.supprimerLigne(utilisateur, id, ligneId)
  }
}
