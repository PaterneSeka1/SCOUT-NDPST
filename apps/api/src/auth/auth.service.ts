import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { compare } from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import type { Prisma } from '../generated/prisma/client'
import { env } from '../config/env'
import { limiteAtteinte, limiterTaux } from '../common/lib/rateLimit'
import { logger } from '../common/lib/logger'
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
  editeurContenu: true,
  actif: true,
  doitChangerMotDePasse: true,
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
      logger.warn('auth.rate_limit', {
        ip,
        parIdentifiantIp: atteintes[0],
        parIp: atteintes[1],
        parIdentifiant: atteintes[2],
      })
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
    // compte existe ou est désactivé.
    const echec = async () => {
      await Promise.all(limites.map(([cle, max]) => limiterTaux(cle, max, FENETRE_CONNEXION_MS)))
      logger.warn('auth.connexion_refusee', { ip })
      return new UnauthorizedException('Identifiant ou mot de passe incorrect')
    }
    if (!utilisateur || !utilisateur.actif) throw await echec()
    if (!(await compare(motDePasse, utilisateur.password))) throw await echec()

    const jetonSession = genererJeton()
    const sessionExpireLe = new Date(Date.now() + env().SESSION_TTL_SECONDES * 1000)
    const { sessionCreee, courant } = await this.prisma.$transaction(async (tx) => {
      // Le hash peut avoir changé pendant bcrypt. Sérialiser la création de
      // session avec UPDATE Utilisateur (changement/reset) empêche un ancien
      // secret de créer une session après la révocation transactionnelle.
      await tx.$queryRaw`SELECT id FROM "Utilisateur" WHERE id = ${utilisateur.id} FOR UPDATE`
      const courant = await tx.utilisateur.findUnique({
        where: { id: utilisateur.id },
        select: { ...SELECTION_UTILISATEUR, password: true },
      })
      if (!courant?.actif || courant.password !== utilisateur.password) {
        throw new UnauthorizedException('Identifiant ou mot de passe incorrect')
      }
      const sessionCreee = await tx.sessionUtilisateur.create({
        data: {
          utilisateurId: utilisateur.id,
          empreinteJeton: empreinte(jetonSession),
          expireLe: sessionExpireLe,
          agentUtilisateur: agent?.slice(0, 200) ?? null,
        },
      })
      return { sessionCreee, courant }
    })

    logger.info('auth.connexion_reussie', { utilisateurId: utilisateur.id, sessionId: sessionCreee.id })
    const session = versSession(courant)
    return {
      utilisateur: session,
      jetonAcces: await this.signerAcces(session, sessionCreee.id),
      jetonSession,
      sessionExpireLe,
    }
  }

  // Émet un nouveau jeton d'accès à partir du jeton de session, après avoir
  // relu en base le rôle et le statut actif du compte.
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
    if (!utilisateur.actif) {
      await this.revoquer(session.id)
      throw expiree
    }

    const identite = versSession(utilisateur)
    const jetonAcces = await this.signerAcces(identite, session.id)

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
    const rotation = await this.prisma.sessionUtilisateur.updateMany({
      where: { id: session.id, empreinteJeton: hash, revoqueeLe: null, expireLe: { gt: maintenant } },
      data: {
        empreinteJeton: empreinte(nouveauJeton),
        ancienneEmpreinte: hash,
        ancienneValideJusqua: new Date(maintenant.getTime() + GRACE_ROTATION_MS),
      },
    })
    if (rotation.count !== 1) {
      // Deux requêtes peuvent avoir lu le même jeton courant. Seule la
      // gagnante pose un nouveau cookie ; la perdante utilise la grâce sans
      // écraser ce cookie par un secret qui n'existe plus en base.
      const courante = await this.prisma.sessionUtilisateur.findFirst({
        where: { id: session.id, revoqueeLe: null, expireLe: { gt: new Date() } },
      })
      if (
        !courante ||
        courante.ancienneEmpreinte !== hash ||
        !courante.ancienneValideJusqua ||
        courante.ancienneValideJusqua <= new Date()
      )
        throw expiree
      return { utilisateur: identite, jetonAcces, sessionExpireLe: session.expireLe }
    }
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
  async revoquerToutes(utilisateurId: string, transaction?: Prisma.TransactionClient): Promise<void> {
    await (transaction ?? this.prisma).sessionUtilisateur.updateMany({
      where: { utilisateurId, revoqueeLe: null },
      data: { revoqueeLe: new Date() },
    })
    if (!transaction) logger.info('auth.sessions_revoquees', { utilisateurId })
  }

  private async revoquer(sessionId: string) {
    await this.prisma.sessionUtilisateur.update({ where: { id: sessionId }, data: { revoqueeLe: new Date() } })
  }

  private signerAcces(session: UtilisateurSession, sessionId: string): Promise<string> {
    const { id, ...identite } = session
    const charge = { ...identite, sid: sessionId }
    return this.jwt.signAsync(charge, {
      subject: id,
      issuer: env().INSTALLATION_ID,
      expiresIn: env().JWT_ACCESS_TTL_SECONDES,
      secret: env().JWT_ACCESS_SECRET,
      algorithm: 'HS256',
    })
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
  editeurContenu: boolean
  doitChangerMotDePasse?: boolean
}): UtilisateurSession {
  return {
    id: u.id,
    matricule: u.matricule,
    email: u.email ?? '',
    nom: u.nom,
    prenom: u.prenom,
    role: u.role,
    editeurContenu: u.editeurContenu,
    doitChangerMotDePasse: u.doitChangerMotDePasse ?? false,
  }
}
