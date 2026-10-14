import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { compare } from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { env } from '../config/env'
import { limiteAtteinte, limiterTaux } from '../common/lib/rateLimit'
import { logger } from '../common/lib/logger'
import { ALGORITHME_ADMIN, clesAdmin } from './cles-admin'
import type { UtilisateurSession } from '../common/types'

const MAX_TENTATIVES_CONNEXION = 5
const FENETRE_CONNEXION_MS = 15 * 60 * 1000
// Fenêtre pendant laquelle l'ancien jeton de session reste accepté après une
// rotation : plusieurs requêtes parallèles d'un même navigateur peuvent
// déclencher chacune un rafraîchissement.
const GRACE_ROTATION_MS = 30 * 1000

const SELECTION_UTILISATEUR = {
  id: true,
  matricule: true,
  email: true,
  nom: true,
  prenom: true,
  role: true,
  roleDistrict: true,
  paroisseId: true,
  actif: true,
  paroisse: { select: { actif: true } },
} as const

export interface JetonsEmis {
  utilisateur: UtilisateurSession
  jetonAcces: string
  // Absent quand l'ancien jeton de session a été présenté pendant la fenêtre
  // de grâce : le navigateur détient déjà le nouveau.
  jetonSession?: string
  sessionExpireLe: Date
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async connecter(identifiant: string, motDePasse: string, ip: string, agent?: string): Promise<JetonsEmis> {
    // Seuls les ÉCHECS sont comptés, sur trois compteurs :
    //   - identifiant + IP (5) : brute-force d'un compte depuis une source ;
    //   - IP (20) : credential stuffing depuis une source ;
    //   - identifiant (20) : attaque distribuée sur un compte.
    // Un tiers ne peut donc plus bloquer le compte de quelqu'un d'autre en
    // quelques essais, et une connexion réussie ne consomme rien.
    const limites: [string, number][] = [
      [`login:id-ip:${identifiant}:${ip}`, MAX_TENTATIVES_CONNEXION],
      [`login:ip:${ip}`, MAX_TENTATIVES_CONNEXION * 4],
      [`login:id:${identifiant}`, MAX_TENTATIVES_CONNEXION * 4],
    ]
    const atteintes = await Promise.all(limites.map(([cle, max]) => limiteAtteinte(cle, max)))
    if (atteintes.some(Boolean)) {
      // Jamais l'identifiant (matricule/téléphone = donnée personnelle) dans le log.
      logger.warn('auth.rate_limit', { ip, parIdentifiantIp: atteintes[0], parIp: atteintes[1], parIdentifiant: atteintes[2] })
      throw new HttpException(
        { erreur: 'Trop de tentatives. Réessayez dans quelques minutes.' },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const utilisateur = await this.prisma.utilisateur.findFirst({
      where: { OR: [{ matricule: identifiant }, { telephone: identifiant }] },
      select: { ...SELECTION_UTILISATEUR, password: true },
    })

    // Message identique dans tous les cas d'échec : ne révèle pas si le
    // compte existe, est désactivé ou si sa paroisse l'est.
    const echec = async () => {
      await Promise.all(limites.map(([cle, max]) => limiterTaux(cle, max, FENETRE_CONNEXION_MS)))
      return new UnauthorizedException('Identifiant ou mot de passe incorrect')
    }
    if (!utilisateur || !utilisateur.actif) throw await echec()
    if (utilisateur.paroisse && !utilisateur.paroisse.actif) throw await echec()
    if (!(await compare(motDePasse, utilisateur.password))) throw await echec()

    const jetonSession = genererJeton()
    const sessionExpireLe = new Date(Date.now() + env().SESSION_TTL_SECONDES * 1000)
    await this.prisma.sessionUtilisateur.create({
      data: {
        utilisateurId: utilisateur.id,
        empreinteJeton: empreinte(jetonSession),
        expireLe: sessionExpireLe,
        agentUtilisateur: agent?.slice(0, 200) ?? null,
      },
    })

    const session = versSession(utilisateur)
    return { utilisateur: session, jetonAcces: await this.signerAcces(session), jetonSession, sessionExpireLe }
  }

  // Émet un nouveau jeton d'accès à partir du jeton de session, après avoir
  // relu en base le rôle et le statut actif du compte et de sa paroisse.
  async rafraichir(jetonSession: string): Promise<JetonsEmis> {
    const hash = empreinte(jetonSession)
    const maintenant = new Date()
    const session = await this.prisma.sessionUtilisateur.findFirst({
      where: { OR: [{ empreinteJeton: hash }, { ancienneEmpreinte: hash }] },
      include: { utilisateur: { select: SELECTION_UTILISATEUR } },
    })

    const expiree = new UnauthorizedException('Session expirée')
    if (!session || session.revoqueeLe || session.expireLe <= maintenant) throw expiree

    const { utilisateur } = session
    if (!utilisateur.actif || (utilisateur.paroisse && !utilisateur.paroisse.actif)) {
      await this.revoquer(session.id)
      throw expiree
    }

    const identite = versSession(utilisateur)
    const jetonAcces = await this.signerAcces(identite)

    if (session.empreinteJeton !== hash) {
      // Ancien jeton : accepté seulement pendant la fenêtre de grâce. Au-delà,
      // c'est le signe d'un jeton volé rejoué : la session entière est révoquée.
      if (!session.ancienneValideJusqua || session.ancienneValideJusqua <= maintenant) {
        logger.warn('auth.rejeu_jeton_session', { sessionId: session.id })
        await this.revoquer(session.id)
        throw expiree
      }
      return { utilisateur: identite, jetonAcces, sessionExpireLe: session.expireLe }
    }

    const nouveauJeton = genererJeton()
    await this.prisma.sessionUtilisateur.update({
      where: { id: session.id },
      data: {
        empreinteJeton: empreinte(nouveauJeton),
        ancienneEmpreinte: hash,
        ancienneValideJusqua: new Date(maintenant.getTime() + GRACE_ROTATION_MS),
      },
    })
    return { utilisateur: identite, jetonAcces, jetonSession: nouveauJeton, sessionExpireLe: session.expireLe }
  }

  async deconnecter(jetonSession: string | undefined): Promise<void> {
    if (!jetonSession) return
    const hash = empreinte(jetonSession)
    await this.prisma.sessionUtilisateur.updateMany({
      where: { OR: [{ empreinteJeton: hash }, { ancienneEmpreinte: hash }], revoqueeLe: null },
      data: { revoqueeLe: new Date() },
    })
  }

  // Révoque toutes les sessions d'un compte (changement ou réinitialisation de
  // mot de passe, désactivation).
  async revoquerToutes(utilisateurId: string): Promise<void> {
    await this.prisma.sessionUtilisateur.updateMany({
      where: { utilisateurId, revoqueeLe: null },
      data: { revoqueeLe: new Date() },
    })
  }

  private async revoquer(sessionId: string) {
    await this.prisma.sessionUtilisateur.update({ where: { id: sessionId }, data: { revoqueeLe: new Date() } })
  }

  private signerAcces(session: UtilisateurSession): Promise<string> {
    const { id, ...charge } = session
    const communes = { subject: id, issuer: env().INSTALLATION_ID, expiresIn: env().JWT_ACCESS_TTL_SECONDES }
    // Administrateur plateforme hébergé ici : jeton à clé privée, vérifiable
    // par les autres installations qu'il administre (clé publique seule).
    const { clePrivee } = clesAdmin()
    if (session.role === 'ADMIN_PLATEFORME' && clePrivee) {
      return this.jwt.signAsync(charge, {
        ...communes,
        privateKey: clePrivee.export({ type: 'pkcs8', format: 'pem' }).toString(),
        algorithm: ALGORITHME_ADMIN,
      })
    }
    return this.jwt.signAsync(charge, { ...communes, secret: env().JWT_ACCESS_SECRET, algorithm: 'HS256' })
  }
}

function genererJeton(): string {
  return randomBytes(32).toString('base64url')
}

function empreinte(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex')
}

function versSession(u: {
  id: string
  matricule: string | null
  email: string | null
  nom: string
  prenom: string
  role: string
  roleDistrict: string | null
  paroisseId: string | null
}): UtilisateurSession {
  return {
    id: u.id,
    matricule: u.matricule,
    email: u.email ?? '',
    nom: u.nom,
    prenom: u.prenom,
    role: u.role,
    roleDistrict: u.roleDistrict,
    paroisseId: u.paroisseId,
  }
}
