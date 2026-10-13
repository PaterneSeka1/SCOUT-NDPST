import { Body, Controller, Get, HttpCode, Param, Post, Put, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { effacerCookies } from '../../auth/cookies'
import { corpsObjet } from '../utilisateurs/corps'
import { ProfilService } from './profil.service'

// Espace personnel : accessible à tout utilisateur authentifié, sans
// restriction de rôle. Chaque route n'agit que sur le compte de la session
// (jamais sur un id transmis), et mes-enfants sur les seuls scouts rattachés
// au compte par LienParentScout.
@ApiTags('Profil')
@Controller()
export class ProfilController {
  constructor(private readonly profil: ProfilService) {}

  @Get('me')
  lire(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.profil.profil(utilisateur)
  }

  @Put('me')
  modifier(@UtilisateurCourant() utilisateur: UtilisateurSession, @Body() corps: unknown) {
    return this.profil.modifierProfil(utilisateur, corpsObjet(corps))
  }

  @Get('me/branche')
  branche(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.profil.branche(utilisateur)
  }

  // Après le changement, toutes les sessions du compte sont révoquées et les
  // cookies de la session courante effacés : l'utilisateur doit se reconnecter.
  @Put('me/password')
  async changerMotDePasse(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Body() corps: unknown,
    @Res({ passthrough: true }) reponse: Response,
  ) {
    const resultat = await this.profil.changerMotDePasse(utilisateur, corpsObjet(corps))
    effacerCookies(reponse)
    return resultat
  }

  @Get('mes-enfants')
  mesEnfants(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.profil.mesEnfants(utilisateur)
  }

  // 200 comme la route Next (mise à jour, pas création).
  @Post('mes-enfants/:scoutId/consentement-image')
  @HttpCode(200)
  consentementImage(
    @UtilisateurCourant() utilisateur: UtilisateurSession,
    @Param('scoutId') scoutId: string,
    @Body() corps: unknown,
  ) {
    return this.profil.consentementImage(utilisateur, scoutId, corpsObjet(corps))
  }

  @Get('ma-progression')
  maProgression(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.profil.maProgression(utilisateur)
  }
}
