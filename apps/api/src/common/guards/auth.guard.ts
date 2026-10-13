import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { CLE_PUBLIC } from '../decorators/public.decorator'
import type { RequeteAuthentifiee, UtilisateurSession } from '../types'
import { COOKIE_ACCES } from '../../auth/cookies'
import { ALGORITHME_ADMIN, clesAdmin } from '../../auth/cles-admin'
import { env } from '../../config/env'

type ChargeJeton = Omit<UtilisateurSession, 'id' | 'externe'> & { sub: string; iss?: string }

// Garde globale : refuse par défaut toute route non marquée @Public().
// Le jeton d'accès est lu dans le cookie httpOnly (navigateur) ou dans
// l'en-tête Authorization: Bearer (autres clients : futures plateformes,
// scripts). Sur une route publique, un jeton valide est tout de même décodé
// (identité optionnelle), un jeton invalide est ignoré.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
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
    return true
  }

  // Deux familles de jetons, jamais interchangeables :
  // - HS256 : comptes de CETTE installation, signés avec son secret ;
  // - ES256 : administrateur plateforme partagé, signé par l'installation qui
  //   héberge le compte et vérifié avec sa clé publique. L'algorithme et la
  //   clé sont imposés par la famille, jamais choisis d'après le jeton seul.
  private async verifier(jeton: string): Promise<UtilisateurSession> {
    const entete = this.jwt.decode<{ header?: { alg?: string }; payload?: { iss?: string } } | null>(jeton, {
      complete: true,
    })
    const algorithme = entete?.header?.alg

    if (algorithme === 'HS256') {
      const charge = await this.jwt.verifyAsync<ChargeJeton>(jeton, {
        secret: env().JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
        issuer: env().INSTALLATION_ID,
      })
      return versUtilisateur(charge)
    }

    if (algorithme === ALGORITHME_ADMIN) {
      const emetteur = entete?.payload?.iss
      const clePublique = emetteur ? clesAdmin().clesPubliques.get(emetteur) : undefined
      if (!emetteur || !clePublique) throw new UnauthorizedException('Émetteur non reconnu')
      const charge = await this.jwt.verifyAsync<ChargeJeton>(jeton, {
        publicKey: clePublique.export({ type: 'spki', format: 'pem' }).toString(),
        algorithms: [ALGORITHME_ADMIN],
        issuer: emetteur,
      })
      // Seul l'administrateur plateforme circule entre installations.
      if (charge.role !== 'ADMIN_PLATEFORME') throw new UnauthorizedException('Jeton non autorisé')
      const utilisateur = versUtilisateur(charge)
      return emetteur === env().INSTALLATION_ID
        ? utilisateur
        : // Compte d'une autre installation : il n'existe pas dans cette base.
          { ...utilisateur, paroisseId: null, roleDistrict: null, externe: emetteur }
    }

    throw new UnauthorizedException('Algorithme de jeton refusé')
  }
}

function versUtilisateur(charge: ChargeJeton): UtilisateurSession {
  return {
    id: charge.sub,
    matricule: charge.matricule,
    email: charge.email,
    nom: charge.nom,
    prenom: charge.prenom,
    role: charge.role,
    roleDistrict: charge.roleDistrict,
    paroisseId: charge.paroisseId,
  }
}

function extraireJeton(requete: RequeteAuthentifiee): string | null {
  const entete = requete.headers.authorization
  if (entete?.startsWith('Bearer ')) return entete.slice('Bearer '.length).trim() || null
  const cookies = requete.cookies as Record<string, string> | undefined
  return cookies?.[COOKIE_ACCES] ?? null
}
