import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_GROUPE } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../../common/types'
import {
  SchemaCreationUtilisateur,
  SchemaModificationUtilisateur,
  SchemaReinitialisationMotDePasse,
  type CorpsCreationUtilisateur,
  type CorpsModificationUtilisateur,
  type CorpsReinitialisationMotDePasse,
} from './utilisateurs.schemas'
import { UtilisateursService } from './utilisateurs.service'

// Paramètre de query : seule une valeur textuelle unique est retenue
// (Express renvoie un tableau si le paramètre est répété).
function texte(valeur: unknown): string | undefined {
  return typeof valeur === 'string' ? valeur : undefined
}

// Gestion des comptes de la paroisse : réservée au Chef de Groupe
// (ROLES_GROUPE). Le périmètre paroisse et la hiérarchie (pas d'auto-promotion,
// comptes district protégés) sont contrôlés dans le service.
@ApiTags('Utilisateurs')
@Roles(...ROLES_GROUPE)
@Controller('utilisateurs')
export class UtilisateursController {
  constructor(private readonly utilisateurs: UtilisateursService) {}

  @Get()
  lister(@UtilisateurCourant() utilisateur: UtilisateurSession, @Query() query: Record<string, unknown>) {
    return this.utilisateurs.lister(utilisateur, {
      page: texte(query.page),
      limite: texte(query.limite),
      role: texte(query.role),
      recherche: texte(query.recherche),
    })
  }

  // 201 par défaut sur un POST, comme la route Next.
  @Post()
  creer(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Body(new ZodPipe(SchemaCreationUtilisateur)) corps: CorpsCreationUtilisateur,
  ) {
    return this.utilisateurs.creer(utilisateur, corps)
  }

  @Get(':id')
  detail(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.utilisateurs.detail(utilisateur, id)
  }

  @Put(':id')
  modifier(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaModificationUtilisateur)) corps: CorpsModificationUtilisateur,
  ) {
    return this.utilisateurs.modifier(utilisateur, id, corps)
  }

  // Désactivation (jamais de suppression physique).
  @Delete(':id')
  desactiver(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.utilisateurs.desactiver(utilisateur, id)
  }

  @Put(':id/password')
  reinitialiserMotDePasse(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body(new ZodPipe(SchemaReinitialisationMotDePasse)) corps: CorpsReinitialisationMotDePasse,
  ) {
    return this.utilisateurs.reinitialiserMotDePasse(utilisateur, id, corps)
  }
}
