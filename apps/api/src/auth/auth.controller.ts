import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { Public } from '../common/decorators/public.decorator'
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator'
import { ZodPipe } from '../common/pipes/zod.pipe'
import type { UtilisateurSession } from '../common/types'
import { AuthService, type JetonsEmis } from './auth.service'
import { MotDePasseService } from './mot-de-passe.service'
import { COOKIE_SESSION, effacerCookies, poserCookieAcces, poserCookieSession } from './cookies'

const SchemaConnexion = z.object({
  identifiant: z.string().trim().min(1, 'Identifiant requis').max(100),
  password: z.string().min(1, 'Mot de passe requis').max(200),
})

const SchemaDemandeReinitialisation = z.object({
  email: z.string().trim().min(1, 'Email requis').max(254),
})

const SchemaReinitialisation = z.object({
  token: z.string().trim().max(200).default(''),
  motDePasse: z.string().max(200).default(''),
})

// IP réelle du client : Express la lit dans X-Forwarded-For selon TRUST_PROXY
// (configuré dans main.ts), jamais directement depuis l'en-tête.
function ipClient(requete: Request): string {
  return requete.ip ?? 'ip-inconnue'
}

function jetonSessionDe(requete: Request): string | undefined {
  return (requete.cookies as Record<string, string> | undefined)?.[COOKIE_SESSION]
}

function poserCookies(reponse: Response, jetons: JetonsEmis) {
  poserCookieAcces(reponse, jetons.jetonAcces)
  if (jetons.jetonSession) poserCookieSession(reponse, jetons.jetonSession, jetons.sessionExpireLe)
}

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly motDePasse: MotDePasseService,
  ) {}

  // Public : point d'entrée de la connexion, protégé par limitation de débit.
  @Public()
  @Post('connexion')
  @HttpCode(200)
  async connexion(
    @Body(new ZodPipe(SchemaConnexion)) corps: z.infer<typeof SchemaConnexion>,
    @Req() requete: Request,
    @Res({ passthrough: true }) reponse: Response,
  ) {
    const jetons = await this.auth.connecter(
      corps.identifiant,
      corps.password,
      ipClient(requete),
      requete.headers['user-agent'],
    )
    poserCookies(reponse, jetons)
    return { utilisateur: jetons.utilisateur }
  }

  // Public : authentifié par le cookie de session (httpOnly, limité à /api/auth).
  @Public()
  @Post('rafraichir')
  @HttpCode(200)
  async rafraichir(@Req() requete: Request, @Res({ passthrough: true }) reponse: Response) {
    const jeton = jetonSessionDe(requete)
    if (!jeton) throw new UnauthorizedException('Session expirée')
    try {
      const jetons = await this.auth.rafraichir(jeton)
      poserCookies(reponse, jetons)
      return { utilisateur: jetons.utilisateur }
    } catch (erreur) {
      effacerCookies(reponse)
      throw erreur
    }
  }

  // Public : doit fonctionner même avec un jeton d'accès expiré.
  @Public()
  @Post('deconnexion')
  @HttpCode(200)
  async deconnexion(@Req() requete: Request, @Res({ passthrough: true }) reponse: Response) {
    await this.auth.deconnecter(jetonSessionDe(requete))
    effacerCookies(reponse)
    return { ok: true }
  }

  @Get('session')
  session(@UtilisateurCourant() utilisateur: UtilisateurSession) {
    return { utilisateur }
  }

  // Public : demande de lien de réinitialisation (réponse identique que le
  // compte existe ou non, limitation de débit par IP et par adresse).
  @Public()
  @Post('mot-de-passe-oublie')
  @HttpCode(200)
  demanderReinitialisation(
    @Body(new ZodPipe(SchemaDemandeReinitialisation)) corps: z.infer<typeof SchemaDemandeReinitialisation>,
    @Req() requete: Request,
  ) {
    return this.motDePasse.demanderReinitialisation(corps.email, ipClient(requete))
  }

  // Public : vérifie un lien reçu par e-mail avant d'afficher le formulaire.
  @Public()
  @Get('reinitialiser-motdepasse')
  verifierLien(@Query('token') token?: string) {
    return this.motDePasse.verifierLien(typeof token === 'string' ? token.trim().slice(0, 200) : '')
  }

  // Public : consomme un lien de réinitialisation à usage unique.
  @Public()
  @Post('reinitialiser-motdepasse')
  @HttpCode(200)
  reinitialiser(
    @Body(new ZodPipe(SchemaReinitialisation)) corps: z.infer<typeof SchemaReinitialisation>,
    @Req() requete: Request,
  ) {
    return this.motDePasse.reinitialiser(corps.token, corps.motDePasse, ipClient(requete))
  }
}
