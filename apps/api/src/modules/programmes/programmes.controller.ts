import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_GESTION, ROLES_TOUT_STAFF as ROLES_LECTURE } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import {
  ProgrammesService,
  type CorpsCreationProgramme,
  type CorpsLigne,
  type CorpsModificationProgramme,
} from './programmes.service'

function objet<T extends object>(corps: unknown): T {
  return (typeof corps === 'object' && corps !== null ? corps : {}) as T
}

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
  creer(@UtilisateurCourant() utilisateur: UtilisateurSession, @Body() corps: unknown) {
    return this.programmes.creer(utilisateur, objet<CorpsCreationProgramme>(corps))
  }

  @Get(':id')
  @Roles(...ROLES_LECTURE)
  detail(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.programmes.detail(utilisateur, id)
  }

  @Patch(':id')
  @Roles(...ROLES_GESTION)
  modifier(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string, @Body() corps: unknown) {
    return this.programmes.modifier(utilisateur, id, objet<CorpsModificationProgramme>(corps))
  }

  @Delete(':id')
  @Roles(...ROLES_GESTION)
  supprimer(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.programmes.supprimer(utilisateur, id)
  }

  @Post(':id/lignes')
  @HttpCode(201)
  @Roles(...ROLES_GESTION)
  ajouterLigne(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string, @Body() corps: unknown) {
    return this.programmes.ajouterLigne(utilisateur, id, objet<CorpsLigne>(corps))
  }

  @Patch(':id/lignes/:ligneId')
  @Roles(...ROLES_GESTION)
  modifierLigne(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Param('ligneId') ligneId: string,
    @Body() corps: unknown,
  ) {
    return this.programmes.modifierLigne(utilisateur, id, ligneId, objet<CorpsLigne>(corps))
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
