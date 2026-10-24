import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { CLE_PUBLIC } from '../decorators/public.decorator'
import type { RequeteAuthentifiee, UtilisateurSession } from '../types'
import { COOKIE_ACCES } from '../../auth/cookies'
import { env } from '../../config/env'
import { PrismaService } from '../../prisma/prisma.service'
import { CLE_MOT_DE_PASSE_TEMPORAIRE } from '../decorators/mot-de-passe-temporaire.decorator'

type ChargeJeton = Omit<UtilisateurSession, 'id'> & { sub: string; sid?: string }

// Garde globale : refuse par défaut toute route non marquée @Public().
// Le jeton d'accès est lu dans le cookie httpOnly (navigateur) ou dans
// l'en-tête Authorization: Bearer (scripts, clients autorisés). Sur une route publique, un jeton valide est tout de même décodé
// (identité optionnelle), un jeton invalide est ignoré.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(contexte: ExecutionContext): Promise<boolean> {
    const estPublique = this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, [
      contexte.getHandler(),
      contexte.getClass(),
    ])
    const requete = contexte.switchToHttp().getRequest<RequeteAuthentifiee>()
    const jeton = extraireJeton(requete)

    if (jeton) {
      try {
        requete.utilisateur = await this.verifier(jeton)
      } catch {
        if (!estPublique) throw new UnauthorizedException('Session expirée')
      }
    }

    if (estPublique) return true
    if (!requete.utilisateur) throw new UnauthorizedException('Non authentifié')
    if (
      requete.utilisateur.doitChangerMotDePasse &&
      !this.reflector.getAllAndOverride<boolean>(CLE_MOT_DE_PASSE_TEMPORAIRE, [
        contexte.getHandler(),
        contexte.getClass(),
      ])
    ) {
      throw new ForbiddenException({
        code: 'CHANGEMENT_MOT_DE_PASSE_REQUIS',
        erreur: 'Définissez votre mot de passe personnel avant de continuer',
      })
    }
    return true
  }

  // Jetons HS256 signés par cette installation uniquement : l'algorithme et
  // l'émetteur sont imposés, jamais déduits du jeton.
  private async verifier(jeton: string): Promise<UtilisateurSession> {
    const charge = await this.jwt.verifyAsync<ChargeJeton>(jeton, {
      secret: env().JWT_ACCESS_SECRET,
      algorithms: ['HS256'],
      issuer: env().INSTALLATION_ID,
    })
    return this.verifierSessionLocale(charge)
  }

  private async verifierSessionLocale(charge: ChargeJeton): Promise<UtilisateurSession> {
    if (!charge.sid || !charge.sub) throw new UnauthorizedException('Session à renouveler')
    const session = await this.prisma.sessionUtilisateur.findUnique({
      where: { id: charge.sid },
      select: {
        utilisateurId: true,
        revoqueeLe: true,
        expireLe: true,
        utilisateur: {
          select: {
            id: true,
            matricule: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            editeurContenu: true,
            actif: true,
            doitChangerMotDePasse: true,
          },
        },
      },
    })
    const u = session?.utilisateur
    if (
      !session ||
      session.utilisateurId !== charge.sub ||
      session.revoqueeLe ||
      session.expireLe <= new Date() ||
      !u?.actif ||
      u.role !== charge.role
    ) {
      throw new UnauthorizedException('Session expirée')
    }
    return {
      id: u.id,
      matricule: u.matricule,
      email: u.email ?? '',
      nom: u.nom,
      prenom: u.prenom,
      role: u.role,
      editeurContenu: u.editeurContenu,
      doitChangerMotDePasse: u.doitChangerMotDePasse,
    }
  }
}


function extraireJeton(requete: RequeteAuthentifiee): string | null {
  const entete = requete.headers.authorization
  if (entete?.startsWith('Bearer ')) return entete.slice('Bearer '.length).trim() || null
  const cookies = requete.cookies as Record<string, string> | undefined
  return cookies?.[COOKIE_ACCES] ?? null
}
