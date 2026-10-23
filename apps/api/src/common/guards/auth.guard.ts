import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { CLE_PUBLIC } from '../decorators/public.decorator'
import type { RequeteAuthentifiee, UtilisateurSession } from '../types'
import { COOKIE_ACCES } from '../../auth/cookies'
import { ALGORITHME_ADMIN, clesAdmin } from '../../auth/cles-admin'
import { env } from '../../config/env'
import { PrismaService } from '../../prisma/prisma.service'
import { CLE_MOT_DE_PASSE_TEMPORAIRE } from '../decorators/mot-de-passe-temporaire.decorator'

type ChargeJeton = Omit<UtilisateurSession, 'id' | 'externe'> & { sub: string; iss?: string; sid?: string }

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
      return this.verifierSessionLocale(charge)
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
      if (emetteur === env().INSTALLATION_ID) return this.verifierSessionLocale(charge)
      // Vérification en ligne auprès de l'émetteur : aucune fenêtre de droits
      // résiduels ni cache positif. Une installation indisponible ferme l'accès.
      const url = env().ADMIN_URL_VERIFICATION_SESSION
      if (!url) throw new UnauthorizedException('Vérification de session externe non configurée')
      const reponse = await fetch(url, {
        headers: { Authorization: `Bearer ${jeton}` },
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      })
      if (!reponse.ok) throw new UnauthorizedException('Session externe expirée')
      const resultat = (await reponse.json()) as { utilisateur?: UtilisateurSession }
      const courant = resultat.utilisateur
      if (
        !courant ||
        courant.id !== charge.sub ||
        courant.role !== 'ADMIN_PLATEFORME' ||
        courant.externe ||
        courant.doitChangerMotDePasse
      ) {
        throw new UnauthorizedException('Session externe refusée')
      }
      return {
        ...versUtilisateur(charge),
        doitChangerMotDePasse: false,
        paroisseId: null,
        roleDistrict: null,
        externe: emetteur,
      }
    }

    throw new UnauthorizedException('Algorithme de jeton refusé')
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
            roleDistrict: true,
            paroisseId: true,
            actif: true,
            doitChangerMotDePasse: true,
            paroisse: { select: { actif: true } },
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
      (u.paroisse && !u.paroisse.actif) ||
      u.role !== charge.role ||
      u.roleDistrict !== charge.roleDistrict ||
      u.paroisseId !== charge.paroisseId
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
      roleDistrict: u.roleDistrict,
      paroisseId: u.paroisseId,
      doitChangerMotDePasse: u.doitChangerMotDePasse,
    }
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
    doitChangerMotDePasse: charge.doitChangerMotDePasse,
  }
}

function extraireJeton(requete: RequeteAuthentifiee): string | null {
  const entete = requete.headers.authorization
  if (entete?.startsWith('Bearer ')) return entete.slice('Bearer '.length).trim() || null
  const cookies = requete.cookies as Record<string, string> | undefined
  return cookies?.[COOKIE_ACCES] ?? null
}
