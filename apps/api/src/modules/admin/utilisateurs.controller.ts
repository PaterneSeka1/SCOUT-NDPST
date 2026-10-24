import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_ADMIN } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import {
  SchemaCreationUtilisateur,
  SchemaFiltresUtilisateurs,
  SchemaModificationUtilisateur,
  SchemaMotDePasseAdmin,
  type DonneesCreationUtilisateur,
  type DonneesModificationUtilisateur,
  type DonneesMotDePasseAdmin,
  type FiltresUtilisateurs,
} from './utilisateurs.schemas'
import { UtilisateursService } from './utilisateurs.service'

// Gestion de tous les comptes de l'installation, réservée à l'administrateur.
@ApiTags('Administration')
@Roles(...ROLES_ADMIN)
@Controller('admin/utilisateurs')
export class AdminUtilisateursController {
  constructor(private readonly utilisateurs: UtilisateursService) {}

  @Get()
  lister(@Query(new ZodPipe(SchemaFiltresUtilisateurs)) filtres: FiltresUtilisateurs) {
    return this.utilisateurs.lister(filtres)
  }

  @Post()
  @HttpCode(201)
  creer(
    @Body(new ZodPipe(SchemaCreationUtilisateur)) corps: DonneesCreationUtilisateur,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.utilisateurs.creer(corps, utilisateur.id)
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.utilisateurs.detail(id)
  }

  @Get(':id/mandats')
  mandats(@Param('id') id: string) {
    return this.utilisateurs.mandats(id)
  }

  @Put(':id')
  modifier(
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationUtilisateur)) corps: DonneesModificationUtilisateur,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.utilisateurs.modifier(id, corps, utilisateur.id)
  }

  // Désactivation (jamais de suppression physique d'un compte).
  @Delete(':id')
  desactiver(@Param('id') id: string, @UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.utilisateurs.desactiver(id, utilisateur.id)
  }

  @Put(':id/password')
  changerMotDePasse(
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaMotDePasseAdmin)) corps: DonneesMotDePasseAdmin,
    @UtilisateurCourant() utilisateur: UtilisateurSession,
  ) {
    return this.utilisateurs.changerMotDePasse(id, corps, utilisateur.id)
  }
}
