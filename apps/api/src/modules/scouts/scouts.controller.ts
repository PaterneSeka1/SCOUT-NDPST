import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ROLES_GROUPE, ROLES_GROUPE_ETENDU, ROLES_TOUT_STAFF } from '@scout/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { premiereValeur } from './corps'
import { FicheScoutService } from './fiche-scout.service'
import { PassageBrancheService } from './passage-branche.service'
import { ProgressionsService } from './progressions.service'
import { ScoutsService } from './scouts.service'

// Ordre de déclaration significatif : les routes statiques (import,
// passage-branche) doivent précéder `:id`, sinon GET /scouts/passage-branche
// serait capturé par GET /scouts/:id.
@ApiTags('Scouts')
@Controller('scouts')
export class ScoutsController {
  constructor(
    private readonly scouts: ScoutsService,
    private readonly fiche: FicheScoutService,
    private readonly progressions: ProgressionsService,
    private readonly passages: PassageBrancheService,
  ) {}

  @Get()
  @Roles(...ROLES_TOUT_STAFF)
  lister(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Query('page') page?: unknown,
    @Query('limite') limite?: unknown,
    @Query('recherche') recherche?: unknown,
    @Query('actif') actif?: unknown,
    @Query('branche') branche?: unknown,
  ) {
    return this.scouts.lister(utilisateur, {
      page: premiereValeur(page),
      limite: premiereValeur(limite),
      recherche: premiereValeur(recherche),
      actif: premiereValeur(actif),
      branche: premiereValeur(branche),
    })
  }

  @Post()
  @HttpCode(201)
  @Roles(...ROLES_TOUT_STAFF)
  creer(@UtilisateurCourant() utilisateur: UtilisateurSession, @Body() corps: unknown) {
    return this.scouts.creer(utilisateur, corps)
  }

  // Import en masse (lignes déjà extraites du fichier côté client) : rapport
  // ligne par ligne, statut 200 même en cas d'échecs partiels.
  @Post('import')
  @HttpCode(200)
  @Roles(...ROLES_TOUT_STAFF)
  importer(@UtilisateurCourant() utilisateur: UtilisateurSession, @Body() corps: unknown) {
    return this.scouts.importer(utilisateur, corps)
  }

  @Get('passage-branche')
  @Roles(...ROLES_GROUPE)
  previsualiserPassages(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Query('dateReference') dateReference?: unknown,
  ) {
    return this.passages.previsualiser(utilisateur, premiereValeur(dateReference))
  }

  @Post('passage-branche')
  @HttpCode(200)
  @Roles(...ROLES_GROUPE)
  appliquerPassages(@UtilisateurCourant() utilisateur: UtilisateurSession, @Body() corps: unknown) {
    return this.passages.appliquer(utilisateur, corps)
  }

  // Pas de @Roles : un SCOUT peut consulter sa propre fiche (contrôle dans le service).
  @Get(':id')
  detail(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.scouts.detail(utilisateur, id)
  }

  @Put(':id')
  @Roles(...ROLES_TOUT_STAFF)
  modifier(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string, @Body() corps: unknown) {
    return this.scouts.modifier(utilisateur, id, corps)
  }

  @Post(':id/compte')
  @HttpCode(201)
  @Roles(...ROLES_GROUPE_ETENDU)
  creerCompte(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string, @Body() corps: unknown) {
    return this.scouts.creerCompte(utilisateur, id, corps)
  }

  @Put(':id/matricule')
  @Roles(...ROLES_GROUPE_ETENDU)
  attribuerMatricule(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body() corps: unknown,
  ) {
    return this.scouts.attribuerMatricule(utilisateur, id, corps)
  }

  @Post(':id/contacts')
  @HttpCode(201)
  @Roles(...ROLES_TOUT_STAFF)
  ajouterContact(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string, @Body() corps: unknown) {
    return this.fiche.ajouterContact(utilisateur, id, corps)
  }

  @Put(':id/contacts/:contactId')
  @Roles(...ROLES_TOUT_STAFF)
  modifierContact(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() corps: unknown,
  ) {
    return this.fiche.modifierContact(utilisateur, id, contactId, corps)
  }

  @Delete(':id/contacts/:contactId')
  @Roles(...ROLES_TOUT_STAFF)
  supprimerContact(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ) {
    return this.fiche.supprimerContact(utilisateur, id, contactId)
  }

  @Post(':id/documents')
  @HttpCode(201)
  @Roles(...ROLES_TOUT_STAFF)
  ajouterDocument(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body() corps: unknown,
  ) {
    return this.fiche.ajouterDocument(utilisateur, id, corps)
  }

  @Delete(':id/documents/:documentId')
  @Roles(...ROLES_TOUT_STAFF)
  supprimerDocument(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.fiche.supprimerDocument(utilisateur, id, documentId)
  }

  // Pas de @Roles : l'accès dépend du rôle de branche OU de l'affectation
  // district (ASSISTANT_DISTRICT), vérifié scout par scout dans le service.
  @Get(':id/progressions')
  listerProgressions(@UtilisateurCourant() utilisateur: UtilisateurSession, @Param('id') id: string) {
    return this.progressions.lister(utilisateur, id)
  }

  @Post(':id/progressions')
  @HttpCode(201)
  validerProgression(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('id') id: string,
    @Body() corps: unknown,
  ) {
    return this.progressions.valider(utilisateur, id, corps)
  }
}
