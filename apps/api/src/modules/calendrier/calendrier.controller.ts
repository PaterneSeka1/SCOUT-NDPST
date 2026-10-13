import { Controller, Delete, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { ROLES_TOUT_STAFF } from '@scout/shared'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UtilisateurCourant } from '../../common/decorators/utilisateur-courant.decorator'
import type { UtilisateurSession } from '../../common/types'
import { CalendrierService } from './calendrier.service'

// Premier élément d'un paramètre de requête (comme URLSearchParams.get),
// jamais un tableau ou un objet.
function premiereValeur(valeur: unknown): string | undefined {
  const v = Array.isArray(valeur) ? valeur[0] : valeur
  return typeof v === 'string' ? v : undefined
}

@ApiTags('Calendrier')
@Controller('calendrier')
export class CalendrierController {
  constructor(private readonly calendrier: CalendrierService) {}

  @Get()
  @Roles(...ROLES_TOUT_STAFF)
  evenements(@UtilisateurCourant() utilisateur: UtilisateurSession, @Query('mois') mois: unknown) {
    return this.calendrier.evenementsDuMois(utilisateur, premiereValeur(mois))
  }

  // Public : flux iCal authentifié par le jeton personnel passé en paramètre
  // (Google Calendar, Apple Calendar, Outlook… ne peuvent pas présenter de
  // session), avec limitation de débit par IP.
  @Public()
  @Get('ics')
  async ics(@Query('token') token: unknown, @Req() requete: Request, @Res() reponse: Response) {
    // IP réelle du client : Express la lit dans X-Forwarded-For selon
    // TRUST_PROXY (configuré dans main.ts), jamais directement depuis l'en-tête.
    const contenu = await this.calendrier.fluxIcs(premiereValeur(token), requete.ip ?? 'ip-inconnue')
    reponse.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="scout-ascci.ics"',
      'Cache-Control': 'private, max-age=1800',
    })
    reponse.status(200).send(contenu)
  }

  @Post('token')
  @HttpCode(200)
  @Roles(...ROLES_TOUT_STAFF)
  genererJeton(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.calendrier.genererJeton(utilisateur.id)
  }

  // Révocation ouverte à tout compte authentifié (comme la route d'origine) :
  // un compte qui a perdu son rôle doit pouvoir couper son flux.
  @Delete('token')
  revoquerJeton(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return this.calendrier.revoquerJeton(utilisateur.id)
  }
}
