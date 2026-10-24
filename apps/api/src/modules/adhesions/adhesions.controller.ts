import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { ROLES_ADMIN, ROLES_GROUPE_ETENDU } from '@scout/shared'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import {
  SchemaDemandePublique,
  SchemaTraitementDemande,
  type CorpsDemandePublique,
  type CorpsTraitementDemande,
} from './adhesions.schemas'
import { AdhesionsService } from './adhesions.service'

@ApiTags('Site public')
@Controller('public/demandes')
export class PublicDemandesController {
  constructor(private readonly adhesions: AdhesionsService) {}

  // Public : formulaire « Nous rejoindre » et « Contact ». Limité par IP,
  // protégé par un champ piège et un délai minimal de saisie.
  @Public()
  @Post()
  @HttpCode(201)
  recevoir(@Body(new ZodPipe(SchemaDemandePublique)) corps: CorpsDemandePublique, @Req() requete: Request) {
    return this.adhesions.recevoir(corps, requete.ip ?? 'ip-inconnue')
  }
}

// Traitement des demandes : administrateur et direction du groupe.
@ApiTags('Administration')
@Roles(...ROLES_ADMIN, ...ROLES_GROUPE_ETENDU)
@Controller('admin/demandes')
export class AdminDemandesController {
  constructor(private readonly adhesions: AdhesionsService) {}

  @Get()
  lister(@Query() requete: Record<string, unknown>) {
    return this.adhesions.lister(requete)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.adhesions.detail(id)
  }

  @Patch(':id')
  traiter(
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaTraitementDemande)) corps: CorpsTraitementDemande,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.adhesions.traiter(id, corps, utilisateur.id)
  }
}
